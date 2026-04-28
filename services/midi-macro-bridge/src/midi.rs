//! MIDI plumbing for the bridge.
//!
//! Physical MIDI input (transport events from the MC-500, the probe
//! port listener) goes through `midir` on every platform. Virtual
//! MCU endpoints take a different path on macOS so we can stamp
//! stable CoreMIDI `kMIDIPropertyUniqueID` values onto them — LUNA
//! keys its "same device across restarts" recognition off the
//! UniqueID, not the name, so without this each bridge invocation
//! looks like a brand-new device and the user has to reconfigure
//! LUNA's Control Surface row every time.
//!
//! TODO(abstraction): cross-platform MIDI abstraction trait.
//! The current file cfg-splits the virtual endpoint implementations
//! between coremidi (macOS, stable UniqueID) and midir's ALSA path
//! (Linux, ephemeral IDs) to preserve Linux build-ability while
//! getting the UniqueID win on macOS. A `VirtualMcuBackend` trait
//! with platform-specific impls would let the rest of the code be
//! cfg-free. Left for a future cleanup pass.
//!
//! Callbacks from the MIDI layer run on platform threads (midir's
//! or CoreMIDI's), not the main thread. They do NOT call into the
//! keystroke emitter directly — instead they forward events through
//! an mpsc channel to the main thread, because macOS CGEvent (which
//! enigo uses for keystroke synthesis) does not play well with being
//! called from arbitrary threads.

use anyhow::{anyhow, Context, Result};
use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use tracing::{debug, info};

#[cfg(target_os = "macos")]
use coremidi::{
    Client as CoreMidiClient, PacketBuffer, Properties, VirtualDestination, VirtualSource,
};

#[cfg(all(unix, not(target_os = "macos")))]
use midir::os::unix::{VirtualInput, VirtualOutput};
// MidiOutput / MidiOutputConnection are imported unconditionally
// at the top of the file — the Linux virtual-endpoint path uses
// them, but so does connect_output on every platform.

use crate::state::TransportEvent;

// ---------------------------------------------------------------------------
// MIDI message splitter — converts a CoreMIDI packet (which can carry many
// concatenated MIDI messages) into individual messages so downstream
// parsers can rely on "one message per byte slice".
// ---------------------------------------------------------------------------

/// Split a buffer of concatenated MIDI bytes into individual messages.
///
/// CoreMIDI delivers packets that may contain N MIDI messages
/// back-to-back (Ableton bundles up to ~189 bytes per packet). Our
/// downstream parsers (`mcu::parse_cc_display`, `mcu::parse_heartbeat_query`)
/// expect a single complete message per `&[u8]`, so without splitting
/// they reject every bundled packet wholesale — which silently drops
/// position info from any DAW that bundles.
///
/// Behaviour:
/// - 3-byte channel messages: Note On/Off, Poly AT, CC, Pitch Bend
///   (status `0x80`-`0xBF`, `0xE0`-`0xEF`).
/// - 2-byte channel messages: Program Change, Channel Pressure
///   (status `0xC0`-`0xDF`).
/// - SysEx: `0xF0` ... `0xF7`, variable length.
/// - System Common: `0xF1`/`0xF3` (2 byte), `0xF2` (3 byte), single-byte
///   `0xF4`-`0xF6`.
/// - System Realtime: `0xF8`-`0xFF` (1 byte each).
/// - Stray bytes without a leading status (orphan data, running-status
///   mid-packet) are skipped — we don't carry running status across
///   message boundaries because MCU surfaces don't use it in practice.
///
/// Truncated trailing messages (status byte without the expected data)
/// are dropped silently — a well-formed packet shouldn't produce this.
pub fn split_midi_messages(bytes: &[u8]) -> Vec<Vec<u8>> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let status = bytes[i];
        // Skip orphan data bytes (high bit clear) until we find the
        // next status byte.
        if status < 0x80 {
            i += 1;
            continue;
        }
        let len = match status {
            0x80..=0xBF | 0xE0..=0xEF => 3,
            0xC0..=0xDF => 2,
            0xF0 => {
                // SysEx: scan for terminating 0xF7. If unterminated,
                // drop the rest of the buffer (malformed).
                let mut j = i + 1;
                while j < bytes.len() && bytes[j] != 0xF7 {
                    j += 1;
                }
                if j == bytes.len() {
                    return out;
                }
                j - i + 1
            }
            0xF1 | 0xF3 => 2,
            0xF2 => 3,
            // Stray 0xF7 (end-of-SysEx without start), single-byte
            // System Common (0xF4-F6), and System Realtime (0xF8-FF)
            // are all 1-byte. The early `< 0x80` skip means we can't
            // see data bytes here.
            _ => 1,
        };
        if i + len > bytes.len() {
            return out;
        }
        out.push(bytes[i..i + len].to_vec());
        i += len;
    }
    out
}

