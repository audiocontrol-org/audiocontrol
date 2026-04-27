# MIDI Macro Bridge -- Workplan

## GitHub Tracking

| Item | Reference |
|------|-----------|
| Milestone | TBD |
| Parent Issue | TBD |
| Phase 1 Issue | TBD |
| Phase 2 Issue | TBD |
| Phase 3 Issue | TBD |
| Phase 4 Issue | TBD |
| Phase 5 Parent Issue | [#320](https://github.com/audiocontrol-org/audiocontrol/issues/320) |
| Phase 5a Issue | [#321](https://github.com/audiocontrol-org/audiocontrol/issues/321) — LCXL3 protocol module |
| Phase 5b Issue | [#322](https://github.com/audiocontrol-org/audiocontrol/issues/322) — `TogglePlay` + Nudge state-machine variants |
| Phase 5c Issue | [#323](https://github.com/audiocontrol-org/audiocontrol/issues/323) — `[lcxl3]` config section |
| Phase 5d Issue | [#324](https://github.com/audiocontrol-org/audiocontrol/issues/324) — wire LCXL3 input + LED output into main loop |
| Phase 5e Issue | [#325](https://github.com/audiocontrol-org/audiocontrol/issues/325) — LCXL3 hardware validation |
| Phase 6 Parent Issue | [#327](https://github.com/audiocontrol-org/audiocontrol/issues/327) — Web Control Interface |
| Phase 6a Issue | [#328](https://github.com/audiocontrol-org/audiocontrol/issues/328) — server skeleton + reload plumbing |
| Phase 6b Issue | [#329](https://github.com/audiocontrol-org/audiocontrol/issues/329) — port enumeration + status APIs |
| Phase 6c Issue | [#330](https://github.com/audiocontrol-org/audiocontrol/issues/330) — static asset embedding + base layout |
| Phase 6d Issue | [#331](https://github.com/audiocontrol-org/audiocontrol/issues/331) — stylesheet (studio rack aesthetic) |
| Phase 6e Issue | [#332](https://github.com/audiocontrol-org/audiocontrol/issues/332) — configuration form + APPLY |
| Phase 6f Issue | [#333](https://github.com/audiocontrol-org/audiocontrol/issues/333) — event stream UI |
| Phase 6g Issue | [#334](https://github.com/audiocontrol-org/audiocontrol/issues/334) — HALT button + master LED |
| Phase 6h Issue | [#335](https://github.com/audiocontrol-org/audiocontrol/issues/335) — auto-open browser + first-run polish |
| Phase 6i Issue | [#336](https://github.com/audiocontrol-org/audiocontrol/issues/336) — Phase 6 hardware validation |
| Phase 1-2 PR | [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged) |
| Phase 3-4 PR | [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged) |
| Tolerance fix PR | [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (merged) |
| Idle byte-trace PR | [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319) (merged) |
| Phase 5 + Ableton PR | [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326) (merged) |

## Technical Approach

### Phases 1-2 (shipped in PR #316)

- Copy existing scaffolded Rust code into `services/midi-macro-bridge/`
- 5 source files: main.rs, config.rs, state.rs, midi.rs, keys.rs
- Resolve dependency version skew if needed (enigo 0.2, midir 0.10)
- Add Makefile build target following scsi-midi-bridge pattern
- Hardware validation with MC-500 + LUNA

### Phases 3-4 — MCU transport + closed-loop locate

- **Reverse-engineer first, then build.** Phase 3 opened with hardware probe sessions (LUNA running, MCU output routed to the bridge) to capture LUNA's position message format and confirm structural assumptions. Findings are in `services/midi-macro-bridge/MCU-NOTES.md`: 10-digit BBT display on `B0 40-49`, right-to-left digit numbering, ~16 Hz update rate, bar counter is strictly monotonic across time-signature changes, each `[`/`]` keystroke moves exactly ±1 bar with sub-100 ms latency.
- **Two structural shifts land together.** (1) Transport moves from keystroke emission to MCU output — Phase 1-2's `Return`+`Space` approach is refactored into a pluggable backend, with `McuBackend` (default) and `KeystrokeBackend` (opt-in fallback). MCU bypasses the frontmost-app requirement, Accessibility permission, and OS keystroke rate limits. (2) Closed-loop locate uses the same MCU plumbing: read position from `B0 40-49`, emit bar-nudge MCU messages, verify landing.
- **Sub-phase split.** Phase 3 is broken into six linear sub-steps (3a–3f) so discovery against LUNA can happen in the middle, informed by a solid parser and a heartbeat responder, before committing to the backend refactor. Details in the per-phase sections below.
- Hardware validation in Phase 4 covers transport via MCU (Play/Stop/Continue/RTZ round-tripping against LUNA with LUNA backgrounded), closed-loop locate forward/backward/from-zero, time-signature changes, and the oscillation-abort path for the nudge > 1 bar misconfiguration.

### Phase 5 — Novation Launch Control XL Mk3 as a second input source

- **Empirical first.** The handshake the LCXL3 expects, the bytes its transport buttons emit, and the LED CCs that bring its panel to life were all captured against Ableton Live's LCXL3 integration before any code was written. Decoded handshake reference lives in `docs/1.0/001-IN-PROGRESS/midi-macro-bridge/lcxl3-handshake-trace.md` and the `--lcxl3-activate` CLI mode (already shipped) demonstrated end-to-end that the handshake plus LED preset is enough for the device's transport buttons to become functional.
- **Additive, not replacement.** The MC-500 input pipeline stays exactly as it is. The LCXL3 plugs in as a second `midi::connect_raw` callback feeding the same `mpsc::Sender<TransportEvent>` the MC-500 already uses. The state machine arbitrates between them; existing echo/dedup logic handles near-simultaneous events from both sources.
- **New `TransportEvent` variants.** `TogglePlay` (Play/Stop button), `NudgeForward(u32)`, `NudgeBackward(u32)` (encoder ticks). MC-500 path keeps emitting `Start` / `Continue` / `Stop` / `Spp` unchanged.
- **State-machine extensions.** `TogglePlay` while Stopped emits `[Play]` (LUNA's snap-on-stop means no `ReturnToZero` needed); while Playing emits `[Stop]`; while Locating ignored. Nudge events emit N × `BarForward` / `BarBackward` while Stopped (capped at 4 per packet at the parser layer); ignored while Playing or Locating.
- **LED feedback.** After every `Machine::handle()`, if the state changed, write the corresponding transport-button LED CC to the LCXL3's DAW In port: `B0 74 21` for Playing, `B0 74 27` for Stopped/Locating.
- **Activation lifecycle.** On startup with `[lcxl3] enabled = true`, the bridge runs the full Live-equivalent handshake (probe + UDI + claim + host name `"Bridge"` + transport LED preset). On Ctrl-C, the bridge sends the deactivation SysEx so the device returns to its idle state. Power-cycle mid-session requires a bridge restart in v1.

### Phase 6 — Embedded web control interface

- **Why a web UI:** the MIDI port-name problem has no factory default. Every machine sees different port names depending on what's plugged in, what virtual buses are configured, and what other apps have claimed devices. A picker that enumerates the actual currently-connected ports — and surfaces per-port status (configured/connected/missing/failed) — is the only ergonomic way to get a non-technical user past the very first hurdle. Hand-edited TOML stays as a fallback path for power users; it's not the onboarding flow.
- **Why embedded HTTP, not native:** htmx + axum + `rust-embed` ship as a single binary, run offline (no CDN), don't require Apple's notarization story for a separate GUI app, and don't drag in a JS toolchain. The existing daemon is already long-running; adding an HTTP listener is a much smaller change than building a Tauri / Swift menu-bar app, and the picker fits htmx's strengths well (server-rendered fragment swaps, minimal client logic).
- **Why studio-rack aesthetic:** the bridge is virtually a piece of MIDI patch hardware. Reflecting that identity in the UI — peak-meter LEDs, signal-flow routing, screenprint typography — gives musicians a familiar mental model and avoids generic-dashboard look. Full design captured in [`web-ui-design.md`](web-ui-design.md).
- **Tokio runtime in a dedicated thread, not async-everywhere.** The MIDI event loop stays synchronous on its existing `std::thread` — it owns all `MidiInputConnection` / `MidiOutputConnection` handles, and rewriting it as `async` would be a much bigger refactor than this work warrants. The HTTP server runs in its own `tokio::runtime::Runtime` on a second thread. The two communicate exclusively through `tokio::sync::watch<Status>` (server reads), `tokio::sync::broadcast<EventLine>` (server reads), and `tokio::sync::mpsc<Cmd>` (server writes). HTTP handlers never touch MIDI handles directly.
- **In-process reload, not process restart.** `POST /api/config` writes `config.toml` atomically (tmp + rename), then sends `Cmd::Reload(Config)` on the channel. The MIDI loop drops its current connections, calls a new `setup_midi_connections(&Config)` factory, and the watch-broadcast `Status` flips through `Reconnecting` → `Running`. Targeted at ~100ms downtime; the UI shows a "RECONNECTING…" state during the window. Avoids the "config-change requires restart" UX wart and means no launchd dependency for the v1 web UI.
- **`POST /api/halt` is not a direct exit.** The handler emits `Cmd::Halt` and the MIDI loop performs the actual `std::process::exit(2)`. Keeps the exit-path single — easier to reason about, easier to instrument with shutdown logging. The web UI uses a 3-second hold-to-confirm interaction so an accidental click can't take the bridge down.
- **Server-rendered fragments, not JSON.** `GET /api/ports` returns HTML `<option>` elements ready for swap into the picker; `GET /api/status` returns the full status panel as a fragment; SSE event lines are pre-rendered HTML. Means client-side code is roughly zero — htmx handles the swap, no JS state management, no JSON-to-DOM mapping logic to maintain.
- **Auto-open on startup.** On macOS, after the listener binds, run `open http://127.0.0.1:<port>` so the user lands on the UI without typing a URL. `--no-open` flag suppresses for headless / launchd-managed cases. The chosen URL is also written to `~/Library/Application Support/MidiMacroBridge/url.txt` for future tooling (menu-bar app, `open --bridge` helper).

## Modules Affected

### Phases 1-2 (shipped in PR #316)

- `services/midi-macro-bridge/` (new)
- Root `Makefile`

### Phases 3-4

- `services/midi-macro-bridge/src/mcu.rs` (new) — MCU input parser (`PositionTracker`, `parse_mcu_bytes`) and MCU output encoder (`encode_button_press`, `encode_heartbeat_reply`)
- `services/midi-macro-bridge/src/backend.rs` (new) — `Backend` trait; `McuBackend` (default) and `KeystrokeBackend` (fallback)
- `services/midi-macro-bridge/src/locate.rs` (new) — `LocateController` (closed-loop, Backend-agnostic)
- `services/midi-macro-bridge/src/state.rs` — replace `KeyAction` with abstract `Action` enum (`Play`, `Stop`, `Continue`, `ReturnToZero`, `BarForward`, `BarBackward`); add `Locating` state and SPP handling
- `services/midi-macro-bridge/src/midi.rs` — add `Event::Spp(u16)` and SPP parsing; virtual MCU endpoint registration (done in Phase 3 scaffolding commit); heartbeat responder wiring
- `services/midi-macro-bridge/src/keys.rs` — shrinks to a pure emitter for the `KeystrokeBackend`, no state-machine coupling; keeps `Return`/`Space`/bracket keys
- `services/midi-macro-bridge/src/config.rs` — add `[transport]` and `[locate]` sections
- `services/midi-macro-bridge/src/main.rs` — open transport input, register the virtual MCU endpoint, run heartbeat responder, construct selected Backend, drive the closed-loop controller (already has `--probe-midi` / `--probe-mcu` from scaffolding; adds `--send-mcu <spec>` for 3c discovery)
- `services/midi-macro-bridge/README.md` — document the MCU control-surface selection flow, the `[transport]` backend choice, and the `[locate]` config
- `services/midi-macro-bridge/MCU-NOTES.md` — capture log of LUNA's MCU input/output format; appended during 3c discovery with the definitive Play/Stop/Continue/RTZ/BarFwd/BarBack encodings

### Phase 5

- `services/midi-macro-bridge/src/lcxl3.rs` (new) — LCXL3 protocol module: CC-byte parser (`parse(&[u8]) -> Option<TransportEvent>`), handshake byte-sequence constants (probe / UDI / claim / host-name SysEx), LED color constants and `led_for_state(&TransportState) -> Option<[u8; 3]>` helper, all unit-tested against captured byte sequences from `lcxl3-handshake-trace.md`
- `services/midi-macro-bridge/src/state.rs` — extend `TransportEvent` with `TogglePlay`, `NudgeForward(u32)`, `NudgeBackward(u32)`; extend `Machine::handle` arms per the per-state table above; add unit tests for each new transition
- `services/midi-macro-bridge/src/config.rs` — new `LcxlConfig` struct + `[lcxl3]` TOML section (`enabled` default false, `input_port`, `output_port`, `host_name`); TOML round-trip tests for minimal / full / missing variants
- `services/midi-macro-bridge/src/main.rs` — second `midi::connect_raw` for the LCXL3 input alongside the existing MC-500 `midi::connect`; second `midi::connect_output` for LCXL3 LED output (mirrors the existing MC-500 sync output pattern); call `lcxl3::handshake_send` on startup if config enables it; after each `machine.handle()` push state-change LED bytes; send deactivation SysEx in the Ctrl-C path; existing `--lcxl3-activate` one-shot mode imports its byte constants from the new `lcxl3` module rather than duplicating them
- `services/midi-macro-bridge/config.example.toml` — document the new `[lcxl3]` section with all defaults
- `services/midi-macro-bridge/README.md` — add an LCXL3 setup section: how to enable, port-name conventions, what works in v1, the power-cycle restart caveat
- `docs/1.0/001-IN-PROGRESS/midi-macro-bridge/lcxl3-handshake-trace.md` (new) — annotated decode of the captured Live → LCXL3 init sequence; reference document for the byte values used in `lcxl3.rs`

### Phase 6

- `services/midi-macro-bridge/Cargo.toml` — add `axum`, `tokio` (with `rt-multi-thread`, `signal`, `sync`, `time` features), `tower-http`, `rust-embed`, `serde_json`, `futures` dependencies
- `services/midi-macro-bridge/src/web/mod.rs` (new) — axum app builder, route definitions, embedded-asset handler, runtime spawn helper
- `services/midi-macro-bridge/src/web/handlers.rs` (new) — request handlers for `/api/status`, `/api/ports`, `/api/config`, `/api/halt`, `/api/events`
- `services/midi-macro-bridge/src/web/views.rs` (new) — server-rendered HTML fragments (port picker rows, status badges, transport readout, event lines, configuration form blocks)
- `services/midi-macro-bridge/src/web/state.rs` (new) — `WebState`, `Cmd`, `Status`, `EventLine`, `EventSource`, channel wiring between HTTP and MIDI threads
- `services/midi-macro-bridge/src/main.rs` — extract `setup_midi_connections(&Config) -> Connections` factory; spawn the tokio runtime; wire `Cmd` / `Status` channels; handle `Cmd::Reload` / `Cmd::Halt` in the existing loop; call `open` on startup unless `--no-open`
- `services/midi-macro-bridge/src/midi.rs` — split `list_ports()` into `list_ports_input()` and `list_ports_output()`; existing callers updated
- `services/midi-macro-bridge/src/config.rs` — add `WebConfig` struct + `[web]` TOML section (`enabled` default true, `bind_port` default 8765, `auto_open_browser` default true); add `Config::write_atomic(&Path)` for the POST handler
- `services/midi-macro-bridge/web/index.html` (new) — the SPA shell: header strip, transport readout placeholder, routing matrix scaffold, configuration accordion, event stream container
- `services/midi-macro-bridge/web/app.css` (new) — full studio-rack stylesheet: palette CSS variables, panel chrome, brushed-metal gradient, hairlines, screenprint labels, LED component, scanline overlay, film-grain noise
- `services/midi-macro-bridge/web/app.js` (new) — minimal vanilla JS for the HALT hold-to-confirm interaction and SSE pause-on-hover behaviour; no other client logic
- `services/midi-macro-bridge/web/htmx.min.js` (vendored, new) — htmx 1.9.x core
- `services/midi-macro-bridge/web/htmx-sse.js` (vendored, new) — htmx SSE extension for the live event stream
- `services/midi-macro-bridge/web/fonts/geist-mono.woff2` (vendored, new, OFL)
- `services/midi-macro-bridge/web/fonts/departure-mono.woff2` (vendored, new, OFL)
- `services/midi-macro-bridge/config.example.toml` — document the new `[web]` section with all field defaults
- `services/midi-macro-bridge/README.md` — replace "config-by-hand" setup instructions with web-UI flow as the primary path; keep the TOML reference as a power-user fallback
- `docs/1.0/001-IN-PROGRESS/midi-macro-bridge/web-ui-design.md` (new) — canonical UX/UI design reference: aesthetic direction, palette, typography, wireframes, interaction patterns, v1-vs-deferred split

## Deferred — cross-platform MIDI abstraction layer

The virtual MCU endpoints in `src/midi.rs` are currently cfg-split three ways: macOS uses `coremidi` directly (so we can stamp stable `kMIDIPropertyUniqueID` values and LUNA recognises the bridge across restarts); Linux keeps `midir`'s ALSA path (ephemeral IDs, documented limitation); Windows / other platforms bail.

This works but is cfg-noisy. A future cleanup pass should introduce a `VirtualMcuBackend` trait with platform-specific implementations so callers are cfg-free. Out of scope for Phase 3; tracked here so it isn't forgotten.

## Phase 1: Integration and Build

**Deliverable:** Service exists in monorepo, builds, and tests pass.

### Tasks

- [x] Copy scaffolded code into `services/midi-macro-bridge/`
- [x] Resolve any dependency version skew (enigo, midir)
- [x] Verify `cargo test` passes
- [x] Verify `cargo build --release` succeeds
- [x] Add `build-midi-macro-bridge` target to root Makefile
- [x] Verify `--list-ports` works

### Acceptance Criteria

- [x] `make build-midi-macro-bridge` succeeds
- [x] All unit tests pass (22/22)
- [x] `--list-ports` runs without error

## Phase 2: Hardware Validation

**Deliverable:** MC-500 controls LUNA transport via the bridge.

### Tasks

- [x] Run `--self-test` with LUNA focused, verify keystrokes land
- [x] Connect MC-500 via MIDI interface
- [x] Test Play (0xFA) -- LUNA rewinds and plays
- [x] Test Stop (0xFC) -- LUNA stops
- [x] Test Continue (0xFB) -- LUNA resumes
- [x] Test echo resilience (duplicate Stop, duplicate Continue)
- [x] Document any inter-keystroke delay tuning needed -- default 20ms worked, no tuning required

### Acceptance Criteria

- [x] All three transport commands work reliably
- [x] No double-fire on duplicate messages
- [x] Frontmost-app check prevents keystroke leaks

## Phase 3: MCU Transport + Closed-Loop Locate Implementation

**Deliverable:** Bridge drives LUNA's transport via MCU (Play/Stop/Continue/Return-to-zero), responds to MCU heartbeat to stay alive as a surface, and performs closed-loop bar-accurate locate by iteratively emitting MCU bar-nudge messages and verifying against LUNA's MCU position output. Keystroke backend preserved as opt-in fallback.

### Phase 3 scaffolding (already landed)

- [x] Add `midi::create_virtual_mcu` using `midir::os::unix::{VirtualInput, VirtualOutput}`; bridge registers the endpoint pair `MIDI Macro Bridge` in CoreMIDI so LUNA sees it in the MIDI Control Surfaces dropdown
- [x] Add `--probe-midi <port>` CLI mode for generic physical-port probing
- [x] Add `--probe-mcu` CLI mode: register the virtual endpoint and dump every byte arriving on its virtual input

### Phase 3 hardware probe (already completed; results in MCU-NOTES.md)

- [x] User configured LUNA's MIDI Control Surfaces, picked `MIDI Macro Bridge` as both INPUT DEVICE and OUTPUT DEVICE
- [x] Captured `probe-idle.log`, `probe-playback.log`, `probe-barstep.log`, `probe-ts.log`
- [x] Decoded LUNA's `B0 40-49` 10-digit BBT display and documented in MCU-NOTES.md
- [x] Measured ~16 Hz position update rate and sub-100 ms keystroke-to-update latency
- [x] Confirmed bar counter is TS-independent (structural assumption for closed-loop)

### Phase 3a — MCU input parser

- [x] Create `src/mcu.rs` with `parse_cc_display(bytes: &[u8]) -> Option<DigitUpdate>` (pure function that maps `B0 4X vv` into a typed `DigitUpdate` for digits 0-9)
- [x] `PositionTracker` struct that maintains the 10-digit display state, exposes `current_bar() -> u32` (composed from `d7`/`d8`/`d9`), and fires a `PositionUpdate { previous_bar, bar }` event whenever the composed bar value changes
- [x] Unit tests: replay of the byte sequences captured in `probe-barstep.log` (bar 1 → 2 → ... → 6 → 5 → ... → 1); digit-carry case from `probe-ts.log` (bar 69 → 70 triggers both `d47` and `d48` in the same batch)
- [x] Rest of LUNA's inbound stream (notes, CCs outside `B0 40-49`, pitch-bend, channel pressure, LCD SysEx, heartbeat SysEx) is not consumed by the parser — observable in the probe logs but not our concern for closed-loop locate

### Phase 3b — MCU heartbeat responder

- [x] `VirtualMcuPair::send(&mut self, &[u8])` so the bridge can emit bytes on its virtual output (previously receive-only)
- [x] `mcu::parse_heartbeat_query` detects LUNA's `F0 00 00 66 1X 00 F7` probe and returns the model ID; `mcu::mcu_identity_reply(model)` builds a plausible MCU identity SysEx reply (`F0 00 00 66 <model> 01 <serial 7 ASCII> <version 4 ASCII> F7`)
- [x] `--probe-mcu` replies to model `0x14` heartbeats with the identity message and logs `-> identity reply sent ...` on stderr
- [x] Confirmed empirically (probe-heartbeat-test.log, 186 s): LUNA stops probing after one identity reply — surface stays active without re-initialisation bursts.
- [x] Paused, coordinated with user, and kicked off the 3c discovery session.

### Phase 3c — MCU transmit discovery

- [x] Added `--send-mcu <spec>` CLI mode that registers the virtual endpoint, waits for LUNA's activation burst to settle, then sends the specified MCU message. Specs shipped: `play`, `stop`, `rewind`, `ff`, `record`, `cursor-{left,right,up,down}`, split `*-press` / `*-release`, and `raw <hex-bytes>`.
- [x] Discovery session complete. Confirmed byte sequences on hardware: Continue = `90 5E 7F; 90 5E 00`, Stop = `90 5D 7F; 90 5D 00`, Return-to-zero = `90 5B 7F; 90 5B 00`, Bar-forward = `B0 3C 01`, Bar-backward = `B0 3C 41`. Ruled out cursor navigation as a bar-step primitive (marker-nav + no position feedback).
- [x] MCU-NOTES.md has the full action map plus rationale, latency measurements, and notes on LUNA's post-stop play-start-snap behaviour and the cursor-nav dead end.

### Phase 3d — Backend trait + Action refactor

- [x] `KeyAction` replaced with `Action` enum. Final variants: `Play` (covers both "start" and "continue"), `Stop`, `ReturnToZero`, `BarForward`, `BarBackward`.
- [x] `Backend` trait in `src/backend.rs` with `emit(&[Action])` + `name()`.
- [x] `McuBackend`: maps each Action to its discovered MCU bytes via `VirtualMcuPair::send`.
- [x] `KeystrokeBackend`: translates Action → `KeyStroke` (Space, Return, `[`, `]`) and emits via enigo.
- [x] State machine updated: Start = `[ReturnToZero, Play]`, Continue = `[Play]`, Stop = `[Stop]`, Locating bar-nudge via controller.
- [x] `[transport]` TOML section with `backend` (`"mcu"` default, `"keystrokes"` fallback); Phase 1-2 legacy top-level keystroke fields silently ignored.
- [x] Unit tests cover backend translation preservation. All 22 original state-machine tests reworked to assert on `Action`.

### Phase 3e — Closed-loop locate

- [x] `TransportEvent::Spp(u32)` variant + SPP parsing in `midi::parse_transport` (4/4 assumption with mid-bar round-down).
- [x] `TransportState::Locating { target, queued_start }` with atomic-locate semantics — target coalescing, Stop cancels, Start/Continue queues post-locate Play.
- [x] `LocateController::run(target) -> Result<LocateOutcome>` with six outcomes: Reached / Cancelled / NudgeTooLarge / Timeout / IterationCap / NoInitialPosition. Pure `plan_step` function tested in isolation; run() orchestrates I/O through `PositionSource` and `EventSource` traits.
- [x] `[locate]` TOML section: `enabled` (default `true`), `max_iterations` (128), `position_timeout_ms` (500), `initial_position_timeout_ms` (3000).
- [x] Unit tests: 17 in locate.rs covering every outcome plus mocked PositionSource / EventSource / Backend.
- [x] `info!` log on each locate: target bar, starting bar, per-iteration action + delta, final bar, iterations, outcome

### Phase 3f — Integration + docs

- [x] `main.rs`: register the virtual MCU endpoint when MCU backend or locate is enabled; run the heartbeat responder both in idle and during locate; feed MCU bytes to a PositionTracker shared between idle drain and the LocateController; construct the configured Backend; gate the LocateController on `locate.enabled`. `--probe-midi`, `--probe-mcu`, `--send-mcu`, `--self-test`, `--list-ports` modes preserved.
- [ ] README: new "MCU vs keystrokes" section explaining the transport-backend choice and when to pick which; update the setup instructions so MCU is the default path; keep keystroke setup (Accessibility permission, frontmost app) as the fallback recipe. *(Deferred — flagged inline in README for release hardening.)*
- [x] `config.example.toml`: documents `[transport]` and `[locate]` sections plus the new `mc500_output_port` for sync-on-stop
- [x] Startup logs report: active backend, whether the MCU pair is registered, locate-enabled flag, MC-500 output port availability
- [ ] Run the full Phase 1-2 regression with the keystroke backend config (`[transport] backend = "keystrokes"`) to confirm no behaviour change for users who opt in. *(Pending user-driven validation.)*

### Phase 3 Acceptance Criteria

- [x] All unit tests green, including new tests for `mcu.rs`, `backend.rs`, `locate.rs`, and the refactored `state.rs` (84 passing)
- [x] All existing Phase 1-2 tests still pass (now exercising the KeystrokeBackend path)
- [x] `cargo build --release` clean; `make build-midi-macro-bridge` green
- [x] `MCU-NOTES.md` contains the definitive Play/Stop/Continue/RTZ/BarFwd/BarBack MCU encodings, backed by 3c discovery
- [x] Config with `[transport] backend = "mcu"` (default) produces MCU output for transport; config with `backend = "keystrokes"` reproduces Phase 1-2 behaviour
- [x] Config without `[transport]` or `[locate]` sections parses and defaults correctly
- [x] Oscillation detection aborts cleanly with a user-actionable error (`NudgeTooLarge` outcome with dedicated `warn!`)
- [x] Heartbeat responder keeps the surface alive — empirically validated via the 186 s heartbeat test (probe-heartbeat-test.log) and subsequent extended sessions

## Phase 4: Hardware Validation

**Deliverable:** MC-500 transport drives LUNA via MCU, and MC-500 LOCATE operations drive LUNA's playhead to the matching bar — both verified end-to-end.

User confirmed on 2026-04-23: "the bridge works great" / "it seems to work pretty well." The non-exotic cases below are all observed working; the more defensive / edge-case items are confirmed by code review of the safety paths rather than exercised on hardware.

### Tasks

- [x] Run the bridge with default config (`[transport] backend = "mcu"`, `[locate] enabled = true`). Confirm startup logs show "MCU backend" and "locate enabled"
- [x] Bring LUNA to the background (another app frontmost). Hit Play / Stop / Continue on the MC-500. LUNA transport responds correctly. This is the core win over keystroke emulation.
- [x] MC-500 locate drives LUNA's playhead to the requested bar in 4/4 (forward and backward)
- [x] After a locate, hit PLAY on MC-500 — LUNA starts from the located position (Start-while-Locating was queued as Continue)
- [x] Rapid SPP during MC-500 value-dial entry — bridge coalesces to the final SPP; no intermediate locates fire
- [ ] MC-500 locate to a bar inside a 3/4 section of the song — LUNA lands on the exact bar (validates TS-independence at runtime). *(Not exercised during this session; closed-loop design is TS-agnostic by construction since we read absolute bars from LUNA.)*
- [ ] Hit LOCATE while LUNA is playing — SPP ignored, playback uninterrupted. *(Not exercised; state machine's `(Playing, Spp(_))` → ignored arm is covered by unit test.)*
- [ ] Deliberately set LUNA's nudge value to > 1 bar (if applicable) — bridge detects oscillation, aborts with an actionable error. *(Not exercised; `NudgeTooLarge` outcome is covered by unit test.)*
- [ ] Disconnect LUNA's MCU output mid-locate (quit LUNA) — bridge times out per-iteration with a clean error, doesn't hang. *(Not exercised; `Timeout` outcome is covered by unit test.)*
- [ ] Switch config to `[transport] backend = "keystrokes"`, restart the bridge, confirm Phase 1-2 behaviour is reproduced. *(Not exercised this session.)*

### Hardware quirks discovered (documented, not bugs)

- LUNA snaps the playhead to the play-start position on Stop — addressed by the new sync-on-stop feature that pushes SPP back to the MC-500.
- MC-500 SPP is gated by MIDI sync mode: sends SPP when sync is OFF, accepts SPP only when sync is ON, and the two paths are mutually exclusive. Documented in PRD appendix and service README.

### Acceptance Criteria

- [x] Transport works with LUNA backgrounded when the MCU backend is in use (user confirmed)
- [ ] Transport works with LUNA frontmost + Accessibility granted when the keystroke backend is selected *(regression not exercised)*
- [x] Locate lands on the correct bar for forward and backward cases (user confirmed)
- [x] Locate sequence is atomic (rapid SPP coalesced; no mid-sequence restart)
- [x] Post-locate PLAY uses the located position, not zero
- [x] SPP during playback is ignored (unit-tested)
- [x] Nudge-size misconfiguration is detected and surfaces as a clear runtime error (unit-tested)
- [x] Missing / stalled MCU position feed is detected and surfaces as a clean timeout, not a hang (unit-tested)

## Phase 5: Novation Launch Control XL Mk3 as a second input source

**Deliverable:** With `[lcxl3] enabled = true` in config, the bridge runs the LCXL3's DAW handshake on startup, listens for transport-button and encoder events, and translates them into the existing `Action` vocabulary that drives LUNA. Transport-state LED feedback is sent back to the device. The MC-500 input pipeline is unchanged; both input sources can run simultaneously.

The existing `--lcxl3-activate` one-shot CLI mode (already shipped) demonstrates the handshake works end-to-end. Phase 5 is about wiring the same logic into the normal bridge run-loop and adding the input/output translation paths.

### Phase 5a — LCXL3 protocol module

**Deliverable:** `src/lcxl3.rs` exists with the byte sequences, parser, and LED helpers, fully unit-tested.

- [x] Create `src/lcxl3.rs` with handshake byte-sequence constants (probe `02 00`, UDI exchange, claim `02 7F`, host-name SysEx via `04 36 62` / `06 36 01 <ascii>` / `04 36 7F`, transport LED CCs)
- [x] Implement `parse(bytes: &[u8]) -> Option<TransportEvent>` — recognises Play/Stop toggle (`B0 74 7F`) and encoder ticks (`B6 1E nn` / `B6 1F nn`), clamps encoder magnitude to ≤ 4
- [x] Implement `led_for_state(state: &TransportState) -> Option<[u8; 3]>` — returns transport-button CC for Playing / Stopped / Locating; `None` if no LED change is needed
- [x] Move existing `LCXL3_DAW_PROBE` / `LCXL3_DAW_CLAIM` / `LCXL3_UDI` / `lcxl3_host_name_sequence` / LED constants from `main.rs` into the new module; update `--lcxl3-activate` to import from `lcxl3.rs`
- [x] Unit tests: every captured CC from `lcxl3-handshake-trace.md` parses to the expected `TransportEvent`; encoder magnitude cap clamps high values; LED helper returns the right bytes for each state

### Acceptance Criteria

- [x] `cargo test lcxl3` passes (14 new tests)
- [x] `--lcxl3-activate` still works (sanity-checked end-to-end: device echoes probe + UDI reply + claim ack as before)

### Phase 5b — State-machine extensions

**Deliverable:** `state.rs` accepts the new `TransportEvent` variants and emits the right `Action` vector for each (state, event) combination.

- [x] Add `TogglePlay`, `NudgeForward(u32)`, `NudgeBackward(u32)` to `TransportEvent`
- [x] Extend `Machine::handle` per the table in the workplan's Technical Approach section above
- [x] Unit tests: `TogglePlay` while Stopped → `[Play]`, transitions to Playing; while Playing → `[Stop]`, transitions to Stopped; while Locating → `[]`, no transition. Nudge while Stopped emits N actions; while Playing or Locating → `[]`.
- [x] Existing `Start` / `Continue` / `Stop` / `Spp` tests continue to pass unchanged
- [x] `transport_to_locate_event` returns `None` for the new variants so the LocateController ignores LCXL3 events mid-locate

### Acceptance Criteria

- [x] All Phase 1-4 state-machine tests still pass
- [x] New tests cover every (state × new event) combination

### Phase 5c — Config schema

**Deliverable:** `[lcxl3]` section parses from TOML; defaults work when section is absent.

- [x] Add `LcxlConfig` struct (with `serde(default)` field defaults) to `config.rs`: `enabled: bool` (default false), `input_port: String` (default "LCXL3 1 DAW Out"), `output_port: String` (default "LCXL3 1 DAW In"), `host_name: String` (default "Bridge")
- [x] Add `lcxl3: LcxlConfig` field to `Config` (with `#[serde(default)]`)
- [x] Document the new section in `config.example.toml` with all field defaults
- [x] Unit tests: minimal config (no `[lcxl3]`) parses with defaults; full config parses with overridden values; partial section parses with per-field defaults

### Acceptance Criteria

- [x] `cargo test config::tests::` passes including new round-trip tests (4 new tests)
- [x] Existing config files (no `[lcxl3]` section) continue to load without error

### Phase 5d — Wire into main loop

**Deliverable:** Bridge run with `[lcxl3] enabled = true` activates the device on startup, processes events from both MC-500 and LCXL3 inputs, mirrors LED state to the device, and deactivates on shutdown.

- [x] In `main.rs` after the existing MC-500 `midi::connect`, add a second `midi::connect_raw` for the LCXL3 input port. Each callback's parser converts bytes to `Option<TransportEvent>` (`parse_transport` for MC-500, `lcxl3::parse` for LCXL3); both forward into the same `tx` channel
- [x] Open the LCXL3 output port via `midi::connect_output` (same pattern as the existing `mc500_out` for sync-on-stop)
- [x] On startup with LCXL3 enabled, call `lcxl3::handshake_send(&mut MidiOutputConnection, host_name: &[u8])` to fire the full activation sequence
- [x] In the main loop, after `machine.handle(event)`, if `machine.state()` differs from the previous state, send the corresponding LED bytes via `lcxl3::led_for_state` to the LCXL3 output port (gated on the LCXL3 connection existing)
- [x] In the Ctrl-C / shutdown path, send the deactivation SysEx so the LCXL3 returns to idle
- [x] If the LCXL3 input port is not available at startup, log a warning and continue without LCXL3 input — the MC-500 path still works
- [x] Removed the transitional `#![allow(dead_code)]` from `lcxl3.rs` — exports are now consumed

### Acceptance Criteria

- [x] Bridge starts cleanly with both MC-500 and LCXL3 enabled (sanity-checked on hardware: handshake fired, encoder events parse, deactivation on shutdown)
- [x] Bridge starts cleanly with only one of MC-500 / LCXL3 enabled (the other empty / disabled in config) — `enabled = false` skips both LCXL3 connection paths
- [x] Bridge starts cleanly with neither configured (existing degrade-gracefully behaviour preserved)
- [x] Ctrl-C sends the deactivation SysEx visibly in the log (`LCXL3 deactivation SysEx sent`)

### Phase 5e — Hardware validation

**Deliverable:** End-to-end LCXL3 → bridge → LUNA verified on hardware. **Done; user confirmed "Works great" 2026-04-27.**

- [x] Bridge launches with both MC-500 and LCXL3 enabled. Activation handshake fires; LCXL3 transport buttons illuminate.
- [x] Press Play on LCXL3 → LUNA plays (`TogglePlay` event → `[Play]` action, state Stopped → Playing). Press again → LUNA stops (`[Stop]` action, state Playing → Stopped). LED on LCXL3 follows transport state on every transition.
- [x] Encoder ticks → LUNA's bar position advances/retreats correctly. Center-at-64 jog encoding parses correctly: `BF 5D 41` = +1, `BF 5D 3F` = -1, `BF 5D 42` = +2, `BF 5D 3E` = -2. Magnitude clamped to 4 per CC. Captured live: 30+ encoder events emitting 1–2 `BarForward`/`BarBackward` actions each.
- [x] Encoder during playback ignored cleanly. Captured live: `NudgeForward(1)` arrived during Playing state → log shows "no-op event", state stayed Playing, zero actions emitted.
- [x] Ctrl-C the bridge → LCXL3 returns to idle (deactivation SysEx sent, log shows "LCXL3 deactivation SysEx sent").
- [x] Sync-on-stop still fires after `TogglePlay → [Stop]` (log shows `sync-on-stop: sent SPP to MC-500 bar=1`). No regression in the existing MC-500 path.
- [x] *(via unit tests)* LCXL3 transport while LUNA is in the middle of a closed-loop locate (MC-500 SPP) — `transport_to_locate_event` returns `None` for the new variants (5b commit), `Machine::handle` Locating arms ignore them (5b tests). Hardware retest deferred since both layers are unit-tested.

### Hardware quirks discovered during 5e (documented, not bridge bugs)

- **Quitting Ableton Live (or any DAW that claims the LCXL3) takes the device out of DAW mode mid-session.** Live actively reclaims the device on launch and releases it on quit; both paths break the bridge's hold. v1 mitigation: restart the bridge to re-handshake. Same workflow as a power-cycle.
- **Initial parser used the wrong CC for the jog encoder** (channel-7 CCs `0x1E` / `0x1F` with sign-magnitude, instead of channel-16 CC `0x5D` with center-at-64). Discovered when the bridge fired phantom `NudgeForward(4)` events at startup with no human input. The channel-7 CCs turned out to be a V-pot's absolute-position state-mirror that the device emits on every DAW handshake. Fixed in 5e from a dedicated hardware probe; tests, parser, and `lcxl3-handshake-trace.md` reference doc updated.

### Acceptance Criteria

- [x] All hardware test cases above pass on the user's rig
- [x] No regression in MC-500 transport / locate behaviour with both inputs enabled (sync-on-stop confirmed firing post-`TogglePlay → Stop`)
- [x] LCXL3 LEDs reflect transport state correctly after every press (visually confirmed by user; state-change push fires `lcxl3::led_for_state` bytes on every Machine state transition)

## Phase 6: Embedded Web Control Interface

**Deliverable:** The bridge binary serves a single-page htmx control interface at `http://127.0.0.1:8765` (auto-opened in the user's browser on startup). Musicians configure MIDI ports through a graphical picker, see live transport state and an event stream, and apply configuration changes in-process without restarting the bridge — without ever touching `config.toml`. Distribution work (.pkg installer, launchd, signing, notarization) is **not** in this phase.

The full UX/interaction specification is captured in [`web-ui-design.md`](web-ui-design.md). This workplan section is the implementation breakdown.

### Phase 6a — Server skeleton + reload plumbing

**Deliverable:** The bridge binary spawns a tokio runtime in a dedicated thread, runs an axum server with a single "hello, bridge" handler, and the existing MIDI event loop handles `Cmd::Reload` / `Cmd::Halt` without otherwise changing behaviour. No UI yet; this phase is purely the channel-wiring refactor.

- [x] Add `axum`, `tokio` (with `rt-multi-thread`, `signal`, `sync`, `time` features), `tower-http`, `rust-embed`, `serde_json`, `futures` to `services/midi-macro-bridge/Cargo.toml`
- [x] Create `src/web/state.rs` with `WebState`, `Cmd { Reload(Config), Halt }`, `Status`, `EventLine`, `EventSource` types and the channel-creation helpers (`mpsc<Cmd>`, `watch<Status>`, `broadcast<EventLine>`)
- [x] Create `src/web/mod.rs` with the axum app builder + a single placeholder route returning `text/plain "MIDI Macro Bridge — Phase 6a placeholder"`
- [x] In `main.rs`, factor the existing per-startup MIDI wiring into `setup_midi_connections(&Config) -> Result<MidiConnections>` so the loop can rebuild connections on reload
- [x] Spawn a dedicated `std::thread` running `tokio::runtime::Runtime::new()` that drives the axum server bound to `127.0.0.1:8765` (fall back to `:0` if 8765 is taken; log the chosen port)
- [x] In the MIDI event loop, drain `cmd_rx` each tick and handle `Cmd::Reload` (drop connections, call factory, publish new `Status`) and `Cmd::Halt` (`std::process::exit(2)`)
- [x] Emit a `Status` snapshot through the watch channel after every state change
- [x] Verify: `cargo run` starts the bridge as before, `curl http://127.0.0.1:8765` returns the placeholder, MC-500 transport still drives LUNA, and a manually-triggered `Cmd::Reload` (test harness) tears down + rebuilds connections without process exit

### Acceptance Criteria

- [x] `cargo build --release` clean with new dependencies (2 pre-existing warnings only)
- [x] All existing unit tests still pass (130 total, 8 new)
- [x] New unit tests for `setup_midi_connections` (idempotent across same-config calls), `Cmd` channel plumbing, axum placeholder route
- [x] Server starts on the configured port, logs the URL clearly, falls back to OS-assigned port if 8765 is taken
- [x] Existing CLI modes (`--list-ports`, `--self-test`, `--probe-midi`, `--probe-mcu`, `--send-mcu`, `--lcxl3-activate`) all still work — the web server is gated and these modes bypass it

### Phase 6b — Port enumeration + status APIs

**Deliverable:** The HTTP server exposes the data the UI needs: live MIDI port lists, the full status snapshot, and an SSE event stream.

- [x] Split `midi::list_ports()` into `midi::list_ports_input()` and `midi::list_ports_output()` returning `Vec<String>`; update existing callers
- [x] Add `web::handlers::ports` returning an HTML fragment containing two `<datalist>` elements (input + output) populated from the live enumeration
- [x] Add `web::handlers::status` returning an HTML fragment with the current bridge state, transport state, last bar, last event timestamp, per-port-slot status, MCU heartbeat freshness
- [x] Add `web::handlers::events` returning a `text/event-stream` SSE response that subscribes to the `broadcast<EventLine>` channel and forwards each event as a pre-rendered HTML line
- [x] In the MIDI loop, push an `EventLine` to the broadcast channel after every `Machine::handle()` and on each MCU heartbeat reply / error
- [x] Server-side ring-buffer the last 200 `EventLine`s so a freshly-opened tab gets recent history
- [x] Verify: `curl http://127.0.0.1:8765/api/ports` shows current ports, `/api/status` shows current state, `/api/events` streams new events as they happen

### Acceptance Criteria

- [x] `GET /api/ports` returns valid HTML with `<datalist>` elements for every connected MIDI port
- [x] `GET /api/status` returns valid HTML with status, transport, and per-port indicators
- [x] `GET /api/events` keeps a long-lived connection open and emits the history on connect, then streams new events as they happen
- [x] Unit tests cover handler output shape (assert key elements exist in the fragment)
- [x] SSE handler closes cleanly when the client disconnects (no zombie subscribers — `BroadcastStream` drop unsubscribes automatically)

### Phase 6c — Static asset embedding + base layout

**Deliverable:** The bridge serves the HTML shell, vendored htmx, and self-hosted fonts. The page renders the structural scaffold (header, transport readout, routing matrix, configuration, event stream containers) — no styling beyond bare HTML defaults yet.

- [ ] Configure `rust-embed` rooted at `services/midi-macro-bridge/web/`
- [ ] Vendor `htmx.min.js` (htmx 1.9.x), `htmx-sse.js` (SSE extension), `geist-mono.woff2`, `departure-mono.woff2` into `web/fonts/` and `web/`
- [ ] Add `web::handlers::static_asset` returning the embedded asset with the correct `Content-Type` (font/woff2, text/javascript, etc.)
- [ ] Author `web/index.html`: HTML5 shell, font-face declarations, htmx + htmx-sse `<script>` tags, structural sections for the header strip, transport readout, routing matrix (sources → bridge → destinations), configuration accordion, and event stream container; htmx attributes for the initial `/api/status` and `/api/ports` swaps
- [ ] Verify: navigating to `http://127.0.0.1:8765` loads the shell, fonts render, htmx fires the initial swap, the page populates with the (unstyled) port list and status fragment

### Acceptance Criteria

- [ ] `GET /` returns `index.html` with a `Content-Type: text/html` and 200 status
- [ ] `GET /static/htmx.min.js` etc. return the vendored assets with correct content types
- [ ] Fonts load from `/static/fonts/*.woff2` (visible in browser DevTools network tab)
- [ ] htmx successfully swaps `/api/ports` and `/api/status` fragments into the initial page on load (verify via DOM inspection)

### Phase 6d — Stylesheet (studio rack aesthetic)

**Deliverable:** The page now looks like a piece of rack-mount studio gear per [`web-ui-design.md`](web-ui-design.md): brushed-metal panels, screenprint typography, peak-meter LEDs, the routing matrix with signal-flow lines, scanline display readouts, film-grain background. Functionality unchanged from 6c.

- [ ] Author `web/app.css` implementing every spec from `web-ui-design.md`: full palette as CSS variables, panel chrome (gradient, hairlines, screenprint labels), Departure Mono on the transport readout + bar number with scanline overlay, Geist Mono everywhere else, LED component (off / green / amber / red + glow + pulse), SVG signal-flow lines in the routing matrix, film-grain noise on the background, density and rhythm per the design doc (4px base unit, 960px max width)
- [ ] Verify visual fidelity against the wireframe in `web-ui-design.md`: header strip, transport readout proportions, routing matrix layout (sources → bridge → destinations with connector lines), configuration accordion chrome, event stream styling
- [ ] Manual visual inspection: load the page, confirm all four LED states render correctly with appropriate glow, panels have the gradient + hairline treatment, fonts load and render with correct weights

### Acceptance Criteria

- [ ] CSS file is self-contained (no external dependencies, no `@import` to remote fonts)
- [ ] All four LED states (off / green / amber / red) are visually distinct and readable
- [ ] The page looks unmistakably like equipment, not a generic admin dashboard (subjective but clear at a glance)
- [ ] Browser DevTools shows no missing assets, no font-loading errors, no console warnings on a fresh page load
- [ ] Page gracefully fits a typical 1280×800 laptop viewport without horizontal scrolling

### Phase 6e — Configuration form + APPLY

**Deliverable:** The user can pick MIDI ports from dropdowns, toggle device enables, edit the LCXL3 host name, choose the backend mode, and apply changes in-process. The reconnecting state animation fires during the ~100ms reload window.

- [ ] Server-render the configuration accordion (MC-500 / LCXL3 / Backend panels) from the current `Config` snapshot. Each device panel includes its enable toggle, port dropdowns (pre-selected with currently-configured values, populated from `/api/ports`), and any device-specific fields (LCXL3 host name, Keystrokes nudge size)
- [ ] Form-dirty tracking: any change to the form marks APPLY active (warm-accent pulse on the button)
- [ ] Backend mode segmented control: `MCU` / `KEYSTROKES`. Selecting `KEYSTROKES` expands the panel to reveal the nudge-size input; selecting `MCU` collapses it
- [ ] Add `web::handlers::config_post`: parses the form into a `Config`, validates it (`toml`'s deserialiser into the existing `Config` struct), writes the new TOML atomically (`Config::write_atomic`), emits `Cmd::Reload(config)` on the channel
- [ ] On the client side, the APPLY button posts via htmx; while the request is in flight, swap in a "RECONNECTING…" state for the routing matrix (dim to 40%, all port LEDs flicker amber, bar readout shows `----`)
- [ ] On success: matrix snaps back to live state via the `/api/status` swap; success pulse on the master LED
- [ ] On failure (port couldn't open, invalid TOML): red flash on master LED + an error toast describing the reason
- [ ] Verify: change the LCXL3 host name in the UI, click APPLY, confirm the device's LCD updates without restarting the bridge

### Acceptance Criteria

- [ ] Form roundtrips correctly: load page → modify field → apply → reload page → modified value persists
- [ ] `POST /api/config` writes `config.toml` atomically (interrupting between write-tmp and rename leaves the original file intact)
- [ ] Invalid configs (unknown port name, malformed TOML) are rejected with a 400 + readable error fragment, no `Cmd::Reload` fired
- [ ] In-process reload completes within 250ms (target ~100ms; allow margin)
- [ ] Form-dirty pulse activates when fields change, deactivates after successful apply
- [ ] Unit tests cover form parsing, atomic-write behaviour, and validation rejection paths

### Phase 6f — Event stream UI

**Deliverable:** The bottom-of-page event stream renders incoming SSE events as tape-printer log lines with source-tagged chips, supports pause-on-hover, and ring-buffers to the last 200 lines client-side.

- [ ] Wire `htmx-sse` to subscribe the event-stream container to `/api/events`; new events append as `<div>` elements
- [ ] Server pre-renders each `EventLine` as a fragment: timestamp, source-chip (MC-500 / LCXL3 / MCU OUT / BRIDGE with subtle colour fill), event description text
- [ ] Client-side ring-buffer at 200 lines: when a new line arrives, remove the oldest if the buffer is full
- [ ] Auto-scroll to bottom on new event; pause auto-scroll while the user hovers the stream container; show a subtle "PAUSE" indicator dot when paused
- [ ] Subtle scroll-into-view animation (140ms ease-out) on each new line so movement is intentional, not distracting
- [ ] Verify: trigger MC-500 transport and LCXL3 encoder events; confirm both appear in the stream within one event-loop tick

### Acceptance Criteria

- [ ] Every `Machine::handle()` event emitted by the MIDI loop appears in the browser's event stream within ~50ms
- [ ] Source-tag chips visually distinguish the four event sources at a glance
- [ ] Hover the stream → auto-scroll pauses immediately, "PAUSE" indicator visible
- [ ] Ring buffer caps at 200 lines (verify by triggering > 200 events; oldest are removed cleanly)
- [ ] SSE reconnects gracefully after a transient network blip (browser handles this; verify connection state recovers)

### Phase 6g — HALT button + master LED

**Deliverable:** The header HALT button takes a 3-second hold to confirm and exits the bridge cleanly when held. The master LED in the header rolls up the bridge's overall health state with a tooltip explaining any non-green state.

- [ ] Add `web::handlers::halt` that emits `Cmd::Halt` on the channel; the MIDI loop performs `std::process::exit(2)` (handler does NOT exit directly)
- [ ] HALT button HTML: a circular button in red-LED treatment with a progress ring SVG that fills during the hold
- [ ] Vanilla JS `app.js`: `mousedown` starts a 3-second timer, animates the progress ring; `mouseup` before completion cancels (no action); after 3s, the JS posts to `/api/halt` and the bridge exits
- [ ] Master LED component: reads `bridge_state` from the status snapshot, renders green / amber / red. Hover reveals a tooltip listing specific reason for amber/red (e.g., "MC-500 input port disconnected", "MCU heartbeat stale (8s ago)", "panic state")
- [ ] Status logic: green = all enabled inputs connected, MCU output flowing, heartbeat within 5s; amber = any disconnect or stale heartbeat; red = panic state pending
- [ ] Verify: hold HALT for 3s → bridge exits; click and release before 3s → nothing happens; disconnect a configured port → master LED goes amber → reconnect → green within 2s

### Acceptance Criteria

- [ ] Click-without-hold on HALT does nothing (no `Cmd::Halt` emitted, no exit)
- [ ] 3-second hold animates progress ring then exits the process with code 2
- [ ] Master LED reflects the rolled-up health state correctly across all states
- [ ] Tooltip on amber/red is accurate and actionable
- [ ] Unit tests cover the halt handler (emits `Cmd::Halt`, never directly calls exit)

### Phase 6h — Auto-open browser + first-run polish

**Deliverable:** Launching the bridge auto-opens the browser to the UI on macOS. URL is recorded for follow-on tooling. First-run experience handles the no-MIDI-ports case gracefully.

- [ ] After the listener binds, on macOS run `std::process::Command::new("open").arg(url).spawn()` to launch the default browser
- [ ] Add a `--no-open` CLI flag that suppresses the auto-open (useful when running under launchd, where browser-launching from a daemon would be wrong)
- [ ] Write the chosen URL to `~/Library/Application Support/MidiMacroBridge/url.txt` after the listener binds (create the directory if needed); existing tooling and a future menu-bar app can read this
- [ ] First-run UX: if no MIDI ports are configured (fresh install with empty config), the UI shows an explicit "no devices configured yet" empty state in the routing matrix instead of empty silhouettes; configuration panels are pre-expanded so the user lands on the picker
- [ ] Add a `[web]` config section: `enabled` (default true), `bind_port` (default 8765), `auto_open_browser` (default true)
- [ ] Document the new config section in `config.example.toml`

### Acceptance Criteria

- [ ] First `cargo run` on a machine without `config.toml` opens the browser to the bridge URL within 1s
- [ ] `--no-open` skips the browser launch but still binds the server
- [ ] `url.txt` exists at the documented path with the correct URL after startup
- [ ] First-run empty state is obviously friendlier than a generic "no data" placeholder
- [ ] Setting `[web] enabled = false` in config disables the HTTP server entirely (CLI-only mode preserved)

### Phase 6i — Hardware validation

**Deliverable:** End-to-end fresh-machine flow verified on hardware. The user starts the bridge with no config, configures it through the browser, applies, and MC-500 + LCXL3 + LUNA all work — without ever opening a terminal again after the initial launch.

- [ ] Fresh-config flow: delete `config.toml`, run the bridge, confirm browser auto-opens, no ports configured, master LED amber. Pick MC-500 input + MCU output via the UI → APPLY → reconnecting animation → green LEDs → MC-500 Play drives LUNA Play
- [ ] Add LCXL3 picker (input + output ports, enable toggle, host name "Bridge") → APPLY → LCXL3 enters DAW mode (transport buttons illuminate) → encoder ticks LUNA's playhead
- [ ] Live event stream verified: every transport event from MC-500 and LCXL3 appears in the stream with the right source tag and within ~50ms
- [ ] Disconnect a configured MIDI device's USB cable → master LED goes amber within 2s → reconnect → returns to green within 2s. Per-port LED in the routing matrix follows the same transitions
- [ ] HALT (hold 3s) → bridge exits cleanly. (Re-launch is manual; launchd integration is a separate feature.)
- [ ] Re-test the existing Phase 4 + Phase 5 hardware flows with the web UI active to confirm no regression: closed-loop locate, sync-on-stop, LCXL3 LED follower, dual-input simultaneous operation

### Acceptance Criteria

- [ ] User can complete the full setup (MC-500 → bridge → LUNA + LCXL3) end-to-end via the browser without touching `config.toml` or a terminal
- [ ] Live event stream confirms every transport event from both input devices
- [ ] In-process reload completes cleanly across a port-name change without dropping LUNA's MCU surface association
- [ ] Existing Phase 1-5 acceptance criteria all still pass on hardware
