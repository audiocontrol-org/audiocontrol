//! midi-macro-bridge
//!
//! Translates MIDI transport messages from a Roland MC-500mkII (or
//! similar) into keyboard events that control UAD LUNA's transport.
//!
//! See README.md for user-facing docs.

use anyhow::{Context, Result};
use std::cell::RefCell;
use std::collections::VecDeque;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tracing::{error, info, warn};

mod backend;
mod config;
mod keys;
mod lcxl3;
mod locate;
mod mcu;
mod midi;
mod state;
mod web;

use crate::backend::{Backend, KeystrokeBackend, McuBackend};
use crate::config::{BackendKind, Config, LoadOutcome};
use crate::keys::Emitter;
use crate::lcxl3::{ButtonRow, LcxlMode, MixerAction, SideButton, SurfaceEvent, VRow};
use crate::locate::{
    transport_to_locate_event, EventSource as LocateEventSource, LocateController, LocateEvent,
    LocateOutcome, PositionSource,
};
use crate::mcu::PositionTracker;
use crate::midi::VirtualMcuPair;
use crate::state::{Machine, TransportEvent, TransportState};
use crate::web::state::{
    BridgeState, Cmd, EventLine, EventSource, PortStatus, PortStatuses, SseFrame, Status,
    WebState, build_channels,
};
use tokio::sync::{broadcast, watch};

// ── MIDI connection bundle ────────────────────────────────────────────────────

/// All live MIDI connection handles plus the backend/pair they depend
/// on. Dropping this struct closes every open port cleanly.
///
/// Named with a leading underscore on connection fields because midir
/// drops the port on `Drop` — the compiler would otherwise warn about
/// "unused" bindings.
struct MidiConnections {
    _midi_conn: Option<midir::MidiInputConnection<()>>,
    _lcxl3_input_conn: Option<midir::MidiInputConnection<()>>,
    lcxl3_out: Option<midir::MidiOutputConnection>,
    mc500_out: Option<midir::MidiOutputConnection>,
    backend: Box<dyn Backend>,
    pair: Option<Rc<RefCell<VirtualMcuPair>>>,
    mcu_bytes_rx: mpsc::Receiver<Vec<u8>>,
    // tx half kept alive so the channel stays open even if no callback
    // fires (e.g. when midi_input_port is empty and no receiver drains
    // the channel). Dropped alongside the struct.
    _mcu_bytes_tx: mpsc::Sender<Vec<u8>>,
    /// Captures connection-attempt outcomes for the status publisher.
    port_statuses: PortStatuses,
}

