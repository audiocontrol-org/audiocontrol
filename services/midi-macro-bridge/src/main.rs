//! midi-macro-bridge
//!
//! Translates MIDI transport messages from a Roland MC-500mkII (or
//! similar) into keyboard events that control UAD LUNA's transport.
//!
//! See README.md for user-facing docs.

use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use tracing::{error, info, warn};

mod config;
mod keys;
mod mcu;
mod midi;
mod state;

use crate::config::Config;
use crate::keys::Emitter;
use crate::state::{Machine, TransportEvent};

fn main() -> Result<()> {
    init_tracing();

    let args: Vec<String> = std::env::args().collect();

    // --list-ports: print available MIDI inputs and exit.
    if args.iter().any(|a| a == "--list-ports") {
        for name in midi::list_ports()? {
            println!("{name}");
        }
        return Ok(());
    }

    // --probe-midi <port-substring>: dump every received byte sequence
    // on the given existing MIDI input port. Useful for probing
    // physical interfaces or other virtual ports.
    if let Some(idx) = args.iter().position(|a| a == "--probe-midi") {
        let port = args
            .get(idx + 1)
            .filter(|a| !a.starts_with("--"))
            .context("--probe-midi requires a port name substring: --probe-midi \"828mk3\"")?;
        return run_probe_midi(port);
    }

    // --probe-mcu: register the bridge's virtual MCU endpoint pair
    // under the name "MIDI Macro Bridge" and dump every byte arriving
    // on the virtual input. The user configures LUNA to use that
    // endpoint pair as a MIDI control surface (INPUT + OUTPUT DEVICE,
    // protocol MCU); LUNA then streams position updates to the bridge
    // and we capture them for offline analysis.
    if args.iter().any(|a| a == "--probe-mcu") {
        return run_probe_mcu();
    }

    // --self-test: emit a hardcoded event sequence with delays, for
    // validating the keystroke path without needing hardware.
    let self_test = args.iter().any(|a| a == "--self-test");

    let config_path = args
        .iter()
        .skip(1)
        .find(|a| !a.starts_with("--"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("config.toml"));

    let config = Config::load(&config_path)
        .with_context(|| format!("loading config from {}", config_path.display()))?;
    info!(?config, "loaded config");

    if !config.enabled_on_startup {
        info!("enabled_on_startup = false; exiting");
        return Ok(());
    }

    let mut emitter = Emitter::new(config.keystroke_delay_ms, config.frontmost_filter())?;
    let mut machine = Machine::new();

    if self_test {
        return run_self_test(&mut machine, &mut emitter);
    }

    let (tx, rx) = mpsc::channel::<TransportEvent>();

    // Keep the MIDI connection alive for the life of the program.
    // Dropping it would close the port and stop the callback.
    let _midi_conn = midi::connect(&config.midi_input_port, move |event| {
        if let Err(e) = tx.send(event) {
            // Channel closed — main loop has exited. Nothing to do.
            error!(?e, "channel send failed");
        }
    })?;

    // Ctrl-C handling — forward through a channel the main loop polls.
    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    info!("ready — waiting for MIDI transport events (Ctrl-C to exit)");

    loop {
        if shutdown_rx.try_recv().is_ok() {
            info!("shutting down");
            return Ok(());
        }

        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok(event) => {
                let state_before = machine.state();
                let actions = machine.handle(event);
                let state_after = machine.state();

                if actions.is_empty() {
                    info!(
                        ?event,
                        ?state_before,
                        ?state_after,
                        "ignored (redundant event)"
                    );
                } else {
                    info!(
                        ?event,
                        ?state_before,
                        ?state_after,
                        ?actions,
                        "emitting keystrokes"
                    );
                    if let Err(e) = emitter.emit_sequence(&actions) {
                        warn!(?e, "keystroke emission failed");
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                error!("MIDI channel disconnected");
                return Ok(());
            }
        }
    }
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}

/// Name under which the bridge registers its virtual MCU endpoint
/// pair. This is the string that shows up in LUNA's "MIDI Control
/// Surfaces" INPUT DEVICE / OUTPUT DEVICE dropdowns.
const MCU_ENDPOINT_NAME: &str = "MIDI Macro Bridge";

/// Dump every MIDI byte sequence received on an existing port to
/// stdout, with a microsecond-offset timestamp and a coarse label.
/// Useful for probing physical interfaces (e.g., the 828mk3) or
/// other apps' virtual ports.
fn run_probe_midi(port_substring: &str) -> Result<()> {
    let (rx, _conn_lifecycle) = {
        use std::time::Instant;
        let start = Instant::now();
        let (tx, rx) = mpsc::channel::<(u128, Vec<u8>)>();
        let conn = midi::connect_raw(port_substring, move |bytes| {
            let _ = tx.send((start.elapsed().as_micros(), bytes.to_vec()));
        })?;
        (rx, conn)
    };

    eprintln!("# probe-midi: listening on port matching '{port_substring}' — Ctrl-C to stop");
    eprintln!("# columns: <microseconds since start>  [<byte count>]  <label>  <hex>");
    drive_probe_loop(rx)
}

/// Register the bridge's virtual MCU endpoint pair, answer LUNA's
/// heartbeat probe so the surface stays alive, and dump every byte
/// arriving on the virtual input. The user then configures LUNA's
/// MIDI Control Surfaces to pick the bridge as both INPUT and OUTPUT
/// DEVICE on a free row (protocol: MCU), and LUNA streams position
/// updates into the probe.
fn run_probe_mcu() -> Result<()> {
    use std::time::Instant;

    let start = Instant::now();
    let (tx, rx) = mpsc::channel::<(u128, Vec<u8>)>();
    let mut pair = midi::create_virtual_mcu(MCU_ENDPOINT_NAME, move |bytes| {
        let _ = tx.send((start.elapsed().as_micros(), bytes.to_vec()));
    })?;

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    eprintln!("# probe-mcu: virtual endpoint '{MCU_ENDPOINT_NAME}' is now registered.");
    eprintln!("# In LUNA, open MIDI Control Surfaces and select '{MCU_ENDPOINT_NAME}' as");
    eprintln!("# both INPUT DEVICE and OUTPUT DEVICE on a free row (protocol: MCU).");
    eprintln!(
        "# Heartbeat responder active: replies to model 0x{:02X} probes with identity.",
        mcu::MCU_MODEL_ID
    );
    eprintln!("# Ctrl-C to stop. Dropping the bridge removes the endpoint from LUNA's list.");
    eprintln!("# columns: <microseconds since start>  [<byte count>]  <label>  <hex>");

    loop {
        if shutdown_rx.try_recv().is_ok() {
            eprintln!("# probe stopped");
            return Ok(());
        }
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok((us, bytes)) => {
                // Heartbeat responder — reply to LUNA's model-ID query so
                // the surface doesn't time out. Only respond to our
                // declared model ID; the other queries LUNA sprays across
                // 0x10-0x15 are checking for *other* MCU variants.
                if let Some(model) = mcu::parse_heartbeat_query(&bytes) {
                    if model == mcu::MCU_MODEL_ID {
                        let reply = mcu::mcu_identity_reply(model);
                        match pair.send(&reply) {
                            Ok(()) => eprintln!(
                                "# -> identity reply sent for model 0x{model:02X}"
                            ),
                            Err(e) => eprintln!("# heartbeat reply failed: {e}"),
                        }
                    }
                }

                let hex: Vec<String> = bytes.iter().map(|b| format!("{b:02X}")).collect();
                println!(
                    "{us:>12}us  [{:>3}]  {:<18}  {}",
                    bytes.len(),
                    classify_midi(&bytes),
                    hex.join(" ")
                );
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                eprintln!("# MIDI channel disconnected");
                return Ok(());
            }
        }
    }
}

/// Shared event-print loop for the probe modes. Runs until Ctrl-C or
/// the MIDI channel disconnects. The MIDI connection handle must be
/// held alive by the caller for the duration of the loop (dropping
/// it closes the port / virtual endpoint).
fn drive_probe_loop(rx: mpsc::Receiver<(u128, Vec<u8>)>) -> Result<()> {
    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    loop {
        if shutdown_rx.try_recv().is_ok() {
            eprintln!("# probe stopped");
            return Ok(());
        }
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok((us, bytes)) => {
                let hex: Vec<String> = bytes.iter().map(|b| format!("{b:02X}")).collect();
                println!(
                    "{us:>12}us  [{:>3}]  {:<18}  {}",
                    bytes.len(),
                    classify_midi(&bytes),
                    hex.join(" ")
                );
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                eprintln!("# MIDI channel disconnected");
                return Ok(());
            }
        }
    }
}

