//! Novation Launch Control XL Mk3 protocol module.
//!
//! Owns the LCXL3-specific knowledge the rest of the bridge needs:
//!
//! - Byte sequences for the DAW activation handshake (probe, Universal
//!   Device Inquiry, claim, host-name page metadata, transport-LED
//!   preset) plus the deactivation SysEx.
//! - `parse(&[u8]) -> Option<TransportEvent>` that converts captured
//!   LCXL3 CC bytes into the new state-machine variants from Phase 5b
//!   (`TogglePlay`, `NudgeForward`, `NudgeBackward`).
//! - `led_for_state(&TransportState)` that returns the transport-button
//!   LED CC corresponding to each transport state, or `None` when no
//!   LED change is needed.
//! - `handshake_send` and `deactivate_send` helpers that fire the
//!   activation / deactivation sequence on a `MidiOutputConnection`.
//!
//! See `docs/1.0/001-IN-PROGRESS/midi-macro-bridge/lcxl3-handshake-trace.md`
//! for the byte-level decode of the captured Live → LCXL3 init that
//! every constant in this module is derived from.
//!
//! Threading: this module is purely synchronous. The
//! `handshake_send` helper sleeps briefly between SysEx messages
//! (mirroring Live's pacing), so it is intended to run on the bridge's
//! main thread at startup, not from a MIDI callback.
//!
//! Encoder semantics: the LCXL3's transport encoder uses sign-magnitude
//! relative values on channel 7 — bit 6 set means negative direction,
//! the low bits carry the magnitude. The parser unpacks this and clamps
//! magnitude to `MAX_NUDGE_PER_PACKET` so a fast spin can't queue a
//! runaway sequence of nudges into the state machine.
//!
//! The `dead_code` allow on the module is transitional: Phase 5a ships
//! these symbols, Phase 5d (`main.rs` wiring) consumes them. Once 5d
//! lands, remove the allow and let the compiler catch genuinely unused
//! exports.

#![allow(dead_code)]

use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Result};
use midir::MidiOutputConnection;

use crate::state::{TransportEvent, TransportState};

// ---- Handshake byte sequences ---------------------------------------------

/// `F0 00 20 29 02 15 02 00 F7` — DAW probe / disconnect. Live sends
/// this as the opening handshake byte and again as the closing one.
/// The same byte is therefore reused as the bridge's deactivation
/// SysEx on shutdown.
pub const DAW_PROBE: [u8; 9] = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x02, 0x00, 0xF7];

/// `F0 00 20 29 02 15 02 7F F7` — DAW claim. The device echoes this
/// back when it accepts being driven by a DAW; transport buttons start
/// emitting CCs only after this exchange.
pub const DAW_CLAIM: [u8; 9] = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x02, 0x7F, 0xF7];

/// `F0 7E 7F 06 01 F7` — Universal Device Inquiry, sent between the
/// probe and the claim. The device replies with its identity SysEx;
/// the bridge consumes that reply via the standard byte-trace path
/// rather than parsing it.
pub const UDI: [u8; 6] = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];

/// Same bytes as `DAW_PROBE`. Named separately so callers can express
/// intent at the call site (`deactivate_send` vs `handshake_send`).
pub const DAW_DEACTIVATE: [u8; 9] = DAW_PROBE;

/// Build the host-identification SysEx Live sends after `02 7F`. Uses
/// page `0x36` with sub-id `01` carrying ASCII bytes for the host
/// name. The device displays this string somewhere on its panel when
/// it has nothing else to show, so we use `"Bridge"` to make it clear
/// what's driving the device.
///
/// Returns three SysEx messages: page-open `04 36 62`, name `06 36 01
/// <ascii>`, page-close `04 36 7F`. Send them in that order.
pub fn host_name_sequence(name: &[u8]) -> Vec<Vec<u8>> {
    let mut name_msg = vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x06, 0x36, 0x01];
    name_msg.extend_from_slice(name);
    name_msg.push(0xF7);
    vec![
        vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x04, 0x36, 0x62, 0xF7],
        name_msg,
        vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x04, 0x36, 0x7F, 0xF7],
    ]
}

// ---- Transport-button LED CCs ---------------------------------------------

/// `B0 74 27` — Play LED in "stopped / idle" colour.
pub const LED_PLAY_STOPPED: [u8; 3] = [0xB0, 0x74, 0x27];