/// Open all MIDI connections described by `config` and build the
/// transport backend.
///
/// This function is idempotent in the sense that calling it twice with
/// the same `Config` produces structurally equivalent `MidiConnections`
/// — same port-name resolution logic, same backend kind, same virtual
/// endpoint name. If the underlying platform rejects a second open of
/// the same port (e.g. because the previous connection is still alive),
/// the second call will fail; the caller (the reload handler) must drop
/// the previous `MidiConnections` before invoking this function.
fn setup_midi_connections(
    config: &Config,
) -> Result<(MidiConnections, mpsc::Receiver<(EventSource, SurfaceEvent)>)> {
    // Per-event surface channel. Each event is tagged with its source
    // (MC-500 or LCXL3) so the main loop can emit correctly-tagged EventLines.
    // Phase 9b: channel carries SurfaceEvent (wraps TransportEvent for MC-500).
    let (transport_tx, transport_rx) = mpsc::channel::<(EventSource, SurfaceEvent)>();

    // MCU byte channel: virtual-endpoint callback → main loop.
    let (mcu_bytes_tx, mcu_bytes_rx) = mpsc::channel::<Vec<u8>>();

    let needs_virtual_pair = matches!(config.transport.backend, BackendKind::Mcu)
        || config.locate.enabled;

    let (backend, pair) = build_backend(config, needs_virtual_pair, mcu_bytes_tx.clone())?;
    info!(
        backend = backend.name(),
        has_mcu_pair = pair.is_some(),
        locate_enabled = config.locate.enabled,
        "bridge ready"
    );

    let mut port_statuses = PortStatuses::default();

    // MC-500 transport input.
    let _midi_conn = if config.midi_input_port.is_empty() {
        warn!(
            "no `midi_input_port` configured — MC-500 transport input is disabled. \
             The bridge is still running as an MCU control surface; set \
             midi_input_port in config.toml to receive transport events."
        );
        port_statuses.mc500_input = PortStatus {
            configured: None,
            connected: false,
            error: None,
        };
        None
    } else {
        let tx_mc500 = transport_tx.clone();
        let port = config.midi_input_port.clone();
        match midi::connect(&port, move |event| {
            if let Err(e) = tx_mc500.send((EventSource::Mc500, SurfaceEvent::Transport(event))) {
                error!(?e, "channel send failed");
            }
        }) {
            Ok(conn) => {
                port_statuses.mc500_input = PortStatus {
                    configured: Some(port.clone()),
                    connected: true,
                    error: None,
                };
                Some(conn)
            }
            Err(e) => {
                return Err(e).with_context(|| {
                    format!(
                        "opening MIDI input matching '{}'. Run --list-ports to see \
                         available ports.",
                        port
                    )
                });
            }
        }
    };

    // MC-500 sync output.
    let mc500_out: Option<midir::MidiOutputConnection> =
        if config.mc500_output_port.is_empty() {
            info!("no `mc500_output_port` configured — sync-on-stop is disabled");
            port_statuses.mc500_sync = PortStatus {
                configured: None,
                connected: false,
                error: None,
            };
            None
        } else {
            let port = config.mc500_output_port.clone();
            match midi::connect_output(&port) {
                Ok(conn) => {
                    info!(port = %port, "MC-500 sync output ready");
                    port_statuses.mc500_sync = PortStatus {
                        configured: Some(port),
                        connected: true,
                        error: None,
                    };
                    Some(conn)
                }
                Err(e) => {
                    warn!(
                        ?e,
                        port = %port,
                        "couldn't open MC-500 sync output — sync-on-stop will be disabled \
                         for this session. The forward MC-500 → LUNA path is unaffected."
                    );
                    port_statuses.mc500_sync = PortStatus {
                        configured: Some(port),
                        connected: false,
                        error: Some(e.to_string()),
                    };
                    None
                }
            }
        };

    // LCXL3 input.
    let _lcxl3_input_conn = if config.lcxl3.enabled {
        let tx_lcxl3 = transport_tx.clone();
        let port = config.lcxl3.input_port.clone();
        match midi::connect_raw(&port, move |bytes| {
            // Trace every received byte sequence at debug level so the
            // user can capture device-emitted bytes when diagnosing
            // unrecognised input (e.g. the jog encoder bytes on a fresh
            // device firmware revision). Mirrors `handle_mcu_byte_idle`
            // on the MCU side which earned its keep diagnosing the
            // Ableton multi-message-packet issue. RUST_LOG=midi_macro_bridge=debug
            // emits these.
            let hex: String = bytes
                .iter()
                .map(|b| format!("{b:02X}"))
                .collect::<Vec<_>>()
                .join(" ");
            // Phase 9b: use parse_surface so faders, V-pots, side buttons,
            // and mode changes all flow through the SurfaceEvent channel.
            if let Some(event) = lcxl3::parse_surface(bytes) {
                tracing::debug!(len = bytes.len(), %hex, ?event, "lcxl3: rx → event");
                if let Err(e) = tx_lcxl3.send((EventSource::Lcxl3, event)) {
                    error!(?e, "lcxl3 channel send failed");
                }
            } else {
                tracing::debug!(len = bytes.len(), %hex, "lcxl3: rx (ignored)");
            }
        }) {
            Ok(conn) => {
                info!(port = %port, "LCXL3 input ready");
                port_statuses.lcxl3_input = PortStatus {
                    configured: Some(port),
                    connected: true,
                    error: None,
                };
                Some(conn)
            }
            Err(e) => {
                warn!(
                    ?e,
                    port = %port,
                    "LCXL3 input port unavailable — disabling LCXL3 input for this session. \
                     Bridge continues with MC-500 input only."
                );
                port_statuses.lcxl3_input = PortStatus {
                    configured: Some(port),
                    connected: false,
                    error: Some(e.to_string()),
                };
                None
            }
        }
    } else {
        None
    };

    // LCXL3 output.
    let lcxl3_out: Option<midir::MidiOutputConnection> = if config.lcxl3.enabled {
        let port = config.lcxl3.output_port.clone();
        match midi::connect_output(&port) {
            Ok(mut conn) => {
                if let Err(e) =
                    lcxl3::handshake_send(&mut conn, config.lcxl3.host_name.as_bytes())
                {
                    warn!(?e, "LCXL3 activation handshake failed; LEDs may not initialise");
                } else {
                    info!(port = %port, host_name = %config.lcxl3.host_name, "LCXL3 output ready (activated)");
                    // Stage 4: enter DAW Mixer mode if configured.
                    if config.lcxl3.mixer.enabled {
                        if let Err(e) = lcxl3::enter_mixer_mode(&mut conn) {
                            warn!(?e, "LCXL3 enter_mixer_mode failed; device may stay in DAW Control mode");
                        } else {
                            info!("lcxl3-activate: entered mixer mode (mode-select + 3 relative-toggles + fader pickup)");
                        }
                    }
                }
                port_statuses.lcxl3_output = PortStatus {
                    configured: Some(port),
                    connected: true,
                    error: None,
                };
                Some(conn)
            }
            Err(e) => {
                warn!(
                    ?e,
                    port = %port,
                    "LCXL3 output port unavailable — handshake skipped. The device's \
                     transport buttons will likely stay dormant (no DAW claim sent)."
                );
                port_statuses.lcxl3_output = PortStatus {
                    configured: Some(port),
                    connected: false,
                    error: Some(e.to_string()),
                };
                None
            }
        }
    } else {
        None
    };

    // Virtual MCU endpoint status.
    port_statuses.mcu_virtual = PortStatus {
        configured: Some(MCU_ENDPOINT_NAME.to_string()),
        connected: pair.is_some(),
        error: None,
    };

    Ok((
        MidiConnections {
            _midi_conn,
            _lcxl3_input_conn,
            lcxl3_out,
            mc500_out,
            backend,
            pair,
            mcu_bytes_rx,
            _mcu_bytes_tx: mcu_bytes_tx,
            port_statuses,
        },
        transport_rx,
    ))
}

// ── Status builder ────────────────────────────────────────────────────────────