/// Coarse classification of the first status byte. Good enough for
/// probe logs; real parsing is the job of `midi.rs` / `mcu.rs`.
fn classify_midi(bytes: &[u8]) -> &'static str {
    let Some(first) = bytes.first().copied() else {
        return "(empty)";
    };
    match first {
        0xF0 => "SysEx",
        0xF1 => "MTC qframe",
        0xF2 => "SPP",
        0xF3 => "Song select",
        0xF6 => "Tune request",
        0xF7 => "SysEx end",
        0xF8 => "Clock",
        0xFA => "Start",
        0xFB => "Continue",
        0xFC => "Stop",
        0xFE => "Active sensing",
        0xFF => "Reset",
        b => match b & 0xF0 {
            0x80 => "Note off",
            0x90 => "Note on",
            0xA0 => "Poly pressure",
            0xB0 => "CC",
            0xC0 => "Program change",
            0xD0 => "Channel pressure",
            0xE0 => "Pitch bend",
            _ => "(unknown)",
        },
    }
}

/// Emit a canned sequence of events so the user can validate the
/// keystroke path (and Accessibility permissions) without the MC-500
/// being connected. LUNA should respond as if the MC-500 sent these.
fn run_self_test(machine: &mut Machine, emitter: &mut Emitter) -> Result<()> {
    use std::thread::sleep;

    info!("self-test: focus LUNA now, starting in 3 seconds");
    sleep(Duration::from_secs(3));

    let script = [
        (TransportEvent::Start, "Start (should rewind and play)"),
        (TransportEvent::Stop, "Stop"),
        (TransportEvent::Continue, "Continue (should resume)"),
        (TransportEvent::Stop, "Stop"),
    ];

    for (event, description) in script {
        info!(?event, description, "self-test step");
        let actions = machine.handle(event);
        if !actions.is_empty() {
            emitter.emit_sequence(&actions)?;
        }
        sleep(Duration::from_secs(2));
    }

    info!("self-test complete");
    Ok(())
}