// ---------------------------------------------------------------------------
// Physical MIDI input (all platforms, via midir)
// ---------------------------------------------------------------------------

/// Connect to the first MIDI input port whose name contains
/// `port_substring` (case-insensitive). Events are delivered by
/// calling `on_event` from midir's callback thread.
///
/// Keep the returned connection alive for as long as you want to
/// receive events — dropping it closes the port.
pub fn connect<F>(port_substring: &str, mut on_event: F) -> Result<MidiInputConnection<()>>
where
    F: FnMut(TransportEvent) + Send + 'static,
{
    let midi_in = MidiInput::new("midi-macro-bridge")?;

    let ports = midi_in.ports();
    let matching = ports
        .iter()
        .find(|p| {
            midi_in
                .port_name(p)
                .map(|n| n.to_lowercase().contains(&port_substring.to_lowercase()))
                .unwrap_or(false)
        })
        .ok_or_else(|| {
            anyhow!(
                "no MIDI input port matching '{}'. Try --list-ports to see available ports.",
                port_substring
            )
        })?;

    let port_name = midi_in.port_name(matching)?;
    info!(port = %port_name, "connecting to MIDI input");

    let conn = midi_in
        .connect(
            matching,
            "mc500-transport",
            move |_timestamp, bytes, _| {
                if let Some(evt) = parse_transport(bytes) {
                    debug!(?evt, raw = ?bytes, "transport event received");
                    on_event(evt);
                }
            },
            (),
        )
        .map_err(|e| anyhow!("midir connect failed: {e}"))?;

    Ok(conn)
}

/// List all available MIDI input port names.
///
/// Deprecated name kept as a thin wrapper so any callers outside this
/// file continue to compile. New code should call `list_ports_input`.
#[allow(dead_code)]
pub fn list_ports() -> Result<Vec<String>> {
    list_ports_input()
}

/// List all available MIDI input port names.
pub fn list_ports_input() -> Result<Vec<String>> {
    let midi_in = MidiInput::new("midi-macro-bridge-list")?;
    midi_in
        .ports()
        .iter()
        .map(|p| midi_in.port_name(p).context("read port name"))
        .collect()
}

/// List all available MIDI output port names.
pub fn list_ports_output() -> Result<Vec<String>> {
    let midi_out = MidiOutput::new("midi-macro-bridge-list-out")?;
    midi_out
        .ports()
        .iter()
        .map(|p| midi_out.port_name(p).context("read port name"))
        .collect()
}

/// Connect to the first MIDI *output* port matching `port_substring`
/// (case-insensitive). Used for sending SPP back to the MC-500 so it
/// can stay in sync with LUNA's play-start-on-stop behaviour.
/// Returns a live MidiOutputConnection; dropping it closes the port.
pub fn connect_output(port_substring: &str) -> Result<MidiOutputConnection> {
    let midi_out = MidiOutput::new("midi-macro-bridge-out")?;
    let ports = midi_out.ports();
    let matching = ports
        .iter()
        .find(|p| {
            midi_out
                .port_name(p)
                .map(|n| n.to_lowercase().contains(&port_substring.to_lowercase()))
                .unwrap_or(false)
        })
        .ok_or_else(|| {
            anyhow!(
                "no MIDI output port matching '{}'. Try --list-ports (note: that lists \
                 inputs; the output with the same name generally exists alongside).",
                port_substring
            )
        })?;

    let port_name = midi_out.port_name(matching)?;
    info!(port = %port_name, "connecting to MIDI output");

    let conn = midi_out
        .connect(matching, "mc500-spp-out")
        .map_err(|e| anyhow!("midir output connect failed: {e}"))?;

    Ok(conn)
}