/// Construct a `Status` snapshot from current runtime values. Called
/// after every state mutation that should be visible to the HTTP
/// server.
fn build_status(
    bridge_state: BridgeState,
    machine: &Machine,
    tracker: &PositionTracker,
    last_event_at: Option<SystemTime>,
    mcu_heartbeat_at: Option<SystemTime>,
    connections: &MidiConnections,
    config: &Config,
) -> Status {
    let last_bar = {
        let b = tracker.current_bar();
        if b == 0 { None } else { Some(b) }
    };
    Status {
        bridge_state,
        transport: machine.state(),
        last_bar,
        last_event_at,
        ports: connections.port_statuses.clone(),
        mcu_heartbeat_at,
        config: config.clone(),
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    init_tracing();

    let args: Vec<String> = std::env::args().collect();

    // ── CLI flags ─────────────────────────────────────────────────────────────

    // --no-open: suppress the auto-open browser launch even when
    // `config.web.auto_open_browser = true`. Useful when running under
    // launchd (where browser-launching from a daemon is wrong) or in CI.
    let no_open = args.iter().any(|a| a == "--no-open");

    // ── CLI modes that bypass the web server ──────────────────────────────────

    // --list-ports: print available MIDI inputs and exit.
    if args.iter().any(|a| a == "--list-ports") {
        for name in midi::list_ports_input()? {
            println!("{name}");
        }
        return Ok(());
    }

    // --probe-midi <port-substring>: dump every received byte sequence
    // on the given existing MIDI input port.
    if let Some(idx) = args.iter().position(|a| a == "--probe-midi") {
        let port = args
            .get(idx + 1)
            .filter(|a| !a.starts_with("--"))
            .context("--probe-midi requires a port name substring: --probe-midi \"828mk3\"")?;
        return run_probe_midi(port);
    }

    // --probe-mcu: register the virtual MCU endpoint pair and dump
    // every byte arriving on the virtual input.
    if args.iter().any(|a| a == "--probe-mcu") {
        return run_probe_mcu();
    }

    // --lcxl3-activate [substring]: send the DAW-mode activation
    // SysEx to a Launch Control XL Mk3, then dump everything it emits.
    //
    // Optional companion: --lcxl3-mode <hex> picks a sub-mode after
    // activation. Per Novation's reference, send `B6 1E vv` where vv =
    // 01 (DAW Mixer) / 02 (DAW Control) / 06-09 (Custom 1-4) / 12-1D
    // (Custom 5-16). Useful for Phase 9a capture sessions: switch the
    // device into Mixer mode programmatically and capture each control's
    // bytes.
    if let Some(idx) = args.iter().position(|a| a == "--lcxl3-activate") {
        let substring = args
            .get(idx + 1)
            .filter(|a| !a.starts_with("--"))
            .map(String::as_str)
            .unwrap_or("LCXL3");
        let mode = args
            .iter()
            .position(|a| a == "--lcxl3-mode")
            .and_then(|i| args.get(i + 1))
            .map(|s| u8::from_str_radix(s.trim_start_matches("0x"), 16))
            .transpose()
            .with_context(|| "--lcxl3-mode requires a hex byte (e.g. --lcxl3-mode 01 for DAW Mixer)")?;
        return run_lcxl3_activate(substring, mode);
    }

    // --send-mcu <spec> [args...]: emit a candidate MCU message to
    // LUNA for discovery.
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

    // ── Config load ───────────────────────────────────────────────────────────

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

    // ── Channel setup ─────────────────────────────────────────────────────────

    let initial_status = Status::initialising(config.clone());
    let (cmd_tx, mut cmd_rx, status_tx, status_rx, events_tx, events_history) =
        build_channels(initial_status);

    // ── Web server (skipped for --self-test) ──────────────────────────────────

    // Hold the JoinHandle for the lifetime of main so the thread
    // isn't dropped while the process is running. We never explicitly
    // join it — the tokio runtime inside runs until the process exits.
    let _server_handle = if config.web.enabled && !self_test {
        let web_state = WebState::new(
            status_rx,
            events_tx.clone(),
            cmd_tx.clone(),
            events_history.clone(),
            config_path.clone(),
        );
        let bind_addr = format!("127.0.0.1:{}", config.web.bind_port)
            .parse()
            .expect("invalid bind address");
        let handle = web::run_server_thread(bind_addr, web_state)
            .context("starting web server")?;
        let url = format!("http://{}", handle.bound_addr);
        info!(%url, "web server ready");

        // Persist the URL so follow-on tooling (menu-bar app, `open --bridge`)
        // can find it without scanning ports.
        persist_bridge_url(&url);

        // Auto-open browser — gated on config setting AND --no-open flag.
        if config.web.auto_open_browser && !no_open {
            open_browser(&url);
        } else if no_open {
            info!("--no-open: skipping browser launch");
        } else {
            info!("auto_open_browser=false: skipping browser launch");
        }

        Some(handle.join_handle)
    } else {
        None
    };

    // ── MIDI connections ──────────────────────────────────────────────────────
    //
    // Wrapped in `Option` so the reload handler can move the value out
    // and replace it, giving the borrow checker a clear ownership
    // picture across loop iterations. `None` means the bridge is in
    // the `Panicked` state; the loop spins but does no MIDI I/O.

    let (conns, rx) = setup_midi_connections(&config)?;
    let mut connections: Option<MidiConnections> = Some(conns);
    let mut transport_rx: Option<mpsc::Receiver<(EventSource, SurfaceEvent)>> = Some(rx);

    // Phase 9b mode and mixer sub-mode state.
    // Default to DawMixer so the main loop routes V-pots as pan from the
    // start — the device enters DAW Mixer on startup (via enter_mixer_mode).
    // If mixer.enabled = false the device boots in DAW Control; the mode
    // state below will be overridden by the first ModeChange event anyway.
    let mut current_mode = LcxlMode::DawMixer;
    let mut mixer_state = LcxlMixerState::default();

    let mut machine = Machine::new();
    let mut tracker = PositionTracker::new();
    let mut last_event_at: Option<SystemTime> = None;
    let mut mcu_heartbeat_at: Option<SystemTime> = None;

    if self_test {
        let c = connections.as_mut().unwrap();
        return run_self_test(&mut machine, c.backend.as_mut());
    }

    // Ctrl-C handling.
    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    // Publish initial Running status and bridge-ready event.
    if let Some(c) = &connections {
        let _ = status_tx.send(build_status(
            BridgeState::Running,
            &machine,
            &tracker,
            last_event_at,
            mcu_heartbeat_at,
            c,
            &config,
        ));
    }
    emit_event(
        &events_tx,
        &events_history,
        EventSource::Bridge,
        "bridge ready".to_string(),
    );

    info!("ready — waiting for MIDI events (Ctrl-C to exit)");

    let mut active_config = config;
    let locate_enabled = active_config.locate.enabled;
    let mut locate_runtime_cfg = active_config.locate.to_runtime();

    loop {
        // ── Shutdown check ────────────────────────────────────────────────────
        if shutdown_rx.try_recv().is_ok() {
            info!("shutting down");
            shutdown_cleanup(connections.as_mut());
            return Ok(());
        }

        // ── Drain web commands ────────────────────────────────────────────────
        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                Cmd::Halt => {
                    info!("halt requested via web UI");
                    shutdown_cleanup(connections.as_mut());
                    std::process::exit(2);
                }
                Cmd::WebServerPanic(reason) => {
                    error!(
                        %reason,
                        "web server thread reported fatal failure — bridge UI is dead but \
                         MIDI loop continues. Restart the bridge to recover."
                    );
                    emit_event(
                        &events_tx,
                        &events_history,
                        EventSource::Bridge,
                        format!("WEB SERVER PANIC: {reason}"),
                    );
                    let _ = status_tx.send_modify(|s| {
                        s.bridge_state = BridgeState::Panicked;
                    });
                }
                Cmd::Reload(new_config) => {
                    info!("reloading MIDI connections from new config");
                    let _ = status_tx.send_modify(|s| {
                        s.bridge_state = BridgeState::Reconnecting;
                    });
                    emit_event(
                        &events_tx,
                        &events_history,
                        EventSource::Bridge,
                        "reconnecting — dropping MIDI connections".to_string(),
                    );

                    // Deactivate LCXL3 before dropping old connections.
                    if let Some(c) = connections.as_mut() {
                        if let Some(out) = c.lcxl3_out.as_mut() {
                            lcxl3::deactivate_send(out);
                        }
                    }

                    // Move out (drop) old connections, then rebuild.
                    let _ = connections.take();
                    let _ = transport_rx.take();

                    match setup_midi_connections(&new_config) {
                        Ok((new_conns, new_rx)) => {
                            connections = Some(new_conns);
                            transport_rx = Some(new_rx);
                            active_config = new_config;
                            locate_runtime_cfg = active_config.locate.to_runtime();
                            info!("MIDI connections rebuilt successfully");
                            emit_event(
                                &events_tx,
                                &events_history,
                                EventSource::Bridge,
                                "reconnected — MIDI connections rebuilt".to_string(),
                            );
                            if let Some(c) = &connections {
                                let _ = status_tx.send(build_status(
                                    BridgeState::Running,
                                    &machine,
                                    &tracker,
                                    last_event_at,
                                    mcu_heartbeat_at,
                                    c,
                                    &active_config,
                                ));
                            }
                        }
                        Err(e) => {
                            error!(?e, "failed to rebuild MIDI connections after reload");
                            emit_event(
                                &events_tx,
                                &events_history,
                                EventSource::Bridge,
                                format!("panic: failed to rebuild MIDI connections: {e}"),
                            );
                            let _ = status_tx.send_modify(|s| {
                                s.bridge_state = BridgeState::Panicked;
                            });
                        }
                    }
                }
            }
        }

        // ── Drain MCU bytes ───────────────────────────────────────────────────
        let mut mcu_bytes_drained = false;
        if let Some(c) = connections.as_mut() {
            while let Ok(bytes) = c.mcu_bytes_rx.try_recv() {
                let hb_fired = handle_mcu_byte_idle(&bytes, &c.pair, &mut tracker);
                if hb_fired {
                    mcu_heartbeat_at = Some(SystemTime::now());
                    emit_event(
                        &events_tx,
                        &events_history,
                        EventSource::McuOut,
                        "heartbeat reply".to_string(),
                    );
                }
                mcu_bytes_drained = true;
            }
        }

        // ── Process one surface event ─────────────────────────────────────────
        let transport_drained = if let Some(rx) = transport_rx.as_ref() {
            match rx.recv_timeout(Duration::from_millis(50)) {
                Ok((ev_source, surface_event)) => {
                    last_event_at = Some(SystemTime::now());

                    match surface_event {
                        // ── Transport arm: existing state-machine path ────────
                        SurfaceEvent::Transport(event) => {
                            handle_transport_event(
                                event,
                                ev_source,
                                &mut machine,
                                &mut connections,
                                transport_rx.as_ref(),
                                &mut tracker,
                                locate_runtime_cfg,
                                locate_enabled,
                                &events_tx,
                                &events_history,
                                &status_tx,
                                mcu_heartbeat_at,
                                &active_config,
                            )?;
                        }

                        // ── Fader: 7-bit value → 14-bit volume ───────────────
                        SurfaceEvent::Fader { strip, value } => {
                            let value14 = (value as u16) << 7;
                            let action = MixerAction::Volume { channel: strip, value14 };
                            emit_event(
                                &events_tx,
                                &events_history,
                                ev_source,
                                format!("Fader {strip} → {action:?}"),
                            );
                            if let Some(c) = connections.as_mut() {
                                if let Err(e) = c.backend.emit_mixer(&action) {
                                    warn!(?e, "mixer backend emit failed");
                                }
                            }
                        }

                        // ── V-pot: mode-aware routing ─────────────────────────
                        SurfaceEvent::VPotDelta { row, col, delta } => {
                            if current_mode == LcxlMode::DawControl
                                && row == VRow::Bottom
                                && col == 0
                            {
                                // Jog-wheel path: route through transport state machine.
                                let transport = if delta > 0 {
                                    TransportEvent::NudgeForward(delta as u32)
                                } else if delta < 0 {
                                    TransportEvent::NudgeBackward((-delta) as u32)
                                } else {
                                    // delta == 0: no-op
                                    continue;
                                };
                                handle_transport_event(
                                    transport,
                                    ev_source,
                                    &mut machine,
                                    &mut connections,
                                    transport_rx.as_ref(),
                                    &mut tracker,
                                    locate_runtime_cfg,
                                    locate_enabled,
                                    &events_tx,
                                    &events_history,
                                    &status_tx,
                                    mcu_heartbeat_at,
                                    &active_config,
                                )?;
                            } else {
                                // Mixer pan path.
                                let action = MixerAction::Pan { channel: col, delta };
                                emit_event(
                                    &events_tx,
                                    &events_history,
                                    ev_source,
                                    format!("V-pot ({row:?}, {col}) → {action:?}"),
                                );
                                if let Some(c) = connections.as_mut() {
                                    if let Err(e) = c.backend.emit_mixer(&action) {
                                        warn!(?e, "mixer backend emit failed");
                                    }
                                }
                            }
                        }

                        // ── Fader buttons: Solo/Arm and Mute/Select rows ──────
                        SurfaceEvent::FaderButton { row, strip, pressed } => {
                            if !pressed {
                                continue; // ignore release
                            }
                            let action = match row {
                                ButtonRow::TopSoloArm => {
                                    if mixer_state.solo_arm_in_arm_mode {
                                        MixerAction::Arm { channel: strip }
                                    } else {
                                        MixerAction::Solo { channel: strip }
                                    }
                                }
                                ButtonRow::BottomMuteSelect => {
                                    if mixer_state.mute_select_in_select_mode {
                                        MixerAction::Select { channel: strip }
                                    } else {
                                        MixerAction::Mute { channel: strip }
                                    }
                                }
                            };
                            emit_event(
                                &events_tx,
                                &events_history,
                                ev_source,
                                format!("FaderButton {row:?} {strip} → {action:?}"),
                            );
                            if let Some(c) = connections.as_mut() {
                                if let Err(e) = c.backend.emit_mixer(&action) {
                                    warn!(?e, "mixer backend emit failed");
                                }
                            }
                        }

                        // ── Side-panel buttons ────────────────────────────────
                        SurfaceEvent::SideButton { button, pressed } => {
                            if !pressed {
                                continue; // ignore release
                            }
                            match button {
                                SideButton::SoloArmRowToggle => {
                                    mixer_state.solo_arm_in_arm_mode =
                                        !mixer_state.solo_arm_in_arm_mode;
                                    info!(
                                        in_arm = mixer_state.solo_arm_in_arm_mode,
                                        "LCXL3 Solo/Arm row toggled"
                                    );
                                }
                                SideButton::MuteSelectRowToggle => {
                                    mixer_state.mute_select_in_select_mode =
                                        !mixer_state.mute_select_in_select_mode;
                                    info!(
                                        in_select = mixer_state.mute_select_in_select_mode,
                                        "LCXL3 Mute/Select row toggled"
                                    );
                                }
                                SideButton::TrackLeft => {
                                    let action = MixerAction::BankPrev;
                                    emit_event(
                                        &events_tx,
                                        &events_history,
                                        ev_source,
                                        format!("SideButton TrackLeft → {action:?}"),
                                    );
                                    if let Some(c) = connections.as_mut() {
                                        if let Err(e) = c.backend.emit_mixer(&action) {
                                            warn!(?e, "mixer backend emit failed");
                                        }
                                    }
                                }
                                SideButton::TrackRight => {
                                    let action = MixerAction::BankNext;
                                    emit_event(
                                        &events_tx,
                                        &events_history,
                                        ev_source,
                                        format!("SideButton TrackRight → {action:?}"),
                                    );
                                    if let Some(c) = connections.as_mut() {
                                        if let Err(e) = c.backend.emit_mixer(&action) {
                                            warn!(?e, "mixer backend emit failed");
                                        }
                                    }
                                }
                                SideButton::PageUp | SideButton::PageDown => {
                                    // Stage 5+ may map these to LUNA page navigation.
                                    info!(?button, "side button (Page Up/Down) — unmapped in stages 2-4");
                                }
                                SideButton::SmallButton => {
                                    info!("LCXL3 small button (0x68) pressed — unmapped");
                                }
                            }
                        }

                        // ── Mode change from device ───────────────────────────
                        SurfaceEvent::ModeChange(new_mode) => {
                            info!(?new_mode, "LCXL3 mode changed");
                            current_mode = new_mode;
                            emit_event(
                                &events_tx,
                                &events_history,
                                ev_source,
                                format!("LCXL3 mode → {new_mode:?}"),
                            );
                        }
                    }

                    true
                }
                Err(mpsc::RecvTimeoutError::Timeout) => false,
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    error!("MIDI channel disconnected");
                    return Ok(());
                }
            }
        } else {
            // No transport channel — bridge is in Panicked state. Sleep briefly
            // to avoid a tight spin while waiting for a Reload command.
            std::thread::sleep(Duration::from_millis(50));
            false
        };

        // Publish status after heartbeat state update.
        if mcu_bytes_drained {
            if let Some(c) = &connections {
                let _ = status_tx.send(build_status(
                    BridgeState::Running,
                    &machine,
                    &tracker,
                    last_event_at,
                    mcu_heartbeat_at,
                    c,
                    &active_config,
                ));
            }
        }

        if !mcu_bytes_drained && !transport_drained {
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}

