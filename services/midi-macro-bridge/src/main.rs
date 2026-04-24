//! midi-macro-bridge
//!
//! Translates MIDI transport messages from a Roland MC-500mkII (or
//! similar) into keyboard events that control UAD LUNA's transport.
//!
//! See README.md for user-facing docs.

use anyhow::{Context, Result};
use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

mod backend;
mod config;
mod keys;
mod locate;
mod mcu;
mod midi;
mod state;

use crate::backend::{Backend, KeystrokeBackend, McuBackend};
use crate::config::{BackendKind, Config, LoadOutcome};
use crate::keys::Emitter;
use crate::locate::{
    transport_to_locate_event, EventSource, LocateController, LocateEvent, LocateOutcome,
    PositionSource,
};
use crate::mcu::PositionTracker;
use crate::midi::VirtualMcuPair;
use crate::state::{Machine, TransportEvent, TransportState};

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

    // --send-mcu <spec> [args...]: emit a candidate MCU message to
    // LUNA and dump any inbound response for a few seconds. Used
    // during Phase 3c to empirically map actions (play, stop, bar-
    // nudge, ...) to the byte sequences LUNA actually responds to.
    if let Some(idx) = args.iter().position(|a| a == "--send-mcu") {
        let spec = args
            .get(idx + 1)
            .filter(|a| !a.starts_with("--"))
            .context("--send-mcu requires a spec (e.g. 'play', 'stop', 'raw 90 5E 7F')")?
            .clone();
        let extra: Vec<String> = args
            .iter()
            .skip(idx + 2)
            .take_while(|a| !a.starts_with("--"))
            .cloned()
            .collect();
        return run_send_mcu(&spec, &extra);
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

    let config = match Config::load(&config_path)
        .with_context(|| format!("loading config from {}", config_path.display()))?
    {
        LoadOutcome::Loaded(cfg) => {
            info!(?cfg, path = %config_path.display(), "loaded config");
            cfg
        }
        LoadOutcome::NotFound => {
            warn!(
                path = %config_path.display(),
                "config file not found — running with defaults. \
                 See services/midi-macro-bridge/config.example.toml."
            );
            Config::default()
        }
    };

    if !config.enabled_on_startup {
        info!("enabled_on_startup = false; exiting");
        return Ok(());
    }

    // MCU input channel: the virtual endpoint's callback forwards
    // received byte sequences here; the main loop drains them to
    // reply to heartbeat queries and feed position updates into the
    // PositionTracker. Created before build_backend so the MCU
    // backend's endpoint callback can plug into the same channel.
    let (mcu_bytes_tx, mcu_bytes_rx) = mpsc::channel::<Vec<u8>>();

    // Whether we need the virtual MCU endpoint pair at all. MCU
    // backend needs it for both directions; KeystrokeBackend +
    // locate.enabled needs it for input only; KeystrokeBackend +
    // no locate doesn't need it.
    let needs_virtual_pair = matches!(config.transport.backend, BackendKind::Mcu)
        || config.locate.enabled;

    let (mut backend, pair) = build_backend(&config, needs_virtual_pair, mcu_bytes_tx)?;
    info!(
        backend = backend.name(),
        has_mcu_pair = pair.is_some(),
        locate_enabled = config.locate.enabled,
        "bridge ready"
    );

    let mut machine = Machine::new();
    let mut tracker = PositionTracker::new();

    if self_test {
        return run_self_test(&mut machine, backend.as_mut());
    }

    let (tx, rx) = mpsc::channel::<TransportEvent>();

    // Keep the MIDI connection alive for the life of the program.
    // Dropping it would close the port and stop the callback. If the
    // user's config has no MC-500 transport port (or the config file
    // is missing), skip this — the bridge's virtual MCU endpoint is
    // still useful on its own for LUNA testing, even without
    // transport input.
    let _midi_conn = if config.midi_input_port.is_empty() {
        warn!(
            "no `midi_input_port` configured — MC-500 transport input is disabled. \
             The bridge is still running as an MCU control surface; set \
             midi_input_port in config.toml to receive transport events."
        );
        None
    } else {
        Some(
            midi::connect(&config.midi_input_port, move |event| {
                if let Err(e) = tx.send(event) {
                    // Channel closed — main loop has exited. Nothing to do.
                    error!(?e, "channel send failed");
                }
            })
            .with_context(|| {
                format!(
                    "opening MIDI input matching '{}'. Run --list-ports to see \
                     available ports.",
                    config.midi_input_port
                )
            })?,
        )
    };

    // MIDI output to the MC-500 for sync-on-stop. Warn-and-continue
    // if the port can't be opened — the forward direction still
    // works, we just can't sync positions back.
    let mut mc500_out: Option<midir::MidiOutputConnection> = if config.mc500_output_port.is_empty() {
        info!("no `mc500_output_port` configured — sync-on-stop is disabled");
        None
    } else {
        match midi::connect_output(&config.mc500_output_port) {
            Ok(conn) => {
                info!(
                    port = %config.mc500_output_port,
                    "MC-500 sync output ready"
                );
                Some(conn)
            }
            Err(e) => {
                warn!(
                    ?e,
                    port = %config.mc500_output_port,
                    "couldn't open MC-500 sync output — sync-on-stop will be disabled \
                     for this session. The forward MC-500 → LUNA path is unaffected."
                );
                None
            }
        }
    };

    // Ctrl-C handling — forward through a channel the main loop polls.
    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    info!("ready — waiting for MIDI events (Ctrl-C to exit)");

    let locate_runtime_cfg = config.locate.to_runtime();
    let locate_enabled = config.locate.enabled;

    loop {
        if shutdown_rx.try_recv().is_ok() {
            info!("shutting down");
            return Ok(());
        }

        // Drain any pending MCU bytes: reply to heartbeats and keep
        // the PositionTracker current so the next locate starts
        // with fresh state.
        let mut mcu_bytes_drained = false;
        while let Ok(bytes) = mcu_bytes_rx.try_recv() {
            handle_mcu_byte_idle(&bytes, &pair, &mut tracker);
            mcu_bytes_drained = true;
        }

        // Process at most one transport event per iteration.
        let transport_drained = match rx.recv_timeout(Duration::from_millis(50)) {
            Ok(event) => {
                let state_before = machine.state();
                let actions = machine.handle(event);

                if actions.is_empty() {
                    info!(
                        ?event,
                        ?state_before,
                        state_after = ?machine.state(),
                        "no-op event (echo guard or state change only)"
                    );
                } else {
                    info!(
                        ?event,
                        ?state_before,
                        state_after = ?machine.state(),
                        ?actions,
                        "dispatching actions"
                    );
                    if let Err(e) = backend.emit(&actions) {
                        warn!(?e, "backend emit failed");
                    }
                }

                // If the state machine transitioned into Locating,
                // run the closed-loop controller before returning to
                // the event loop. Blocks until the locate completes.
                if let TransportState::Locating { target, .. } = machine.state() {
                    run_locate_step(
                        target,
                        &mcu_bytes_rx,
                        &rx,
                        &pair,
                        &mut tracker,
                        backend.as_mut(),
                        locate_runtime_cfg,
                        locate_enabled,
                        &mut machine,
                    )?;
                }

                // Sync-on-stop: if the state just transitioned from
                // anything-non-Stopped to Stopped (because we hit
                // Stop, or a locate cancelled/failed, or a locate
                // completed without a queued Play), LUNA will snap
                // to its play-start position. Wait briefly for that
                // to settle, then push SPP at the new bar to the
                // MC-500 so both machines agree.
                let state_after = machine.state();
                let transitioned_to_stopped = state_after == TransportState::Stopped
                    && !matches!(state_before, TransportState::Stopped);
                if transitioned_to_stopped {
                    sync_mc500_to_luna_after_stop(
                        &mcu_bytes_rx,
                        &pair,
                        &mut tracker,
                        mc500_out.as_mut(),
                    );
                }

                true
            }
            Err(mpsc::RecvTimeoutError::Timeout) => false,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                error!("MIDI channel disconnected");
                return Ok(());
            }
        };

        // Brief idle sleep if both channels were empty, keeping CPU
        // cost low during long quiet periods.
        if !mcu_bytes_drained && !transport_drained {
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}

/// Build the configured transport backend and (if needed) the
/// virtual MCU endpoint pair. The pair is returned separately so the
/// main loop can share it with the heartbeat responder and the
/// LocateController's PositionSource.
fn build_backend(
    config: &Config,
    needs_virtual_pair: bool,
    mcu_bytes_tx: mpsc::Sender<Vec<u8>>,
) -> Result<(Box<dyn Backend>, Option<Rc<RefCell<VirtualMcuPair>>>)> {
    let pair = if needs_virtual_pair {
        let tx_for_callback = mcu_bytes_tx;
        let pair = midi::create_virtual_mcu(MCU_ENDPOINT_NAME, move |bytes| {
            let _ = tx_for_callback.send(bytes.to_vec());
        })?;
        Some(Rc::new(RefCell::new(pair)))
    } else {
        None
    };

    let backend: Box<dyn Backend> = match config.transport.backend {
        BackendKind::Mcu => {
            let pair = pair
                .as_ref()
                .expect("MCU backend requires needs_virtual_pair to be true")
                .clone();
            Box::new(McuBackend::new(pair))
        }
        BackendKind::Keystrokes => {
            let emitter = Emitter::new(
                config.transport.keystroke_delay_ms,
                config.transport.frontmost_filter(),
            )?;
            Box::new(KeystrokeBackend::new(emitter))
        }
    };

    Ok((backend, pair))
}

/// Tail of a Stop transition. Gives LUNA a short window to settle
/// at its play-start position (we actively drain inbound MCU bytes
/// during the wait so the tracker reflects the post-snap bar), then
/// sends an SPP message to the MC-500 so it jumps to the same bar.
/// Silent on all failure modes — sync is an enhancement; the
/// forward path has already fired.
fn sync_mc500_to_luna_after_stop(
    mcu_bytes_rx: &mpsc::Receiver<Vec<u8>>,
    pair: &Option<Rc<RefCell<VirtualMcuPair>>>,
    tracker: &mut PositionTracker,
    mc500_out: Option<&mut midir::MidiOutputConnection>,
) {
    // Observed timing from probe-send-stop.log: LUNA takes ~170 ms
    // between "Stop received" and the final snap-to-play-start
    // position update. 500 ms gives comfortable headroom.
    const SETTLE_WINDOW: Duration = Duration::from_millis(500);

    let Some(out) = mc500_out else {
        return;
    };

    let deadline = Instant::now() + SETTLE_WINDOW;
    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let poll = remaining.min(Duration::from_millis(50));
        match mcu_bytes_rx.recv_timeout(poll) {
            Ok(bytes) => handle_mcu_byte_idle(&bytes, pair, tracker),
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    let bar = tracker.current_bar();
    if bar == 0 {
        // Tracker has no position — we never saw LUNA settle on
        // anything. Don't send SPP; it'd tell the MC-500 to go to a
        // bar that may not reflect reality.
        info!("sync-on-stop: no tracked position from LUNA; skipping SPP");
        return;
    }

    let spp = midi::bar_to_spp_message(bar);
    match out.send(&spp) {
        Ok(()) => info!(bar, "sync-on-stop: sent SPP to MC-500"),
        Err(e) => warn!(?e, bar, "sync-on-stop: SPP send failed"),
    }
}

/// Idle-path handling for a received MCU byte sequence: reply to
/// heartbeat queries, apply position CCs to the tracker. Non-CC /
/// non-heartbeat bytes are ignored (LCD dumps, V-Pot updates, etc).
fn handle_mcu_byte_idle(
    bytes: &[u8],
    pair: &Option<Rc<RefCell<VirtualMcuPair>>>,
    tracker: &mut PositionTracker,
) {
    if let Some(pair) = pair {
        if let Some(model) = mcu::parse_heartbeat_query(bytes) {
            if model == mcu::MCU_MODEL_ID {
                let reply = mcu::mcu_identity_reply(model);
                if let Err(e) = pair.borrow_mut().send(&reply) {
                    warn!(?e, "heartbeat reply send failed");
                }
            }
        }
    }
    if let Some(update) = mcu::parse_cc_display(bytes) {
        tracker.apply(update);
    }
}

/// Invoked when `Machine::handle` has transitioned into the
/// `Locating` state. If locate is enabled in config, constructs the
/// LocateController I/O sources and runs the closed-loop. Always
/// calls `Machine::complete_locate` at the end so the state machine
/// returns to Stopped / Playing regardless of outcome, then emits
/// any post-locate Play action the state machine produced.
#[allow(clippy::too_many_arguments)]
fn run_locate_step(
    target: u32,
    mcu_bytes_rx: &mpsc::Receiver<Vec<u8>>,
    transport_rx: &mpsc::Receiver<TransportEvent>,
    pair: &Option<Rc<RefCell<VirtualMcuPair>>>,
    tracker: &mut PositionTracker,
    backend: &mut dyn Backend,
    cfg: locate::LocateConfig,
    locate_enabled: bool,
    machine: &mut Machine,
) -> Result<()> {
    if !locate_enabled {
        warn!(
            target,
            "SPP received but [locate] enabled=false in config — cancelling"
        );
        let post = machine.complete_locate(false, false);
        if !post.is_empty() {
            backend.emit(&post)?;
        }
        return Ok(());
    }

    let outcome = {
        let mut position = McuPositionSource::new(mcu_bytes_rx, tracker, pair.as_ref());
        let mut events = TransportLocateEventSource { rx: transport_rx };
        let controller = LocateController {
            position: &mut position,
            events: &mut events,
            backend,
            config: cfg,
        };
        controller.run(target)?
    };

    // queued_start is observed by the LocateController (since it
    // consumes transport events during the locate), so the Machine
    // hasn't had a chance to record it. Extract the flag from the
    // outcome and pass it through explicitly.
    let (reached, queued_start) = match &outcome {
        LocateOutcome::Reached { queued_start, .. } => (true, *queued_start),
        _ => (false, false),
    };
    info!(?outcome, reached, queued_start, "locate outcome");

    let post = machine.complete_locate(reached, queued_start);
    if !post.is_empty() {
        info!(?post, "emitting post-locate actions");
        backend.emit(&post)?;
    }
    Ok(())
}

/// PositionSource implementation backed by an mpsc channel of raw
/// MCU bytes. Parses inbound CCs into `DigitUpdate`s, feeds them to
/// the shared tracker, and returns Some(bar) when the composed bar
/// changes. Also replies to MCU heartbeat queries so LUNA doesn't
/// drop the surface during long locates.
struct McuPositionSource<'a> {
    bytes_rx: &'a mpsc::Receiver<Vec<u8>>,
    tracker: &'a mut PositionTracker,
    pair: Option<&'a Rc<RefCell<VirtualMcuPair>>>,
    /// True once we've seen any position update — distinguishes
    /// "tracker has known state" from "tracker still at zero because
    /// nothing has arrived." Initialised from the tracker's current
    /// state at construction time, so a locate that starts with the
    /// tracker already holding real data doesn't block waiting.
    has_seen_position: bool,
}

impl<'a> McuPositionSource<'a> {
    fn new(
        bytes_rx: &'a mpsc::Receiver<Vec<u8>>,
        tracker: &'a mut PositionTracker,
        pair: Option<&'a Rc<RefCell<VirtualMcuPair>>>,
    ) -> Self {
        let has_seen_position = tracker.current_bar() != 0;
        Self {
            bytes_rx,
            tracker,
            pair,
            has_seen_position,
        }
    }

    fn handle_heartbeat(&self, bytes: &[u8]) {
        let Some(pair) = self.pair else { return };
        if let Some(model) = mcu::parse_heartbeat_query(bytes) {
            if model == mcu::MCU_MODEL_ID {
                let reply = mcu::mcu_identity_reply(model);
                if let Err(e) = pair.borrow_mut().send(&reply) {
                    warn!(?e, "heartbeat reply send failed during locate");
                }
            }
        }
    }
}

impl<'a> PositionSource for McuPositionSource<'a> {
    fn current_bar(&self) -> Option<u32> {
        if self.has_seen_position {
            Some(self.tracker.current_bar())
        } else {
            None
        }
    }

    fn wait_for_position_change(&mut self, timeout: Duration) -> Option<u32> {
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return None;
            }
            let poll = remaining.min(Duration::from_millis(100));
            match self.bytes_rx.recv_timeout(poll) {
                Ok(bytes) => {
                    self.handle_heartbeat(&bytes);
                    if let Some(update) = mcu::parse_cc_display(&bytes) {
                        if let Some(pos) = self.tracker.apply(update) {
                            self.has_seen_position = true;
                            return Some(pos.bar);
                        }
                    }
                    // Other bytes: keep waiting.
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => return None,
            }
        }
    }
}

