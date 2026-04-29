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
//! - `parse_surface(&[u8]) -> Option<SurfaceEvent>` (Phase 9b) that
//!   decodes the full physical surface — faders, V-pots (in relative
//!   mode), fader buttons, side-panel buttons, and mode changes — in
//!   addition to the transport events from Phase 5. Mode routing is
//!   left to the caller; `parse_surface` is stateless.
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

/// LCXL3 channel-16 status byte for the transport jog wheel. The
/// encoder sends one `BF 5D nn` CC per tick during a spin, with the
/// value center-at-64 — i.e. `0x41` (65) = +1, `0x42` (66) = +2,
/// `0x3F` (63) = -1, `0x3E` (62) = -2. Captured live in the LCXL3
/// hardware probe (`5e-controls.log`); matches the original Live →
/// LCXL3 trace.
///
/// The bridge initially mis-mapped the encoder to channel-7 CCs
/// `B6 1E` / `B6 1F`, which turned out to be a different encoder
/// emitting absolute position state on every DAW handshake. The
/// resulting "phantom" `NudgeForward(4)` events at startup were the
/// telltale sign — real ticks only appear when the user spins.
const JOG_CC_STATUS: u8 = 0xBF;
const JOG_CC: u8 = 0x5D;
const JOG_CENTER: u8 = 0x40;

/// Hard cap on nudge magnitude per encoder CC. A fast spin emits a
/// stream of CCs with magnitudes 1..7 each; the cap keeps any single
/// CC from queuing more than this many `BarForward` / `BarBackward`
/// actions to the state machine. Four bars per CC is enough to feel
/// responsive without runaway risk.
pub const MAX_NUDGE_PER_PACKET: u32 = 4;

// ---- Phase 9b types ------------------------------------------------------

/// Which encoder row a V-pot belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VRow {
    Top,
    Middle,
    Bottom,
}

/// Which row of fader buttons is being pressed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonRow {
    TopSoloArm,
    BottomMuteSelect,
}

/// Side-panel buttons that aren't already covered by Phase 5's `TransportEvent`.
/// (Play, Record, Shift continue to flow through `TransportEvent` / existing
/// parser.)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SideButton {
    PageUp,
    PageDown,
    TrackLeft,
    TrackRight,
    SoloArmRowToggle,
    MuteSelectRowToggle,
    SmallButton,
}

/// Active LCXL3 sub-mode reported by the device.
///
/// `Custom(u8)` carries the raw `vv` byte from `B6 1E vv` unchanged.
/// Values `0x06-0x09` = Custom 1-4; `0x12-0x1D` = Custom 5-16.
/// Phase 9b stage 2+ may refine the representation; keeping raw for now.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LcxlMode {
    DawMixer,
    DawControl,
    Custom(u8),
}

/// All surface events the parser can emit (Phase 9b).
///
/// `Transport` carries the existing Phase 5 vocabulary unchanged; all
/// current callers of `parse()` are unaffected. New variants represent the
/// physical LCXL3 surface without mode routing — the caller is responsible
/// for deciding how to handle a `VPotDelta` in DAW Control vs DAW Mixer mode,
/// for example.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SurfaceEvent {
    /// Phase 5 transport vocabulary, unchanged. Existing state machine
    /// consumes these.
    Transport(TransportEvent),

    /// Fader moved (channel 16, CCs `0x05-0x0C`). Device-side pickup mode
    /// is enabled by the bridge at startup (`B6 46 7F`); the bridge just
    /// consumes values as they arrive.
    Fader {
        /// 0-indexed strip (0 = fader 1, 7 = fader 8).
        strip: u8,
        /// 7-bit absolute value, 0..=127.
        value: u8,
    },

    /// V-pot turned (channel 16, CCs `0x4D-0x64` in relative mode).
    /// The bridge sends `B6 45/48/49 7F` at startup to put all three rows
    /// into relative mode. Delta is decoded from centre-at-`0x40` encoding.
    VPotDelta {
        row: VRow,
        /// 0-indexed column (0 = leftmost encoder).
        col: u8,
        /// Signed delta. Magnitude clamped to `MAX_NUDGE_PER_PACKET` (= 4)
        /// for symmetry with Phase 5's jog-wheel handling.
        delta: i8,
    },

    /// Fader button pressed or released.
    FaderButton {
        row: ButtonRow,
        /// 0-indexed strip.
        strip: u8,
        pressed: bool,
    },

    /// Side-panel button pressed or released (not Play/Record/Shift, which
    /// remain `Transport` events).
    SideButton {
        button: SideButton,
        pressed: bool,
    },

    /// Device reported a sub-mode change (`B6 1E vv`).
    ModeChange(LcxlMode),
}

