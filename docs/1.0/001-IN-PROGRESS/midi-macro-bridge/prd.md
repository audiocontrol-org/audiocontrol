# MIDI Macro Bridge — Product Requirements Document

**Status:** Approved
**Owner:** Orion
**Created:** 2026-04-22

## Problem Statement

There is no way to control LUNA's transport from the MC-500mkII sequencer. LUNA does not support MMC, and MCU lacks locate-to-position. The originally validated workaround was translating MIDI transport bytes into keyboard events, and that's what Phases 1-2 shipped. In practice, keystroke emulation has real limitations: it requires LUNA to be the frontmost app (transport commands get swallowed or leak into other apps when focus is elsewhere), it depends on macOS Accessibility permission (a brittle onboarding step for non-technical users), and the OS can rate-limit or drop synthesised keystrokes under load. MCU output bypasses all three: LUNA accepts control-surface input regardless of which app is frontmost, there is no Accessibility gate, and MCU messages are delivered via the same MIDI plumbing that already carries the MC-500's transport.

Beyond basic transport, the user needs LUNA's playhead to follow the MC-500's locate operations bar-for-bar. Audio tape sync is *not* a forgiveness mechanism here: the MC-500 chases sync to lock its own tempo and nearest-bar reference, but it preserves whatever bar-offset exists at the moment sync is established — if the MC-500 thinks it's on bar 17 while the DAW is on bar 25, the MC-500 holds that 8-bar gap indefinitely. An open-loop locate that misses the target bar by any amount therefore desyncs the two machines *permanently* for the duration of the session. Bar-exact is the requirement, not a nice-to-have.

## User Stories

- As a studio user, I want to hit Play/Stop/Continue on the MC-500 and have LUNA follow, so I can use the hardware sequencer as my transport controller.
- As a developer, I want the bridge integrated into the monorepo build system, so it is built and tested alongside other services.
- As a studio user, I want locating on the MC-500 (LOCATE button, numeric entry, or locate-memory recall) to move LUNA's playhead to the *exact* same bar, so audio tape sync locks the two machines together without a persistent offset. Closed-loop verification against LUNA's MCU position output is what makes this reliable; open-loop keystroke counting is not trustworthy enough given that any mistake is permanent.
- As a studio user with a Novation Launch Control XL Mk3 on the desk, I want to drive LUNA's transport (Play/Stop) and nudge the playhead bar-by-bar from the LCXL3's transport buttons and encoders, so I can operate LUNA without reaching for the keyboard or having the MC-500 plugged in for trivial sessions. The LCXL3 should run alongside the MC-500 when both are connected — neither input source disables the other.
- As a non-technical user installing the bridge for the first time, I want to configure MIDI port routings through a graphical interface that opens automatically in my browser, so I can pick from a list of currently-connected ports without ever opening a TOML file or a terminal. Hand-editing config files isn't a workflow musicians know — and MIDI port names vary per machine, so there's no factory default that works for everyone.

## Success Criteria

- `services/midi-macro-bridge/` exists as a Rust service in the monorepo
- `cargo test` passes for all unit tests (state machine, MIDI parser, config, locate)
- `cargo build --release` produces a working macOS binary
- `--list-ports` shows available MIDI inputs
- `--self-test` emits keystrokes to LUNA when focused
- Root Makefile has a `build-midi-macro-bridge` target
- Hardware-validated: MC-500 Play/Stop/Continue controls LUNA transport via MCU (works with LUNA in the background; no Accessibility permission required)
- Hardware-validated: MC-500 LOCATE drives LUNA to the matching bar *exactly* (no 1-bar-off errors), regardless of time signature, via closed-loop nudging against LUNA's MCU position output
- Keystroke backend remains selectable via `[transport] backend = "keystrokes"` for environments where MCU isn't available, preserving Phase 1-2 behaviour as an opt-in fallback
- Hardware-validated: LCXL3 Play/Stop button toggles LUNA transport; LCXL3 encoder ticks nudge LUNA's bar position; LCXL3 transport LEDs reflect the bridge's playing/stopped state. The bridge runs the full Live-equivalent activation handshake on startup and the deactivation handshake on Ctrl-C
- Hardware-validated: with both MC-500 and LCXL3 enabled, transport events from either device drive LUNA correctly and neither input source masks the other
- Hardware-validated: a fresh install of the bridge auto-opens a browser-based control interface, lets the user pick MIDI input/output ports from live-enumerated dropdowns, applies the configuration in-process (no restart, ~100ms downtime), and shows live transport state plus a recent-events stream — without the user ever touching `config.toml`