// ── LCXL3 mixer sub-mode state ────────────────────────────────────────────────

/// Tracks the device-managed row-toggle sub-modes so the main loop can
/// interpret fader-button presses correctly.
///
/// Both flags start as `false` — Solo and Mute are the default row labels
/// printed on the LCXL3 panel.
#[derive(Debug, Default)]
pub struct LcxlMixerState {
    /// True after the first press of B0 41 (Solo/Arm row toggle).
    /// Top fader-button row is Arm when true, Solo when false.
    pub solo_arm_in_arm_mode: bool,
    /// True after the first press of B0 42 (Mute/Select row toggle).
    /// Bottom fader-button row is Select when true, Mute when false.
    pub mute_select_in_select_mode: bool,
}

// ── Backend construction ──────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Push an `EventLine` to both the broadcast channel and the history ring
/// buffer. The broadcast notifies live SSE subscribers; the ring buffer
/// provides history to freshly-opened tabs.
///
/// The line is wrapped in `SseFrame::Event` before broadcasting so the
/// single `broadcast::Sender<SseFrame>` can carry both event lines and
/// status OOB fragments.
/// Run the shared shutdown cleanup before the bridge exits. Currently
/// just sends the LCXL3 deactivation SysEx so the device returns to its
/// idle state. Called from both the Ctrl-C handler path and the web UI
/// HALT command path so neither leaves the device in indeterminate LED
/// state.
///
/// Best-effort — failures are logged but don't block exit.
fn shutdown_cleanup(connections: Option<&mut MidiConnections>) {
    let Some(c) = connections else { return };
    let Some(out) = c.lcxl3_out.as_mut() else { return };
    lcxl3::deactivate_send(out);
    info!("LCXL3 deactivation SysEx sent");
}

