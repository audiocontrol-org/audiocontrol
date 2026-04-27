//! Closed-loop locate controller.
//!
//! Given an SPP-derived target bar, drive LUNA's playhead to that
//! target by iteratively emitting `BarForward` / `BarBackward`
//! actions and reading LUNA's MCU position feedback to verify each
//! step landed. Converges on the target or reports one of several
//! well-defined failure modes — it never loops indefinitely.
//!
//! The controller is split in two:
//!
//! - `plan_step` is a pure function: given the current and target
//!   bars and the sign of the previous delta, it returns the next
//!   move. Fully unit-tested in isolation.
//! - `LocateController::run` orchestrates the I/O around
//!   `plan_step`: emit the Action via a `Backend`, block on
//!   position updates from a `PositionSource`, handle competing
//!   events (target-coalescing SPP, Stop cancel, queued Start) via
//!   an `EventSource`.
//!
//! The two trait abstractions (`PositionSource`, `EventSource`) are
//! there so `run` can be unit-tested against fakes. In production,
//! the main event loop wires them to mpsc channels driven by the
//! MCU-input parser and the transport-MIDI callback respectively.

use anyhow::Result;
use std::time::{Duration, Instant};
use tracing::{info, warn};

use crate::backend::Backend;
use crate::state::{Action, TransportEvent};

/// Configuration knobs for a locate run. Loaded from the `[locate]`
/// TOML section.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LocateConfig {
    /// Hard cap on bar-nudge iterations. At 1 bar per iteration this
    /// also caps the maximum locate distance. Default 128 bars.
    pub max_iterations: u32,

    /// Per-iteration timeout. If LUNA hasn't pushed a new bar value
    /// within this window after our nudge, we consider the MCU
    /// feedback broken and abort. The observed keystroke-to-update
    /// latency during Phase 3c was ~55 ms; 500 ms gives almost
    /// 10x headroom.
    pub position_timeout: Duration,

    /// Maximum time to wait for an *initial* position reading from
    /// LUNA before the first iteration. Generally longer than
    /// position_timeout to tolerate the post-reconnect handshake
    /// "dead window" where LUNA's position stream is briefly quiet.
    pub initial_position_timeout: Duration,
}

impl Default for LocateConfig {
    fn default() -> Self {
        Self {
            max_iterations: 128,
            position_timeout: Duration::from_millis(500),
            initial_position_timeout: Duration::from_secs(3),
        }
    }
}

/// The decision `plan_step` returns to `run`. Keeps the pure
/// planning logic isolated from the I/O.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepDecision {
    /// Current bar matches target; locate is done.
    Reached,
    /// The previous delta sign disagrees with the new one — a single
    /// nudge overshot past zero, so either LUNA's nudge resolution
    /// is > 1 bar or we're dealing with a non-monotonic response.
    /// Either way, abort.
    Oscillation,
    /// Emit this action and wait for the next position update.
    Emit(Action),
}

/// Pure step logic. `prev_delta_sign` is 0 on the first iteration
/// (no previous delta to compare against).
pub fn plan_step(current: u32, target: u32, prev_delta_sign: i32) -> StepDecision {
    if current == target {
        return StepDecision::Reached;
    }
    let delta_sign: i32 = if target > current { 1 } else { -1 };
    if prev_delta_sign != 0 && prev_delta_sign != delta_sign {
        return StepDecision::Oscillation;
    }
    StepDecision::Emit(if delta_sign > 0 {
        Action::BarForward
    } else {
        Action::BarBackward
    })
}

/// Final outcome of a `LocateController::run` call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LocateOutcome {
    /// Landed on the target. `queued_start` is true if a Start or
    /// Continue event arrived mid-locate — the caller should emit
    /// `Action::Play` to resume playback from the located position.
    Reached {
        iterations: u32,
        queued_start: bool,
        final_bar: u32,
    },
    /// Stop event arrived during locate. No post-locate playback.
    Cancelled { iterations: u32 },
    /// One nudge moved past the target — LUNA's nudge resolution is
    /// > 1 bar. Actionable config error, not a silent oscillation.
    NudgeTooLarge { iterations: u32 },
    /// No position feedback from LUNA within the configured timeout.
    /// Possible causes: LUNA disconnected, MCU surface not active,
    /// bridge lost its UniqueID. Caller should log and abort cleanly.
    Timeout { iterations: u32, last_known_bar: Option<u32> },
    /// Hit the iteration cap without reaching the target. Usually
    /// means a distance that exceeds `max_iterations`; raise the cap
    /// or bug-report.
    IterationCap { last_known_bar: u32 },
    /// LUNA never pushed an initial position reading — happens if
    /// the MCU surface isn't activated or has gone quiet. Distinct
    /// from `Timeout` so the caller can surface a more specific
    /// error message.
    NoInitialPosition,
}