## In Scope

### Phases 1–2 (shipped in PR #316)

- Integrate existing Rust code into `services/midi-macro-bridge/`
- MIDI transport byte translation (0xFA Start, 0xFB Continue, 0xFC Stop)
- Keystroke synthesis via enigo (Space for play/stop toggle, Return for return-to-zero)
- Frontmost-app check (macOS only, via osascript) — fails closed on error
- Config file (TOML) with port name, delay, frontmost app filter
- State machine for echo/feedback resilience
- `--list-ports` and `--self-test` CLI modes
- Makefile build target

### Phases 3–4 (this extension) — MCU transport + closed-loop locate

Two structural changes ship together in this phase: replace the keystroke transport path with MCU output (with keystrokes demoted to an opt-in fallback backend), and add SPP-driven closed-loop locate that reuses the same MCU plumbing.

- Register the bridge as a virtual MIDI device named `MIDI Macro Bridge` (input + output pair via CoreMIDI virtual endpoints) so it appears in LUNA's MIDI Control Surfaces dropdown and can be selected as both INPUT DEVICE and OUTPUT DEVICE on a control-surface row. This is how MCU routing is established — no IAC bus or manual routing required. **Scaffolded in an earlier Phase 3 commit; extended here to emit.**
- Respond to LUNA's MCU heartbeat probe (`F0 00 00 66 1X 00 F7`, every 5 s) with a proper identity reply so the surface stays alive for long-running sessions and so LUNA reliably accepts the bridge's input.
- Emit MCU button messages on the virtual output for transport actions: **Play**, **Stop**, **Continue (= play-from-position)**, **Return-to-zero**, **Bar-forward**, **Bar-backward**. The exact MCU note numbers / sequences are discovered empirically during Phase 3c against the live LUNA instance — the MCU standard gives strong candidates (transport 0x5B-0x5F, navigation 0x62/0x63) but DAWs vary on how "return to zero" and "1-bar nudge" map.
- Parse LUNA's MCU position output (bars/beats/subdivisions — `B0 40-49` per MCU-NOTES.md) and maintain a tracked-playhead model used for both closed-loop verification and deciding nudge direction.
- SPP-driven locate: parse Song Position Pointer (`0xF2 ll hh`) as the *target* (bar destination requested by the MC-500); drive LUNA's playhead to that target by iteratively emitting bar-nudge actions (via the configured backend) and reading LUNA's MCU position output to verify each nudge landed where expected. Closed-loop is required, not optimising — a bar-off locate would leave the MC-500 running with a persistent bar-offset against LUNA for the rest of the session.
- Introduce an `Action` enum (`Play`, `Stop`, `Continue`, `ReturnToZero`, `BarForward`, `BarBackward`) emitted by the state machine. Introduce a `Backend` trait implemented by `McuBackend` (default) and `KeystrokeBackend` (existing Phase 1-2 logic, preserved). A `[transport] backend = "mcu" | "keystrokes"` config switches between them; default is `"mcu"`.
- Extend state machine with a `Locating` state and atomic-locate semantics: SPP events coalesced while locating, Stop cancels the in-flight locate, Start arriving during locate is queued as Continue so a return-to-zero doesn't undo the locate.
- Add `[locate]` TOML section: `enabled`, `max_iterations` safety cap, `position_timeout_ms`.
- `info!`-level logging of every locate: target bar (from SPP), starting bar (from MCU), per-iteration action + delta, final bar, total iterations — fully diagnosable when locates misfire.
- Closed-loop naturally supports bidirectional navigation: move in whichever direction (forward or backward) is closer to the target; no always-rewind penalty.

**Deliberate closed-loop constraint:** the approach only works if LUNA's bar-nudge primitive moves the playhead by ≤ 1 bar per invocation. The hardware probe confirms this for the bracket keystrokes; the MCU-equivalent primitive needs the same property. If an unexpected nudge size is discovered in Phase 3c or seen at runtime (delta reverses sign between iterations), the controller aborts with a clear configuration error — it does not silently oscillate.

### Phase 5 — Novation Launch Control XL Mk3 as a second input source

The bridge gains a second, parallel input source. Phases 1–4 keep working unchanged; Phase 5 is purely additive.

