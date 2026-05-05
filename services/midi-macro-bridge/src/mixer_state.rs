//! Per-strip mixer state mirrored from LUNA's MCU output stream.
//!
//! LUNA echoes button state back to the surface via note-on messages (see
//! `mcu::parse_state_change`). This module owns the per-strip bookkeeping
//! and is the source of truth for "what does LUNA currently have set for
//! mute/solo/arm/select on each strip in the current bank?".
//!
//! The struct starts fully false (all LEDs dark). LUNA sends a surface-init
//! burst when the MCU connection is first established; that burst drives all
//! 32 states from unknown to their true values. Subsequent single-strip
//! echoes keep the struct in sync.

use crate::mcu::McuStateChange;

/// Per-strip state mirrored from LUNA's MCU output stream.
///
/// `strip` indices are bank-relative (0..=7) — the same coordinate
/// system that LUNA uses for the note numbers it sends us and that the
/// LCXL3 fader buttons occupy physically.
#[derive(Debug, Default, Clone, Copy)]
pub struct StripStates {
    pub mute: [bool; 8],
    pub solo: [bool; 8],
    pub arm: [bool; 8],
    pub select: [bool; 8],
}

impl StripStates {
    /// Apply a state change. Returns `true` if the stored value actually
    /// changed, `false` if the incoming state matched what was already
    /// stored (no-op). Callers can use the return value to skip redundant
    /// LED writes.
    pub fn apply(&mut self, change: McuStateChange) -> bool {
        match change {
            McuStateChange::Mute { strip, on } => {
                let idx = strip as usize;
                let prev = self.mute[idx];
                self.mute[idx] = on;
                prev != on
            }
            McuStateChange::Solo { strip, on } => {
                let idx = strip as usize;
                let prev = self.solo[idx];
                self.solo[idx] = on;
                prev != on
            }
            McuStateChange::Arm { strip, on } => {
                let idx = strip as usize;
                let prev = self.arm[idx];
                self.arm[idx] = on;
                prev != on
            }
            McuStateChange::Select { strip, on } => {
                let idx = strip as usize;
                let prev = self.select[idx];
                self.select[idx] = on;
                prev != on
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcu::McuStateChange;

    // ---- apply() basic behaviour ------------------------------------------

    #[test]
    fn apply_mute_changes_correct_strip() {
        let mut s = StripStates::default();
        let changed = s.apply(McuStateChange::Mute { strip: 3, on: true });
        assert!(changed);
        assert!(s.mute[3]);
        // Other strips must be unchanged.
        for i in [0usize, 1, 2, 4, 5, 6, 7] {
            assert!(!s.mute[i], "strip {i} should still be false");
        }
    }

    #[test]
    fn apply_solo_changes_correct_strip() {
        let mut s = StripStates::default();
        assert!(s.apply(McuStateChange::Solo { strip: 5, on: true }));
        assert!(s.solo[5]);
    }

    #[test]
    fn apply_arm_changes_correct_strip() {
        let mut s = StripStates::default();
        assert!(s.apply(McuStateChange::Arm { strip: 0, on: true }));
        assert!(s.arm[0]);
    }

    #[test]
    fn apply_select_changes_correct_strip() {
        let mut s = StripStates::default();
        assert!(s.apply(McuStateChange::Select { strip: 7, on: true }));
        assert!(s.select[7]);
    }

    #[test]
    fn apply_returns_false_when_state_unchanged() {
        let mut s = StripStates::default();
        // Default is false; writing false again is a no-op.
        assert!(!s.apply(McuStateChange::Mute { strip: 2, on: false }));
        // Set true, then set true again.
        s.apply(McuStateChange::Mute { strip: 2, on: true });
        assert!(!s.apply(McuStateChange::Mute { strip: 2, on: true }));
    }

    #[test]
    fn apply_returns_true_on_transition_true_to_false() {
        let mut s = StripStates::default();
        s.apply(McuStateChange::Solo { strip: 1, on: true });
        assert!(s.apply(McuStateChange::Solo { strip: 1, on: false }));
        assert!(!s.solo[1]);
    }

    #[test]
    fn apply_independent_field_types_do_not_cross_contaminate() {
        let mut s = StripStates::default();
        s.apply(McuStateChange::Mute { strip: 0, on: true });
        // Mute strip 0 = true; solo/arm/select strip 0 must remain false.
        assert!(!s.solo[0]);
        assert!(!s.arm[0]);
        assert!(!s.select[0]);
    }

    #[test]
    fn apply_all_strips_each_type() {
        // Verify that every strip index 0..7 is independently addressable
        // for all four state types.
        for strip in 0u8..8 {
            let mut s = StripStates::default();
            s.apply(McuStateChange::Mute { strip, on: true });
            assert!(s.mute[strip as usize]);
            s.apply(McuStateChange::Mute { strip, on: false });
            assert!(!s.mute[strip as usize]);

            s.apply(McuStateChange::Solo { strip, on: true });
            assert!(s.solo[strip as usize]);

            s.apply(McuStateChange::Arm { strip, on: true });
            assert!(s.arm[strip as usize]);

            s.apply(McuStateChange::Select { strip, on: true });
            assert!(s.select[strip as usize]);
        }
    }
}
