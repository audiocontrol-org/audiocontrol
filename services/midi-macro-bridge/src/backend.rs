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

/// Pure function — translate a `MixerAction` into the sequence of MCU
/// MIDI byte messages LUNA's surface accepts. Vocabulary captured in
/// `docs/.../research/luna-mcu-mixer-notes.md` from the 2026-04-29
/// hardware profiling session.
///
/// Channel index in the action is bank-relative 0..7; banking state
/// is tracked at a higher layer (main.rs).
///
/// Returns an empty vec for actions that emit nothing (e.g. pan delta 0).
pub fn mixer_action_to_messages(action: &MixerAction) -> Vec<Vec<u8>> {
    match action {
        MixerAction::Volume { channel, value14 } => {
            // Volume requires fader-touch context — LUNA silently
            // discards pitch-bend without a preceding 90 (0x68+ch) 7F
            // touch-on. Synthesise the touch around each value. Adds
            // 2 extra MIDI messages per emission but keeps the bridge
            // stateless. Future optimisation (Phase 9b stage 6+):
            // enable LCXL3 touch events and forward them naturally so
            // touch-on fires once per fader-grab instead of per value.
            let ch = *channel & 0x07;
            let touch_note = 0x68 + ch;
            let pb_status = 0xE0 | ch;
            let lo = (*value14 & 0x7F) as u8;
            let hi = ((*value14 >> 7) & 0x7F) as u8;
            vec![
                vec![0x90, touch_note, 0x7F],
                vec![pb_status, lo, hi],
                vec![0x90, touch_note, 0x00],
            ]
        }
        MixerAction::Pan { channel, delta } => {
            // Sign-magnitude on CC 0x10-0x17 (channel 1):
            //   bit 6 clear = clockwise / right (positive)
            //   bit 6 set   = counter-clockwise / left (negative)
            //   bits 0-5    = magnitude (1..63)
            let ch = *channel & 0x07;
            let cc = 0x10 + ch;
            let vv = if *delta >= 0 {
                (*delta as u8) & 0x3F
            } else {
                0x40 | ((-*delta as u8) & 0x3F)
            };
            if vv == 0 {
                vec![]
            } else {
                vec![vec![0xB0, cc, vv]]
            }
        }
        MixerAction::Mute { channel } => {
            let note = 0x10 + (*channel & 0x07);
            vec![vec![0x90, note, 0x7F], vec![0x90, note, 0x00]]
        }
        MixerAction::Solo { channel } => {
            let note = 0x08 + (*channel & 0x07);
            vec![vec![0x90, note, 0x7F], vec![0x90, note, 0x00]]
        }
        MixerAction::Arm { channel } => {
            let note = *channel & 0x07;
            vec![vec![0x90, note, 0x7F], vec![0x90, note, 0x00]]
        }
        MixerAction::Select { channel } => {
            let note = 0x18 + (*channel & 0x07);
            vec![vec![0x90, note, 0x7F], vec![0x90, note, 0x00]]
        }
        MixerAction::BankPrev => {
            vec![vec![0x90, 0x2E, 0x7F], vec![0x90, 0x2E, 0x00]]
        }
        MixerAction::BankNext => {
            vec![vec![0x90, 0x2F, 0x7F], vec![0x90, 0x2F, 0x00]]
        }
    }
}