- Open the LCXL3's "DAW In" / "DAW Out" port pair via midir alongside the existing MC-500 connection. Both inputs feed the same `TransportEvent` channel; the existing state machine arbitrates.
- On startup (when LCXL3 is enabled in config), perform the full Live-equivalent DAW activation handshake against the device: Novation probe (`F0 00 20 29 02 15 02 00 F7`), Universal Device Inquiry exchange, DAW claim (`02 7F`), host-name SysEx page (`04 36 …` / `06 36 01 "Bridge"` / `04 36 7F`), and a minimal LED preset for the transport buttons. Without this, the LCXL3's transport buttons stay dormant — they only emit when the device believes a host is connected. On Ctrl-C the bridge sends the deactivation handshake (`02 00`) so the device returns to its idle state.
- Translate LCXL3 control messages into existing `Action` vocabulary:
  - Play/Stop toggle button (`B0 74 7F` press) → `TogglePlay` event → `[Play]` if currently Stopped, `[Stop]` if currently Playing. LUNA's snap-on-stop behaviour means `[Play]` (without a preceding `ReturnToZero`) resumes from the right place naturally.
  - Encoder rotation (`B6 1E nn` / `B6 1F nn`) → `NudgeForward(n)` / `NudgeBackward(n)` → N × `BarForward` / `BarBackward` actions, with a hard cap of 4 nudges per packet so a fast spin can't flood the backend.
  - Other controls (faders, V-pots, pads, fader buttons, Record button) are intentionally unmapped in v1 — adding them later is purely additive.
- Push transport-state LED feedback back to the LCXL3 after every state transition: `B0 74 21` (green) when entering Playing, `B0 74 27` (idle) when returning to Stopped. Locating intermediate state shows idle since locates complete in seconds.
- New `[lcxl3]` config section (`enabled` defaults to `false`, plus `input_port`, `output_port`, `host_name`). MC-500-only users see no behaviour change.
- New `src/lcxl3.rs` module owns the LCXL3 protocol details (CC parsing, handshake byte sequences, LED helpers); `state.rs` gains the new `TransportEvent` variants and `Machine::handle` arms; `main.rs` wires the second input alongside the existing MC-500 path; the existing `--lcxl3-activate` one-shot CLI mode now imports its constants from `lcxl3.rs` rather than duplicating them.

**Power-cycle behaviour (v1):** if the user power-cycles the LCXL3 mid-session, midir's input connection breaks. The bridge logs the disconnect and the user restarts the bridge to re-handshake. Auto-reconnect is out of scope for v1.

### Phase 6 — Embedded web control interface

The bridge gains a graphical configuration and status interface served from the binary itself. Hand-edited TOML stays as a fallback path; the web UI becomes the primary onboarding experience. Distribution work (notarized `.pkg`, launchd LaunchAgent, signing, auto-update) is tracked separately and is *not* part of this scope.

- Embed an HTTP server (`axum` on a `tokio` runtime spawned in a dedicated thread) inside the bridge binary. The MIDI event loop stays on its existing `std::thread` — the two communicate exclusively through `tokio::sync::watch` (status snapshots, server reads) and `tokio::sync::mpsc` (commands, server writes). HTTP handlers never touch `MidiInputConnection` / `MidiOutputConnection` handles directly; the MIDI thread retains exclusive ownership.
- Bind to `127.0.0.1:8765` (with `0.0.0.0` and authentication explicitly out of scope for v1) and fall back to OS-assigned (`:0`) when 8765 is taken; record the chosen URL in `~/Library/Application Support/MidiMacroBridge/url.txt` for follow-on tooling.
- Auto-open the browser to the bridge URL on startup via macOS `open`. A `--no-open` CLI flag suppresses this for headless reload scenarios.
- Serve a single-page htmx-driven control surface from compiled-in static assets (`rust-embed`): no JS bundler, no node_modules, no SPA framework. Self-host fonts (Geist Mono, Departure Mono) — the bridge runs offline.
- Visual identity: "Studio Rack Utility" — the interface presents as a virtual rack-mount MIDI patch utility. Panel-screened typography, peak-meter LEDs (off / green-steady / amber / red), signal-flow routing visualisation (sources → bridge → destinations), tape-printer event log. Full design captured in [`web-ui-design.md`](web-ui-design.md).
- HTTP API surface (htmx-targeted; endpoints return HTML fragments rather than JSON):
  - `GET /` — single-page HTML shell
  - `GET /static/*` — embedded assets (CSS, JS, fonts)
  - `GET /api/ports` — live-enumerated MIDI input + output port lists
  - `GET /api/status` — bridge state, transport state, current-bar, per-port-slot status (Off / Connected / Missing / Failed), MCU heartbeat freshness, current loaded `Config`
  - `GET /api/events` — Server-Sent Events stream of `Machine::handle()` events (ring-buffered to last 200 server-side so a freshly-opened tab sees recent history)
  - `POST /api/config` — receives form data, writes `config.toml` atomically (write-tmp + rename), emits `Cmd::Reload` on the channel
  - `POST /api/halt` — emits `Cmd::Halt`; the MIDI loop performs the actual `std::process::exit(2)` (the HTTP handler never exits the process directly)