///
/// `SendError` on the broadcast (no subscribers) is silently ignored —
/// that's normal when no browser tab is open.
fn emit_event(
    events_tx: &broadcast::Sender<SseFrame>,
    history: &Arc<Mutex<VecDeque<EventLine>>>,
    source: EventSource,
    text: String,
) {
    let line = EventLine {
        at: SystemTime::now(),
        source,
        text,
    };
    {
        let mut h = history.lock().unwrap();
        if h.len() >= crate::web::state::EVENT_HISTORY_CAPACITY {
            h.pop_front();
        }
        h.push_back(line.clone());
    }
    // Ignore SendError — no subscribers is fine.
    let _ = events_tx.send(SseFrame::Event(line));
}

/// Tail of a Stop transition. Gives LUNA a short window to settle
/// at its play-start position, then sends an SPP message to the
/// MC-500 so it jumps to the same bar.
fn sync_mc500_to_luna_after_stop(
    mcu_bytes_rx: &mpsc::Receiver<Vec<u8>>,
    pair: &Option<Rc<RefCell<VirtualMcuPair>>>,
    tracker: &mut PositionTracker,
    mc500_out: Option<&mut midir::MidiOutputConnection>,
) {
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
        };
    }

    let bar = tracker.current_bar();
    if bar == 0 {
        info!("sync-on-stop: no tracked position from LUNA; skipping SPP");
        return;
    }

    let spp = midi::bar_to_spp_message(bar);
    match out.send(&spp) {
        Ok(()) => info!(bar, "sync-on-stop: sent SPP to MC-500"),
        Err(e) => warn!(?e, bar, "sync-on-stop: SPP send failed"),
    }
}