/// Abstracts "how do I get a bar-position update?" so the controller
/// can be unit-tested without a live MCU stream.
pub trait PositionSource {
    /// Current known bar. `None` if no position has been seen yet.
    fn current_bar(&self) -> Option<u32>;

    /// Block until a new position reading arrives that changes the
    /// composed bar value, or until `timeout` elapses. Returns the
    /// new bar, or `None` on timeout.
    fn wait_for_position_change(&mut self, timeout: Duration) -> Option<u32>;
}

/// Competing events the controller may observe during a locate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocateEvent {
    /// User hit a new SPP — target is updated in place.
    NewTarget(u32),
    /// User hit Stop — cancel the locate.
    Stop,
    /// User hit Start or Continue — set the queued-play flag and
    /// keep locating. The main loop will emit `Play` after the
    /// locate completes.
    QueuePlay,
}

/// Abstracts "is there a competing event right now?" for the
/// controller. In production, backed by the transport-event mpsc
/// channel. In tests, a Vec-backed queue.
pub trait EventSource {
    /// Non-blocking check for a pending event. Returns `None` if
    /// nothing is waiting.
    fn try_recv(&mut self) -> Option<LocateEvent>;
}

/// Orchestrates a closed-loop locate against the supplied position
/// source, event source, and backend. See module docs for the split
/// of responsibilities between `plan_step` and `run`.
pub struct LocateController<'a> {
    pub position: &'a mut dyn PositionSource,
    pub events: &'a mut dyn EventSource,
    pub backend: &'a mut dyn Backend,
    pub config: LocateConfig,
}

/// Running tally of per-iteration wait latencies, for end-of-locate
/// summary logging. Keeps just enough state to report min / max /
/// average without carrying the full series.
#[derive(Debug, Default)]
struct LatencyStats {
    count: u32,
    sum_ms: u128,
    min_ms: Option<u128>,
    max_ms: Option<u128>,
}

impl LatencyStats {
    fn record(&mut self, wait_ms: u128) {
        self.count += 1;
        self.sum_ms += wait_ms;
        self.min_ms = Some(self.min_ms.map_or(wait_ms, |m| m.min(wait_ms)));
        self.max_ms = Some(self.max_ms.map_or(wait_ms, |m| m.max(wait_ms)));
    }

    fn avg_ms(&self) -> u128 {
        if self.count == 0 {
            0
        } else {
            self.sum_ms / self.count as u128
        }
    }
}