/// `B0 74 21` — Play LED in "playing" colour (green).
pub const LED_PLAY_PLAYING: [u8; 3] = [0xB0, 0x74, 0x21];

/// `B0 76 07` — Record LED in "idle / not armed" colour. The bridge
/// sets this once during the handshake; Record isn't mapped in v1 so
/// the LED stays static.
pub const LED_RECORD_IDLE: [u8; 3] = [0xB0, 0x76, 0x07];

// ---- Transport-input CC layout -------------------------------------------

/// LCXL3 channel-1 status byte for the Play / Stop / Record button
/// row. The Play/Stop toggle is CC `0x74`.
const CH1_CC_STATUS: u8 = 0xB0;
const PLAY_BUTTON_CC: u8 = 0x74;
/// Magic press value — `0x7F` on press, `0x00` on release. The state
/// machine only fires on press; the release event is silently dropped.
const PRESS_VELOCITY: u8 = 0x7F;

/// LCXL3 channel-7 status byte for the transport encoder (the
/// dedicated forward/back encoder, not the V-pots). The encoder
/// sends sign-magnitude values on CCs `0x1E` and `0x1F` — captured
/// during the live trace.
const CH7_CC_STATUS: u8 = 0xB6;
const ENCODER_CC_PRIMARY: u8 = 0x1E;
const ENCODER_CC_SECONDARY: u8 = 0x1F;
/// Bit 6 of the encoder value indicates direction — set means
/// negative (backward), clear means positive (forward). The low six
/// bits carry the magnitude.
const ENCODER_DIR_MASK: u8 = 0x40;
const ENCODER_MAG_MASK: u8 = 0x3F;

/// Hard cap on nudge magnitude per encoder packet. A fast spin can
/// pack many ticks into one packet; without a cap, the state machine
/// would emit dozens of `BarForward` actions and the user would lose
/// control of the playhead. Four bars per packet is enough to feel
/// responsive without runaway risk.
pub const MAX_NUDGE_PER_PACKET: u32 = 4;

// ---- Parser --------------------------------------------------------------

/// Convert a single LCXL3 MIDI message into the corresponding
/// `TransportEvent`. Returns `None` for any message the bridge doesn't
/// map (release events, encoder values that decode to zero, every
/// other CC the LCXL3 emits — faders, V-pots, pads, etc.).
///
/// Encoder magnitude is clamped to `MAX_NUDGE_PER_PACKET` here so the
/// state machine sees bounded values.
pub fn parse(bytes: &[u8]) -> Option<TransportEvent> {
    if bytes.len() != 3 {
        return None;
    }
    let status = bytes[0];
    let cc = bytes[1];
    let value = bytes[2];

    // Play/Stop toggle button: only the press fires an event; releases
    // are silently dropped.
    if status == CH1_CC_STATUS && cc == PLAY_BUTTON_CC && value == PRESS_VELOCITY {
        return Some(TransportEvent::TogglePlay);
    }

    // Transport encoder rotation. Both CCs (#30 and #31) appear in
    // captures; treat them identically for nudge purposes.
    if status == CH7_CC_STATUS
        && (cc == ENCODER_CC_PRIMARY || cc == ENCODER_CC_SECONDARY)
    {
        let magnitude = (value & ENCODER_MAG_MASK) as u32;
        if magnitude == 0 {
            return None;
        }
        let clamped = magnitude.min(MAX_NUDGE_PER_PACKET);
        if value & ENCODER_DIR_MASK != 0 {
            return Some(TransportEvent::NudgeBackward(clamped));
        } else {
            return Some(TransportEvent::NudgeForward(clamped));
        }
    }

    None
}

// ---- LED state mirror ----------------------------------------------------

/// Return the bytes that should be written to the LCXL3's DAW In port
/// when the bridge enters `state`, or `None` if no LED change is
/// needed for that state.
///
/// `Locating` shows the same colour as `Stopped` because closed-loop
/// locates complete in seconds and a transient "locating" colour
/// would only flash briefly — visually noisier than helpful.
pub fn led_for_state(state: &TransportState) -> Option<[u8; 3]> {
    match state {
        TransportState::Playing => Some(LED_PLAY_PLAYING),
        TransportState::Stopped => Some(LED_PLAY_STOPPED),
        TransportState::Locating { .. } => Some(LED_PLAY_STOPPED),
    }
}