- In-process reload: on `Cmd::Reload`, the MIDI loop drops its current `MidiInputConnection` / `MidiOutputConnection` handles and calls a new `setup_midi_connections(&Config)` factory to rebuild them. Designed to complete within ~100ms; the UI shows a "RECONNECTING…" state during the reload window.
- Configuration form covers MC-500 (input port + sync output port + enable toggle), LCXL3 (input port + LED output port + enable toggle + host-name string), and Backend mode (MCU / Keystrokes; the latter expands to reveal the nudge-size config). The single APPLY button is the only way changes take effect — picking from a dropdown marks the form dirty; nothing happens until APPLY.
- HALT button uses a 3-second hold-to-confirm interaction so an accidental click can't take the bridge down. On confirm the bridge process exits with code 2; under launchd (added by the follow-on packaging feature) it respawns within 1s.
- Master health LED in the page header (green / amber / red) summarises the rolled-up state of all enabled inputs, MCU output, and DAW heartbeat freshness; tooltip describes the specific reason for any non-green state.

**v1 deferred (tracked but not blocking):** keyboard shortcuts, theme toggle, bar/beat/tick precision in the transport readout (just bar in v1), per-source event colour customisation, export/share config snapshot, mobile/touch optimisation, raw-byte diagnostics panel, multi-instance support. LAN access with auth is a separate feature in the distribution track.

## Out of Scope

- MIDI clock forwarding
- **Full** MCU surface emulation. Phases 3-4 consume the MCU position output stream and emit a **limited** set of outbound MCU messages: transport button presses (Play/Stop/Continue/Return-to-zero), bar-nudge button presses (Bar-forward/Bar-backward), and the heartbeat identity reply. We do not emit faders, V-Pot rotations, jog-wheel moves, channel-strip selects, automation mode changes, or any of the rest of the MCU vocabulary. We do not parse those inbound either (LUNA sends the full surface state for an 8-strip mixer, which we ignore aside from the 10-digit position display).
- Sample-accurate positioning — bar-accurate is the bar; tape audio sync handles finer chase
- Locate during playback — SPP received while LUNA is playing is ignored
- LUNA nudge value greater than 1 bar — closed-loop assumes `[` / `]` moves ≤ 1 bar; larger nudge values are detected at runtime and surfaced as a configuration error rather than silently misbehaving
- Windows support in v1
- Program Change to marker navigation (future feature)
- LCXL3 fader / V-pot / pad / Record-button mappings — Phase 5 covers transport buttons + encoder only; the rest of the LCXL3 surface stays unmapped (additive future work)
- LCXL3 auto-reconnect on device power-cycle — bridge restart required in v1
- General-purpose preset system (future -- v1 is hardcoded MC-500 + LCXL3 to LUNA mapping)
- macOS `.pkg` installer + notarization + signing — distribution work tracked as a separate follow-on feature, not Phase 6
- launchd LaunchAgent / auto-start at login — same follow-on
- Auto-update mechanism, crash reporting, telemetry
- LAN-reachable web UI / iPad use case — Phase 6 binds to `127.0.0.1` only; LAN access requires auth + HTTPS, deferred
- SPA frontend framework (React, Svelte, Vue) — Phase 6 is htmx + plain HTML by design; no JS bundler, no node_modules
- Native menu-bar status app — possible follow-on once the web UI is established
- Multi-bridge / multi-instance management — single bridge per machine in v1

## Dependencies

- None on other audiocontrol modules -- standalone Rust binary
- Hardware (Phases 1-2): MC-500mkII connected via MIDI interface, LUNA installed
- Hardware (Phases 3-4): the user configures LUNA's MIDI Control Surfaces to select `MIDI Macro Bridge` (the virtual endpoint pair registered by the bridge at startup) as both INPUT DEVICE and OUTPUT DEVICE on a free control-surface row, protocol MCU. No additional MIDI cabling or routing is required — the bridge is the endpoint LUNA talks to.
- Hardware (Phase 5): Novation Launch Control XL Mk3 connected via USB; the device exposes `LCXL3 1 DAW In` / `LCXL3 1 DAW Out` MIDI ports that the bridge opens directly. No Live, Logic, or other DAW configuration is required — the bridge runs the activation handshake itself.

## Open Questions

