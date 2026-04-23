//! Backends that turn abstract `Action` sequences into concrete
//! outbound events — MCU MIDI messages on the virtual endpoint, or
//! keystrokes via enigo.
//!
//! The `Backend` trait is the only thing the main event loop needs
//! to know. Which concrete backend is in use is decided at startup
//! based on the config's `[transport] backend` setting and held
//! behind a `Box<dyn Backend>`.

use anyhow::{Context, Result};
use std::thread;
use std::time::Duration;
use tracing::trace;

use crate::keys::{Emitter, KeyStroke};
use crate::midi::VirtualMcuPair;
use crate::state::Action;

/// Default gap between consecutive MCU button events (the press and
/// the release of a tap, and the gap between adjacent actions in a
/// sequence). 50 ms matches the timing used in the Phase 3c
/// discovery session and gives LUNA ample margin to process each
/// message before the next arrives.
const MCU_TAP_GAP_MS: u64 = 50;

/// Abstract output sink for transport and navigation actions. The
/// main loop calls `emit` with whatever the state machine produced;
/// the backend is responsible for turning that into bytes or
/// keystrokes that LUNA (or another DAW) will act on.
///
/// Not `Send` — the KeystrokeBackend holds an `Enigo` which contains
/// a `NonNull<CGEventSource>` on macOS. The bridge's event loop is
/// single-threaded anyway, so no thread transfer is needed.
pub trait Backend {
    /// Dispatch a sequence of actions. Empty sequences are valid
    /// (the state machine emits `vec![]` on no-op events) and must
    /// be cheap.
    fn emit(&mut self, actions: &[Action]) -> Result<()>;

    /// Human-readable name for logging at startup.
    fn name(&self) -> &'static str;
}

// ---------------------------------------------------------------------------
// MCU backend (default)
// ---------------------------------------------------------------------------

/// Action byte sequences as discovered in Phase 3c against live LUNA.
/// See `MCU-NOTES.md` for the capture logs backing each mapping.
const MCU_BYTES_PLAY_PRESS: [u8; 3] = [0x90, 0x5E, 0x7F];
const MCU_BYTES_PLAY_RELEASE: [u8; 3] = [0x90, 0x5E, 0x00];
const MCU_BYTES_STOP_PRESS: [u8; 3] = [0x90, 0x5D, 0x7F];
const MCU_BYTES_STOP_RELEASE: [u8; 3] = [0x90, 0x5D, 0x00];
const MCU_BYTES_REWIND_PRESS: [u8; 3] = [0x90, 0x5B, 0x7F];
const MCU_BYTES_REWIND_RELEASE: [u8; 3] = [0x90, 0x5B, 0x00];
const MCU_BYTES_BAR_FORWARD: [u8; 3] = [0xB0, 0x3C, 0x01];
const MCU_BYTES_BAR_BACKWARD: [u8; 3] = [0xB0, 0x3C, 0x41];

/// Emits Actions as MCU control-surface messages on the bridge's
/// virtual MIDI output. LUNA (with the bridge selected as its MCU
/// control surface) receives and acts on them just as if a physical
/// Mackie Control were the source. No keyboard focus, no
/// Accessibility permission, no rate-limiting.
pub struct McuBackend {
    pair: VirtualMcuPair,
    tap_gap: Duration,
}

impl McuBackend {
    pub fn new(pair: VirtualMcuPair) -> Self {
        Self {
            pair,
            tap_gap: Duration::from_millis(MCU_TAP_GAP_MS),
        }
    }

    /// Send an MCU button "tap" — press then release, separated by
    /// the configured tap gap. Most MCU transport buttons (Play,
    /// Stop, Rewind) behave identically whether driven by a tap or
    /// by an abrupt press-release; the gap is purely defensive.
    fn tap(&mut self, press: &[u8], release: &[u8]) -> Result<()> {
        self.pair.send(press)?;
        thread::sleep(self.tap_gap);
        self.pair.send(release)?;
        Ok(())
    }

