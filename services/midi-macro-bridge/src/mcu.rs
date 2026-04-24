//! MCU (Mackie Control Universal) input parsing.
//!
//! The bridge registers a virtual MCU endpoint that LUNA writes to as
//! if the bridge were a physical control surface. LUNA pushes a lot of
//! MCU vocabulary at us — button LEDs, V-Pot rings, VU meters, faders,
//! LCD dumps, heartbeat probes — but only a small slice matters for
//! closed-loop locate: the 10-digit BBT / timecode display that lives
//! in CCs `B0 40`–`B0 49`.
//!
//! This module implements:
//!
//! - `parse_cc_display` — maps a single `B0 4X vv` message to a typed
//!   `DigitUpdate`. Pure function; unit-tested with captured bytes.
//! - `PositionTracker` — accumulates digit updates, maintains the full
//!   10-digit display state, and reports position changes as
//!   `PositionUpdate` events when the composed bar number changes.
//!
//! See `MCU-NOTES.md` for the reverse-engineered LUNA-specific layout
//! and the capture logs that back it up.
//!
//! ## Key facts from the probe
//!
//! - CCs `B0 40`–`B0 49` update individual digits of the 10-digit
//!   display. `B0 40` is the rightmost digit, `B0 49` is the
//!   leftmost — indices run right-to-left across the surface.
//! - In BEATS/BBT mode, the layout is: `d9 d8 d7 | d6 d5 | d4 d3 d2 d1 d0`
//!   with bar on d7/d8/d9, beat on d5/d6, tick on d0/d1/d2.
//! - Values are 7-bit ASCII characters. `0x20` = blank, `0x30`–`0x39`
//!   = ASCII '0'–'9'. Other characters have not been observed from
//!   LUNA and are treated as invalid.
//! - LUNA sends only the digits that changed, so the tracker must
//!   maintain state across messages.

use std::fmt;

/// The bridge only cares about the 10-digit timecode display (CC
/// indices `B0 40`–`B0 49`); everything else on the inbound MCU
/// stream is a no-op for closed-loop locate.
pub const TIMECODE_CC_MIN: u8 = 0x40;
pub const TIMECODE_CC_MAX: u8 = 0x49;
pub const DIGIT_COUNT: usize = (TIMECODE_CC_MAX - TIMECODE_CC_MIN + 1) as usize;

/// Digit index within the display (0 = rightmost, 9 = leftmost).
pub type DigitIndex = u8;

/// Character value a digit can hold. We model the two characters LUNA
/// actually emits — blank and ASCII digit — and reject anything else
/// as a malformed update. This keeps the PositionTracker honest:
/// unknown bytes don't silently compute to zero.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DigitChar {
    Blank,
    Digit(u8),
}

impl DigitChar {
    /// Numeric value for composing multi-digit fields. Blank contributes
    /// zero — e.g. `bar 65` has `d7=5`, `d8=6`, `d9=blank`, so the
    /// composed value is `0 * 100 + 6 * 10 + 5 = 65`.
    pub fn as_u32(self) -> u32 {
        match self {
            DigitChar::Blank => 0,
            DigitChar::Digit(v) => v as u32,
        }
    }

    fn from_byte(value: u8) -> Option<DigitChar> {
        match value {
            0x20 => Some(DigitChar::Blank),
            0x30..=0x39 => Some(DigitChar::Digit(value - 0x30)),
            _ => None,
        }
    }
}

impl fmt::Display for DigitChar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DigitChar::Blank => f.write_str(" "),
            DigitChar::Digit(v) => write!(f, "{v}"),
        }
    }
}

/// Result of parsing a single CC message that might touch the display.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DigitUpdate {
    pub index: DigitIndex,
    pub value: DigitChar,
}

/// Parse a 3-byte CC (`Bn cc vv`) and, if it targets the timecode
/// display digits, return the typed update. Returns `None` for:
///   - messages that aren't 3 bytes starting with a CC status byte
///   - CCs outside the timecode display range
///   - display-range CCs with byte values LUNA doesn't emit
///
/// MCU conventionally uses channel 0, but we accept any channel
/// (status byte `0xB0..=0xBF`) to be robust against DAW variation.
pub fn parse_cc_display(bytes: &[u8]) -> Option<DigitUpdate> {
    if bytes.len() != 3 {
        return None;
    }
    let status = bytes[0];
    if status & 0xF0 != 0xB0 {
        return None;
    }
    let cc = bytes[1];
    if !(TIMECODE_CC_MIN..=TIMECODE_CC_MAX).contains(&cc) {
        return None;
    }
    let value = DigitChar::from_byte(bytes[2])?;
    Some(DigitUpdate {
        index: cc - TIMECODE_CC_MIN,
        value,
    })
}