- enigo 0.2 API compatibility -- need to verify current crate version matches scaffolded code *(resolved in Phase 1: enigo 0.2.1 API matches)*
- midir 0.10 API compatibility -- similar concern *(resolved in Phase 1: midir 0.10.4 API matches)*
- **What exact position messages does LUNA emit on the MCU output, and at what rate?** The MCU protocol defines multiple position-reporting paths (timecode display SysEx, BEATS-mode display). Phase 3's first task is reverse-engineering the actual byte stream; this informs the parser design.
- **Does LUNA's `[` / `]` keystroke honour the nudge-value setting, and does that setting map to musical bars or to some raw tick count?** Phase 4 hardware validation answers this empirically.

## Appendix: Known MC-500 hardware quirks

Documented after 2026-04-23 hardware testing — not bridge bugs,
hardware limitations of the Roland MC-500mkII.

**SPP is gated by MIDI sync mode, and the gate is one-way at a time.**
The MC-500 only accepts inbound SPP when in MIDI sync mode, and it
only sends outbound SPP when *not* in MIDI sync mode. The two paths
are mutually exclusive — the user picks which direction to enable:

- **MIDI sync mode OFF** (default for the bridge's locate feature):
  MC-500 sends SPP when the user hits LOCATE → bridge drives LUNA
  via closed-loop locate. But sync-on-stop (bridge → MC-500 SPP)
  is ignored.
- **MIDI sync mode ON**: MC-500 accepts SPP from the bridge →
  sync-on-stop works (MC-500 follows LUNA's snapped position). But
  the MC-500 no longer sends SPP on LOCATE, so closed-loop locate
  from the MC-500 side stops working.

**Implication for users:** if you want the bridge to drive LUNA
from MC-500 LOCATE, keep the MC-500 out of MIDI sync mode and
accept that sync-on-stop is a no-op (manually return the MC-500
to bar 1 as part of your Stop workflow). If you want sync-on-stop
to mirror LUNA's behaviour, enable MIDI sync mode and drive locate
some other way.

This is not something the bridge can solve — SPP is the only
position-exchange primitive in the MIDI spec that the MC-500
honours, and the MC-500 firmware gates it by mode.

## Appendix: Future Direction

This service will evolve into a general-purpose MIDI-to-macro translator with:

- Device presets (MC-500, Novation LaunchControl XL)
- DAW presets (LUNA, Logic, Ableton)
- Configurable MIDI CC/note to keystroke/macro mappings
- Possibly a menu bar app wrapper

## Appendix: Open-Loop Locate Fallback (fragile, documented for completeness only)

If closed-loop locate (Phase 3-4 primary approach) turns out to be unworkable in practice — for example, LUNA's MCU position output doesn't report position reliably enough, or the round-trip latency between keystroke and position update is too high to run an iterative loop — an open-loop strategy exists but is **not a drop-in substitute**:

- Parse SPP, compute target bar from a configured time signature
- Always rewind to bar 0 (Return), then emit *N* `BarForward` keystrokes to advance
- User-configured time signature in the `[locate]` TOML section; documented LUNA nudge-value precondition (nudge must equal one bar)
- Atomic-locate state machine stays the same (`Locating` state, coalesce SPP while locating, Stop cancels, Start-during-locate becomes Continue)

Why this is a last resort, not a graceful fallback — the MC-500's sync behaviour doesn't forgive landing-error:

- **Any bar-off locate is permanent.** Tape sync preserves whatever offset exists at sync-lock time; it does not chase LUNA's absolute position. A single keystroke miscount puts MC-500 and LUNA out of sync for the rest of the session.
- **The bridge cannot verify correctness.** Without an MCU position feed there is no way to detect that a locate landed wrong — the error only surfaces when the user notices audio isn't on the expected downbeat.
- **Three silent failure modes stack.** LUNA's nudge-value setting not matching 1 bar, time-signature mismatches mid-song, or LUNA dropping a keystroke under load all produce bar-off locates with no in-band signal.
- **Large locates are slow regardless.** Locate to bar 200 emits 200 keystrokes (~4 s at 20 ms per stroke) even when nothing goes wrong.

If Phase 4 shows closed-loop cannot be made reliable, the right response is to re-evaluate the problem rather than ship open-loop — perhaps by finding another LUNA output path that reports position, by constraining the user to session layouts where MC-500 and LUNA both reset to bar 1 on every locate, or by marking the feature unsupported until LUNA exposes a machine-readable position feed. Open-loop without closed-loop verification is not safe enough to ship as the primary path for this user's workflow.