/// Idle-path handling for a received MCU byte sequence. Returns
/// `true` if a heartbeat reply was sent (so the caller can update
/// `mcu_heartbeat_at`).
fn handle_mcu_byte_idle(
    bytes: &[u8],
    pair: &Option<Rc<RefCell<VirtualMcuPair>>>,
    tracker: &mut PositionTracker,
) -> bool {
    let hex = bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(" ");
    tracing::debug!(len = bytes.len(), %hex, "idle: rx bytes");

    let mut heartbeat_sent = false;
    if let Some(pair) = pair {
        if let Some(model) = mcu::parse_heartbeat_query(bytes) {
            if model == mcu::MCU_MODEL_ID {
                let reply = mcu::mcu_identity_reply(model);
                if let Err(e) = pair.borrow_mut().send(&reply) {
                    warn!(?e, "heartbeat reply send failed");
                } else {
                    heartbeat_sent = true;
                }
            }
        }
    }
    if let Some(update) = mcu::parse_cc_display(bytes) {
        let before_bar = tracker.current_bar();
        if let Some(pos) = tracker.apply(update) {
            tracing::debug!(
                idx = update.index,
                ?update.value,
                before_bar,
                after_bar = pos.bar,
                "idle: bar-changing update"
            );
        } else {
            tracing::debug!(
                idx = update.index,
                ?update.value,
                tracker_bar = tracker.current_bar(),
                "idle: non-bar update applied"
            );
        }
    }
    heartbeat_sent
}

// ── Transport event handler ───────────────────────────────────────────────────