/// EventSource implementation backed by the transport-event channel.
/// Translates each received TransportEvent into a LocateEvent the
/// controller understands (new target / cancel / queue play).
struct TransportLocateEventSource<'a> {
    rx: &'a mpsc::Receiver<TransportEvent>,
}

impl<'a> EventSource for TransportLocateEventSource<'a> {
    fn try_recv(&mut self) -> Option<LocateEvent> {
        match self.rx.try_recv() {
            Ok(ev) => transport_to_locate_event(ev),
            Err(_) => None,
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

/// Parse a `--send-mcu <spec> [extra...]` command into one or more
/// MIDI byte sequences to emit on the virtual MCU output. Buttons
/// emit a press (velocity 0x7F) followed by a release (velocity
/// 0x00) with a short inter-message gap. Split `-press` / `-release`
/// variants let us test non-tap behaviours (e.g. whether LUNA
/// interprets a held-down rewind differently from a tap).
fn parse_mcu_spec(spec: &str, extra: &[String]) -> Result<Vec<Vec<u8>>> {
    let button_tap = |note: u8| {
        vec![
            vec![0x90, note, 0x7F], // press
            vec![0x90, note, 0x00], // release
        ]
    };
    Ok(match spec {
        "play" => button_tap(0x5E),
        "stop" => button_tap(0x5D),
        "rewind" => button_tap(0x5B),
        "ff" | "fast-forward" => button_tap(0x5C),
        "record" => button_tap(0x5F),
        "cursor-left" => button_tap(0x62),
        "cursor-right" => button_tap(0x63),
        "cursor-up" => button_tap(0x60),
        "cursor-down" => button_tap(0x61),
        "rewind-press" => vec![vec![0x90, 0x5B, 0x7F]],
        "rewind-release" => vec![vec![0x90, 0x5B, 0x00]],
        "ff-press" => vec![vec![0x90, 0x5C, 0x7F]],
        "ff-release" => vec![vec![0x90, 0x5C, 0x00]],
        "raw" => {
            anyhow::ensure!(
                !extra.is_empty(),
                "raw spec requires hex bytes: --send-mcu raw 90 5E 7F"
            );
            let bytes: Vec<u8> = extra
                .iter()
                .map(|s| {
                    let trimmed = s.trim_start_matches("0x").trim_start_matches("0X");
                    u8::from_str_radix(trimmed, 16)
                        .with_context(|| format!("not a hex byte: {s:?}"))
                })
                .collect::<Result<_>>()?;
            vec![bytes]
        }
        other => anyhow::bail!(
            "unknown --send-mcu spec '{other}'. Known: play, stop, rewind, ff, record, \
             cursor-left, cursor-right, cursor-up, cursor-down, rewind-press, rewind-release, \
             ff-press, ff-release, raw <hex-bytes>"
        ),
    })
}

/// Emit a candidate MCU message to LUNA via the virtual output, then
/// dump any inbound bytes for a few seconds so we can see LUNA's
/// reaction. Intended for Phase 3c discovery — drive it with
/// `--send-mcu play`, `--send-mcu stop`, etc.; the output shows the
/// exact bytes we emitted and whatever LUNA pushed back (position
/// updates, LED changes, etc.).
///
/// The tool waits for LUNA to activate the surface (signalled by the
/// init burst from LUNA) before emitting, rather than running on a
/// fixed settle timer. That way the user has as long as they need to
/// switch apps and toggle the Control Surface row ON.
fn run_send_mcu(spec: &str, extra: &[String]) -> Result<()> {
    use std::thread::sleep;
    use std::time::Instant;

    const MAX_WAIT_S: u64 = 120; // how long we wait for LUNA to activate
    const QUIET_MS: u64 = 250; // silence window after init burst
    const TAP_GAP_MS: u64 = 50; // press -> release gap for button taps
    const PRE_EMIT_MS: u64 = 200; // small pause after activation before we emit
    const OBSERVE_S: u64 = 3; // post-send listen window

    // Parse first so spec errors are reported before we touch MIDI.
    let messages = parse_mcu_spec(spec, extra)?;

    let start = Instant::now();
    let (tx, rx) = mpsc::channel::<(u128, Vec<u8>)>();
    let mut pair = midi::create_virtual_mcu(MCU_ENDPOINT_NAME, move |bytes| {
        let _ = tx.send((start.elapsed().as_micros(), bytes.to_vec()));
    })?;

    eprintln!("# send-mcu: spec='{spec}', {} message(s) queued to emit", messages.len());
    for (i, msg) in messages.iter().enumerate() {
        let hex: Vec<String> = msg.iter().map(|b| format!("{b:02X}")).collect();
        eprintln!("#   msg[{i}] = {}", hex.join(" "));
    }
    eprintln!(
        "# waiting for LUNA to activate surface '{MCU_ENDPOINT_NAME}' \
         (up to {MAX_WAIT_S}s)..."
    );
    eprintln!(
        "# In LUNA: Preferences > Controllers > MIDI Control Surfaces; select"
    );
    eprintln!(
        "# '{MCU_ENDPOINT_NAME}' as both INPUT and OUTPUT DEVICE and toggle the row ON."
    );

    wait_for_luna_activation(
        &rx,
        &mut pair,
        Duration::from_secs(MAX_WAIT_S),
        Duration::from_millis(QUIET_MS),
    )?;

    eprintln!("# surface ready — waiting {PRE_EMIT_MS}ms then emitting");
    sleep(Duration::from_millis(PRE_EMIT_MS));

    for (i, msg) in messages.iter().enumerate() {
        pair.send(msg)
            .with_context(|| format!("sending message {i}"))?;
        let hex: Vec<String> = msg.iter().map(|b| format!("{b:02X}")).collect();
        let ts = start.elapsed().as_micros();
        println!("{ts:>12}us  SENT  {}", hex.join(" "));
        if i + 1 < messages.len() {
            sleep(Duration::from_millis(TAP_GAP_MS));
        }
    }

    eprintln!("# observing {OBSERVE_S}s for LUNA's response...");
    drain_with_heartbeats(&rx, &mut pair, Duration::from_secs(OBSERVE_S))?;

    eprintln!("# done");
    Ok(())
}

/// Block until LUNA has activated the virtual surface and finished
/// pushing the init burst. Detected by: any non-heartbeat inbound
/// message, followed by `quiet` of no further non-heartbeat
/// traffic. Heartbeats arriving during the wait are answered so the
/// surface stays alive. Returns `Err` if no activation is seen
/// within `max_wait`.
fn wait_for_luna_activation(
    rx: &mpsc::Receiver<(u128, Vec<u8>)>,
    pair: &mut midi::VirtualMcuPair,
    max_wait: Duration,
    quiet: Duration,
) -> Result<()> {
    use std::time::Instant;

    let start = Instant::now();
    let mut activated_at: Option<Instant> = None;
    let mut last_non_heartbeat: Option<Instant> = None;

    loop {
        if start.elapsed() >= max_wait {
            anyhow::bail!(
                "no surface activation from LUNA in {}s — is the Control Surface \
                 row set to '{MCU_ENDPOINT_NAME}' (INPUT + OUTPUT) and toggled ON?",
                max_wait.as_secs()
            );
        }

        if let Some(last) = last_non_heartbeat {
            if last.elapsed() >= quiet {
                let elapsed = activated_at
                    .map(|a| a.elapsed().as_millis() as u64)
                    .unwrap_or(0);
                eprintln!(
                    "# init burst finished ({}ms of activity, then {}ms quiet) — ready",
                    elapsed,
                    quiet.as_millis()
                );
                return Ok(());
            }
        }

        let poll = Duration::from_millis(200).min(quiet);
        match rx.recv_timeout(poll) {
            Ok((us, bytes)) => {
                let heartbeat_model = mcu::parse_heartbeat_query(&bytes);

                if let Some(model) = heartbeat_model {
                    if model == mcu::MCU_MODEL_ID {
                        let reply = mcu::mcu_identity_reply(model);
                        if let Err(e) = pair.send(&reply) {
                            eprintln!("# heartbeat reply failed: {e}");
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

                if heartbeat_model.is_none() {
                    if activated_at.is_none() {
                        activated_at = Some(Instant::now());
                        eprintln!("# LUNA activation detected; waiting for init burst to settle...");
                    }
                    last_non_heartbeat = Some(Instant::now());
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                anyhow::bail!("MIDI channel disconnected while waiting for LUNA");
            }
        }
    }
}

/// Drain the inbound channel for `duration`, printing each message
/// and replying to MCU heartbeat queries so LUNA keeps the surface
/// alive during the send-mcu settle / observe windows.
fn drain_with_heartbeats(
    rx: &mpsc::Receiver<(u128, Vec<u8>)>,
    pair: &mut midi::VirtualMcuPair,
    duration: Duration,
) -> Result<()> {
    use std::time::Instant;
    let deadline = Instant::now() + duration;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Ok(());
        }
        let poll = remaining.min(Duration::from_millis(200));
        match rx.recv_timeout(poll) {
            Ok((us, bytes)) => {
                if let Some(model) = mcu::parse_heartbeat_query(&bytes) {
                    if model == mcu::MCU_MODEL_ID {
                        let reply = mcu::mcu_identity_reply(model);
                        if let Err(e) = pair.send(&reply) {
                            eprintln!("# heartbeat reply failed: {e}");
                        } else {
                            eprintln!("# -> identity reply sent for model 0x{model:02X}");
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

/// Emit a canned sequence of events through the configured backend
/// so the user can validate the output path without the MC-500 being
/// connected. For the keystroke backend this means focusing LUNA
/// first; for the MCU backend LUNA just needs the surface configured
/// and ON.
fn run_self_test(machine: &mut Machine, backend: &mut dyn Backend) -> Result<()> {
    use std::thread::sleep;

    info!(backend = backend.name(), "self-test: starting in 3 seconds");
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
            backend.emit(&actions)?;
        }
        sleep(Duration::from_secs(2));
    }

    info!("self-test complete");
    Ok(())
}
