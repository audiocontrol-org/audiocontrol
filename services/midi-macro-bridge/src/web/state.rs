//! Channel types and shared state for the HTTP ↔ MIDI-loop bridge.
//!
//! Many items here are used only in Phase 6b+ (status APIs, SSE event
//! stream, config handlers). The `dead_code` lint is suppressed for
//! this module since these are deliberate forward-declarations.
#![allow(dead_code)]
//!
//! The MIDI event loop is synchronous on a `std::thread` and owns all
//! `MidiInputConnection` / `MidiOutputConnection` handles as well as
//! the `Rc<RefCell<VirtualMcuPair>>` and `PositionTracker`. None of
//! those are `Send`. The tokio runtime runs in a separate `std::thread`
//! so those handles never cross thread boundaries.
//!
//! Communication between the two threads is exclusively through the
//! three channels defined here:
//!
//! - `watch::Sender<Status>` — MIDI loop publishes `Status` snapshots;
//!   HTTP handlers read via `watch::Receiver<Status>`.
//! - `broadcast::Sender<EventLine>` — MIDI loop pushes events; SSE
//!   handlers subscribe (not wired to live events yet in Phase 6a).
//! - `mpsc::Sender<Cmd>` — HTTP handlers post commands; MIDI loop
//!   drains via `mpsc::Receiver<Cmd>::try_recv` each tick.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime};

use tokio::sync::{broadcast, mpsc, watch};

use crate::config::Config;
use crate::state::TransportState;

// ── Commands (HTTP → MIDI loop) ──────────────────────────────────────────────

/// Commands that HTTP handlers can send to the MIDI event loop.
///
/// The MIDI loop drains these via `try_recv` each tick; it must never
/// block waiting for a command.
#[derive(Debug)]
pub enum Cmd {
    /// Drop the current MIDI connections and rebuild from the new config.
    Reload(Config),
    /// Exit the process cleanly. The loop calls `std::process::exit(2)`;
    /// the HTTP handler itself must NOT exit — separation of concerns.
    Halt,
}

// ── Bridge state ─────────────────────────────────────────────────────────────

/// High-level operational state of the bridge process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BridgeState {
    /// Startup: connections not yet established.
    Initialising,
    /// All configured connections are open; MIDI events are flowing.
    Running,
    /// A `Cmd::Reload` was received; connections are being torn down
    /// and rebuilt. Transitions to `Running` on success or `Panicked`
    /// on failure.
    Reconnecting,
    /// A fatal error occurred during connection setup. Manual
    /// intervention (config change or process restart) required.
    Panicked,
}

// ── Event log ────────────────────────────────────────────────────────────────

/// Which part of the bridge produced an `EventLine`.
#[derive(Debug, Clone)]
pub enum EventSource {
    /// Roland MC-500 mkII transport input.
    Mc500,
    /// Novation Launch Control XL Mk3 input.
    Lcxl3,
    /// MCU virtual output (bytes sent to the DAW).
    McuOut,
    /// Bridge-internal event (startup, reconnect, error, etc.).
    Bridge,
}

/// A single line in the live event stream pushed to the SSE channel.
#[derive(Debug, Clone)]
pub struct EventLine {
    pub at: SystemTime,
    pub source: EventSource,
    pub text: String,
}

// ── Port status ───────────────────────────────────────────────────────────────

/// Status of a single MIDI port slot (input or output).
#[derive(Debug, Clone)]
pub struct PortStatus {
    /// Port name as configured (substring match). `None` if the slot
    /// is not configured / not applicable.
    pub configured: Option<String>,
    /// Whether the port is currently open and active.
    pub connected: bool,
    /// Last error seen while opening this port, if any.
    pub error: Option<String>,
}

impl Default for PortStatus {
    fn default() -> Self {
        Self {
            configured: None,
            connected: false,
            error: None,
        }
    }
}

/// Rolled-up status for every port slot the bridge manages.
#[derive(Debug, Clone)]
pub struct PortStatuses {
    pub mc500_input: PortStatus,
    pub mc500_sync: PortStatus,
    pub lcxl3_input: PortStatus,
    pub lcxl3_output: PortStatus,
    pub mcu_virtual: PortStatus,
}

impl Default for PortStatuses {
    fn default() -> Self {
        Self {
            mc500_input: PortStatus::default(),
            mc500_sync: PortStatus::default(),
            lcxl3_input: PortStatus::default(),
            lcxl3_output: PortStatus::default(),
            mcu_virtual: PortStatus::default(),
        }
    }
}

impl PortStatuses {
    /// Returns `true` if any of the four physical port slots (mc500_input,
    /// mc500_sync, lcxl3_input, lcxl3_output) is configured but not connected.
    /// The virtual MCU endpoint is excluded because it is always configured when
    /// the MCU backend is active — a transient virtual-port failure is already
    /// surfaced via the slot's own LED.
    pub fn is_any_configured_port_disconnected(&self) -> bool {
        let slots = [
            &self.mc500_input,
            &self.mc500_sync,
            &self.lcxl3_input,
            &self.lcxl3_output,
        ];
        slots
            .iter()
            .any(|s| s.configured.is_some() && !s.connected)
    }
}