/// A position change observed by the tracker. Emitted whenever the
/// composed bar value flips; the `previous_bar` / `bar` pair lets
/// downstream code log the delta and detect direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PositionUpdate {
    pub previous_bar: u32,
    pub bar: u32,
}

/// Maintains the current state of the 10-digit timecode display. LUNA
/// sends sparse updates (only digits that changed), so the tracker is
/// the single source of truth for "what's the current position?".
///
/// All digits start as `Blank` (matching LUNA's surface-init burst
/// where every digit is cleared to `0x20`).
#[derive(Debug, Clone)]
pub struct PositionTracker {
    digits: [DigitChar; DIGIT_COUNT],
    last_emitted_bar: u32,
}

impl Default for PositionTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl PositionTracker {
    pub fn new() -> Self {
        Self {
            digits: [DigitChar::Blank; DIGIT_COUNT],
            last_emitted_bar: 0,
        }
    }

    /// Apply a digit update. Returns `Some(PositionUpdate)` if the
    /// composed bar value changed as a result; `None` if the update
    /// affected a non-bar digit (beat, tick) or left the bar value
    /// unchanged.
    pub fn apply(&mut self, update: DigitUpdate) -> Option<PositionUpdate> {
        let idx = update.index as usize;
        if idx >= DIGIT_COUNT {
            return None;
        }
        self.digits[idx] = update.value;

        let bar = self.current_bar();
        // LUNA's bars are 1-based; a composed bar of 0 after we've
        // already emitted a real bar is a digit-carry transient at
        // decade boundaries (e.g. 9→10: d7 rolls '9'→'0' before d8
        // goes blank→'1', so the midpoint composes to 0). Treating it
        // as a real position update fools the closed-loop controller
        // into nudging backward for one iteration before the second
        // update arrives.
        if bar == 0 && self.last_emitted_bar != 0 {
            return None;
        }
        if bar != self.last_emitted_bar {
            let previous_bar = self.last_emitted_bar;
            self.last_emitted_bar = bar;
            Some(PositionUpdate {
                previous_bar,
                bar,
            })
        } else {
            None
        }
    }

    /// Current bar value, composed from digits 7, 8, 9 (BBT layout).
    /// When all three are blank (before LUNA has ever sent the display)
    /// this returns 0 — callers that need to distinguish "before first
    /// update" from "on bar 0" should track that via the update events.
    pub fn current_bar(&self) -> u32 {
        self.digit(9).as_u32() * 100 + self.digit(8).as_u32() * 10 + self.digit(7).as_u32()
    }

    /// Current beat value, composed from digits 5 and 6.
    pub fn current_beat(&self) -> u32 {
        self.digit(6).as_u32() * 10 + self.digit(5).as_u32()
    }

    /// Current tick value, composed from digits 0, 1, 2 (we ignore the
    /// rarely-used tick ten-thousands / thousands digits — they stay
    /// blank in every capture we've seen).
    pub fn current_tick(&self) -> u32 {
        self.digit(2).as_u32() * 100 + self.digit(1).as_u32() * 10 + self.digit(0).as_u32()
    }

    fn digit(&self, idx: DigitIndex) -> DigitChar {
        self.digits[idx as usize]
    }
}

// ---- MCU handshake output --------------------------------------------

/// Mackie MCU manufacturer ID prefix (shared across the protocol
/// family: MCU, MCU Pro, Logic Control, HUI-compatible surfaces).
const MACKIE_SYSEX_PREFIX: [u8; 4] = [0xF0, 0x00, 0x00, 0x66];

/// Model ID we claim when responding to LUNA's heartbeat. `0x14` is
/// "MCU Pro / Logic Control", which is what LUNA's other outbound
/// messages already address (e.g., the LCD SysEx on the inbound side
/// uses `F0 00 00 66 14 12 ...`).
pub const MCU_MODEL_ID: u8 = 0x14;

/// Detect LUNA's MCU heartbeat probe. LUNA sends `F0 00 00 66 1X 00 F7`
/// for each model ID `X` in `0x10..=0x15` every 5 seconds. Returns the
/// queried model ID if the bytes match the heartbeat shape.
pub fn parse_heartbeat_query(bytes: &[u8]) -> Option<u8> {
    if bytes.len() == 7
        && bytes[0..4] == MACKIE_SYSEX_PREFIX
        && bytes[5] == 0x00
        && bytes[6] == 0xF7
    {
        Some(bytes[4])
    } else {
        None
    }
}

