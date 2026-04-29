//! Backends that turn abstract `Action` sequences into concrete
//! outbound events — MCU MIDI messages on the virtual endpoint, or
//! keystrokes via enigo.
//!
//! The `Backend` trait is the only thing the main event loop needs
//! to know. Which concrete backend is in use is decided at startup
//! based on the config's `[transport] backend` setting and held
//! behind a `Box<dyn Backend>`.

use anyhow::{Context, Result};
use std::cell::RefCell;
use std::rc::Rc;
use std::thread;
use std::time::Duration;
use tracing::trace;

use crate::keys::{Emitter, KeyStroke};
use crate::lcxl3::MixerAction;
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

    /// Emit a mixer control action toward the DAW. Defaults to a
    /// logged no-op so backends that have no mixer capability
    /// (`KeystrokeBackend`) don't need to implement it explicitly.
    ///
    /// `McuBackend` overrides this with debug-log stubs for stages 5-7.
    ///
    /// **Note on design intent**: the `MixerBackend` trait below is the
    /// *standalone* interface for code that only needs mixer dispatch
    /// (e.g., tests). `Backend::emit_mixer` delegates to the same logic
    /// at runtime so the main loop can use a single `Box<dyn Backend>`
    /// for both transport and mixer dispatch without downcasting.
    fn emit_mixer(&mut self, action: &MixerAction) -> Result<()> {
        tracing::debug!(?action, "mixer: emit_mixer no-op on keystroke backend");
        Ok(())
    }
}

/// Standalone interface for emitting MCU mixer-control messages to the DAW.
///
/// Implemented by `McuBackend`. `KeystrokeBackend` does NOT implement this —
/// no keystroke equivalent exists for mixer control (no DAW handles "press
/// space to set channel 1 volume to 0.65"). Code that only needs mixer
/// dispatch (test doubles, future sub-systems) can depend on this narrower
/// trait instead of the full `Backend`.
///
/// **Stages 5-7 pending**: actual MCU byte translation requires LUNA profiling.
/// Until that lands, `McuBackend::emit_mixer` logs what it would send.
pub trait MixerBackend {
    /// Emit a single mixer action toward the DAW.
    fn emit_mixer(&mut self, action: &MixerAction) -> Result<()>;

    /// Human-readable name for logging.
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
///
/// The virtual pair is held behind `Rc<RefCell<>>` because the main
/// loop needs the same pair to reply to MCU heartbeat queries.
/// Single-threaded so `Rc` suffices; all borrows are brief and
/// non-overlapping.
pub struct McuBackend {
    pair: Rc<RefCell<VirtualMcuPair>>,
    tap_gap: Duration,
}

impl McuBackend {
    pub fn new(pair: Rc<RefCell<VirtualMcuPair>>) -> Self {
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
        self.pair.borrow_mut().send(press)?;
        thread::sleep(self.tap_gap);
        self.pair.borrow_mut().send(release)?;
        Ok(())
    }

    fn emit_action(&mut self, action: Action) -> Result<()> {
        trace!(?action, "McuBackend: emitting");
        match action {
            Action::Play => self.tap(&MCU_BYTES_PLAY_PRESS, &MCU_BYTES_PLAY_RELEASE),
            Action::Stop => self.tap(&MCU_BYTES_STOP_PRESS, &MCU_BYTES_STOP_RELEASE),
            Action::ReturnToZero => self.tap(&MCU_BYTES_REWIND_PRESS, &MCU_BYTES_REWIND_RELEASE),
            Action::BarForward => self.pair.borrow_mut().send(&MCU_BYTES_BAR_FORWARD),
            Action::BarBackward => self.pair.borrow_mut().send(&MCU_BYTES_BAR_BACKWARD),
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

    /// Override the default no-op with the real (currently stub) MCU mixer path.
    fn emit_mixer(&mut self, action: &MixerAction) -> Result<()> {
        MixerBackend::emit_mixer(self, action)
    }
}

impl MixerBackend for McuBackend {
    fn emit_mixer(&mut self, action: &MixerAction) -> Result<()> {
        // STAGE 5-7 PENDING: actual MCU byte translation needs LUNA profiling.
        // Log what we'd emit so the user can verify routing works end-to-end
        // before the LUNA session that determines the correct byte vocabulary.
        tracing::info!(?action, "mixer: would emit (LUNA profiling pending)");
        Ok(())
    }

    fn name(&self) -> &'static str {
        "mcu-mixer"
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

    // ---- MixerBackend trait surface checks ----------------------------------
    // These compile-time tests verify that MixerAction is publicly accessible
    // and that the MixerBackend trait is visible. The McuBackend impl is tested
    // via main.rs integration; these just confirm the types are wired.

    #[test]
    fn mixer_action_volume_debug_format() {
        let a = MixerAction::Volume { channel: 2, value14: 8192 };
        let s = format!("{a:?}");
        assert!(s.contains("Volume"), "debug should contain 'Volume'");
    }

    #[test]
    fn mixer_action_bank_nav_debug_format() {
        assert!(format!("{:?}", MixerAction::BankPrev).contains("BankPrev"));
        assert!(format!("{:?}", MixerAction::BankNext).contains("BankNext"));
    }

    #[test]
    fn mixer_action_all_variants_are_eq() {
        // Verify PartialEq derived correctly — same channel = equal, different = not.
        assert_eq!(
            MixerAction::Mute { channel: 3 },
            MixerAction::Mute { channel: 3 }
        );
        assert_ne!(
            MixerAction::Mute { channel: 3 },
            MixerAction::Mute { channel: 4 }
        );
        assert_ne!(
            MixerAction::Mute { channel: 0 },
            MixerAction::Solo { channel: 0 }
        );
    }
}