    fn emit_action(&mut self, action: Action) -> Result<()> {
        trace!(?action, "McuBackend: emitting");
        match action {
            Action::Play => self.tap(&MCU_BYTES_PLAY_PRESS, &MCU_BYTES_PLAY_RELEASE),
            Action::Stop => self.tap(&MCU_BYTES_STOP_PRESS, &MCU_BYTES_STOP_RELEASE),
            Action::ReturnToZero => self.tap(&MCU_BYTES_REWIND_PRESS, &MCU_BYTES_REWIND_RELEASE),
            Action::BarForward => self.pair.send(&MCU_BYTES_BAR_FORWARD),
            Action::BarBackward => self.pair.send(&MCU_BYTES_BAR_BACKWARD),
        }
    }
}

impl Backend for McuBackend {
    fn emit(&mut self, actions: &[Action]) -> Result<()> {
        for (i, action) in actions.iter().enumerate() {
            if i > 0 {
                thread::sleep(self.tap_gap);
            }
            self.emit_action(*action)
                .with_context(|| format!("emitting {action:?}"))?;
        }
        Ok(())
    }

    fn name(&self) -> &'static str {
        "mcu"
    }
}

// ---------------------------------------------------------------------------
// Keystroke backend (opt-in fallback)
// ---------------------------------------------------------------------------

/// Emits Actions as keystrokes via enigo / CGEvent. Requires macOS
/// Accessibility permission and LUNA to be the frontmost app. This
/// preserves the Phase 1-2 behaviour of the bridge as an opt-in
/// fallback for environments where the MCU path isn't available.
pub struct KeystrokeBackend {
    emitter: Emitter,
}

impl KeystrokeBackend {
    pub fn new(emitter: Emitter) -> Self {
        Self { emitter }
    }
}

impl Backend for KeystrokeBackend {
    fn emit(&mut self, actions: &[Action]) -> Result<()> {
        let strokes: Vec<KeyStroke> = actions.iter().map(action_to_keystroke).collect();
        self.emitter.emit_sequence(&strokes)
    }

    fn name(&self) -> &'static str {
        "keystrokes"
    }
}

/// Translate an abstract Action into the LUNA keystroke that
/// achieves it. Play / Stop both map to `Space` — LUNA's keystroke
/// is a toggle, so the state machine's explicit direction knowledge
/// collapses into the same keypress. The state machine's echo guard
/// keeps the toggle from mis-firing.
fn action_to_keystroke(action: &Action) -> KeyStroke {
    match action {
        Action::Play => KeyStroke::Space,
        Action::Stop => KeyStroke::Space,
        Action::ReturnToZero => KeyStroke::Return,
        Action::BarForward => KeyStroke::BracketRight,
        Action::BarBackward => KeyStroke::BracketLeft,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_to_keystroke_mapping_preserves_phase_1_2_behaviour() {
        // These must match what the Phase 1-2 Machine::handle used to
        // emit directly before the Action refactor.
        assert_eq!(action_to_keystroke(&Action::Play), KeyStroke::Space);
        assert_eq!(action_to_keystroke(&Action::Stop), KeyStroke::Space);
        assert_eq!(action_to_keystroke(&Action::ReturnToZero), KeyStroke::Return);
        assert_eq!(action_to_keystroke(&Action::BarForward), KeyStroke::BracketRight);
        assert_eq!(action_to_keystroke(&Action::BarBackward), KeyStroke::BracketLeft);
    }

    /// Exhaustive match on `Action` — this test will fail to compile
    /// if a new variant is added and `action_to_keystroke` isn't
    /// updated. Cheap coverage check for the refactor.
    #[test]
    fn every_action_variant_has_a_keystroke_mapping() {
        for action in [
            Action::Play,
            Action::Stop,
            Action::ReturnToZero,
            Action::BarForward,
            Action::BarBackward,
        ] {
            let _ = action_to_keystroke(&action);
        }
    }
}
