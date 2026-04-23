//! MIDI input handling via midir.
//!
//! The callback runs on midir's own thread. It does NOT call into
//! the keystroke emitter directly — instead it sends events through
//! an mpsc channel to the main thread. This is deliberate: macOS
//! CGEvent (which enigo uses for keystroke synthesis) does not play
//! well with being called from arbitrary threads.

use anyhow::{anyhow, Context, Result};
use midir::{MidiInput, MidiInputConnection};
use tracing::{debug, info};

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