/// Route a single `TransportEvent` through the state machine and execute
/// the resulting actions. Called from both the `SurfaceEvent::Transport`
/// arm in the main loop AND from the `VPotDelta` jog-wheel path (when the
/// device is in DAW Control mode and the bottom-row col-0 V-pot is used as
/// a jog wheel).
///
/// This function encapsulates everything that was previously inlined in the
/// main loop under `Ok((ev_source, event)) => { ... }`.
#[allow(clippy::too_many_arguments)]
fn handle_transport_event(
    event: TransportEvent,
    ev_source: EventSource,
    machine: &mut Machine,
    connections: &mut Option<MidiConnections>,
    transport_rx: Option<&mpsc::Receiver<(EventSource, SurfaceEvent)>>,
    tracker: &mut PositionTracker,
    locate_runtime_cfg: locate::LocateConfig,
    locate_enabled: bool,
    events_tx: &broadcast::Sender<SseFrame>,
    events_history: &Arc<Mutex<VecDeque<EventLine>>>,
    status_tx: &watch::Sender<Status>,
    mcu_heartbeat_at: Option<SystemTime>,
    active_config: &Config,
) -> Result<()> {
    let state_before = machine.state();
    let actions = machine.handle(event);

    if actions.is_empty() {
        info!(
            ?event,
            ?state_before,
            state_after = ?machine.state(),
            "no-op event (echo guard or state change only)"
        );
        emit_event(
            events_tx,
            events_history,
            ev_source,
            format!("{event:?} → no-op (state: {:?})", machine.state()),
        );
    } else {
        info!(
            ?event,
            ?state_before,
            state_after = ?machine.state(),
            ?actions,
            "dispatching actions"
        );
        emit_event(
            events_tx,
            events_history,
            ev_source,
            format!(
                "{event:?} → {actions:?} (state: {:?} → {:?})",
                state_before,
                machine.state()
            ),
        );
        if let Some(c) = connections.as_mut() {
            if let Err(e) = c.backend.emit(&actions) {
                warn!(?e, "backend emit failed");
            }
        }
    }

    if let TransportState::Locating { target, .. } = machine.state() {
        if let (Some(c), Some(trx)) = (connections.as_mut(), transport_rx) {
            run_locate_step(
                target,
                &c.mcu_bytes_rx,
                trx,
                &c.pair,
                tracker,
                c.backend.as_mut(),
                locate_runtime_cfg,
                locate_enabled,
                machine,
            )?;
        }
    }

    let state_after = machine.state();
    let transitioned_to_stopped = state_after == TransportState::Stopped
        && !matches!(state_before, TransportState::Stopped);
    if transitioned_to_stopped {
        if let Some(c) = connections.as_mut() {
            sync_mc500_to_luna_after_stop(
                &c.mcu_bytes_rx,
                &c.pair,
                tracker,
                c.mc500_out.as_mut(),
            );
        }
    }

    if state_after != state_before {
        if let Some(c) = connections.as_mut() {
            if let Some(out) = c.lcxl3_out.as_mut() {
                if let Some(led) = lcxl3::led_for_state(&state_after) {
                    if let Err(e) = out.send(&led) {
                        warn!(?e, "LCXL3 LED state push failed");
                    }
                }
            }
        }

        // Publish updated status after any transport state change.
        if let Some(c) = connections.as_ref() {
            let _ = status_tx.send(build_status(
                BridgeState::Running,
                machine,
                tracker,
                Some(SystemTime::now()),
                mcu_heartbeat_at,
                c,
                active_config,
            ));
        }
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_locate_step(
    target: u32,
    mcu_bytes_rx: &mpsc::Receiver<Vec<u8>>,
    transport_rx: &mpsc::Receiver<(EventSource, SurfaceEvent)>,
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

// ── MCU position source ───────────────────────────────────────────────────────

struct McuPositionSource<'a> {
    bytes_rx: &'a mpsc::Receiver<Vec<u8>>,
    tracker: &'a mut PositionTracker,
    pair: Option<&'a Rc<RefCell<VirtualMcuPair>>>,
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

    fn apply_bytes_update(&mut self, bytes: &[u8], result: &mut Option<u32>) {
        self.handle_heartbeat(bytes);
        if let Some(update) = mcu::parse_cc_display(bytes) {
            if let Some(pos) = self.tracker.apply(update) {
                *result = Some(pos.bar);
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
        let mut result: Option<u32> = None;

        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return result;
            }
            let poll = remaining.min(Duration::from_millis(100));
            match self.bytes_rx.recv_timeout(poll) {
                Ok(bytes) => {
                    self.handle_heartbeat(&bytes);
                    if let Some(update) = mcu::parse_cc_display(&bytes) {
                        if let Some(pos) = self.tracker.apply(update) {
                            self.has_seen_position = true;
                            result = Some(pos.bar);
                            break;
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => return result,
            }
        }

        const CARRY_SETTLE: Duration = Duration::from_millis(5);
        let settle_deadline = Instant::now() + CARRY_SETTLE;
        loop {
            match self.bytes_rx.try_recv() {
                Ok(bytes) => self.apply_bytes_update(&bytes, &mut result),
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => return result,
            }
        }
        while Instant::now() < settle_deadline {
            let remaining = settle_deadline.saturating_duration_since(Instant::now());
            match self.bytes_rx.recv_timeout(remaining) {
                Ok(bytes) => self.apply_bytes_update(&bytes, &mut result),
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        result
    }
}

// ── Transport locate event source ─────────────────────────────────────────────

/// Adapts the `SurfaceEvent` channel for the `LocateController`, which only
/// cares about `TransportEvent`s. Non-transport surface events (faders, V-pots,
/// etc.) arriving during a locate are silently dropped — the user can't operate
/// the mixer while a locate is in progress, and the LocateController shouldn't
/// have to know about them.
struct TransportLocateEventSource<'a> {
    rx: &'a mpsc::Receiver<(EventSource, SurfaceEvent)>,
}

impl<'a> LocateEventSource for TransportLocateEventSource<'a> {
    fn try_recv(&mut self) -> Option<LocateEvent> {
        match self.rx.try_recv() {
            Ok((_source, SurfaceEvent::Transport(ev))) => transport_to_locate_event(ev),
            // Non-transport surface events during a locate are discarded.
            Ok((_source, _)) => None,
            Err(_) => None,
        }
    }
}

// ── Tracing init ──────────────────────────────────────────────────────────────

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}

const MCU_ENDPOINT_NAME: &str = "MIDI Macro Bridge";

// ── Browser open / URL persistence ───────────────────────────────────────────

/// Write `url` to the platform-appropriate state file so follow-on
/// tooling (menu-bar app, shell helper) can find the bridge URL without
/// scanning ports. Errors are non-fatal — log a warning and continue.
fn persist_bridge_url(url: &str) {
    let path = bridge_url_path();
    let Some(path) = path else {
        info!("skipping url.txt persistence (no suitable state dir on this platform)");
        return;
    };
    if let Some(parent) = path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            warn!(?e, dir = %parent.display(), "failed to create bridge state dir; url.txt will not be written");
            return;
        }
    }
    match std::fs::write(&path, url) {
        Ok(()) => info!(path = %path.display(), "bridge URL written"),
        Err(e) => warn!(?e, path = %path.display(), "failed to write bridge URL"),
    }
}

/// Return the platform-specific path where the bridge URL should be persisted.
/// Returns `None` on platforms where no suitable location is available.
fn bridge_url_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "macos")]
    {
        // ~/Library/Application Support/MidiMacroBridge/url.txt
        dirs::data_dir().map(|d| d.join("MidiMacroBridge").join("url.txt"))
    }
    #[cfg(not(target_os = "macos"))]
    {
        // $XDG_RUNTIME_DIR/midi-macro-bridge/url.txt on Linux; skip elsewhere.
        std::env::var_os("XDG_RUNTIME_DIR")
            .map(|d| std::path::PathBuf::from(d).join("midi-macro-bridge").join("url.txt"))
    }
}

/// Launch the default browser to `url`. On macOS, uses `open(1)`.
/// On other platforms, logs that auto-open is not implemented.
fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    {
        info!(%url, "opening browser");
        match std::process::Command::new("open").arg(url).spawn() {
            Ok(_) => {}
            Err(e) => warn!(?e, "failed to spawn 'open' for browser launch"),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        info!(%url, "auto-open browser not implemented for this platform");
    }
}

// ── CLI probe modes ───────────────────────────────────────────────────────────