// ── Status snapshot ───────────────────────────────────────────────────────────

/// Full status snapshot published by the MIDI loop each time
/// observable state changes. The HTTP server reads this via the
/// `watch` channel — it never holds a lock on any MIDI handle.
#[derive(Debug, Clone)]
pub struct Status {
    pub bridge_state: BridgeState,
    pub transport: TransportState,
    /// Current bar number as reported by the MCU position tracker.
    /// `None` until the tracker has received at least one update.
    pub last_bar: Option<u32>,
    /// Wall-clock time of the most recent transport event handled by
    /// the state machine.
    pub last_event_at: Option<Instant>,
    pub ports: PortStatuses,
    /// Wall-clock time of the most recent MCU heartbeat reply sent.
    pub mcu_heartbeat_at: Option<Instant>,
    /// Active config snapshot (for the web UI's config form).
    pub config: Config,
}

impl Status {
    /// Construct an `Initialising` status from a freshly-loaded config.
    pub fn initialising(config: Config) -> Self {
        Self {
            bridge_state: BridgeState::Initialising,
            transport: TransportState::Stopped,
            last_bar: None,
            last_event_at: None,
            ports: PortStatuses::default(),
            mcu_heartbeat_at: None,
            config,
        }
    }
}

// ── Axum-shareable state ──────────────────────────────────────────────────────

/// State shared between all axum request handlers.
///
/// Constructed once in `main` after the channels are built, then
/// wrapped in an `Arc` by axum's `State` extractor.
///
/// Handlers read the current `Status` via `status_rx.borrow()` and
/// subscribe to new events via `subscribe_events()`. Commands are
/// sent via `cmd_tx`.
#[derive(Clone)]
pub struct WebState {
    pub status_rx: watch::Receiver<Status>,
    /// A `broadcast::Sender` from which handlers can call `.subscribe()`
    /// to get a per-connection receiver. Stored here because axum state
    /// must be `Clone + Send + Sync`, and `broadcast::Sender` is all
    /// three.
    pub events_tx: broadcast::Sender<EventLine>,
    pub cmd_tx: mpsc::Sender<Cmd>,
    /// Ring buffer of the most recent `EVENT_HISTORY_CAPACITY` events.
    /// The SSE handler drains a clone of this deque before subscribing
    /// to the live broadcast so a freshly-opened tab gets recent history.
    ///
    /// The std `Mutex` is intentional: the MIDI loop (std::thread) pushes
    /// here, and the axum handler clones the deque and drops the lock
    /// before `.await`-ing, so the critical section is always short.
    pub events_history: Arc<Mutex<VecDeque<EventLine>>>,
    /// Path to `config.toml`. The `POST /api/config` handler writes the
    /// updated config here atomically before sending `Cmd::Reload`.
    pub config_path: PathBuf,
}

impl WebState {
    pub fn new(
        status_rx: watch::Receiver<Status>,
        events_tx: broadcast::Sender<EventLine>,
        cmd_tx: mpsc::Sender<Cmd>,
        events_history: Arc<Mutex<VecDeque<EventLine>>>,
        config_path: PathBuf,
    ) -> Self {
        Self {
            status_rx,
            events_tx,
            cmd_tx,
            events_history,
            config_path,
        }
    }

    /// Subscribe to the event broadcast channel. Each call returns a
    /// fresh receiver so SSE connections get independent cursors.
    pub fn subscribe_events(&self) -> broadcast::Receiver<EventLine> {
        self.events_tx.subscribe()
    }
}

// ── Channel factory ───────────────────────────────────────────────────────────

/// The broadcast channel capacity for `EventLine`. A ring-buffer of
/// this size; slow SSE consumers will start missing events once they
/// fall this far behind, which is acceptable for a UI stream.
pub const EVENT_BROADCAST_CAPACITY: usize = 256;

/// How many recent `EventLine`s to keep in the history ring buffer.
/// A freshly-opened SSE connection first drains this buffer before
/// subscribing to new live events.
pub const EVENT_HISTORY_CAPACITY: usize = 200;

/// The mpsc channel capacity for `Cmd`. A small buffer is enough
/// because commands are rare and the MIDI loop drains promptly.
pub const CMD_CHANNEL_CAPACITY: usize = 16;