// ---- Send helpers --------------------------------------------------------

/// Inter-message gap used inside the activation handshake. Live waits
/// roughly 30 ms between probe / UDI / claim — the device needs a
/// chance to ack each one before the next arrives. Within the
/// post-claim burst Live fires messages at zero gap; we keep a small
/// margin everywhere to be conservative.
const HANDSHAKE_GAP: Duration = Duration::from_millis(30);
/// Tighter gap for the post-claim burst (host-name SysEx and LED set).
const HANDSHAKE_GAP_TIGHT: Duration = Duration::from_millis(10);

/// Fire the full DAW activation handshake on `output` so the LCXL3
/// believes a DAW is present. Sequence:
///   1. DAW probe (`02 00`)
///   2. Universal Device Inquiry
///   3. DAW claim (`02 7F`)
///   4. Host-name page metadata (open / set / close)
///   5. Transport LED preset (Play=stopped, Record=idle)
///
/// Sleeps ~30 ms between (1)/(2)/(3) and ~10 ms between (4)/(5).
/// Returns once the last byte has been sent; the device's response
/// (echo of `02 00`, identity reply, echo of `02 7F`) arrives on its
/// own input port and is read by the caller's existing input pipeline.
pub fn handshake_send(output: &mut MidiOutputConnection, host_name: &[u8]) -> Result<()> {
    let send = |out: &mut MidiOutputConnection, label: &str, bytes: &[u8]| -> Result<()> {
        out.send(bytes)
            .map_err(|e| anyhow!("LCXL3 handshake send '{label}' failed: {e}"))
    };

    send(output, "DAW probe", &DAW_PROBE)?;
    thread::sleep(HANDSHAKE_GAP);
    send(output, "Universal Device Inquiry", &UDI)?;
    thread::sleep(HANDSHAKE_GAP);
    send(output, "DAW claim", &DAW_CLAIM)?;
    for msg in host_name_sequence(host_name) {
        send(output, "host-name SysEx", &msg)?;
    }
    thread::sleep(HANDSHAKE_GAP_TIGHT);
    send(output, "Play LED preset", &LED_PLAY_STOPPED)?;
    send(output, "Record LED preset", &LED_RECORD_IDLE)?;
    Ok(())
}

