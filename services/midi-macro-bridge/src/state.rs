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
//! LUNA's keyboard shortcuts (default, US layout):
//! - Spacebar: toggle play/stop
//! - Return:   return playhead to zero
//!
//! There is no "play from top" shortcut, hence Start → [Return, Space].

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

/// Keystrokes we emit toward LUNA. Order within a sequence matters;
/// execute them in order with a small inter-key delay.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyAction {
    Space,  // play/stop toggle
    Return, // return to zero
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
    /// keystrokes to emit (possibly empty) and updates internal state.
    pub fn handle(&mut self, event: TransportEvent) -> Vec<KeyAction> {
        use KeyAction::*;
        use TransportEvent::*;
        use TransportState::*;

        match (self.state, event) {
            // Start from stopped: rewind and play.
            (Stopped, Start) => {
                self.state = Playing;
                vec![Return, Space]
            }
            // Start while playing: stop, rewind, play. Stay in Playing.
            (Playing, Start) => vec![Space, Return, Space],

            // Continue from stopped: just play.
            (Stopped, Continue) => {
                self.state = Playing;
                vec![Space]
            }
            // Continue while playing: no-op. Defends against echoes.
            (Playing, Continue) => vec![],

            // Stop while playing: stop.
            (Playing, Stop) => {
                self.state = Stopped;
                vec![Space]
            }
            // Stop while stopped: no-op. Defends against echoes.
            (Stopped, Stop) => vec![],
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
    use super::*;
    use KeyAction::*;
    use TransportEvent::*;
    use TransportState::*;

    #[test]
    fn start_from_stopped_rewinds_and_plays() {
        let mut m = Machine::new();
        assert_eq!(m.handle(Start), vec![Return, Space]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn start_while_playing_restarts_from_top() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.handle(Start), vec![Space, Return, Space]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn continue_while_stopped_plays() {
        let mut m = Machine::new();
        assert_eq!(m.handle(Continue), vec![Space]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn continue_while_playing_is_noop() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.handle(Continue), vec![]);
        assert_eq!(m.state(), Playing);
    }

    #[test]
    fn stop_while_playing_stops() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.handle(Stop), vec![Space]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn stop_while_stopped_is_noop() {
        let mut m = Machine::new();
        assert_eq!(m.handle(Stop), vec![]);
        assert_eq!(m.state(), Stopped);
    }

    #[test]
    fn reset_returns_to_stopped() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.state(), Playing);
        m.reset();
        assert_eq!(m.state(), Stopped);
    }

    /// Typical MC-500 session: start, stop, continue, stop.
    #[test]
    fn realistic_session() {
        let mut m = Machine::new();
        assert_eq!(m.handle(Start), vec![Return, Space]);
        assert_eq!(m.handle(Stop), vec![Space]);
        assert_eq!(m.handle(Continue), vec![Space]);
        assert_eq!(m.handle(Stop), vec![Space]);
    }

    /// Duplicate Stop messages (e.g., from button bounce or echo)
    /// should not double-fire.
    #[test]
    fn duplicate_stops_dont_double_fire() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.handle(Stop), vec![Space]);
        assert_eq!(m.handle(Stop), vec![]);
        assert_eq!(m.handle(Stop), vec![]);
    }

    /// Duplicate Continue messages while playing should not
    /// double-fire (would otherwise stop LUNA, which is the opposite
    /// of what we want).
    #[test]
    fn duplicate_continues_while_playing_dont_double_fire() {
        let mut m = Machine::new();
        m.handle(Start);
        assert_eq!(m.handle(Continue), vec![]);
        assert_eq!(m.handle(Continue), vec![]);
        assert_eq!(m.state(), Playing);
    }
}
