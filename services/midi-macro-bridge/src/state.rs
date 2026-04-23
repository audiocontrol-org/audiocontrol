//! Transport state machine.
//!
//! This module has zero I/O dependencies and is fully unit-tested.
//! If the tests here pass, the core logic of the bridge is correct —
//! everything else is plumbing.
//!
//! ## Design notes
//!
//! The state machine intentionally produces *no-op* action sequences
//! for redundant events (e.g., Stop while already stopped). This is
//! the first line of defense against MIDI feedback loops and
//! duplicate messages from the MC-500. The second line of defense
//! is routing topology — see README.md.
//!
//! The `Action` variants are backend-agnostic: they describe *what*
//! the DAW should do, not *how* to make it do it. The `McuBackend`
//! maps each Action to an MCU byte sequence; the `KeystrokeBackend`
//! maps them to `Space`, `Return`, `[`, `]` keystrokes. Both
//! backends preserve Phase 1-2 transport semantics:
//!
//! - Start from stopped → rewind + play
//! - Start from playing → stop + rewind + play (restart from top)
//! - Continue from stopped → play from current position
//! - Stop / Continue duplicates → no-op (echo guard)

/// The Machine's current observed state.
///
/// The `Locating` variant carries the target bar. The "Start/Continue
/// arrived during the locate" flag lives on the `LocateController`,
/// not here — during a locate, transport events are consumed by the
/// controller (not the state machine), so the controller is the
/// authority on whether a post-locate Play is queued. The state
/// machine receives that signal back via the `queued_start`
/// parameter to `Machine::complete_locate`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportState {
    Stopped,
    Playing,
    Locating {
        target: u32,
    },
}

/// Events the bridge handles — transport bytes from the MC-500 plus
/// Song Position Pointer. SPP's payload is the 14-bit target position
/// reconstructed from the two MIDI data bytes, translated to a
/// whole-bar target by the caller before it reaches us (see
/// `midi::parse_transport`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportEvent {
    Start,       // 0xFA — play from top
    Continue,    // 0xFB — resume from current position
    Stop,        // 0xFC — stop
    Spp(u32),    // 0xF2 ll hh — target bar (1-based) for closed-loop locate
}

/// Abstract, backend-agnostic actions emitted by the state machine.
/// The McuBackend turns each of these into an MCU byte sequence; the
/// KeystrokeBackend turns them into enigo keystrokes.
///
/// `Play` covers both "start playback" and "continue from current
/// position" — both translate to MCU note `0x5E` or keystroke
/// `Space`, so the state machine doesn't bother distinguishing them
/// at this layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// Begin (or resume) playback from the current playhead position.
    /// MCU: `90 5E 7F; 90 5E 00`. Keystroke: `Space`.
    Play,
    /// Stop playback. MCU: `90 5D 7F; 90 5D 00`. Keystroke: `Space`
    /// (toggles playing → stopped).
    Stop,
    /// Jump playhead to bar 1. MCU: `90 5B 7F; 90 5B 00`.
    /// Keystroke: `Return`.
    ReturnToZero,
    /// Nudge playhead forward by one bar. MCU: `B0 3C 01`.
    /// Keystroke: `]`.
    BarForward,
    /// Nudge playhead backward by one bar. MCU: `B0 3C 41`.
    /// Keystroke: `[`.
    BarBackward,
}

pub struct Machine {
    state: TransportState,
}

impl Default for Machine {
    fn default() -> Self {
        Self::new()
    }
}

impl Machine {
    pub fn new() -> Self {
        Self {
            state: TransportState::Stopped,
        }
    }

    pub fn state(&self) -> TransportState {
        self.state
    }