/// Best-effort send of the deactivation SysEx so the device returns
/// to its idle state. Errors are swallowed (the caller is shutting
/// down anyway and there's nothing useful to do with a send failure).
pub fn deactivate_send(output: &mut MidiOutputConnection) {
    let _ = output.send(&DAW_DEACTIVATE);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::TransportEvent as E;
    use crate::state::TransportState;

    // ---- parse() ---------------------------------------------------------

    #[test]
    fn play_press_emits_toggle_play() {
        // Captured live: B0 74 7F on the Play/Stop button press.
        assert_eq!(parse(&[0xB0, 0x74, 0x7F]), Some(E::TogglePlay));
    }

    #[test]
    fn play_release_is_silently_dropped() {
        // The release fires its own message but the state machine
        // only acts on the press — toggling on every-other release
        // would double-fire the action.
        assert_eq!(parse(&[0xB0, 0x74, 0x00]), None);
    }

    #[test]
    fn record_button_is_unmapped_in_v1() {
        // CC 0x76 is the Record button; v1 leaves it unmapped.
        assert_eq!(parse(&[0xB0, 0x76, 0x7F]), None);
        assert_eq!(parse(&[0xB0, 0x76, 0x00]), None);
    }

    #[test]
    fn encoder_forward_one_tick_emits_nudge_forward_one() {
        assert_eq!(parse(&[0xB6, 0x1E, 0x01]), Some(E::NudgeForward(1)));
        assert_eq!(parse(&[0xB6, 0x1F, 0x01]), Some(E::NudgeForward(1)));
    }

    #[test]
    fn encoder_backward_one_tick_emits_nudge_backward_one() {
        // 0x41 = bit 6 set + magnitude 1 → backward 1.
        assert_eq!(parse(&[0xB6, 0x1E, 0x41]), Some(E::NudgeBackward(1)));
    }

    #[test]
    fn encoder_magnitude_is_clamped_to_max_per_packet() {
        // 0x10 = magnitude 16, no direction bit → clamps to MAX (4) forward.
        assert_eq!(
            parse(&[0xB6, 0x1E, 0x10]),
            Some(E::NudgeForward(MAX_NUDGE_PER_PACKET))
        );
        // 0x50 = bit 6 set + magnitude 16 → clamps to MAX backward.
        assert_eq!(
            parse(&[0xB6, 0x1E, 0x50]),
            Some(E::NudgeBackward(MAX_NUDGE_PER_PACKET))
        );
    }

    #[test]
    fn encoder_zero_magnitude_emits_nothing() {
        // Some controllers send a zero-magnitude tick on direction
        // change; treat as no-op rather than an extra event.
        assert_eq!(parse(&[0xB6, 0x1E, 0x00]), None);
        assert_eq!(parse(&[0xB6, 0x1E, 0x40]), None); // 0x40 = backward, mag 0
    }

    #[test]
    fn unmapped_ccs_return_none() {
        // V-pots, faders, pads — every other CC the LCXL3 emits.
        assert_eq!(parse(&[0xB0, 0x05, 0x40]), None); // V-pot
        assert_eq!(parse(&[0xE0, 0x00, 0x00]), None); // pitch bend (faders)
        assert_eq!(parse(&[0x90, 0x40, 0x7F]), None); // note-on (pads)
    }

    #[test]
    fn malformed_messages_return_none() {
        assert_eq!(parse(&[]), None);
        assert_eq!(parse(&[0xB0]), None);
        assert_eq!(parse(&[0xB0, 0x74]), None);
        assert_eq!(parse(&[0xB0, 0x74, 0x7F, 0x00]), None); // 4 bytes
    }

    // ---- led_for_state() -------------------------------------------------

    #[test]
    fn led_for_state_maps_each_state() {
        assert_eq!(
            led_for_state(&TransportState::Playing),
            Some(LED_PLAY_PLAYING)
        );
        assert_eq!(
            led_for_state(&TransportState::Stopped),
            Some(LED_PLAY_STOPPED)
        );
        assert_eq!(
            led_for_state(&TransportState::Locating { target: 17 }),
            Some(LED_PLAY_STOPPED)
        );
    }

    // ---- host_name_sequence() --------------------------------------------

    #[test]
    fn host_name_sequence_brackets_name_with_open_close_pages() {
        let msgs = host_name_sequence(b"Bridge");
        assert_eq!(msgs.len(), 3);
        // Open: 04 36 62
        assert_eq!(
            msgs[0],
            vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x04, 0x36, 0x62, 0xF7]
        );
        // Name: 06 36 01 "Bridge"
        assert_eq!(
            msgs[1],
            vec![
                0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x06, 0x36, 0x01, b'B', b'r', b'i', b'd',
                b'g', b'e', 0xF7,
            ]
        );
        // Close: 04 36 7F
        assert_eq!(
            msgs[2],
            vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x04, 0x36, 0x7F, 0xF7]
        );
    }

    #[test]
    fn host_name_sequence_handles_empty_name() {
        // Edge case — no characters between 06 36 01 and F7.
        let msgs = host_name_sequence(b"");
        assert_eq!(msgs.len(), 3);
        assert_eq!(
            msgs[1],
            vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x06, 0x36, 0x01, 0xF7]
        );
    }

    // ---- Constant invariants --------------------------------------------

    #[test]
    fn deactivate_is_same_bytes_as_probe() {
        // Documented in the trace: the closing message is identical to
        // the opening probe (sub-id 0x00). Future readers may notice the
        // alias and want to confirm it isn't a typo.
        assert_eq!(DAW_DEACTIVATE, DAW_PROBE);
    }

    #[test]
    fn handshake_constants_are_well_formed_sysex() {
        for (name, msg) in [
            ("DAW_PROBE", DAW_PROBE.as_slice()),
            ("DAW_CLAIM", DAW_CLAIM.as_slice()),
            ("UDI", UDI.as_slice()),
            ("DAW_DEACTIVATE", DAW_DEACTIVATE.as_slice()),
        ] {
            assert_eq!(msg.first(), Some(&0xF0), "{name} should start with F0");
            assert_eq!(msg.last(), Some(&0xF7), "{name} should end with F7");
        }
    }
}