fn run_probe_midi(port_substring: &str) -> Result<()> {
    use std::time::Instant;
    let start = Instant::now();
    let (tx, rx) = mpsc::channel::<(u128, Vec<u8>)>();
    let conn = midi::connect_raw(port_substring, move |bytes| {
        let _ = tx.send((start.elapsed().as_micros(), bytes.to_vec()));
    })?;
    eprintln!("# probe-midi: listening on port matching '{port_substring}' — Ctrl-C to stop");
    eprintln!("# columns: <microseconds since start>  [<byte count>]  <label>  <hex>");
    drive_probe_loop(rx)?;
    drop(conn);
    Ok(())
}

fn run_lcxl3_activate(substring: &str, mode: Option<u8>) -> Result<()> {
    use std::time::Instant;

    let all_ports = midi::list_ports_input()?;
    let find_port = |role: &str| -> Result<String> {
        let s = substring.to_lowercase();
        let r = role.to_lowercase();
        all_ports
            .iter()
            .find(|n| {
                let l = n.to_lowercase();
                l.contains(&s) && l.contains(&r)
            })
            .cloned()
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "no MIDI port name contains both '{substring}' and '{role}'. \
                     Run --list-ports to see available ports."
                )
            })
    };
    let out_query = find_port("DAW Out")?;
    let in_query = find_port("DAW In").unwrap_or_else(|_| {
        out_query.replace("DAW Out", "DAW In")
    });

    let start = Instant::now();
    let (tx, rx) = mpsc::channel::<(u128, Vec<u8>)>();
    let _input_conn = midi::connect_raw(&out_query, move |bytes| {
        let _ = tx.send((start.elapsed().as_micros(), bytes.to_vec()));
    })
    .with_context(|| format!("opening LCXL3 input port matching '{out_query}'"))?;

    let mut output = midi::connect_output(&in_query)
        .with_context(|| format!("opening LCXL3 output port matching '{in_query}'"))?;

    lcxl3::handshake_send(&mut output, b"Bridge")
        .context("sending LCXL3 DAW activation handshake")?;
    eprintln!("# lcxl3-activate: handshake sent (probe → UDI → claim → host name → LED preset)");

    // Optional sub-mode select: B6 1E vv (channel 7 CC 0x1E with mode byte).
    // 01 = DAW Mixer, 02 = DAW Control, 06-09 = Custom 1-4, 12-1D = Custom 5-16.
    if let Some(m) = mode {
        let bytes = [0xB6u8, 0x1E, m];
        match output.send(&bytes) {
            Ok(()) => eprintln!(
                "# lcxl3-activate: sent mode-select B6 1E {m:02X} ({})",
                match m {
                    0x01 => "DAW Mixer",
                    0x02 => "DAW Control",
                    0x06..=0x09 => "Custom 1-4",
                    0x12..=0x1D => "Custom 5-16",
                    _ => "(unknown)",
                }
            ),
            Err(e) => eprintln!("# lcxl3-activate: mode-select send failed: {e}"),
        }
    }

    eprintln!("# Listening on port matching '{out_query}'.");
    eprintln!("# Press transport buttons / move encoders on the device.");
    eprintln!("# Ctrl-C to stop (will send deactivation SysEx).");
    eprintln!("# columns: <microseconds since start>  [<byte count>]  <label>  <hex>");

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    ctrlc::set_handler(move || {
        let _ = shutdown_tx.send(());
    })
    .context("installing Ctrl-C handler")?;

    loop {
        if shutdown_rx.try_recv().is_ok() {
            lcxl3::deactivate_send(&mut output);
            eprintln!("# lcxl3-activate: sent deactivation SysEx, exiting");
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

fn parse_mcu_spec(spec: &str, extra: &[String]) -> Result<Vec<Vec<u8>>> {
    let button_tap = |note: u8| {
        vec![
            vec![0x90, note, 0x7F],
            vec![0x90, note, 0x00],
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

fn run_send_mcu(spec: &str, extra: &[String]) -> Result<()> {
    use std::thread::sleep;
    use std::time::Instant;

    const MAX_WAIT_S: u64 = 120;
    const QUIET_MS: u64 = 250;
    const TAP_GAP_MS: u64 = 50;
    const PRE_EMIT_MS: u64 = 200;
    const OBSERVE_S: u64 = 3;

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
    eprintln!("# In LUNA: Preferences > Controllers > MIDI Control Surfaces; select");
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
                        eprintln!(
                            "# LUNA activation detected; waiting for init burst to settle..."
                        );
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

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    /// Call `setup_midi_connections` twice with a config that has empty
    /// port names and uses the keystroke backend (so no virtual MCU
    /// endpoint is registered). Both calls must succeed — empty-port
    /// paths are warn-and-continue, not errors.
    ///
    /// The MCU / CoreMIDI virtual endpoint path is NOT tested here
    /// because macOS's CoreMIDI rejects a second `kMIDIPropertyUniqueID`
    /// registration in the same process (OSStatus -10843). That
    /// constraint is a platform limitation, not a bridge bug. The
    /// virtual-endpoint test for correctness is covered by the
    /// hardware-validation phase (Phase 6i) which runs out-of-process.
    #[test]
    fn setup_midi_connections_idempotent_with_empty_ports() {
        use crate::config::{BackendKind, LocateConfigToml, TransportConfig};

        let config = Config {
            midi_input_port: String::new(),
            mc500_output_port: String::new(),
            transport: TransportConfig {
                backend: BackendKind::Keystrokes,
                ..TransportConfig::default()
            },
            locate: LocateConfigToml {
                enabled: false,
                ..LocateConfigToml::default()
            },
            ..Config::default()
        };

        let result1 = setup_midi_connections(&config);
        assert!(result1.is_ok(), "first call failed: {:?}", result1.err());

        // Drop the first connections before the second call so both
        // can safely be "alive" sequentially (not simultaneously).
        drop(result1);

        let result2 = setup_midi_connections(&config);
        assert!(result2.is_ok(), "second call failed: {:?}", result2.err());
    }
}
