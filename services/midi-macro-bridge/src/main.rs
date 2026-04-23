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