    /// Handle an incoming transport event. Returns the sequence of
    /// `Action`s to dispatch to the backend (possibly empty) and
    /// updates internal state.
    ///
    /// Locate semantics: entering `Locating` produces no Actions —
    /// the main loop is responsible for running the LocateController,
    /// which drives the actual bar-nudge sequence based on the
    /// target that the state carries. **Transport events arriving
    /// during a locate are consumed by the LocateController's event
    /// source, not the state machine**, so the only `Locating` →
    /// `Locating` transitions the state machine observes directly
    /// are redundant SPPs that haven't yet been drained by the
    /// controller.
    ///
    /// Imports are explicit because `Action::Stop` and
    /// `TransportEvent::Stop` share a variant name; pattern arms use
    /// full paths to keep the compiler unambiguous.
    pub fn handle(&mut self, event: TransportEvent) -> Vec<Action> {
        use TransportEvent as E;
        use TransportState::*;

        match (self.state, event) {
            // --- transport events while idle --------------------------------

            // Start from stopped: rewind and play.
            (Stopped, E::Start) => {
                self.state = Playing;
                vec![Action::ReturnToZero, Action::Play]
            }
            // Start while playing: stop, rewind, play. Stay in Playing.
            (Playing, E::Start) => vec![Action::Stop, Action::ReturnToZero, Action::Play],

            // Continue from stopped: just play.
            (Stopped, E::Continue) => {
                self.state = Playing;
                vec![Action::Play]
            }
            // Continue while playing: no-op. Defends against echoes.
            (Playing, E::Continue) => vec![],

            // Stop while playing: stop.
            (Playing, E::Stop) => {
                self.state = Stopped;
                vec![Action::Stop]
            }
            // Stop while stopped: no-op. Defends against echoes.
            (Stopped, E::Stop) => vec![],

            // --- SPP: enter Locating (from stopped) or ignore (from playing)

            // SPP while stopped: begin a closed-loop locate.
            (Stopped, E::Spp(target)) => {
                self.state = Locating { target };
                vec![]
            }
            // SPP while playing: intentionally ignored. Per PRD, locate
            // during playback is out of scope — user must stop first.
            (Playing, E::Spp(_)) => vec![],

            // --- events while locating --------------------------------------
            //
            // In production these arms rarely fire — the
            // LocateController drains the transport channel during a
            // locate. They're here for correctness if the main loop
            // ever lets an event through (e.g. between machine.handle
            // and controller.run), and for the state-machine unit
            // tests which exercise the transitions directly without
            // a controller running.

            // New SPP while locating: coalesce target in place.
            (Locating { .. }, E::Spp(target)) => {
                self.state = Locating { target };
                vec![]
            }
            // Stop during locate: cancel, return to Stopped.
            (Locating { .. }, E::Stop) => {
                self.state = Stopped;
                vec![]
            }
            // Start or Continue during locate: in production the
            // controller intercepts these; if the state machine sees
            // them, it stays in Locating (the controller — when next
            // invoked — or the main loop should handle the queued
            // play via complete_locate's queued_start parameter).
            (Locating { target }, E::Start) | (Locating { target }, E::Continue) => {
                self.state = Locating { target };
                vec![]
            }
        }
    }

    /// Called by the main loop once the LocateController reports its
    /// outcome. Transitions out of `Locating` back to the appropriate
    /// resting state and returns any Actions that should fire as a
    /// result (specifically `Play` if the controller observed a
    /// Start or Continue during the locate and set `queued_start` in
    /// its outcome).
    ///
    /// Safe to call even if the state isn't Locating (no-op), which
    /// simplifies error paths in the main loop.
    pub fn complete_locate(&mut self, reached: bool, queued_start: bool) -> Vec<Action> {
        if !matches!(self.state, TransportState::Locating { .. }) {
            return vec![];
        }

        if reached && queued_start {
            self.state = TransportState::Playing;
            vec![Action::Play]
        } else {
            self.state = TransportState::Stopped;
            vec![]
        }
    }

    /// Manual reset. Useful if state drifts (e.g., user hits spacebar
    /// directly in LUNA) and they want a clean slate without
    /// restarting the bridge.
    pub fn reset(&mut self) {
        self.state = TransportState::Stopped;
    }
}

#[cfg(test)]
mod tests {
    // Action and TransportEvent both have a `Stop` variant, so we
    // import them aliased rather than globbing to keep assertions
    // unambiguous. Action is the "expected output" side; E is the
    // "input event" side.
    use super::Action as A;
    use super::TransportEvent as E;
    use super::TransportState::*;
    use super::*;

