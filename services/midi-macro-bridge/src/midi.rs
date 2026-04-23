//! MIDI input handling via midir.
//!
//! The callback runs on midir's own thread. It does NOT call into
//! the keystroke emitter directly — instead it sends events through
//! an mpsc channel to the main thread. This is deliberate: macOS
//! CGEvent (which enigo uses for keystroke synthesis) does not play
//! well with being called from arbitrary threads.

use anyhow::{anyhow, Context, Result};
use midir::{MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use tracing::{debug, info};

#[cfg(unix)]
use midir::os::unix::{VirtualInput, VirtualOutput};

use crate::state::TransportEvent;

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
pub fn list_ports() -> Result<Vec<String>> {
    let midi_in = MidiInput::new("midi-macro-bridge-list")?;
    midi_in
        .ports()
        .iter()
        .map(|p| midi_in.port_name(p).context("read port name"))
        .collect()
}

/// Handles to the virtual MIDI input + output endpoints the bridge
/// registers so DAWs (e.g., LUNA) can select the bridge as an MCU
/// control surface. Dropping this value closes both endpoints and
/// removes them from the system's MIDI device list.
pub struct VirtualMcuPair {
    _input: MidiInputConnection<()>,
    output: MidiOutputConnection,
}

impl VirtualMcuPair {
    /// Send a MIDI message out the virtual output. DAWs that have
    /// selected the pair as their MCU control surface INPUT DEVICE
    /// will receive it.
    pub fn send(&mut self, bytes: &[u8]) -> Result<()> {
        self.output
            .send(bytes)
            .map_err(|e| anyhow!("virtual MCU send failed: {e}"))
    }
}

/// Register a paired virtual MIDI input + output under
/// `endpoint_name`. The pair shows up in macOS CoreMIDI (and ALSA on
/// Linux) as a selectable device, so LUNA can pick the bridge as both
/// its MCU INPUT DEVICE and OUTPUT DEVICE. Incoming bytes on the
/// virtual input are forwarded to `on_bytes` on midir's callback
/// thread.
#[cfg(unix)]
pub fn create_virtual_mcu<F>(endpoint_name: &str, on_bytes: F) -> Result<VirtualMcuPair>
where
    F: FnMut(&[u8]) + Send + 'static,
{
    let midi_in = MidiInput::new("midi-macro-bridge-mcu")?;
    let mut on_bytes = on_bytes;
    let input = midi_in
        .create_virtual(
            endpoint_name,
            move |_timestamp, bytes, _| on_bytes(bytes),
            (),
        )
        .map_err(|e| anyhow!("failed to create virtual MIDI input '{endpoint_name}': {e}"))?;

    let midi_out = MidiOutput::new("midi-macro-bridge-mcu")?;
    let output = midi_out
        .create_virtual(endpoint_name)
        .map_err(|e| anyhow!("failed to create virtual MIDI output '{endpoint_name}': {e}"))?;

    info!(endpoint = endpoint_name, "created virtual MCU endpoint pair");

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

/// Extract a transport event from a raw MIDI message.
/// Returns None for non-transport messages (including SPP, clock, notes, etc.).
///
/// We intentionally discard SPP (0xF2). LUNA has no way to accept
/// absolute position, so there is nothing useful we could do with it.
fn parse_transport(bytes: &[u8]) -> Option<TransportEvent> {
    match bytes.first().copied()? {
        0xFA => Some(TransportEvent::Start),
        0xFB => Some(TransportEvent::Continue),
        0xFC => Some(TransportEvent::Stop),
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
    fn ignores_spp() {
        // Song Position Pointer: 0xF2 followed by 2 data bytes.
        // Intentionally discarded (see module docs).
        assert_eq!(parse_transport(&[0xF2, 0x00, 0x00]), None);
        assert_eq!(parse_transport(&[0xF2, 0x40, 0x01]), None);
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
}