/// Build an MCU identity reply for the given model ID. Format:
/// `F0 00 00 66 <modelId> 01 <serial 7 bytes> <version 4 bytes> F7`.
/// The identity reply tells LUNA "I'm a live MCU Pro surface, keep
/// sending me updates" so the surface doesn't time out.
///
/// Serial and version bytes are arbitrary ASCII chosen to identify
/// this implementation. If LUNA turns out to validate specific
/// values (unlikely but possible), we'll adjust during the Phase 3c
/// discovery session.
pub fn mcu_identity_reply(model_id: u8) -> Vec<u8> {
    let mut reply = Vec::with_capacity(18);
    reply.extend_from_slice(&MACKIE_SYSEX_PREFIX);
    reply.push(model_id);
    reply.push(0x01); // "host connection reply / identity"
    reply.extend_from_slice(b"ACMMB01"); // 7-byte ASCII serial
    reply.extend_from_slice(b"v010"); // 4-byte ASCII version
    reply.push(0xF7);
    reply
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- parse_cc_display ------------------------------------------------

    #[test]
    fn parses_digit_in_range() {
        let update = parse_cc_display(&[0xB0, 0x47, 0x35]).unwrap();
        assert_eq!(update.index, 7);
        assert_eq!(update.value, DigitChar::Digit(5));
    }

    #[test]
    fn parses_blank() {
        let update = parse_cc_display(&[0xB0, 0x40, 0x20]).unwrap();
        assert_eq!(update.index, 0);
        assert_eq!(update.value, DigitChar::Blank);
    }

    #[test]
    fn accepts_any_midi_channel() {
        // Channel 3 — `0xB3`. MCU is typically channel 0, but the
        // parser shouldn't care.
        let update = parse_cc_display(&[0xB3, 0x45, 0x31]).unwrap();
        assert_eq!(update.index, 5);
        assert_eq!(update.value, DigitChar::Digit(1));
    }

    #[test]
    fn rejects_non_cc_status() {
        assert_eq!(parse_cc_display(&[0x90, 0x40, 0x20]), None); // note on
        assert_eq!(parse_cc_display(&[0xE0, 0x00, 0x00]), None); // pitch bend
        assert_eq!(parse_cc_display(&[0xF0, 0x00, 0x00]), None); // sysex start
    }

    #[test]
    fn rejects_cc_outside_display_range() {
        assert_eq!(parse_cc_display(&[0xB0, 0x30, 0x00]), None); // V-Pot ring
        assert_eq!(parse_cc_display(&[0xB0, 0x3F, 0x00]), None); // just below
        assert_eq!(parse_cc_display(&[0xB0, 0x4A, 0x00]), None); // just above
    }

    #[test]
    fn rejects_unexpected_byte_values() {
        // LUNA only ever emits blank (0x20) or ASCII digit (0x30-0x39).
        // Anything else is a parse error, not silently zero.
        assert_eq!(parse_cc_display(&[0xB0, 0x40, 0x2E]), None); // '.'
        assert_eq!(parse_cc_display(&[0xB0, 0x40, 0x41]), None); // 'A'
        assert_eq!(parse_cc_display(&[0xB0, 0x40, 0x7F]), None); // max 7-bit
    }

    #[test]
    fn rejects_wrong_length() {
        assert_eq!(parse_cc_display(&[0xB0]), None);
        assert_eq!(parse_cc_display(&[0xB0, 0x40]), None);
        assert_eq!(parse_cc_display(&[0xB0, 0x40, 0x30, 0x00]), None);
    }

    // ---- PositionTracker -------------------------------------------------

    fn feed(tracker: &mut PositionTracker, cc: u8, value: u8) -> Option<PositionUpdate> {
        let update = parse_cc_display(&[0xB0, cc, value]).expect("parsing shouldn't fail in test");
        tracker.apply(update)
    }

    #[test]
    fn new_tracker_reports_bar_zero_blank_state() {
        let t = PositionTracker::new();
        assert_eq!(t.current_bar(), 0);
        assert_eq!(t.current_beat(), 0);
        assert_eq!(t.current_tick(), 0);
    }

    #[test]
    fn bar_composes_from_three_digits() {
        let mut t = PositionTracker::new();
        feed(&mut t, 0x47, 0x35); // d7 = '5'
        feed(&mut t, 0x48, 0x36); // d8 = '6'
        feed(&mut t, 0x49, 0x37); // d9 = '7'
        assert_eq!(t.current_bar(), 765);
    }

    #[test]
    fn blank_digits_contribute_zero_to_bar_value() {
        // d9 blank (unset), d8='6', d7='5' → bar 65
        let mut t = PositionTracker::new();
        feed(&mut t, 0x47, 0x35);
        feed(&mut t, 0x48, 0x36);
        assert_eq!(t.current_bar(), 65);
    }

    #[test]
    fn emits_position_update_on_bar_change() {
        let mut t = PositionTracker::new();
        let first = feed(&mut t, 0x47, 0x31);
        assert_eq!(first, Some(PositionUpdate { previous_bar: 0, bar: 1 }));
        // Same d7 value resent — no change event.
        let same = feed(&mut t, 0x47, 0x31);
        assert_eq!(same, None);
        // Step to bar 2.
        let step = feed(&mut t, 0x47, 0x32);
        assert_eq!(step, Some(PositionUpdate { previous_bar: 1, bar: 2 }));
    }

    #[test]
    fn beat_and_tick_updates_do_not_emit_position_update() {
        let mut t = PositionTracker::new();
        feed(&mut t, 0x47, 0x31); // bar → 1, emits
        assert_eq!(feed(&mut t, 0x45, 0x32), None); // beat change, silent
        assert_eq!(feed(&mut t, 0x42, 0x33), None); // tick change, silent
        assert_eq!(t.current_bar(), 1);
        assert_eq!(t.current_beat(), 2);
        assert_eq!(t.current_tick(), 300);
    }

    /// Sequence captured in `probe-barstep.log`: from LUNA stopped at
    /// bar 1, user pressed `]` five times and `[` five times. The
    /// tracker must report each bar transition and the final rest at
    /// bar 1.
    #[test]
    fn replays_probe_barstep_capture() {
        let mut t = PositionTracker::new();

        // First `]`: LUNA sends a full refresh (tick=0, beat=1, bar=2).
        feed(&mut t, 0x40, 0x30); // d0 = '0' (tick)
        feed(&mut t, 0x41, 0x30); // d1 = '0'
        feed(&mut t, 0x42, 0x30); // d2 = '0'
        feed(&mut t, 0x45, 0x31); // d5 = '1' (beat)
        let step = feed(&mut t, 0x47, 0x32); // d7 = '2' (bar)
        assert_eq!(step, Some(PositionUpdate { previous_bar: 0, bar: 2 }));

        // Subsequent forward steps only touch d7.
        assert_eq!(
            feed(&mut t, 0x47, 0x33),
            Some(PositionUpdate { previous_bar: 2, bar: 3 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x34),
            Some(PositionUpdate { previous_bar: 3, bar: 4 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x35),
            Some(PositionUpdate { previous_bar: 4, bar: 5 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x36),
            Some(PositionUpdate { previous_bar: 5, bar: 6 })
        );

        // Backward steps.
        assert_eq!(
            feed(&mut t, 0x47, 0x35),
            Some(PositionUpdate { previous_bar: 6, bar: 5 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x34),
            Some(PositionUpdate { previous_bar: 5, bar: 4 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x33),
            Some(PositionUpdate { previous_bar: 4, bar: 3 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x32),
            Some(PositionUpdate { previous_bar: 3, bar: 2 })
        );
        assert_eq!(
            feed(&mut t, 0x47, 0x31),
            Some(PositionUpdate { previous_bar: 2, bar: 1 })
        );
    }

    /// Digit-carry case from `probe-ts.log` line containing
    /// `d47=30, d48=37` sent in the same message batch: bar 69 → 70.
    /// The tracker must see the composed bar as 70 after both CCs,
    /// and emit a single PositionUpdate with the right previous/new.
    #[test]
    fn digit_carry_across_bar_9_to_10_boundary() {
        let mut t = PositionTracker::new();

        // Starting state: bar 69 (d7='9', d8='6').
        feed(&mut t, 0x47, 0x39);
        feed(&mut t, 0x48, 0x36);
        assert_eq!(t.current_bar(), 69);

        // LUNA sends d7='0' first (partial state in flight: bar = 60).
        let intermediate = feed(&mut t, 0x47, 0x30);
        assert_eq!(
            intermediate,
            Some(PositionUpdate { previous_bar: 69, bar: 60 })
        );

        // Then d8='7' — now bar = 70, emit.
        let committed = feed(&mut t, 0x48, 0x37);
        assert_eq!(
            committed,
            Some(PositionUpdate { previous_bar: 60, bar: 70 })
        );
    }

    /// 9→10 boundary where the d8 tens-digit is still blank during the
    /// first-phase d7 update. The composed intermediate is bar=0,
    /// which we filter so the closed-loop controller doesn't nudge
    /// backward on spurious decade-carry transients.
    ///
    /// Captured from `luna-locate.log`: at iterations 9/19/29/39, the
    /// controller observed `before_bar=N9 after_bar=0` with
    /// `actual_delta=-9`, then a second update arrived with
    /// `wait_ms=0` reporting the real post-nudge bar.
    #[test]
    fn suppresses_bar_zero_transient_at_decade_boundary() {
        let mut t = PositionTracker::new();

        // Arrive at bar 9 from start (single d7 update).
        let to_nine = feed(&mut t, 0x47, 0x39);
        assert_eq!(to_nine, Some(PositionUpdate { previous_bar: 0, bar: 9 }));

        // LUNA's first-phase update: d7 rolls '9' → '0'. d8 is still
        // blank, so current_bar composes to 0. Guard must swallow it.
        let transient = feed(&mut t, 0x47, 0x30);
        assert_eq!(transient, None);
        assert_eq!(t.current_bar(), 0);
        // Internal last_emitted_bar must stay at 9 so the next real
        // emission carries the correct previous_bar.

        // Second-phase update: d8 blank → '1'. Composed bar = 10.
        let committed = feed(&mut t, 0x48, 0x31);
        assert_eq!(
            committed,
            Some(PositionUpdate { previous_bar: 9, bar: 10 })
        );
    }

    /// Initial composed value of 0 (before the first non-zero bar is
    /// seen) must not be filtered — the guard only applies after
    /// `last_emitted_bar` has advanced past 0.
    #[test]
    fn bar_zero_filter_does_not_suppress_initial_state() {
        let mut t = PositionTracker::new();
        // No emission on a blank→'0' digit write because bar is still 0
        // and last_emitted_bar is still 0 (nothing to report).
        assert_eq!(feed(&mut t, 0x47, 0x30), None);
        // Then an actual move to bar 1 emits normally.
        assert_eq!(
            feed(&mut t, 0x47, 0x31),
            Some(PositionUpdate { previous_bar: 0, bar: 1 })
        );
    }

    #[test]
    fn current_beat_composes_across_two_digits() {
        let mut t = PositionTracker::new();
        feed(&mut t, 0x45, 0x33); // beat ones = 3
        feed(&mut t, 0x46, 0x31); // beat tens = 1 → beat 13
        assert_eq!(t.current_beat(), 13);
    }

    #[test]
    fn current_tick_composes_across_three_digits() {
        let mut t = PositionTracker::new();
        feed(&mut t, 0x40, 0x37); // tick ones = 7
        feed(&mut t, 0x41, 0x32); // tick tens = 2
        feed(&mut t, 0x42, 0x34); // tick hundreds = 4
        assert_eq!(t.current_tick(), 427);
    }

    // ---- MCU handshake ---------------------------------------------------

    #[test]
    fn parses_heartbeat_query_across_all_observed_model_ids() {
        for model in 0x10..=0x15 {
            let bytes = [0xF0, 0x00, 0x00, 0x66, model, 0x00, 0xF7];
            assert_eq!(parse_heartbeat_query(&bytes), Some(model));
        }
    }

    #[test]
    fn rejects_non_heartbeat_sysex() {
        // Identity reply we'd emit — not a query.
        let reply = mcu_identity_reply(0x14);
        assert_eq!(parse_heartbeat_query(&reply), None);
        // LCD dump from probe-idle.log — starts with the Mackie
        // prefix but has a different command byte and is much longer.
        assert_eq!(
            parse_heartbeat_query(&[
                0xF0, 0x00, 0x00, 0x66, 0x14, 0x12, 0x00, 0x53, 0x43, 0xF7
            ]),
            None
        );
        // Non-Mackie SysEx.
        assert_eq!(
            parse_heartbeat_query(&[0xF0, 0x41, 0x10, 0x14, 0x00, 0xF7]),
            None
        );
    }

    #[test]
    fn identity_reply_has_correct_envelope() {
        let reply = mcu_identity_reply(MCU_MODEL_ID);
        assert_eq!(reply.len(), 18);
        assert_eq!(&reply[0..4], &MACKIE_SYSEX_PREFIX);
        assert_eq!(reply[4], MCU_MODEL_ID);
        assert_eq!(reply[5], 0x01);
        assert_eq!(*reply.last().unwrap(), 0xF7);
        // No raw 0xF0/0xF7 in the payload (they'd break SysEx parsing).
        assert!(reply[6..17].iter().all(|&b| b != 0xF0 && b != 0xF7));
    }

    #[test]
    fn identity_reply_echoes_requested_model_id() {
        for model in 0x10..=0x15 {
            let reply = mcu_identity_reply(model);
            assert_eq!(reply[4], model);
        }
    }
}
