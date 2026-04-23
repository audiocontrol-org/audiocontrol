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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportState {
    Stopped,
    Playing,
}

/// Transport events from the MC-500 (MIDI real-time bytes).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportEvent {
    Start,    // 0xFA — play from top
    Continue, // 0xFB — resume from current position
    Stop,     // 0xFC — stop
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
    /// Imports are explicit because `Action::Stop` and
    /// `TransportEvent::Stop` share a variant name. We use pattern
    /// arms and full paths rather than `use *` to keep the compiler
    /// unambiguous.
    pub fn handle(&mut self, event: TransportEvent) -> Vec<Action> {
        use TransportEvent as E;
        use TransportState::*;

        match (self.state, event) {
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
}