/// Encode a 1-based bar number as a MIDI Song Position Pointer
/// message. SPP carries position as 14-bit MIDI beats (16th notes)
/// with bit-level split: `F2 ll hh` where `(hh << 7) | ll` is the
/// beat count. In 4/4, bar N corresponds to `(N - 1) * 16` beats.
///
/// The current assumption is 4/4. A session in other time signatures
/// will see the MC-500 land on the right bar number but not
/// necessarily the musically-matching place — acceptable for the
/// sync-on-stop use case since bar accuracy is what matters.
pub fn bar_to_spp_message(bar: u32) -> [u8; 3] {
    let midi_beats = bar.saturating_sub(1).saturating_mul(16);
    // 14-bit limit: SPP's two data bytes carry 7 bits each.
    let clamped = midi_beats.min((1 << 14) - 1);
    let ll = (clamped & 0x7F) as u8;
    let hh = ((clamped >> 7) & 0x7F) as u8;
    [0xF2, ll, hh]
}

/// Connect to the first MIDI input port matching `port_substring` and
/// forward every incoming byte sequence verbatim to `on_bytes`. Used
/// by `--probe-midi` to reverse-engineer unknown device outputs on
/// existing physical or virtual ports.
pub fn connect_raw<F>(port_substring: &str, mut on_bytes: F) -> Result<MidiInputConnection<()>>
where
    F: FnMut(&[u8]) + Send + 'static,
{
    let midi_in = MidiInput::new("midi-macro-bridge-probe")?;

    let ports = midi_in.ports();
    let matching = ports
        .iter()
        .find(|p| {
            midi_in
                .port_name(p)
                .map(|n| n.to_lowercase().contains(&port_substring.to_lowercase()))
                .unwrap_or(false)
        })
        .ok_or_else(|| {
            anyhow!(
                "no MIDI input port matching '{}'. Try --list-ports to see available ports.",
                port_substring
            )
        })?;

    let port_name = midi_in.port_name(matching)?;
    info!(port = %port_name, "probe: connecting to MIDI input");

    let conn = midi_in
        .connect(
            matching,
            "probe",
            move |_timestamp, bytes, _| on_bytes(bytes),
            (),
        )
        .map_err(|e| anyhow!("midir connect failed: {e}"))?;

    Ok(conn)
}

// ---------------------------------------------------------------------------
// Virtual MCU endpoint pair (platform-specific)
// ---------------------------------------------------------------------------

/// Stable `kMIDIPropertyUniqueID` for the macOS virtual source — the
/// endpoint that shows up in LUNA's MCU INPUT DEVICE dropdown (LUNA
/// reads position / LED updates from it). LUNA stores this ID in its
/// preferences; changing it would force the user to reconfigure
/// LUNA's Control Surface row. ASCII "MMBI" = MCU Macro Bridge Input.
#[cfg(target_os = "macos")]
const VIRTUAL_SOURCE_UID: i32 = 0x4D4D_4249;

/// Stable `kMIDIPropertyUniqueID` for the macOS virtual destination
/// — the endpoint that shows up in LUNA's MCU OUTPUT DEVICE dropdown
/// (LUNA writes transport / display updates to it). ASCII "MMBO" =
/// MCU Macro Bridge Output.
#[cfg(target_os = "macos")]
const VIRTUAL_DESTINATION_UID: i32 = 0x4D4D_424F;

/// Handles to the virtual MIDI input + output endpoints the bridge
/// registers so DAWs (e.g., LUNA) can select the bridge as an MCU
/// control surface. Dropping this value closes both endpoints and
/// removes them from the system's MIDI device list.
#[cfg(target_os = "macos")]
pub struct VirtualMcuPair {
    // Field order matters for Drop: endpoints must drop before the
    // client they were created under, otherwise CoreMIDI logs
    // complaints about orphaned endpoints.
    source: VirtualSource,
    _destination: VirtualDestination,
    _client: CoreMidiClient,
}