/// Build all inter-thread channels and shared state in one call.
///
/// Returns:
/// - `cmd_tx` / `cmd_rx`: HTTP → MIDI-loop command pipe.
/// - `status_tx` / `status_rx`: MIDI-loop → HTTP status watch.
/// - `events_tx`: MIDI-loop → SSE broadcast (handlers call
///   `.subscribe()` for their own receiver).
/// - `events_history`: shared ring buffer for recent events; the MIDI
///   loop holds a clone for pushing, `WebState` holds one for reading.
pub fn build_channels(
    initial_status: Status,
) -> (
    mpsc::Sender<Cmd>,
    mpsc::Receiver<Cmd>,
    watch::Sender<Status>,
    watch::Receiver<Status>,
    broadcast::Sender<EventLine>,
    Arc<Mutex<VecDeque<EventLine>>>,
) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CMD_CHANNEL_CAPACITY);
    let (status_tx, status_rx) = watch::channel(initial_status);
    let (events_tx, _events_rx) = broadcast::channel(EVENT_BROADCAST_CAPACITY);
    let events_history = Arc::new(Mutex::new(VecDeque::with_capacity(EVENT_HISTORY_CAPACITY)));
    (cmd_tx, cmd_rx, status_tx, status_rx, events_tx, events_history)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    fn default_status() -> Status {
        Status::initialising(Config::default())
    }

    // ── PortStatuses::is_any_configured_port_disconnected ─────────────────────

    fn make_connected_port(name: &str) -> PortStatus {
        PortStatus {
            configured: Some(name.to_string()),
            connected: true,
            error: None,
        }
    }

    fn make_disconnected_port(name: &str) -> PortStatus {
        PortStatus {
            configured: Some(name.to_string()),
            connected: false,
            error: None,
        }
    }

    #[test]
    fn is_any_configured_port_disconnected_all_connected_returns_false() {
        let ports = PortStatuses {
            mc500_input: make_connected_port("MC-500 In"),
            mc500_sync: make_connected_port("MC-500 Sync"),
            lcxl3_input: make_connected_port("LCXL3 In"),
            lcxl3_output: make_connected_port("LCXL3 Out"),
            mcu_virtual: make_connected_port("MCU Virtual"),
        };
        assert!(!ports.is_any_configured_port_disconnected());
    }

    #[test]
    fn is_any_configured_port_disconnected_unconfigured_returns_false() {
        // All slots unconfigured (None) — not "configured but disconnected".
        let ports = PortStatuses::default();
        assert!(!ports.is_any_configured_port_disconnected());
    }

    #[test]
    fn is_any_configured_port_disconnected_mc500_input_disconnected() {
        let ports = PortStatuses {
            mc500_input: make_disconnected_port("MC-500 In"),
            ..PortStatuses::default()
        };
        assert!(ports.is_any_configured_port_disconnected());
    }

    #[test]
    fn is_any_configured_port_disconnected_lcxl3_output_disconnected() {
        let ports = PortStatuses {
            lcxl3_output: make_disconnected_port("LCXL3 Out"),
            ..PortStatuses::default()
        };
        assert!(ports.is_any_configured_port_disconnected());
    }

    #[test]
    fn is_any_configured_port_disconnected_mcu_virtual_ignored() {
        // mcu_virtual disconnected but physical slots all fine — should be false.
        let ports = PortStatuses {
            mcu_virtual: make_disconnected_port("MCU Virtual"),
            ..PortStatuses::default()
        };
        assert!(!ports.is_any_configured_port_disconnected());
    }

    #[test]
    fn build_channels_smoke_test() {
        let (cmd_tx, mut cmd_rx, _status_tx, _status_rx, _events_tx, _history) =
            build_channels(default_status());

        // Send a Halt command and immediately poll for it.
        cmd_tx.blocking_send(Cmd::Halt).expect("send succeeded");
        let received = cmd_rx.try_recv().expect("cmd immediately available");
        assert!(matches!(received, Cmd::Halt));
    }

    #[test]
    fn build_channels_reload_roundtrips() {
        let (cmd_tx, mut cmd_rx, _status_tx, _status_rx, _events_tx, _history) =
            build_channels(default_status());

        let cfg = Config::default();
        cmd_tx
            .blocking_send(Cmd::Reload(cfg))
            .expect("send succeeded");
        let received = cmd_rx.try_recv().expect("cmd immediately available");
        assert!(matches!(received, Cmd::Reload(_)));
    }

    #[test]
    fn status_initialising_sets_bridge_state() {
        let s = Status::initialising(Config::default());
        assert!(matches!(s.bridge_state, BridgeState::Initialising));
        assert!(matches!(s.transport, TransportState::Stopped));
        assert!(s.last_bar.is_none());
    }

    #[test]
    fn web_state_subscribe_events_gives_independent_receivers() {
        let (_cmd_tx, _cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(default_status());
        let state = WebState::new(
            status_rx,
            events_tx,
            _cmd_tx,
            history,
            std::path::PathBuf::from("config.toml"),
        );

        let _r1 = state.subscribe_events();
        let _r2 = state.subscribe_events();
        // If we get here without panic, the subscribe API works.
    }
}