impl<'a> LocateController<'a> {
    /// Drive the closed-loop locate. Blocks until the locate reaches
    /// the target, is cancelled, times out, or hits a safety cap.
    pub fn run(self, initial_target: u32) -> Result<LocateOutcome> {
        let locate_start = Instant::now();
        let mut target = initial_target;
        let mut queued_start = false;
        let mut iterations: u32 = 0;
        let mut prev_delta_sign: i32 = 0;
        let mut stats = LatencyStats::default();

        // Block on the first position reading. Covers the
        // reconnection-quirk case documented in MCU-NOTES.md where
        // LUNA pauses its position-display stream during the
        // surface-init handshake.
        let start_bar = match self.position.current_bar() {
            Some(b) => b,
            None => match self
                .position
                .wait_for_position_change(self.config.initial_position_timeout)
            {
                Some(b) => b,
                None => {
                    warn!(
                        timeout_ms = self.config.initial_position_timeout.as_millis() as u64,
                        "locate: no initial position from LUNA — aborting"
                    );
                    return Ok(LocateOutcome::NoInitialPosition);
                }
            },
        };
        info!(target, start_bar, "locate begin");

        loop {
            // Drain any competing events before deciding the next
            // step. Multiple SPPs in quick succession get coalesced
            // to the latest target naturally — try_recv loops until
            // the queue is empty, so the last NewTarget wins.
            while let Some(event) = self.events.try_recv() {
                match event {
                    LocateEvent::NewTarget(t) => {
                        info!(iterations, old_target = target, new_target = t, "locate: target coalesced");
                        target = t;
                    }
                    LocateEvent::Stop => {
                        log_locate_exit("cancelled by Stop", iterations, target, &stats, locate_start);
                        return Ok(LocateOutcome::Cancelled { iterations });
                    }
                    LocateEvent::QueuePlay => {
                        info!(iterations, "locate: Start/Continue queued for after completion");
                        queued_start = true;
                    }
                }
            }

            let current = self.position.current_bar().unwrap_or(start_bar);

            match plan_step(current, target, prev_delta_sign) {
                StepDecision::Reached => {
                    log_locate_exit("reached", iterations, target, &stats, locate_start);
                    return Ok(LocateOutcome::Reached {
                        iterations,
                        queued_start,
                        final_bar: current,
                    });
                }
                StepDecision::Oscillation => {
                    warn!(
                        iterations,
                        current,
                        target,
                        "locate: overshoot detected — DAW's nudge resolution appears to be > 1 bar"
                    );
                    log_locate_exit("NudgeTooLarge", iterations, target, &stats, locate_start);
                    return Ok(LocateOutcome::NudgeTooLarge { iterations });
                }
                StepDecision::Emit(action) => {
                    if iterations >= self.config.max_iterations {
                        warn!(
                            iterations,
                            current, target, "locate: iteration cap reached without landing"
                        );
                        log_locate_exit("IterationCap", iterations, target, &stats, locate_start);
                        return Ok(LocateOutcome::IterationCap {
                            last_known_bar: current,
                        });
                    }

                    let delta = target as i64 - current as i64;
                    prev_delta_sign = if delta > 0 { 1 } else { -1 };

                    // Measure wait latency from just-before emit to
                    // the arrival of the next bar-changing position
                    // update. Includes outbound MIDI latency, DAW
                    // processing, and the MCU surface's display
                    // refresh cycle.
                    let wait_start = Instant::now();
                    self.backend.emit(&[action])?;
                    iterations += 1;

                    match self
                        .position
                        .wait_for_position_change(self.config.position_timeout)
                    {
                        Some(new_bar) => {
                            let wait_ms = wait_start.elapsed().as_millis();
                            stats.record(wait_ms);
                            let actual_delta = new_bar as i64 - current as i64;
                            info!(
                                iteration = iterations,
                                ?action,
                                before_bar = current,
                                after_bar = new_bar,
                                expected_sign = prev_delta_sign,
                                actual_delta,
                                wait_ms = wait_ms as u64,
                                "locate step"
                            );
                            continue;
                        }
                        None => {
                            let wait_ms = wait_start.elapsed().as_millis();
                            warn!(
                                iterations,
                                current,
                                target,
                                wait_ms = wait_ms as u64,
                                timeout_ms = self.config.position_timeout.as_millis() as u64,
                                "locate: no position update within timeout"
                            );
                            log_locate_exit("Timeout", iterations, target, &stats, locate_start);
                            return Ok(LocateOutcome::Timeout {
                                iterations,
                                last_known_bar: self.position.current_bar(),
                            });
                        }
                    }
                }
            }
        }
    }
}

/// End-of-locate summary log. Emitted once per locate with rolled-up
/// latency stats alongside the outcome name — grep-friendly for
/// post-hoc analysis of DAWs with variable response times.
fn log_locate_exit(
    outcome: &str,
    iterations: u32,
    target: u32,
    stats: &LatencyStats,
    locate_start: Instant,
) {
    let total_ms = locate_start.elapsed().as_millis() as u64;
    info!(
        outcome,
        target,
        iterations,
        total_ms,
        latency_samples = stats.count,
        latency_min_ms = stats.min_ms.map(|v| v as u64).unwrap_or(0),
        latency_max_ms = stats.max_ms.map(|v| v as u64).unwrap_or(0),
        latency_avg_ms = stats.avg_ms() as u64,
        "locate exit"
    );
}

// ---------------------------------------------------------------------------
// Event-source translator: bridge TransportEvent → LocateEvent.
// ---------------------------------------------------------------------------