#[cfg(all(unix, not(target_os = "macos")))]
pub struct VirtualMcuPair {
    _input: MidiInputConnection<()>,
    output: MidiOutputConnection,
}

#[cfg(not(unix))]
pub struct VirtualMcuPair {
    _unsupported: (),
}

impl VirtualMcuPair {
    /// Send a MIDI message out the virtual output. DAWs that have
    /// selected the pair as their MCU control surface INPUT DEVICE
    /// will receive it.
    #[cfg(target_os = "macos")]
    pub fn send(&mut self, bytes: &[u8]) -> Result<()> {
        let packets = PacketBuffer::new(0, bytes);
        self.source
            .received(&packets)
            .map_err(|os_status| anyhow!("virtual MCU send failed: OSStatus {os_status}"))
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    pub fn send(&mut self, bytes: &[u8]) -> Result<()> {
        self.output
            .send(bytes)
            .map_err(|e| anyhow!("virtual MCU send failed: {e}"))
    }

    #[cfg(not(unix))]
    pub fn send(&mut self, _bytes: &[u8]) -> Result<()> {
        anyhow::bail!("virtual MIDI endpoints are not supported on this platform")
    }
}

/// Register a paired virtual MIDI input + output under `endpoint_name`.
/// The pair shows up in the system's MIDI device list (CoreMIDI on
/// macOS, ALSA on Linux) so DAWs can select it as an MCU control
/// surface. Incoming bytes on the virtual input are forwarded to
/// `on_bytes` on a platform callback thread.
///
/// On macOS the endpoints are assigned stable `UniqueID`s so LUNA
/// recognises them across bridge restarts. On Linux the IDs are
/// ephemeral (ALSA assigns a fresh client ID each run); users who
/// hit this limitation will need to reconfigure their DAW's control
/// surface selection each time the bridge starts.
#[cfg(target_os = "macos")]
pub fn create_virtual_mcu<F>(endpoint_name: &str, on_bytes: F) -> Result<VirtualMcuPair>
where
    F: FnMut(&[u8]) + Send + 'static,
{
    let client = CoreMidiClient::new("midi-macro-bridge-mcu")
        .map_err(|os_status| anyhow!("CoreMIDI client create failed: OSStatus {os_status}"))?;

    let mut on_bytes = on_bytes;
    let destination = client
        .virtual_destination(endpoint_name, move |packet_list| {
            for packet in packet_list.iter() {
                // Split bundled messages — Ableton can pack 10+
                // messages per packet (timecode display + VU meters in
                // one batch), and downstream parsers want one message
                // per call.
                for msg in split_midi_messages(packet.data()) {
                    on_bytes(&msg);
                }
            }
        })
        .map_err(|os_status| {
            anyhow!("virtual destination create failed: OSStatus {os_status}")
        })?;
    destination
        .set_property(&Properties::unique_id(), VIRTUAL_DESTINATION_UID)
        .map_err(|os_status| {
            anyhow!("setting destination UniqueID failed: OSStatus {os_status}")
        })?;

    let source = client
        .virtual_source(endpoint_name)
        .map_err(|os_status| anyhow!("virtual source create failed: OSStatus {os_status}"))?;
    source
        .set_property(&Properties::unique_id(), VIRTUAL_SOURCE_UID)
        .map_err(|os_status| anyhow!("setting source UniqueID failed: OSStatus {os_status}"))?;

    info!(
        endpoint = endpoint_name,
        source_uid = format!("0x{VIRTUAL_SOURCE_UID:08X}"),
        destination_uid = format!("0x{VIRTUAL_DESTINATION_UID:08X}"),
        "created virtual MCU endpoint pair (stable UniqueIDs via CoreMIDI)"
    );

    Ok(VirtualMcuPair {
        source,
        _destination: destination,
        _client: client,
    })
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn create_virtual_mcu<F>(endpoint_name: &str, on_bytes: F) -> Result<VirtualMcuPair>
where
    F: FnMut(&[u8]) + Send + 'static,
{
    let midi_in = MidiInput::new("midi-macro-bridge-mcu")?;
    let mut on_bytes = on_bytes;
    let input = midi_in
        .create_virtual(
            endpoint_name,
            move |_timestamp, bytes, _| {
                // Match the macOS path: split bundled MIDI messages so
                // downstream consumers see one message per call,
                // regardless of how the underlying transport batched.
                for msg in split_midi_messages(bytes) {
                    on_bytes(&msg);
                }
            },
            (),
        )
        .map_err(|e| anyhow!("failed to create virtual MIDI input '{endpoint_name}': {e}"))?;

    let midi_out = MidiOutput::new("midi-macro-bridge-mcu")?;
    let output = midi_out
        .create_virtual(endpoint_name)
        .map_err(|e| anyhow!("failed to create virtual MIDI output '{endpoint_name}': {e}"))?;

    info!(
        endpoint = endpoint_name,
        "created virtual MCU endpoint pair (ALSA; ephemeral UniqueID — DAW may see a new device on each bridge restart)"
    );

    Ok(VirtualMcuPair {
        _input: input,
        output,
    })
}

#[cfg(not(unix))]
pub fn create_virtual_mcu<F>(_endpoint_name: &str, _on_bytes: F) -> Result<VirtualMcuPair>
where
    F: FnMut(&[u8]) + Send + 'static,
{
    anyhow::bail!("virtual MIDI endpoints are only supported on macOS and Linux")
}

// ---------------------------------------------------------------------------
// Transport byte parsing
// ---------------------------------------------------------------------------

/// Extract a transport or locate event from a raw MIDI message from
/// the MC-500. Recognises the four byte sequences we care about:
///
/// - `0xFA` — Start (play from top)
/// - `0xFB` — Continue (play from current position)
/// - `0xFC` — Stop
/// - `0xF2 ll hh` — SPP (Song Position Pointer) — the 14-bit value
///   `(hh << 7) | ll` is the target **in MIDI beats** (16ths). We
///   convert to whole-bar target assuming 4/4 (16 MIDI beats per
///   bar), rounding down so mid-bar SPPs land on the containing bar.
///   The MC-500's locate targets bar boundaries in practice, so
///   rounding is a defensive fallback; a bar-accurate LOCATE on the
///   MC-500 emits an SPP that's an exact multiple of 16.
///
/// Returns None for anything else (clock, active sensing, notes, etc.).
///
/// The 4/4 assumption here only affects what bar value we *request*
/// of the locate controller. The controller's closed-loop verifies
/// against LUNA's actual bar display (from the MCU position stream)
/// regardless of time signature, so an SPP target in a 3/4 section
/// will still land on the bar LUNA considers to match — it just
/// won't necessarily be what the MC-500 operator *intended* if the
/// session has time-signature changes. Acceptable v1 limitation;
/// the closed-loop design is correct, only the target interpretation
/// is approximate.
fn parse_transport(bytes: &[u8]) -> Option<TransportEvent> {
    match bytes.first().copied()? {
        0xFA => Some(TransportEvent::Start),
        0xFB => Some(TransportEvent::Continue),
        0xFC => Some(TransportEvent::Stop),
        0xF2 if bytes.len() == 3 => {
            let lsb = bytes[1] as u32;
            let msb = bytes[2] as u32;
            let midi_beats = (msb << 7) | lsb;
            // 16 MIDI beats per bar in 4/4. `+ 1` because SPP value 0
            // is bar 1 in our (1-based) bar numbering convention.
            let bar = (midi_beats / 16) + 1;
            Some(TransportEvent::Spp(bar))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_start_byte() {
        assert_eq!(parse_transport(&[0xFA]), Some(TransportEvent::Start));
    }

    #[test]
    fn parses_continue_byte() {
        assert_eq!(parse_transport(&[0xFB]), Some(TransportEvent::Continue));
    }

    #[test]
    fn parses_stop_byte() {
        assert_eq!(parse_transport(&[0xFC]), Some(TransportEvent::Stop));
    }

    #[test]
    fn ignores_midi_clock() {
        // 0xF8 is MIDI clock tick — arrives 24x per quarter note,
        // we don't want to react to these.
        assert_eq!(parse_transport(&[0xF8]), None);
    }

    #[test]
    fn parses_spp_as_bar_target_in_4_4() {
        // `0xF2 00 00` → midi_beats = 0 → bar 1 (start of song).
        assert_eq!(parse_transport(&[0xF2, 0x00, 0x00]), Some(TransportEvent::Spp(1)));
        // 16 MIDI beats = 1 bar in 4/4 → bar 2.
        assert_eq!(parse_transport(&[0xF2, 0x10, 0x00]), Some(TransportEvent::Spp(2)));
        // 32 MIDI beats = bar 3.
        assert_eq!(parse_transport(&[0xF2, 0x20, 0x00]), Some(TransportEvent::Spp(3)));
        // `0xF2 40 01` = (0x01 << 7) | 0x40 = 192 midi beats = 12 bars
        // → bar 13.
        assert_eq!(parse_transport(&[0xF2, 0x40, 0x01]), Some(TransportEvent::Spp(13)));
    }

    #[test]
    fn spp_rounds_mid_bar_to_containing_bar() {
        // 15 MIDI beats = not quite a full bar; rounds down to bar 1.
        assert_eq!(parse_transport(&[0xF2, 0x0F, 0x00]), Some(TransportEvent::Spp(1)));
        // 17 MIDI beats = just past bar 2 downbeat; bar 2.
        assert_eq!(parse_transport(&[0xF2, 0x11, 0x00]), Some(TransportEvent::Spp(2)));
    }

    #[test]
    fn rejects_malformed_spp() {
        // SPP without its two data bytes — not a complete message.
        assert_eq!(parse_transport(&[0xF2]), None);
        assert_eq!(parse_transport(&[0xF2, 0x00]), None);
    }

    #[test]
    fn bar_to_spp_round_trips_through_parse_transport() {
        // Every bar we could emit should, when encoded and then
        // parsed, recover the same bar — confirms the encode/decode
        // functions agree on the 4/4 × 16 midi-beats-per-bar model.
        for bar in [1, 2, 5, 10, 99, 255, 500] {
            let msg = bar_to_spp_message(bar);
            assert_eq!(parse_transport(&msg), Some(TransportEvent::Spp(bar)));
        }
    }

    #[test]
    fn bar_to_spp_has_sysex_status_and_two_data_bytes() {
        let msg = bar_to_spp_message(1);
        assert_eq!(msg[0], 0xF2);
        assert!(msg[1] < 0x80);
        assert!(msg[2] < 0x80);
    }

    #[test]
    fn bar_1_encodes_as_zero_position() {
        assert_eq!(bar_to_spp_message(1), [0xF2, 0x00, 0x00]);
    }

    #[test]
    fn bar_to_spp_clamps_at_14_bit_max() {
        // (16384 - 1) / 16 + 1 ≈ bar 1025 is roughly the top of the
        // 14-bit range. Beyond that the encoder saturates rather
        // than wrapping so a stray huge bar number doesn't alias.
        let msg = bar_to_spp_message(10_000);
        assert_eq!(msg[0], 0xF2);
        assert_eq!(msg[1], 0x7F);
        assert_eq!(msg[2], 0x7F);
    }

    #[test]
    fn ignores_note_on() {
        assert_eq!(parse_transport(&[0x90, 60, 100]), None);
    }

    #[test]
    fn ignores_empty_message() {
        assert_eq!(parse_transport(&[]), None);
    }

    #[test]
    fn ignores_active_sensing() {
        // 0xFE is Active Sensing — some hardware spams it.
        assert_eq!(parse_transport(&[0xFE]), None);
    }

    // ---- split_midi_messages ---------------------------------------------

    #[test]
    fn splitter_passes_through_single_3byte_message() {
        let msgs = split_midi_messages(&[0xB0, 0x47, 0x32]);
        assert_eq!(msgs, vec![vec![0xB0, 0x47, 0x32]]);
    }

    #[test]
    fn splitter_separates_back_to_back_ccs() {
        // 6 bytes = two 3-byte CC messages back-to-back. This is the
        // decade-carry batch pattern (probe-send-jog-fwd.log).
        let msgs = split_midi_messages(&[0xB0, 0x47, 0x30, 0xB0, 0x48, 0x31]);
        assert_eq!(
            msgs,
            vec![vec![0xB0, 0x47, 0x30], vec![0xB0, 0x48, 0x31]]
        );
    }

    #[test]
    fn splitter_handles_ableton_timecode_burst() {
        // Captured live in ableton-locate-debug.log: a 38-byte packet
        // carrying d0..d9 of the BBT display followed by 8 channel-
        // pressure VU updates. Every B0 4X CC must come out as its own
        // 3-byte message; D0 channel pressures as 2-byte messages.
        let packet = [
            0xB0, 0x40, 0x31, 0xB0, 0x41, 0x30, 0xB0, 0x42, 0x30, 0xB0, 0x43, 0x71, 0xB0, 0x44,
            0x30, 0xB0, 0x45, 0x71, 0xB0, 0x46, 0x30, 0xB0, 0x47, 0x71, 0xB0, 0x48, 0x30, 0xB0,
            0x49, 0x30, 0xD0, 0x00, 0xD0, 0x10, 0xD0, 0x20, 0xD0, 0x30,
        ];
        let msgs = split_midi_messages(&packet);
        assert_eq!(msgs.len(), 14, "10 CCs + 4 channel pressures");
        for msg in &msgs[..10] {
            assert_eq!(msg.len(), 3, "CC messages are 3 bytes");
            assert_eq!(msg[0], 0xB0);
        }
        for msg in &msgs[10..] {
            assert_eq!(msg.len(), 2, "Channel pressure messages are 2 bytes");
            assert_eq!(msg[0], 0xD0);
        }
    }

    #[test]
    fn splitter_handles_sysex_inside_packet() {
        // Heartbeat probe (7 bytes) followed by a CC. SysEx terminates
        // at 0xF7 and the splitter should recover to status parsing.
        let packet = [
            0xF0, 0x00, 0x00, 0x66, 0x14, 0x00, 0xF7, // heartbeat for 0x14
            0xB0, 0x47, 0x32, // d7='2'
        ];
        let msgs = split_midi_messages(&packet);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].len(), 7);
        assert_eq!(msgs[0][0], 0xF0);
        assert_eq!(*msgs[0].last().unwrap(), 0xF7);
        assert_eq!(msgs[1], vec![0xB0, 0x47, 0x32]);
    }

    #[test]
    fn splitter_drops_unterminated_sysex() {
        // SysEx with no F7 — drop and stop, don't try to parse what's
        // after it as a fresh message (we'd risk reading SysEx data
        // bytes as status).
        let packet = [0xF0, 0x00, 0x00, 0x66, 0x14, 0x00];
        assert!(split_midi_messages(&packet).is_empty());
    }

    #[test]
    fn splitter_skips_orphan_data_bytes() {
        // Leading data bytes (no status) — we don't track running
        // status across packet boundaries, so just discard them and
        // resync at the next status byte.
        let packet = [0x40, 0x32, 0xB0, 0x47, 0x31];
        let msgs = split_midi_messages(&packet);
        assert_eq!(msgs, vec![vec![0xB0, 0x47, 0x31]]);
    }

    #[test]
    fn splitter_truncates_on_short_trailing_message() {
        // Status byte at the end with insufficient data bytes — drop
        // the partial message rather than reading past the buffer.
        let packet = [0xB0, 0x47, 0x32, 0xB0, 0x48]; // CC then partial
        let msgs = split_midi_messages(&packet);
        assert_eq!(msgs, vec![vec![0xB0, 0x47, 0x32]]);
    }

    #[test]
    fn splitter_handles_2_and_3_byte_channel_messages_mixed() {
        // Program change (0xC0, 2 bytes) + Note on (0x90, 3 bytes) +
        // Channel pressure (0xD0, 2 bytes).
        let packet = [0xC0, 0x05, 0x90, 0x3C, 0x7F, 0xD0, 0x40];
        let msgs = split_midi_messages(&packet);
        assert_eq!(
            msgs,
            vec![
                vec![0xC0, 0x05],
                vec![0x90, 0x3C, 0x7F],
                vec![0xD0, 0x40],
            ]
        );
    }
}