// ---- Phase 9b parser helpers ---------------------------------------------

/// Decode a centre-at-`0x40` relative-encoder value into a signed delta.
///
/// The LCXL3 emits `0x40` (64) for "no movement", `> 0x40` for clockwise,
/// `< 0x40` for counter-clockwise. Magnitude is clamped to
/// `MAX_NUDGE_PER_PACKET` (= 4) for symmetry with Phase 5's jog-wheel
/// handling, which already uses the same cap. V-pot deltas in Mixer mode
/// might in principle justify a higher cap for fast panning, but keeping
/// the cap symmetric avoids two different behaviour models in the same file
/// until a concrete need for asymmetry is demonstrated.
fn decode_relative(value: u8) -> i8 {
    let raw = (value as i8).wrapping_sub(0x40i8);
    // Clamp magnitude to MAX_NUDGE_PER_PACKET.
    let max = MAX_NUDGE_PER_PACKET as i8;
    raw.clamp(-max, max)
}

/// Decode a mode byte from `B6 1E vv` into an `LcxlMode`.
fn parse_mode(vv: u8) -> Option<LcxlMode> {
    match vv {
        0x01 => Some(LcxlMode::DawMixer),
        0x02 => Some(LcxlMode::DawControl),
        0x06..=0x09 | 0x12..=0x1D => Some(LcxlMode::Custom(vv)),
        _ => None,
    }
}

/// Inner mixer-specific parse pass. Returns `None` for bytes that belong
/// exclusively to the Phase 5 transport vocabulary (so the outer
/// `parse_surface` can fall through to `parse()`).
///
/// Note on the `BF 5D nn` overlap: in DAW Control mode this byte is the
/// Phase 5 jog wheel; in DAW Mixer mode (with relative V-pots enabled) it
/// is row 3 col 1. Stage 1 has no mode state, so we always emit
/// `VPotDelta { row: Bottom, col: 0 }`. The mode-aware caller introduced
/// in stage 4 will re-map it to `Transport(NudgeForward/Backward)` when
/// the active mode is DAW Control.
fn parse_mixer_only(bytes: &[u8]) -> Option<SurfaceEvent> {
    if bytes.len() != 3 {
        return None;
    }
    let status = bytes[0];
    let cc = bytes[1];
    let value = bytes[2];
    let pressed = value == 0x7F;

    match (status, cc) {
        // Faders — channel 16, CCs 0x05-0x0C
        (0xBF, 0x05..=0x0C) => Some(SurfaceEvent::Fader {
            strip: cc - 0x05,
            value,
        }),

        // V-pots row 1 (relative mode) — channel 16, CCs 0x4D-0x54
        (0xBF, 0x4D..=0x54) => Some(SurfaceEvent::VPotDelta {
            row: VRow::Top,
            col: cc - 0x4D,
            delta: decode_relative(value),
        }),

        // V-pots row 2 (relative mode) — channel 16, CCs 0x55-0x5C
        (0xBF, 0x55..=0x5C) => Some(SurfaceEvent::VPotDelta {
            row: VRow::Middle,
            col: cc - 0x55,
            delta: decode_relative(value),
        }),

        // V-pots row 3 (relative mode) — channel 16, CCs 0x5D-0x64.
        // 0x5D is also Phase 5's jog wheel CC; `parse_surface` always emits
        // VPotDelta here and relies on the mode-aware caller to re-map.
        (0xBF, 0x5D..=0x64) => Some(SurfaceEvent::VPotDelta {
            row: VRow::Bottom,
            col: cc - 0x5D,
            delta: decode_relative(value),
        }),

        // Top fader button row (Solo/Arm) — channel 1, CCs 0x25-0x2C
        (0xB0, 0x25..=0x2C) => Some(SurfaceEvent::FaderButton {
            row: ButtonRow::TopSoloArm,
            strip: cc - 0x25,
            pressed,
        }),

        // Bottom fader button row (Mute/Select) — channel 1, CCs 0x2D-0x34
        (0xB0, 0x2D..=0x34) => Some(SurfaceEvent::FaderButton {
            row: ButtonRow::BottomMuteSelect,
            strip: cc - 0x2D,
            pressed,
        }),

        // Side-panel buttons on channel 1
        (0xB0, 0x41) => Some(SurfaceEvent::SideButton {
            button: SideButton::SoloArmRowToggle,
            pressed,
        }),
        (0xB0, 0x42) => Some(SurfaceEvent::SideButton {
            button: SideButton::MuteSelectRowToggle,
            pressed,
        }),
        (0xB0, 0x66) => Some(SurfaceEvent::SideButton {
            button: SideButton::TrackRight,
            pressed,
        }),
        (0xB0, 0x67) => Some(SurfaceEvent::SideButton {
            button: SideButton::TrackLeft,
            pressed,
        }),
        (0xB0, 0x68) => Some(SurfaceEvent::SideButton {
            button: SideButton::SmallButton,
            pressed,
        }),
        (0xB0, 0x6A) => Some(SurfaceEvent::SideButton {
            button: SideButton::PageUp,
            pressed,
        }),
        (0xB0, 0x6B) => Some(SurfaceEvent::SideButton {
            button: SideButton::PageDown,
            pressed,
        }),

        // Mode change / report — channel 7, CC 0x1E
        (0xB6, 0x1E) => parse_mode(value).map(SurfaceEvent::ModeChange),

        // Undocumented mode-report companion — channel 7, CC 0x1F.
        // Always co-emitted with 0x1E; suppress to avoid double-handling.
        (0xB6, 0x1F) => None,

        // Channel 7, CC 0x3F = Shift. Not a SurfaceEvent variant in stage 1
        // (Phase 5 also doesn't surface Shift). Return None and let the
        // fallback handle it (which will also return None).
        (0xB6, 0x3F) => None,

        // Record button CC 0x76 — not mapped as a SurfaceEvent in stage 1;
        // Phase 5 ignores it too (only sets its LED). Return None so neither
        // path emits an event for it.
        (0xB0, 0x76) => None,

        // Play button CC 0x74 — leave for the Phase 5 fallback so
        // `parse_surface` returns `Transport(TogglePlay)` on press.
        // Returning None here intentionally routes it to `parse()`.
        (0xB0, 0x74) => None,

        _ => None,
    }
}