/// Not every TransportEvent is relevant to a locate in progress.
/// This translates the ones that are; main.rs will use it to map
/// the incoming mpsc channel into the `LocateEvent` stream the
/// controller reads.
pub fn transport_to_locate_event(event: TransportEvent) -> Option<LocateEvent> {
    match event {
        TransportEvent::Spp(target) => Some(LocateEvent::NewTarget(target)),
        TransportEvent::Stop => Some(LocateEvent::Stop),
        TransportEvent::Start | TransportEvent::Continue => Some(LocateEvent::QueuePlay),
        // LCXL3 events are intentionally ignored mid-locate. The
        // closed-loop controller is the authority on the playhead until
        // it exits; LCXL3 toggle / nudge presses arriving during a
        // locate are dropped on the floor (the user can press Stop on
        // the MC-500 to cancel if they really want to interrupt).
        TransportEvent::TogglePlay
        | TransportEvent::NudgeForward(_)
        | TransportEvent::NudgeBackward(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backend::Backend;
    use std::collections::VecDeque;

    // ---- plan_step (pure) ------------------------------------------------

    #[test]
    fn plan_step_reaches_on_zero_delta() {
        assert_eq!(plan_step(5, 5, 0), StepDecision::Reached);
        assert_eq!(plan_step(5, 5, 1), StepDecision::Reached);
        assert_eq!(plan_step(5, 5, -1), StepDecision::Reached);
    }

    #[test]
    fn plan_step_emits_forward_on_positive_delta() {
        assert_eq!(plan_step(5, 10, 0), StepDecision::Emit(Action::BarForward));
        assert_eq!(plan_step(5, 10, 1), StepDecision::Emit(Action::BarForward));
    }

    #[test]
    fn plan_step_emits_backward_on_negative_delta() {
        assert_eq!(plan_step(10, 5, 0), StepDecision::Emit(Action::BarBackward));
        assert_eq!(plan_step(10, 5, -1), StepDecision::Emit(Action::BarBackward));
    }

    #[test]
    fn plan_step_detects_oscillation_when_delta_sign_flips() {
        // Previous delta was positive (we were moving forward), but
        // now we need to go backward — overshoot.
        assert_eq!(plan_step(11, 10, 1), StepDecision::Oscillation);
        // Previous delta was negative, now positive — overshoot.
        assert_eq!(plan_step(9, 10, -1), StepDecision::Oscillation);
    }

    // ---- LocateController::run (integration via mocks) -------------------

    /// A PositionSource driven by a Vec of fake "updates". The tracker
    /// starts at `initial_bar`; each call to `wait_for_position_change`
    /// either replays the next staged update or reports a timeout
    /// (if the queue is empty).
    struct FakePositionSource {
        current: Option<u32>,
        updates: VecDeque<Option<u32>>, // None = "timeout this call"
    }

    impl FakePositionSource {
        fn new(initial_bar: Option<u32>, updates: Vec<Option<u32>>) -> Self {
            Self {
                current: initial_bar,
                updates: updates.into_iter().collect(),
            }
        }
    }

    impl PositionSource for FakePositionSource {
        fn current_bar(&self) -> Option<u32> {
            self.current
        }

        fn wait_for_position_change(&mut self, _timeout: Duration) -> Option<u32> {
            match self.updates.pop_front() {
                Some(Some(bar)) => {
                    self.current = Some(bar);
                    Some(bar)
                }
                Some(None) => None,
                // No more staged updates → treat as timeout.
                None => None,
            }
        }
    }

    /// An EventSource driven by a pre-staged Vec.
    struct FakeEventSource {
        queue: VecDeque<LocateEvent>,
    }

    impl FakeEventSource {
        fn empty() -> Self {
            Self {
                queue: VecDeque::new(),
            }
        }
        fn with_events(events: Vec<LocateEvent>) -> Self {
            Self {
                queue: events.into_iter().collect(),
            }
        }
    }

    impl EventSource for FakeEventSource {
        fn try_recv(&mut self) -> Option<LocateEvent> {
            self.queue.pop_front()
        }
    }

    /// A Backend that just records every Action sequence it was
    /// asked to emit, for later assertion.
    struct MockBackend {
        emitted: Vec<Action>,
    }

    impl MockBackend {
        fn new() -> Self {
            Self {
                emitted: Vec::new(),
            }
        }
    }

    impl Backend for MockBackend {
        fn emit(&mut self, actions: &[Action]) -> Result<()> {
            self.emitted.extend_from_slice(actions);
            Ok(())
        }

        fn name(&self) -> &'static str {
            "mock"
        }
    }

    fn test_config() -> LocateConfig {
        LocateConfig {
            max_iterations: 10,
            position_timeout: Duration::from_millis(1),
            initial_position_timeout: Duration::from_millis(1),
        }
    }

    #[test]
    fn reaches_target_via_forward_nudges() {
        // Start at bar 1, target bar 4. Each nudge moves one bar.
        let mut pos = FakePositionSource::new(Some(1), vec![Some(2), Some(3), Some(4)]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(4).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Reached {
                iterations: 3,
                queued_start: false,
                final_bar: 4,
            }
        ));
        assert_eq!(
            be.emitted,
            vec![Action::BarForward, Action::BarForward, Action::BarForward]
        );
    }

    #[test]
    fn reaches_target_via_backward_nudges() {
        let mut pos = FakePositionSource::new(Some(10), vec![Some(9), Some(8), Some(7)]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(7).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Reached {
                iterations: 3,
                final_bar: 7,
                ..
            }
        ));
        assert_eq!(
            be.emitted,
            vec![Action::BarBackward, Action::BarBackward, Action::BarBackward]
        );
    }

    #[test]
    fn zero_delta_reaches_immediately_without_emit() {
        let mut pos = FakePositionSource::new(Some(5), vec![]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(5).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Reached {
                iterations: 0,
                final_bar: 5,
                ..
            }
        ));
        assert_eq!(be.emitted, vec![]);
    }

    #[test]
    fn oscillation_aborts_on_sign_reversal() {
        // Start at bar 1, target 3. First nudge overshoots to bar 5
        // (LUNA's nudge is 4 bars, simulated). Delta flips from +2
        // to -2 → oscillation.
        let mut pos = FakePositionSource::new(Some(1), vec![Some(5)]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(3).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::NudgeTooLarge { iterations: 1 }
        ));
    }

    #[test]
    fn timeout_when_no_position_update_arrives() {
        // Staged update sequence returns None (timeout) after the
        // first nudge.
        let mut pos = FakePositionSource::new(Some(1), vec![None]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(4).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Timeout { iterations: 1, .. }
        ));
    }

    #[test]
    fn no_initial_position_aborts_cleanly() {
        let mut pos = FakePositionSource::new(None, vec![None]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(4).unwrap();
        assert_eq!(outcome, LocateOutcome::NoInitialPosition);
    }

    #[test]
    fn iteration_cap_aborts_without_reaching() {
        let cfg = LocateConfig {
            max_iterations: 2,
            position_timeout: Duration::from_millis(1),
            initial_position_timeout: Duration::from_millis(1),
        };
        let mut pos = FakePositionSource::new(Some(1), vec![Some(2), Some(3)]);
        let mut evs = FakeEventSource::empty();
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: cfg,
        };

        // Target is 10 bars away, cap is 2 — stops at bar 3.
        let outcome = ctrl.run(10).unwrap();
        assert_eq!(outcome, LocateOutcome::IterationCap { last_known_bar: 3 });
    }

    #[test]
    fn stop_event_during_locate_cancels() {
        let mut pos = FakePositionSource::new(Some(1), vec![Some(2)]);
        let mut evs = FakeEventSource::with_events(vec![LocateEvent::Stop]);
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(10).unwrap();
        assert!(matches!(outcome, LocateOutcome::Cancelled { iterations: 0 }));
        assert_eq!(be.emitted, vec![]); // No nudges fired
    }

    #[test]
    fn new_target_during_locate_coalesces() {
        // Start at bar 1, target bar 4, but a new SPP arrives
        // mid-locate retargeting to bar 2 — we land on bar 2
        // instead.
        let mut pos = FakePositionSource::new(Some(1), vec![Some(2)]);
        let mut evs = FakeEventSource::with_events(vec![LocateEvent::NewTarget(2)]);
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(4).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Reached {
                iterations: 1,
                final_bar: 2,
                ..
            }
        ));
    }

    #[test]
    fn queue_play_during_locate_sets_the_flag() {
        let mut pos = FakePositionSource::new(Some(1), vec![Some(2)]);
        let mut evs = FakeEventSource::with_events(vec![LocateEvent::QueuePlay]);
        let mut be = MockBackend::new();
        let ctrl = LocateController {
            position: &mut pos,
            events: &mut evs,
            backend: &mut be,
            config: test_config(),
        };

        let outcome = ctrl.run(2).unwrap();
        assert!(matches!(
            outcome,
            LocateOutcome::Reached {
                queued_start: true,
                final_bar: 2,
                ..
            }
        ));
    }

    // ---- TransportEvent → LocateEvent translation -----------------------

    #[test]
    fn transport_events_translate_to_locate_events() {
        assert_eq!(
            transport_to_locate_event(TransportEvent::Spp(42)),
            Some(LocateEvent::NewTarget(42))
        );
        assert_eq!(
            transport_to_locate_event(TransportEvent::Stop),
            Some(LocateEvent::Stop)
        );
        assert_eq!(
            transport_to_locate_event(TransportEvent::Start),
            Some(LocateEvent::QueuePlay)
        );
        assert_eq!(
            transport_to_locate_event(TransportEvent::Continue),
            Some(LocateEvent::QueuePlay)
        );
    }
}