    #[test]
    fn start_from_stopped_rewinds_and_plays() {
        let mut m = Machine::new();
        assert_eq!(m.handle(E::Start), vec![A::ReturnToZero, A::Play]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn start_while_playing_restarts_from_top() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(
            m.handle(E::Start),
            vec![A::Stop, A::ReturnToZero, A::Play]
        );
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn continue_while_stopped_plays() {
        let mut m = Machine::new();
        assert_eq!(m.handle(E::Continue), vec![A::Play]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn continue_while_playing_is_noop() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.handle(E::Continue), vec![]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn stop_while_playing_stops() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.handle(E::Stop), vec![A::Stop]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn stop_while_stopped_is_noop() {
        let mut m = Machine::new();
        assert_eq!(m.handle(E::Stop), vec![]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn reset_returns_to_stopped() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.state(), Playing);
        m.reset();
        assert_eq!(m.state(), Stopped);
    }

    /// Typical MC-500 session: start, stop, continue, stop.
    #[test]
    fn realistic_session() {
        let mut m = Machine::new();
        assert_eq!(m.handle(E::Start), vec![A::ReturnToZero, A::Play]);
        assert_eq!(m.handle(E::Stop), vec![A::Stop]);
        assert_eq!(m.handle(E::Continue), vec![A::Play]);
        assert_eq!(m.handle(E::Stop), vec![A::Stop]);
    }

    /// Duplicate Stop messages (e.g., from button bounce or echo)
    /// should not double-fire.
    #[test]
    fn duplicate_stops_dont_double_fire() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.handle(E::Stop), vec![A::Stop]);
        assert_eq!(m.handle(E::Stop), vec![]);
        assert_eq!(m.handle(E::Stop), vec![]);
    }

    /// Duplicate Continue messages while playing should not
    /// double-fire (would otherwise stop LUNA, which is the opposite
    /// of what we want).
    #[test]
    fn duplicate_continues_while_playing_dont_double_fire() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.handle(E::Continue), vec![]);
        assert_eq!(m.handle(E::Continue), vec![]);
        assert_eq!(m.state(), Playing);
    }

    // ---- Locate (SPP) semantics ------------------------------------------

    #[test]
    fn spp_from_stopped_enters_locating_with_target() {
        let mut m = Machine::new();
        assert_eq!(m.handle(E::Spp(42)), vec![]);
        assert_eq!(m.state(), Locating { target: 42 });
    }

    #[test]
    fn spp_from_playing_is_ignored() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.handle(E::Spp(42)), vec![]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn spp_during_locating_coalesces_target() {
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.state(), Locating { target: 42 });
        // Rapid second SPP: target updates in place.
        assert_eq!(m.handle(E::Spp(99)), vec![]);
        assert_eq!(m.state(), Locating { target: 99 });
    }

    #[test]
    fn stop_during_locating_cancels() {
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.handle(E::Stop), vec![]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn start_during_locating_keeps_state_in_locating() {
        // In production the LocateController intercepts Start during
        // a locate and tracks queued_start in its own outcome. The
        // state machine's job is just to keep state consistent if
        // the event somehow reaches it.
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.handle(E::Start), vec![]);
        assert_eq!(m.state(), Locating { target: 42 });
    }

    #[test]
    fn continue_during_locating_keeps_state_in_locating() {
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.handle(E::Continue), vec![]);
        assert_eq!(m.state(), Locating { target: 42 });
    }

    #[test]
    fn complete_locate_with_queued_start_emits_play_and_transitions_to_playing() {
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        // queued_start comes from the LocateController's outcome, not
        // from state machine transitions.
        assert_eq!(m.complete_locate(true, true), vec![A::Play]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn complete_locate_without_queued_start_returns_to_stopped() {
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.complete_locate(true, false), vec![]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn complete_locate_after_failure_does_not_emit_play_even_if_queued() {
        // If the locate didn't reach the target (timeout, iteration
        // cap, oscillation), we don't start playback from a wrong
        // position — better for the user to see a stopped machine
        // than an un-synced "playing from an unknown bar" state.
        let mut m = Machine::new();
        m.handle(E::Spp(42));
        assert_eq!(m.complete_locate(false, true), vec![]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn complete_locate_is_no_op_when_not_locating() {
        let mut m = Machine::new();
        m.handle(E::Start);
        assert_eq!(m.state(), Playing);
        // Calling complete_locate while playing is a harmless no-op.
        assert_eq!(m.complete_locate(true, true), vec![]);
        assert_eq!(m.state(), Playing);
    }
}