// ---- Phase 9b public parser ----------------------------------------------

/// Decode any LCXL3 byte sequence into a `SurfaceEvent`.
///
/// Strategy: try the mixer-specific arms first (which cover faders, V-pots,
/// fader buttons, side-panel buttons, and mode changes); fall back to the
/// Phase 5 `parse()` for transport bytes not covered above. Both functions
/// exist independently — existing callers of `parse()` are unaffected.
///
/// The V-pot / jog-wheel overlap (`BF 5D nn`): this function always returns
/// `VPotDelta { row: Bottom, col: 0, delta }` because the parser is
/// stateless. The mode-aware layer (stage 4) will convert that to
/// `Transport(NudgeForward/Backward)` when the active mode is DAW Control.
pub fn parse_surface(bytes: &[u8]) -> Option<SurfaceEvent> {
    if let Some(ev) = parse_mixer_only(bytes) {
        return Some(ev);
    }
    parse(bytes).map(SurfaceEvent::Transport)
}

// ---- Phase 5 parser ------------------------------------------------------

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

    // Transport jog wheel. Center-at-64 encoding: `value > 64` is
    // forward by `value - 64`, `value < 64` is backward by
    // `64 - value`, exactly `64` is no-op. Magnitude clamped to
    // `MAX_NUDGE_PER_PACKET` so a fast spin still feels responsive
    // without overrunning LUNA's playhead.
    if status == JOG_CC_STATUS && cc == JOG_CC {
        if value == JOG_CENTER {
            return None;
        }
        if value > JOG_CENTER {
            let mag = ((value - JOG_CENTER) as u32).min(MAX_NUDGE_PER_PACKET);
            return Some(TransportEvent::NudgeForward(mag));
        } else {
            let mag = ((JOG_CENTER - value) as u32).min(MAX_NUDGE_PER_PACKET);
            return Some(TransportEvent::NudgeBackward(mag));
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
    fn jog_wheel_forward_one_tick_emits_nudge_forward_one() {
        // Captured: BF 5D 41 — value 65 = center 64 + 1.
        assert_eq!(parse(&[0xBF, 0x5D, 0x41]), Some(E::NudgeForward(1)));
    }

    #[test]
    fn jog_wheel_backward_one_tick_emits_nudge_backward_one() {
        // Captured: BF 5D 3F — value 63 = center 64 - 1.
        assert_eq!(parse(&[0xBF, 0x5D, 0x3F]), Some(E::NudgeBackward(1)));
    }

    #[test]
    fn jog_wheel_two_ticks_per_cc_is_passed_through() {
        // Fast spin: BF 5D 42 = +2, BF 5D 3E = -2.
        assert_eq!(parse(&[0xBF, 0x5D, 0x42]), Some(E::NudgeForward(2)));
        assert_eq!(parse(&[0xBF, 0x5D, 0x3E]), Some(E::NudgeBackward(2)));
    }

    #[test]
    fn jog_wheel_magnitude_is_clamped_to_max_per_cc() {
        // BF 5D 50 = 80 = +16 → clamps to MAX (4).
        assert_eq!(
            parse(&[0xBF, 0x5D, 0x50]),
            Some(E::NudgeForward(MAX_NUDGE_PER_PACKET))
        );
        // BF 5D 30 = 48 = -16 → clamps to MAX backward.
        assert_eq!(
            parse(&[0xBF, 0x5D, 0x30]),
            Some(E::NudgeBackward(MAX_NUDGE_PER_PACKET))
        );
    }

    #[test]
    fn jog_wheel_at_center_emits_nothing() {
        // Encoder at rest sends BF 5D 40 = no movement.
        assert_eq!(parse(&[0xBF, 0x5D, 0x40]), None);
    }

    #[test]
    fn unmapped_ccs_return_none() {
        // V-pots, faders, pads — every other CC the LCXL3 emits.
        // Specifically: B6 1E nn / B6 1F nn (channel-7 encoder) is
        // the V-pot the LCXL3 streams absolute-position state for on
        // every handshake. Earlier parser versions matched these; we
        // now correctly ignore them.
        assert_eq!(parse(&[0xB6, 0x1E, 0x06]), None);
        assert_eq!(parse(&[0xB6, 0x1F, 0x06]), None);
        assert_eq!(parse(&[0xB0, 0x05, 0x40]), None); // V-pot on ch1
        assert_eq!(parse(&[0xBF, 0x05, 0x14]), None); // fader CC on ch16
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

    // ---- parse_surface() — Phase 9b ----------------------------------------

    // -- Faders ---------------------------------------------------------------

    #[test]
    fn parse_surface_fader_strip_0_boundary_values() {
        // BF 05 nn — fader 1, strip 0
        assert_eq!(
            parse_surface(&[0xBF, 0x05, 0x00]),
            Some(SurfaceEvent::Fader { strip: 0, value: 0 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x05, 0x40]),
            Some(SurfaceEvent::Fader { strip: 0, value: 64 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x05, 0x7F]),
            Some(SurfaceEvent::Fader { strip: 0, value: 127 })
        );
    }

    #[test]
    fn parse_surface_fader_all_strips() {
        // Each fader CC 0x05-0x0C maps to strip 0-7
        for i in 0u8..8 {
            let cc = 0x05 + i;
            assert_eq!(
                parse_surface(&[0xBF, cc, 0x64]),
                Some(SurfaceEvent::Fader { strip: i, value: 100 }),
                "fader cc={cc:#04x} should give strip={i}"
            );
        }
    }

    // -- V-pots (relative mode) -----------------------------------------------

    #[test]
    fn parse_surface_vpot_centre_is_zero_delta() {
        // Centre-at-0x40 → delta = 0. All three rows.
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x40]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: 0 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x55, 0x40]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Middle, col: 0, delta: 0 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x5D, 0x40]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Bottom, col: 0, delta: 0 })
        );
    }

    #[test]
    fn parse_surface_vpot_top_row_positive_deltas() {
        // 0x41 = 0x40 + 1 → delta +1; 0x44 = 0x40 + 4 → delta +4 (at cap)
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x41]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: 1 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x44]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: 4 })
        );
        // 0x50 = 0x40 + 16 → clamps to 4
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x50]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: 4 })
        );
    }

    #[test]
    fn parse_surface_vpot_top_row_negative_deltas() {
        // 0x3F = 0x40 - 1 → delta -1; 0x3C = 0x40 - 4 → delta -4
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x3F]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: -1 })
        );
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x3C]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: -4 })
        );
        // 0x30 = 0x40 - 16 → clamps to -4
        assert_eq!(
            parse_surface(&[0xBF, 0x4D, 0x30]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Top, col: 0, delta: -4 })
        );
    }

    #[test]
    fn parse_surface_vpot_all_cols_top_row() {
        for col in 0u8..8 {
            let cc = 0x4D + col;
            assert_eq!(
                parse_surface(&[0xBF, cc, 0x41]),
                Some(SurfaceEvent::VPotDelta { row: VRow::Top, col, delta: 1 }),
                "top row col={col} cc={cc:#04x}"
            );
        }
    }

    #[test]
    fn parse_surface_vpot_all_cols_middle_row() {
        for col in 0u8..8 {
            let cc = 0x55 + col;
            assert_eq!(
                parse_surface(&[0xBF, cc, 0x3F]),
                Some(SurfaceEvent::VPotDelta { row: VRow::Middle, col, delta: -1 }),
                "middle row col={col} cc={cc:#04x}"
            );
        }
    }

    #[test]
    fn parse_surface_vpot_all_cols_bottom_row() {
        for col in 0u8..8 {
            let cc = 0x5D + col;
            assert_eq!(
                parse_surface(&[0xBF, cc, 0x42]),
                Some(SurfaceEvent::VPotDelta { row: VRow::Bottom, col, delta: 2 }),
                "bottom row col={col} cc={cc:#04x}"
            );
        }
    }

    // -- Jog-wheel / V-pot overlap -----------------------------------------------

    #[test]
    fn parse_surface_jog_wheel_returns_vpot_delta_not_transport() {
        // BF 5D 41 = row 3 col 1 (col 0) in relative mode, delta +1.
        // parse_surface is stateless; it always emits VPotDelta here and
        // relies on a mode-aware caller to re-map in DAW Control mode.
        assert_eq!(
            parse_surface(&[0xBF, 0x5D, 0x41]),
            Some(SurfaceEvent::VPotDelta { row: VRow::Bottom, col: 0, delta: 1 })
        );
        // Confirm it is NOT Transport(NudgeForward(1)).
        assert_ne!(
            parse_surface(&[0xBF, 0x5D, 0x41]),
            Some(SurfaceEvent::Transport(E::NudgeForward(1)))
        );
    }

    // -- Fader buttons --------------------------------------------------------

    #[test]
    fn parse_surface_top_fader_button_press_all_strips() {
        // B0 25-2C 7F → TopSoloArm press, strips 0-7
        for i in 0u8..8 {
            let cc = 0x25 + i;
            assert_eq!(
                parse_surface(&[0xB0, cc, 0x7F]),
                Some(SurfaceEvent::FaderButton {
                    row: ButtonRow::TopSoloArm,
                    strip: i,
                    pressed: true,
                }),
                "top button cc={cc:#04x} strip={i}"
            );
        }
    }

    #[test]
    fn parse_surface_top_fader_button_release_all_strips() {
        for i in 0u8..8 {
            let cc = 0x25 + i;
            assert_eq!(
                parse_surface(&[0xB0, cc, 0x00]),
                Some(SurfaceEvent::FaderButton {
                    row: ButtonRow::TopSoloArm,
                    strip: i,
                    pressed: false,
                }),
                "top button release cc={cc:#04x} strip={i}"
            );
        }
    }

    #[test]
    fn parse_surface_bottom_fader_button_press_all_strips() {
        for i in 0u8..8 {
            let cc = 0x2D + i;
            assert_eq!(
                parse_surface(&[0xB0, cc, 0x7F]),
                Some(SurfaceEvent::FaderButton {
                    row: ButtonRow::BottomMuteSelect,
                    strip: i,
                    pressed: true,
                }),
                "bottom button cc={cc:#04x} strip={i}"
            );
        }
    }

    #[test]
    fn parse_surface_bottom_fader_button_release_all_strips() {
        for i in 0u8..8 {
            let cc = 0x2D + i;
            assert_eq!(
                parse_surface(&[0xB0, cc, 0x00]),
                Some(SurfaceEvent::FaderButton {
                    row: ButtonRow::BottomMuteSelect,
                    strip: i,
                    pressed: false,
                }),
                "bottom button release cc={cc:#04x} strip={i}"
            );
        }
    }

    // -- Side-panel buttons ---------------------------------------------------

    #[test]
    fn parse_surface_side_buttons_press_and_release() {
        let cases: &[([u8; 3], SideButton)] = &[
            ([0xB0, 0x41, 0x7F], SideButton::SoloArmRowToggle),
            ([0xB0, 0x42, 0x7F], SideButton::MuteSelectRowToggle),
            ([0xB0, 0x66, 0x7F], SideButton::TrackRight),
            ([0xB0, 0x67, 0x7F], SideButton::TrackLeft),
            ([0xB0, 0x68, 0x7F], SideButton::SmallButton),
            ([0xB0, 0x6A, 0x7F], SideButton::PageUp),
            ([0xB0, 0x6B, 0x7F], SideButton::PageDown),
        ];
        for (bytes, button) in cases {
            assert_eq!(
                parse_surface(bytes.as_slice()),
                Some(SurfaceEvent::SideButton { button: *button, pressed: true }),
                "press: {bytes:02X?}"
            );
            let mut release = *bytes;
            release[2] = 0x00;
            assert_eq!(
                parse_surface(release.as_slice()),
                Some(SurfaceEvent::SideButton { button: *button, pressed: false }),
                "release: {release:02X?}"
            );
        }
    }

    // -- Mode changes ---------------------------------------------------------

    #[test]
    fn parse_surface_mode_change_daw_mixer() {
        assert_eq!(
            parse_surface(&[0xB6, 0x1E, 0x01]),
            Some(SurfaceEvent::ModeChange(LcxlMode::DawMixer))
        );
    }

    #[test]
    fn parse_surface_mode_change_daw_control() {
        assert_eq!(
            parse_surface(&[0xB6, 0x1E, 0x02]),
            Some(SurfaceEvent::ModeChange(LcxlMode::DawControl))
        );
    }

    #[test]
    fn parse_surface_mode_change_custom_1_through_4() {
        // Custom 1-4 = vv 0x06-0x09
        for vv in 0x06u8..=0x09 {
            assert_eq!(
                parse_surface(&[0xB6, 0x1E, vv]),
                Some(SurfaceEvent::ModeChange(LcxlMode::Custom(vv))),
                "vv={vv:#04x}"
            );
        }
    }

    #[test]
    fn parse_surface_mode_change_custom_5_through_16() {
        // Custom 5-16 = vv 0x12-0x1D
        for vv in 0x12u8..=0x1D {
            assert_eq!(
                parse_surface(&[0xB6, 0x1E, vv]),
                Some(SurfaceEvent::ModeChange(LcxlMode::Custom(vv))),
                "vv={vv:#04x}"
            );
        }
    }

    #[test]
    fn parse_surface_b6_1f_companion_returns_none() {
        // The undocumented mode-report companion is always suppressed.
        for vv in [0x01u8, 0x02, 0x06, 0x0A] {
            assert_eq!(
                parse_surface(&[0xB6, 0x1F, vv]),
                None,
                "B6 1F {vv:#04x} should return None"
            );
        }
    }

    #[test]
    fn parse_surface_mode_change_unknown_vv_returns_none() {
        // vv bytes not in any known range → None
        for vv in [0x00u8, 0x03, 0x05, 0x0A, 0x11, 0x1E, 0x7F] {
            assert_eq!(
                parse_surface(&[0xB6, 0x1E, vv]),
                None,
                "unknown vv={vv:#04x} should return None"
            );
        }
    }

    // -- Transport fallback ---------------------------------------------------

    #[test]
    fn parse_surface_play_press_falls_back_to_transport() {
        // Phase 5 transport bytes flow through as Transport variants.
        assert_eq!(
            parse_surface(&[0xB0, 0x74, 0x7F]),
            Some(SurfaceEvent::Transport(E::TogglePlay))
        );
    }

    #[test]
    fn parse_surface_play_release_returns_none() {
        // Play release → parse() returns None → parse_surface returns None.
        assert_eq!(parse_surface(&[0xB0, 0x74, 0x00]), None);
    }

    #[test]
    fn parse_surface_record_button_returns_none() {
        // Record is not mapped as a SurfaceEvent in stage 1.
        assert_eq!(parse_surface(&[0xB0, 0x76, 0x7F]), None);
        assert_eq!(parse_surface(&[0xB0, 0x76, 0x00]), None);
    }

    // -- Unrecognised bytes ---------------------------------------------------

    #[test]
    fn parse_surface_unrecognised_bytes_return_none() {
        assert_eq!(parse_surface(&[0xB0, 0x99, 0x7F]), None); // out-of-range ch1 CC
        assert_eq!(parse_surface(&[0xBF, 0x70, 0x50]), None); // out-of-range ch16 CC
        assert_eq!(parse_surface(&[0xE0, 0x00, 0x00]), None); // pitch bend
        assert_eq!(parse_surface(&[0x90, 0x40, 0x7F]), None); // note-on
        assert_eq!(parse_surface(&[]), None);                  // empty
        assert_eq!(parse_surface(&[0xB0, 0x74]), None);        // 2-byte truncated
    }
}