impl MixerBackend for McuBackend {
    fn emit_mixer(&mut self, action: &MixerAction) -> Result<()> {
        let messages = mixer_action_to_messages(action);
        let mut pair = self.pair.borrow_mut();
        for msg in messages {
            pair.send(&msg)?;
        }
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

    // ---- mixer_action_to_messages — Phase 9b stage 5 byte translation -------
    // Bytes verified against research/luna-mcu-mixer-notes.md.

    #[test]
    fn volume_channel_1_max_emits_touch_pitchbend_touch() {
        let msgs = mixer_action_to_messages(&MixerAction::Volume {
            channel: 0,
            value14: 0x3FFF,
        });
        assert_eq!(msgs.len(), 3);
        assert_eq!(msgs[0], vec![0x90, 0x68, 0x7F]); // touch-on ch 1
        assert_eq!(msgs[1], vec![0xE0, 0x7F, 0x7F]); // pitch-bend max ch 1
        assert_eq!(msgs[2], vec![0x90, 0x68, 0x00]); // touch-off ch 1
    }

    #[test]
    fn volume_channel_8_min_uses_correct_status_bytes() {
        let msgs = mixer_action_to_messages(&MixerAction::Volume {
            channel: 7,
            value14: 0,
        });
        assert_eq!(msgs.len(), 3);
        assert_eq!(msgs[0], vec![0x90, 0x6F, 0x7F]); // touch-on ch 8 (note 0x68+7)
        assert_eq!(msgs[1], vec![0xE7, 0x00, 0x00]); // pitch-bend min ch 8
        assert_eq!(msgs[2], vec![0x90, 0x6F, 0x00]); // touch-off ch 8
    }

    #[test]
    fn volume_mid_value_splits_correctly_into_lo_hi() {
        let msgs = mixer_action_to_messages(&MixerAction::Volume {
            channel: 0,
            value14: 0x2000, // 14-bit midpoint
        });
        assert_eq!(msgs[1], vec![0xE0, 0x00, 0x40]); // 0x2000 = lo=0, hi=0x40
    }

    #[test]
    fn pan_positive_delta_clockwise_no_bit6() {
        let msgs = mixer_action_to_messages(&MixerAction::Pan {
            channel: 0,
            delta: 1,
        });
        assert_eq!(msgs, vec![vec![0xB0, 0x10, 0x01]]);
    }

    #[test]
    fn pan_negative_delta_counter_clockwise_bit6_set() {
        let msgs = mixer_action_to_messages(&MixerAction::Pan {
            channel: 0,
            delta: -1,
        });
        assert_eq!(msgs, vec![vec![0xB0, 0x10, 0x41]]); // 0x40 | 1
    }

    #[test]
    fn pan_zero_delta_emits_nothing() {
        let msgs = mixer_action_to_messages(&MixerAction::Pan {
            channel: 0,
            delta: 0,
        });
        assert!(msgs.is_empty());
    }

    #[test]
    fn pan_channel_index_offsets_cc() {
        // Channel 5 → CC 0x14
        let msgs = mixer_action_to_messages(&MixerAction::Pan {
            channel: 4,
            delta: 3,
        });
        assert_eq!(msgs, vec![vec![0xB0, 0x14, 0x03]]);
    }

    #[test]
    fn mute_channel_3_emits_note_0x12_press_release() {
        let msgs = mixer_action_to_messages(&MixerAction::Mute { channel: 2 });
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x12, 0x7F], vec![0x90, 0x12, 0x00]]
        );
    }

    #[test]
    fn solo_channel_1_emits_note_0x08() {
        let msgs = mixer_action_to_messages(&MixerAction::Solo { channel: 0 });
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x08, 0x7F], vec![0x90, 0x08, 0x00]]
        );
    }

    #[test]
    fn arm_channel_1_emits_note_0x00() {
        let msgs = mixer_action_to_messages(&MixerAction::Arm { channel: 0 });
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x00, 0x7F], vec![0x90, 0x00, 0x00]]
        );
    }

    #[test]
    fn select_channel_8_emits_note_0x1F() {
        let msgs = mixer_action_to_messages(&MixerAction::Select { channel: 7 });
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x1F, 0x7F], vec![0x90, 0x1F, 0x00]]
        );
    }

    #[test]
    fn bank_prev_emits_note_0x2e() {
        let msgs = mixer_action_to_messages(&MixerAction::BankPrev);
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x2E, 0x7F], vec![0x90, 0x2E, 0x00]]
        );
    }

    #[test]
    fn bank_next_emits_note_0x2f() {
        let msgs = mixer_action_to_messages(&MixerAction::BankNext);
        assert_eq!(
            msgs,
            vec![vec![0x90, 0x2F, 0x7F], vec![0x90, 0x2F, 0x00]]
        );
    }

    #[test]
    fn channel_indices_above_7_are_masked() {
        // Defence in depth — main loop should always send 0..7, but mask
        // here too so a bug elsewhere can't generate invalid MIDI.
        let msgs = mixer_action_to_messages(&MixerAction::Mute { channel: 99 });
        // 99 & 0x07 = 3 → note 0x10 + 3 = 0x13
        assert_eq!(msgs[0], vec![0x90, 0x13, 0x7F]);
    }
}
