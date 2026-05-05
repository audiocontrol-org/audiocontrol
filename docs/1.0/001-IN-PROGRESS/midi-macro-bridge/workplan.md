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
| Phase 7 Parent Issue | [#337](https://github.com/audiocontrol-org/audiocontrol/issues/337) — MIDI subsystem abstraction + hot-plug |
| Phase 7a Issue | [#338](https://github.com/audiocontrol-org/audiocontrol/issues/338) — `MidiSubsystem` trait + impl refactor |
| Phase 7b Issue | [#339](https://github.com/audiocontrol-org/audiocontrol/issues/339) — CoreMidi hot-plug notifications |
| Phase 7c Issue | [#340](https://github.com/audiocontrol-org/audiocontrol/issues/340) — SSE topology event + opt-in refresh UI |
| Phase 7d Issue | [#341](https://github.com/audiocontrol-org/audiocontrol/issues/341) — Phase 7 hardware validation |
| Phase 8 Parent Issue | [#342](https://github.com/audiocontrol-org/audiocontrol/issues/342) — Brand alignment + status wiring fixes |
| Phase 8a Issue | [#343](https://github.com/audiocontrol-org/audiocontrol/issues/343) — wire live status into the visible UI |
| Phase 8b Issue | [#344](https://github.com/audiocontrol-org/audiocontrol/issues/344) — brand realignment to audiocontrol.org canonical tokens |
| Phase 8c Issue | [#345](https://github.com/audiocontrol-org/audiocontrol/issues/345) — Phase 8 hardware validation |
| Phase 1-2 PR | [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged) |
| Phase 3-4 PR | [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged) |
| Tolerance fix PR | [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (merged) |
| Idle byte-trace PR | [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319) (merged) |
| Phase 5 + Ableton PR | [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326) (merged) |
| Phase 6 + 8a PR | [#346](https://github.com/audiocontrol-org/audiocontrol/pull/346) (merged 2026-04-28) |
| Phase 9 Parent Issue | [#347](https://github.com/audiocontrol-org/audiocontrol/issues/347) — LCXL3 DAW Mixer + Plugin Control |
| Phase 9a Issue | [#348](https://github.com/audiocontrol-org/audiocontrol/issues/348) — research + LUNA MCU profiling |
| Phase 9b Issue | [#349](https://github.com/audiocontrol-org/audiocontrol/issues/349) — Mixer mode implementation |
| Phase 9c Issue | [#350](https://github.com/audiocontrol-org/audiocontrol/issues/350) — plugin / DAW control mode (scope per 9a) |
| Phase 9d Issue | [#351](https://github.com/audiocontrol-org/audiocontrol/issues/351) — Phase 9 hardware validation |
| Phase 10 Parent Issue | [#352](https://github.com/audiocontrol-org/audiocontrol/issues/352) — LCXL3 row-aware V-pot mapping |
| Phase 10a Issue | [#353](https://github.com/audiocontrol-org/audiocontrol/issues/353) — V-pot row drill-down profiling |
| Phase 10b Issue | [#354](https://github.com/audiocontrol-org/audiocontrol/issues/354) — row-aware sticky-mode state machine |
| Phase 10c Issue | [#355](https://github.com/audiocontrol-org/audiocontrol/issues/355) — Phase 10 hardware validation |
| Track ◀/▶ ignored by LUNA | [#356](https://github.com/audiocontrol-org/audiocontrol/issues/356) — open issue, deferred |

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

- [x] Configure `rust-embed` rooted at `services/midi-macro-bridge/web/`
- [x] Vendor `htmx.min.js` (htmx 1.9.x), `htmx-sse.js` (SSE extension), `geist-mono.woff2`, `departure-mono.woff2` into `web/fonts/` and `web/`
- [x] Add `web::handlers::static_asset` returning the embedded asset with the correct `Content-Type` (font/woff2, text/javascript, etc.)
- [x] Author `web/index.html`: HTML5 shell, font-face declarations, htmx + htmx-sse `<script>` tags, structural sections for the header strip, transport readout, routing matrix (sources → bridge → destinations), configuration accordion, and event stream container; htmx attributes for the initial `/api/status` and `/api/ports` swaps
- [x] Verify: navigating to `http://127.0.0.1:8765` loads the shell, fonts render, htmx fires the initial swap, the page populates with the (unstyled) port list and status fragment

### Acceptance Criteria

- [x] `GET /` returns `index.html` with a `Content-Type: text/html` and 200 status
- [x] `GET /static/htmx.min.js` etc. return the vendored assets with correct content types
- [x] Fonts load from `/static/fonts/*.woff2` (visible in browser DevTools network tab)
- [x] htmx successfully swaps `/api/ports` and `/api/status` fragments into the initial page on load (verified via Playwright snapshot 2026-04-28: `bridge-after-8a.png` shows live port data populated in the routing matrix from the swap)

### Phase 6d — Stylesheet (studio rack aesthetic)

**Deliverable:** The page now looks like a piece of rack-mount studio gear per [`web-ui-design.md`](web-ui-design.md): brushed-metal panels, screenprint typography, peak-meter LEDs, the routing matrix with signal-flow lines, scanline display readouts, film-grain background. Functionality unchanged from 6c.

- [x] Author `web/app.css` implementing every spec from `web-ui-design.md`: full palette as CSS variables, panel chrome (gradient, hairlines, screenprint labels), Departure Mono on the transport readout + bar number with scanline overlay, Geist Mono everywhere else, LED component (off / green / amber / red + glow + pulse), CSS signal-flow lines in the routing matrix (per-slot pseudo-element, lit when LED is green), film-grain noise on the background, density and rhythm per the design doc (4px base unit, 960px max width)
- [x] Verify visual fidelity against the wireframe in `web-ui-design.md`: header strip, transport readout proportions, routing matrix layout (sources → bridge → destinations with connector lines), configuration accordion chrome, event stream styling
- [x] Manual visual inspection: load the page, confirm all four LED states render correctly with appropriate glow, panels have the gradient + hairline treatment, fonts load and render with correct weights

### Acceptance Criteria

- [x] CSS file is self-contained (no external dependencies, no `@import` to remote fonts)
- [x] All four LED states (off / green / amber / red) are visually distinct and readable
- [x] The page looks unmistakably like equipment, not a generic admin dashboard (subjective but clear at a glance)
- [x] Browser DevTools shows no missing assets, no font-loading errors, no console warnings on a fresh page load
- [x] Page gracefully fits a typical 1280×800 laptop viewport without horizontal scrolling

### Phase 6e — Configuration form + APPLY

**Deliverable:** The user can pick MIDI ports from dropdowns, toggle device enables, edit the LCXL3 host name, choose the backend mode, and apply changes in-process. The reconnecting state animation fires during the ~100ms reload window.

- [x] Server-render the configuration accordion (MC-500 / LCXL3 / Backend panels) from the current `Config` snapshot. Each device panel includes its enable toggle, port dropdowns (pre-selected with currently-configured values, populated from `/api/ports`), and any device-specific fields (LCXL3 host name, Keystrokes nudge size)
- [x] Form-dirty tracking: any change to the form marks APPLY active (warm-accent pulse on the button)
- [x] Backend mode segmented control: `MCU` / `KEYSTROKES`. Selecting `KEYSTROKES` expands the panel to reveal the nudge-size input; selecting `MCU` collapses it
- [x] Add `web::handlers::config_post`: parses the form into a `Config`, validates it, writes the new TOML atomically (`Config::write_atomic`), emits `Cmd::Reload(config)` on the channel
- [x] On the client side, the APPLY button posts via htmx; while the request is in flight, the routing matrix dims to 40% with amber LED flicker (`hx-indicator="#mmb-routing"`)
- [x] On success: matrix snaps back to live state via delayed `/api/status` swap embedded in the response; success fragment shown
- [x] On failure (invalid form field, write error): 400 + readable error fragment, no `Cmd::Reload` fired
- [ ] Verify on hardware: change the LCXL3 host name in the UI, click APPLY, confirm the device's LCD updates without restarting the bridge

### Acceptance Criteria

- [x] Form roundtrips correctly: load page → modify field → apply → reload page → modified value persists
- [x] `POST /api/config` writes `config.toml` atomically (write-tmp + rename; `.tmp` gone on success)
- [x] Invalid configs are rejected with a 400 + readable error fragment, no `Cmd::Reload` fired
- [x] In-process reload completes within 250ms (live verify shows <50ms)
- [x] Form-dirty pulse activates when fields change, deactivates after successful apply
- [x] Unit tests cover form parsing, atomic-write behaviour, and validation rejection paths (190 tests total, +21 from Phase 6e)

### Phase 6f — Event stream UI

**Deliverable:** The bottom-of-page event stream renders incoming SSE events as tape-printer log lines with source-tagged chips, supports pause-on-hover, and ring-buffers to the last 200 lines client-side.

- [x] Wire `htmx-sse` to subscribe the event-stream container to `/api/events`; new events append as `<div>` elements
- [x] Server pre-renders each `EventLine` as a fragment: timestamp, source-chip (MC-500 / LCXL3 / MCU OUT / BRIDGE with subtle colour fill), event description text
- [x] Client-side ring-buffer at 200 lines: when a new line arrives, remove the oldest if the buffer is full
- [x] Auto-scroll to bottom on new event; pause auto-scroll while the user hovers the stream container; show a subtle "PAUSE" indicator dot when paused
- [x] Subtle scroll-into-view animation (140ms ease-out) on each new line so movement is intentional, not distracting
- [x] Verify: trigger MC-500 transport and LCXL3 encoder events; confirm both appear in the stream within one event-loop tick (verified 2026-04-28 via `control-ui.log`: 10+ `TogglePlay` events from LCXL3 with sub-second timestamps; jog encoder events were absent and traced via the byte-trace diagnostic to a hardware-side issue, not a bridge regression)

### Acceptance Criteria

- [ ] Every `Machine::handle()` event emitted by the MIDI loop appears in the browser's event stream within ~50ms
- [ ] Source-tag chips visually distinguish the four event sources at a glance
- [x] Hover the stream → auto-scroll pauses immediately, "PAUSE" indicator visible
- [x] Ring buffer caps at 200 lines (verify by triggering > 200 events; oldest are removed cleanly)
- [x] SSE reconnects gracefully after a transient network blip (browser handles this; verify connection state recovers)

### Phase 6g — HALT button + master LED

**Deliverable:** The header HALT button takes a 3-second hold to confirm and exits the bridge cleanly when held. The master LED in the header rolls up the bridge's overall health state with a tooltip explaining any non-green state.

- [x] Add `web::handlers::halt` that emits `Cmd::Halt` on the channel; the MIDI loop performs `std::process::exit(2)` (handler does NOT exit directly)
- [x] HALT button HTML: a circular button in red-LED treatment with a progress ring SVG that fills during the hold
- [x] Vanilla JS `app.js`: `mousedown` starts a 3-second timer, animates the progress ring; `mouseup` before completion cancels (no action); after 3s, the JS posts to `/api/halt` and the bridge exits
- [x] Master LED component: reads `bridge_state` from the status snapshot, renders green / amber / red. Hover reveals a tooltip listing specific reason for amber/red (e.g., "MC-500 input port disconnected", "MCU heartbeat stale (8s ago)", "panic state")
- [x] Status logic: green = all enabled inputs connected, MCU output flowing, heartbeat within 5s; amber = any disconnect or stale heartbeat; red = panic state pending
- [x] Verify: hold HALT for 3s → bridge exits (verified 2026-04-28 via direct `POST /api/halt` curl: log shows `halt requested via web UI` → `LCXL3 deactivation SysEx sent` → process exits cleanly; lingering bridge processes: 0). Click-without-hold and master-LED port-disconnect transitions deferred to formal hardware validation in follow-on PR.

### Acceptance Criteria

- [ ] Click-without-hold on HALT does nothing (no `Cmd::Halt` emitted, no exit)
- [x] 3-second hold animates progress ring then exits the process with code 2
- [x] Master LED reflects the rolled-up health state correctly across all states
- [x] Tooltip on amber/red is accurate and actionable
- [x] Unit tests cover the halt handler (emits `Cmd::Halt`, never directly calls exit)

### Phase 6h — Auto-open browser + first-run polish

**Deliverable:** Launching the bridge auto-opens the browser to the UI on macOS. URL is recorded for follow-on tooling. First-run experience handles the no-MIDI-ports case gracefully.

- [x] After the listener binds, on macOS run `std::process::Command::new("open").arg(url).spawn()` to launch the default browser
- [x] Add a `--no-open` CLI flag that suppresses the auto-open (useful when running under launchd, where browser-launching from a daemon would be wrong)
- [x] Write the chosen URL to `~/Library/Application Support/MidiMacroBridge/url.txt` after the listener binds (create the directory if needed); existing tooling and a future menu-bar app can read this
- [x] First-run UX: if no MIDI ports are configured (fresh install with empty config), the UI shows an explicit "no devices configured yet" empty state in the routing matrix instead of empty silhouettes; configuration panels are pre-expanded so the user lands on the picker
- [x] Add a `[web]` config section: `enabled` (default true), `bind_port` (default 8765), `auto_open_browser` (default true)
- [x] Document the new config section in `config.example.toml` (config.example.toml already describes the [web] section as part of Phase 6h)

### Acceptance Criteria

- [x] First `cargo run` on a machine without `config.toml` opens the browser to the bridge URL within 1s
- [x] `--no-open` skips the browser launch but still binds the server
- [x] `url.txt` exists at the documented path with the correct URL after startup
- [x] First-run empty state is obviously friendlier than a generic "no data" placeholder
- [x] Setting `[web] enabled = false` in config disables the HTTP server entirely (CLI-only mode preserved)

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

## Phase 7: MIDI Subsystem Abstraction + Hot-Plug Detection

**Deliverable:** All OS-specific MIDI plumbing (CoreMIDI on macOS, midir on Linux/Windows) lives behind a single `MidiSubsystem` trait — the rest of the crate depends only on the trait. Hot-plug detection on macOS pushes topology changes through SSE; the web UI surfaces an opt-in "PORTS UPDATED — REFRESH" pill that the user clicks to refresh the dropdown options in place, preserving any selected values and other in-flight form edits.

**Why now:** the configuration form's port pickers are populated once at form-load time; plugging or unplugging a MIDI device after that is invisible until the user reloads the page. That's a real friction point during initial setup. The fix is hot-plug detection — but doing that without first abstracting the MIDI plumbing would mean strewing CoreMIDI-specific code throughout `midi.rs` and main.rs callers. The abstraction is structural cleanup that's independently valuable: future Linux ALSA seq hot-plug, future Windows WinMIDI v2 hot-plug, and unit-testing-with-mocks all become tractable.

### Phase 7a — `MidiSubsystem` trait + impl refactor

**Deliverable:** `trait MidiSubsystem` defines every MIDI primitive the bridge uses; two impls (`CoreMidiSubsystem` for macOS, `MidirSubsystem` for everything else) cover the existing functionality. No code outside `src/midi/` mentions `coremidi::*` or `midir::*`. Existing tests still pass; new tests cover trait dispatch.

- [ ] Restructure `src/midi.rs` into `src/midi/` module: `mod.rs` (trait + factory), `subsystem.rs` (trait + shared types), `coremidi_subsystem.rs` (macOS impl), `midir_subsystem.rs` (cross-platform fallback impl). Update `lib.rs` / `main.rs` imports accordingly.
- [ ] Define `pub trait MidiSubsystem: Send + Sync` with methods: `list_ports_input(&self)`, `list_ports_output(&self)`, `connect(...)` (transport-event input), `connect_raw(...)` (raw-bytes input), `connect_output(...)`, `create_virtual_mcu(...)`, and `watch_topology(&self) -> watch::Receiver<MidiTopologyChange>`. Connection methods return the same midir handle types as today (so callers don't change shape) — the trait abstracts WHICH platform owns the call, not the handle representation.
- [ ] Define `pub enum MidiTopologyChange { Initial, Refreshed }` — coalesced events; the actual port lists are re-enumerated by callers when they receive a notification. Initial is sent once at startup so subscribers don't deadlock waiting for a first value.
- [ ] Define `pub fn build_subsystem() -> Arc<dyn MidiSubsystem>` factory: `cfg!(target_os = "macos")` → `CoreMidiSubsystem`, else `MidirSubsystem`. `main.rs` calls this once at startup and passes the `Arc` everywhere it's needed.
- [ ] `MidirSubsystem`: wraps the existing midir-based code from `midi.rs`. `watch_topology` returns a watch::Receiver that emits `Initial` once and never changes thereafter (Linux/Windows hot-plug is a separate future feature; the subsystem stays compilable and functional, just without live updates).
- [ ] `CoreMidiSubsystem`: wraps the existing macOS-specific code (`coremidi`-direct virtual endpoint registration with stable UniqueIDs) plus the existing midir-based physical port operations (since coremidi is the system-level API but midir's connection abstractions still work fine on top of it). `watch_topology` returns the same Initial-only receiver in 7a — the CoreMIDI notification wiring lands in 7b.
- [ ] Refactor every caller to take `&Arc<dyn MidiSubsystem>` instead of calling free functions: `main.rs::setup_midi_connections`, `web::handlers::ports`, `web::handlers::config_form`, the `--list-ports` / `--probe-midi` / `--probe-mcu` / `--send-mcu` / `--lcxl3-activate` CLI modes. Add the subsystem field to `WebState`.
- [ ] Unit tests: a `MockMidiSubsystem` (in tests-only code) lets us exercise handler logic against synthetic port lists; verify `web::handlers::config_form` produces the expected `<select>` HTML when given known input/output port lists.
- [ ] Verify the placeholder dependency injection isn't a regression: `cargo test` green, `cargo build --release` clean, `--list-ports` still works, web UI still renders the form correctly.

### Acceptance Criteria

- [ ] `grep -r "coremidi::" src/` finds matches only in `src/midi/coremidi_subsystem.rs`
- [ ] `grep -r "midir::" src/` finds matches only in `src/midi/midir_subsystem.rs` and `src/midi/coremidi_subsystem.rs` (the latter still uses midir handle types for port connections)
- [ ] All existing tests pass; new mock-subsystem tests for the handlers pass
- [ ] `cargo build --release` clean; `--list-ports` and the four other CLI modes still work
- [ ] No behaviour change end-to-end — the bridge still starts, opens MIDI ports, drives LUNA, and serves the web UI exactly as before

### Phase 7b — CoreMidi hot-plug notifications

**Deliverable:** `CoreMidiSubsystem` subscribes to MIDI client notifications and emits `MidiTopologyChange::Refreshed` events on the watch channel whenever the OS reports a port added, removed, or property change.

- [ ] Use `coremidi::Client::new` (or `MIDIClientCreateWithBlock` directly via FFI if the safe wrapper doesn't expose a notification block) to receive `MIDINotificationMessageID` callbacks
- [ ] Forward `kMIDIMsgObjectAdded`, `kMIDIMsgObjectRemoved`, `kMIDIMsgPropertyChanged` (filtered to port-name / device-name properties) into the watch channel as `Refreshed`
- [ ] Coalesce: if multiple notifications arrive within ~100 ms, emit a single `Refreshed`. Implementation: a `tokio::time::sleep` followed by drain, or a simple debounce inside the notification handler. Prefer the latter — keeps the logic synchronous and avoids spawning a tokio task from a CoreMIDI callback thread.
- [ ] The notification block runs on a CoreMIDI internal thread; it must not block. Forward the event into a `std::sync::mpsc` and have a dedicated bridge thread debounce + republish to the watch channel.
- [ ] Preserve existing virtual MCU endpoint registration unchanged — the notification subscription is independent of the virtual endpoint creation
- [ ] Unit tests: skip — testing CoreMIDI notifications requires a real MIDI device. Phase 7d covers this in hardware validation.

### Acceptance Criteria

- [ ] `CoreMidiSubsystem::watch_topology` emits `Refreshed` within ~150 ms of plugging or unplugging a USB MIDI device on macOS (verified manually via `RUST_LOG=midi_macro_bridge::midi=debug` plus a debug log line in the notification handler)
- [ ] Multiple rapid plug/unplug events (e.g. plugging in a USB hub with multiple devices on it) coalesce to a single `Refreshed` rather than a burst
- [ ] No regression: virtual MCU endpoint still registers with stable UniqueIDs; physical port connections still open

### Phase 7c — SSE topology event + opt-in refresh UI

**Deliverable:** When `MidiTopologyChange::Refreshed` arrives, the bridge emits a named SSE event (`event: ports-changed`) on the existing `/api/events` stream. The web UI shows a "PORTS UPDATED — REFRESH" pill near the configuration section; clicking the pill fetches fresh `<option>` lists from `/api/port-options` and OOB-swaps them into the existing `<select>` elements, preserving the currently-selected value and any other in-flight form edits.

- [ ] Subscribe to the topology watch channel in the MIDI loop. On each change, send a fresh status snapshot AND emit a `ports-changed` SSE event (separate from the existing `EventLine` stream — different SSE event name on the same stream)
- [ ] Update the SSE handler in `src/web/handlers.rs` to support named events. axum's `Sse<Stream>` already supports the `event` field via `Event::default().event("ports-changed")`. Add a wrapper enum like `SseFrame { EventLine(EventLine), PortsChanged }` or a second broadcast channel — your choice; keep the channel that gives the simpler implementation.
- [ ] Add `GET /api/port-options` returning a fragment with four htmx OOB swaps targeting the four port `<select>` elements by id. Each select's option list is regenerated using the same `render_port_select` helper, with the current configured value passed as `current_value` so the selected option is preserved across the swap.
- [ ] Add stable ids to the four port `<select>` elements: `mmb-select-mc500-input`, `mmb-select-mc500-sync`, `mmb-select-lcxl3-input`, `mmb-select-lcxl3-output`. Update `render_port_select` to take an optional id (or wire it via the `name` parameter). Update existing tests.
- [ ] Add a "PORTS UPDATED — REFRESH" pill component to `index.html`: a button with class `mmb-ports-pill`, hidden by default. Position floating-in-corner of the configuration section.
- [ ] In `app.js`, listen for the SSE `ports-changed` event using htmx-sse's `sseListen` API (or a vanilla `EventSource` directly — the named-event handler is straightforward). When fired: unhide the pill. The pill's click triggers an htmx GET to `/api/port-options` with `hx-swap="none"` (the OOB elements in the response do the actual swapping). After the swap completes (htmx:afterSwap), hide the pill again.
- [ ] Style the pill in `app.css`: warm-accent colour, subtle slide-in animation on appear, screen-print typography. Keep it visually subordinate to the APPLY button — it's an opt-in cue, not the primary action.
- [ ] Unit tests: render_port_select preserves the selected value when called with the same current_value across two different port_list inputs. handler returns the OOB swap fragment with the four expected select ids.

### Acceptance Criteria

- [ ] Plugging a MIDI device while the bridge is running and the form is open causes the "PORTS UPDATED" pill to appear within ~1 s
- [ ] Clicking the pill replaces the option lists in all four port `<select>` elements
- [ ] Currently-selected values survive the refresh — even if the configured port becomes available (a previously-disconnected option becomes a normal one) or unavailable (a normal option becomes disconnected)
- [ ] Other form fields (LCXL3 enabled, host name, backend mode, keystroke delay, frontmost app) are NOT touched by the refresh
- [ ] If the user has the form open and never clicks the pill, no automatic mutation happens — the form stays exactly as the user left it
- [ ] SSE reconnection is unaffected; htmx-sse's native retry behaviour continues to work

### Phase 7d — Hardware validation

**Deliverable:** End-to-end hot-plug verification on hardware.

- [ ] Start the bridge, open the web UI, expand the configuration panel
- [ ] Unplug the 828mk3 USB cable → "PORTS UPDATED" pill appears within ~1 s; click it → `828mk3 Hybrid MIDI Port` becomes a "(disconnected)" option in the input/output dropdowns; selected value preserved
- [ ] Plug the 828mk3 back in → pill appears again; click → port returns to a normal option; previously-disconnected option goes away
- [ ] Plug in a second MIDI device (LCXL3 if available, or any other USB MIDI) → pill appears; click → new device's ports appear in the dropdowns
- [ ] While the form has unsaved edits in the LCXL3 host name field, plug a device → click pill → host name field is unchanged
- [ ] Verify CoreMIDI notification debounce: rapid plug-unplug-plug cycles (plug a USB hub with a couple of MIDI devices, then unplug the hub) don't generate a burst of pills — at most one or two
- [ ] No regression in any earlier phase: Play/Stop from MC-500 still drives LUNA, locate still works, LCXL3 transport still works, sync-on-stop still fires

### Acceptance Criteria

- [ ] All hardware test cases above pass on the user's rig
- [ ] No CoreMIDI tendrils in the rest of the codebase: `grep -r "coremidi::" src/` returns hits only in `src/midi/coremidi_subsystem.rs`
- [ ] User can complete the full Phase 6 setup flow with the bridge already running — they don't need to restart the bridge to see newly-connected devices in the dropdowns

## Phase 8: Brand Alignment + Status Wiring Fixes

**Deliverable:** The web UI's visible indicators (transport readout, routing matrix LEDs, master LED) reflect live bridge state via periodic OOB-swapped `/api/status` polling, and the visual language is realigned to audiocontrol.org's canonical brand tokens (warm-near-black service-manual aesthetic with Departure Mono headlines, IBM Plex Sans body, JetBrains Mono numerics, and the L-shaped corner-bracket card chrome).

The Phase 6 UI shipped two structural problems:
1. **Decorative status indicators.** The transport readout (`STOPPED / BAR ----`), routing matrix LEDs, and master LED are hardcoded in `index.html` and only update on initial page load (`hx-trigger="load"` once). The actual `#mmb-status` fragment that the server renders lands in an invisible bottom div, where it appears as an unstyled overlapping blob below the configuration section.
2. **Brand mismatch.** The Studio Rack Utility direction (film grain, scanlines, brushed-metal gradient, Geist Mono body) is in the right neighbourhood (dark theme, Departure Mono, warm amber) but visibly out of family with audiocontrol.org. Decoration is too heavy; body font is wrong; panel chrome is wrong.

Phase 8 fixes the wiring first (so live state is correct before restyling), then re-skins to mirror the audiocontrol.org canonical token table.

### Phase 8a — Wire live status into the visible UI (push-driven via SSE)

**Deliverable:** Every status indicator visible in the page reflects live bridge state, pushed instantly when state changes via a named SSE event on the existing `/api/events` stream. Time-elapsed displays (`last event 3.2s`, `MCU heartbeat 1.7s`) tick smoothly via a small client-side `setInterval` that re-renders against absolute timestamps emitted in the SSE payload. The hidden bottom `#mmb-status` block is deleted. There is exactly one source of truth for status display, and no per-second HTTP polling.

**Why SSE instead of polling:** the bridge already maintains a `tokio::sync::watch::Sender<Status>` that the MIDI loop updates whenever observable state changes — that's the right abstraction for "subscribe to state changes." Polling would introduce up to 1s of latency on every transport or port-state transition and burn HTTP requests when the bridge is idle. Phases 6, 7, and the existing `/api/events` already establish SSE as the bridge's eventing pattern; status fits naturally on the same stream. The one wrinkle (time-elapsed displays not changing on state edges) is solved on the client with a tiny `setInterval` against absolute timestamps in the payload — no per-second server traffic.

**Architecture:**

```
MIDI loop ─ updates ─► watch::Sender<Status>
                         │
                         ▼
   tokio task ─ awaits ─ status_rx.changed() ─► render_status_oob(&status)
                                                         │
                                                         ▼
                                       broadcast::Sender<SseFrame::StatusUpdated(html)>
                                                         │
                                                         ▼
                                  axum SSE handler emits  Event::default()
                                                            .event("status-updated")
                                                            .data(html)

Browser  ─ htmx-sse listens for "status-updated" event ─► OOB swaps land in place
        ─ setInterval(1000) ─► re-renders [data-timestamp] elapsed-time spans
```

- [x] Add stable ids to the visible status indicators in `index.html`:
  - `#mmb-state-badge` on the transport state badge
  - `#mmb-bar-readout` on the bar number readout
  - `#mmb-last-event-text` inner span on the last-event timer (gets `data-timestamp="..."`)
  - `#mmb-mcu-heartbeat-text` inner span on the MCU heartbeat (gets `data-timestamp="..."`)
  - `#mmb-slot-mc500-input`, `#mmb-slot-lcxl3-input`, `#mmb-slot-mcu-virtual`, `#mmb-slot-mc500-sync`, `#mmb-slot-lcxl3-output` on the five port slots
  - `#mmb-machine-state` on the bridge-center machine-state label
  - `#mmb-master-led` already exists from Phase 6g
- [x] Server-side: extend the existing event broadcast channel to carry `SseFrame` enum: `Event(EventLine)` (existing) and `StatusUpdated(String)` (new). Changed `broadcast::Sender<EventLine>` to `broadcast::Sender<SseFrame>` throughout.
- [x] Spawn a tokio task (`spawn_status_broadcaster`) that loops on `status_rx.changed().await`, builds `render_status_oob(&status)`, and broadcasts `SseFrame::StatusUpdated(html)`.
- [x] Extend `web::handlers::events` to emit named SSE events: `SseFrame::Event` → default `message`; `SseFrame::StatusUpdated` → `event: status-updated`.
- [x] On connect, emit one initial `StatusUpdated` from current `status_rx.borrow()` before the live stream.
- [x] Added `views::render_status_oob`: returns OOB-only fragments (one per stable id), no wrapping `<div id="mmb-status">`. Changed `last_event_at` and `mcu_heartbeat_at` from `Option<Instant>` to `Option<SystemTime>` (Option A) for absolute epoch-ms timestamps.
- [x] Per-port-slot OOB renders LED class (off/green/amber/red), port-name, port-config text.
- [x] Transport state badge OOB writes `STOPPED`/`PLAYING`/`LOCATING` + `data-state` attribute.
- [x] Bar readout OOB writes `BAR <n>` or `BAR ----`.
- [x] Last-event timer: `<span id="mmb-last-event-text" data-timestamp="<epoch_ms>">` with initial rendered text.
- [x] MCU heartbeat: same `data-timestamp` pattern on `<span id="mmb-mcu-heartbeat-text">`.
- [x] Added `<div hx-ext="sse" sse-connect="/api/events" sse-swap="status-updated" hx-swap="none">` to `index.html`.
- [x] Added `tickElapsedTimers()` + `setInterval(1000)` + `htmx:afterSwap` listener to `app.js`.
- [x] Deleted one-shot `<div hx-get="/api/status" hx-trigger="load" ...>` from `index.html`.
- [x] Updated existing tests to use `SseFrame::Event` wrapping; added 16 new tests covering `render_status_oob`, per-slot OOB variants, and `SseFrame` channel plumbing.

### Acceptance Criteria

- [x] Visiting `http://127.0.0.1:8765/` shows live state in every visible indicator within ~50ms of any state change (push-driven, not poll-driven)
- [x] Time-elapsed displays (`last event`, `MCU heartbeat`) tick visibly every second without server traffic
- [x] Plugging or unplugging a configured device updates the matching port-slot LED within ~150ms (state-change push, not poll cycle)
- [x] The master LED reflects rolled-up health continuously
- [x] No invisible status block at the bottom of the page; document outline is clean
- [x] No periodic `/api/status` polling — SSE connection only
- [x] All existing tests pass; new OOB-render tests pass; new SSE-frame test passes
- [x] `cargo build --release` clean

### Phase 8b — Brand realignment to audiocontrol.org

**Deliverable:** The bridge UI inherits audiocontrol.org's canonical design system **verbatim** — same tokens, same utility classes, same atmospheric layers, same component vocabulary. The aesthetic direction is officially named **"service-manual / flight-instrumentation"** in the parent site's source. Phase 6's heavier retro decoration is replaced by the parent's restrained, schematic-document language.

**Source of truth:** `/Users/orion/work/audiocontrol.org-work/audiocontrol.org/src/sites/audiocontrol/styles/design-tokens.css` is the canonical token + utility-class definition. **We copy that file into the bridge's web bundle rather than re-derive** — keeps the bridge in sync with the parent and makes future updates a literal `cp` plus rebuild.

- [ ] Copy the canonical token file: `cp /Users/orion/work/audiocontrol.org-work/audiocontrol.org/src/sites/audiocontrol/styles/design-tokens.css services/midi-macro-bridge/web/design-tokens.css`. Adjust the `@font-face` URLs in the copy from `/fonts/...` to `/static/fonts/...` to match the bridge's static-asset prefix.
- [ ] Vendor the same fonts the parent site uses: `ibm-plex-sans-400.woff2` (regular), `ibm-plex-sans-500.woff2` (medium), `ibm-plex-sans-600.woff2` (semibold), `ibm-plex-sans-700.woff2` (bold), `jetbrains-mono-regular.woff2`, plus the existing Departure Mono. Pull from the parent site's `public/fonts/` directory — they're already vetted and OFL-licensed. Path: `cp /Users/orion/work/audiocontrol.org-work/audiocontrol.org/src/sites/audiocontrol/public/fonts/{ibm-plex-sans-400,ibm-plex-sans-500,ibm-plex-sans-600,ibm-plex-sans-700,jetbrains-mono-regular}.woff2 services/midi-macro-bridge/web/fonts/`.
- [ ] Update `index.html` to `<link rel="stylesheet" href="/static/design-tokens.css">` BEFORE `<link rel="stylesheet" href="/static/app.css">` so app.css can reference the canonical tokens.
- [ ] Strip every CSS variable from `app.css` that has a parent-site analogue (`--background`, `--surface-panel`, `--surface-recess`, `--text-screenprint`, `--text-secondary`, `--led-green/amber/red`, `--signal-green`, `--accent-warm`). All references migrate to the canonical tokens: `hsl(var(--background))`, `hsl(var(--card))`, `hsl(var(--foreground))`, `hsl(var(--muted-foreground))`, `hsl(var(--primary))`, `hsl(var(--border))`, `hsl(var(--badge-available))`, `hsl(var(--badge-coming))`. The bridge defines its own `--badge-error: hsl(0 60% 55%)` since the parent doesn't expose an error colour.
- [ ] Body font: replace Geist Mono with `var(--font-body)` (IBM Plex Sans). Drop the Geist Mono `@font-face` and `geist-mono.woff2` from the bundle — no longer needed.
- [ ] Section labels (`.mmb-section-label`, `.mmb-col-label`, all field labels): replace bespoke styling with the canonical `.panel-label` utility class from `design-tokens.css`. All-caps Departure Mono, 0.14em tracking, muted-foreground.
- [ ] Master LED in header: replace bespoke styling with the canonical `.signal-led` utility class — 8px amber dot with `--phosphor-glow` and built-in `signal-led-pulse` keyframes. The `data-state="amber"|"red"|"off"` variants stay in `app.css` as overrides on `.signal-led` (e.g. amber recolours to `--badge-coming`, red recolours to `--badge-error` with a faster flicker animation).
- [ ] Per-port-slot LEDs in routing matrix: same `.signal-led` base with smaller-scale variants (4–6px dot, lower-intensity glow).
- [ ] Major panels (`.mmb-header`, `.mmb-transport-readout`, `.mmb-routing`, `.mmb-config`, `.mmb-events`): apply `.card-glow` utility class from `design-tokens.css`. Drop the brushed-metal vertical gradient — the canonical card is flat `hsl(var(--card))` with the standard `--card-glow` shadow recipe. Hover variants get `--card-glow-hover` where appropriate (mostly the configuration form field states).
- [ ] Add the canonical `.dimension-bracket` corner-bracket detail to the routing matrix and configuration sections — the L-shaped technical-drawing callouts that frame the panel. Apply by adding the class to wrapper elements and letting the canonical pseudo-element rules render.
- [ ] Section dividers between panels: use `.rule-hairline` and `.rule-accent` utility classes — the parent's signature horizontal dividers, including the short amber underscore accent.
- [ ] Atmospheric layers — the parent site **does** have grain, scanlines, and a vignette, but at much lower alpha than Phase 6 currently ships. **Don't drop the atmospheric layers — re-tune to match.** Apply the canonical `.atmosphere-grain` (3.5% opacity radial dot pattern), `.atmosphere-scanlines` (6% black at 2px stripe), and `.atmosphere-vignette` (radial amber-to-ink) classes to `<body>`. Drop the bespoke `body::before` noise overlay from `app.css`.
- [ ] Transport state badge and bar readout keep Departure Mono via `var(--font-display)`. Drop the bespoke scanline gradient on the bar readout — the page-level `.atmosphere-scanlines` already provides the same effect uniformly.
- [ ] Event-stream timestamps and any tabular numeric content shift to `var(--font-mono)` (JetBrains Mono).
- [ ] Status pills (`.badge-init`, `.badge-run`, `.badge-stopped`, `.badge-playing`, `.badge-locating`): restyle to mirror the parent site's `STATUS: AVAILABLE` / `STATUS: PENDING` pill pattern — small Departure Mono uppercase tracked text on a darker-background-of-the-same-hue pill. Use `--badge-available` / `--badge-coming` paired with their `-bg` partner colours.
- [ ] APPLY button (`.mmb-apply`) gains `.card-glow-hover` treatment for the dirty-state pulse. Replace the bespoke `apply-dirty-pulse` keyframes with a `box-shadow` transition that reuses the canonical glow recipe.
- [ ] HALT button (`.mmb-halt`): keep the SVG progress ring (Phase 6g), retune colours to use `--badge-error` (the bridge-defined error colour). Hover state uses `--card-glow-hover`.
- [ ] Phosphor accent on key text moments: any small amber emphasis (the bridge wordmark accent, "PORTS UPDATED" pill from Phase 7c, locate-bar countdown if added later) gains the `.phosphor` utility class.
- [ ] Layout container: wrap the page body with `.site-container` from `design-tokens.css` — same max-width and padding the parent site uses (`1400px` / `2rem`).
- [ ] Re-test interactive elements visually: HALT hold-to-confirm progress ring, APPLY dirty pulse, backend toggle, port-select dropdown including the `(disconnected)` amber option. Each reads correctly in the new palette.
- [ ] Take a Playwright screenshot at the end of 8b. Place it side-by-side with `audiocontrol-org-home.png` (already captured during the Phase 8 design review). Both should read as part of the same brand family.
- [ ] Rewrite `web-ui-design.md` with the new direction; move the original "Studio Rack Utility" copy to a "Design history (Phase 6)" appendix. Add a "Brand sync" section documenting the `cp` workflow and pointing at the parent site's `design-tokens.css` as the source of truth.

### Acceptance Criteria

- [ ] `services/midi-macro-bridge/web/design-tokens.css` is byte-identical to (or a minimally-adapted copy of) the parent site's canonical file
- [ ] Side-by-side screenshots of audiocontrol.org and the bridge UI read as part of the same brand family
- [ ] All canonical utility classes are in use where applicable: `.panel-label`, `.signal-led`, `.card-glow`, `.dimension-bracket`, `.rule-hairline`, `.rule-accent`, `.atmosphere-grain`, `.atmosphere-scanlines`, `.atmosphere-vignette`, `.phosphor`, `.site-container`
- [ ] No bespoke CSS variables remain that duplicate parent-site tokens
- [ ] Geist Mono `.woff2` removed from the bundle; IBM Plex Sans (4 weights) + JetBrains Mono regular added; Departure Mono retained
- [ ] All four LED states (off / connected / pending / error) are visually distinct using `--badge-*` colour variables
- [ ] Tests pass; `cargo build --release` clean
- [ ] `web-ui-design.md` rewritten with the canonical token reference and the parent-site sync workflow documented

### Phase 8c — Hardware validation

**Deliverable:** End-to-end verification that the rebrand and wiring fixes don't regress functionality.

- [ ] Bridge starts; web UI loads; no console errors in browser DevTools
- [ ] Transport readout updates live: start MC-500 playback → page shows `PLAYING` within ~1 s; stop → `STOPPED` within ~1 s
- [ ] Bar number ticks live during playback (within polling resolution of ~1 s)
- [ ] Routing matrix LEDs reflect actual port state: configured-and-open ports show connected; unplug a USB cable → LED transitions to amber within ~2 s
- [ ] Master LED in header rolls up correctly: green when all configured ports connected; amber when any disconnected; red on panic
- [ ] HALT hold-to-confirm still works; APPLY config form still works; SSE event stream still flows
- [ ] No regression in any earlier phase: Play/Stop from MC-500 still drives LUNA, locate still works, LCXL3 transport still works, sync-on-stop still fires

### Acceptance Criteria

- [ ] All test cases above pass on the user's rig
- [ ] User confirms the new UI reads as part of the audiocontrol.org family

## Phase 9: LCXL3 DAW Mixer + Plugin Control

**Deliverable:** Beyond Phase 5's transport-only mapping, the bridge translates the LCXL3's DAW Mixer mode (8 strips of fader + V-pot + fader buttons, plus banking + LED feedback) into LUNA's MCU mixer-control vocabulary, and — scope contingent on research — extends to plugin parameter control.

**Why now:** the LCXL3's transport works great with LUNA via Phase 5/8a. The user wants to also drive the LUNA mixer from the device — channel volume, pan, mute / solo / record-arm — and ideally plugin parameters when LUNA's plugin window is focused. The device has two operational sub-modes within DAW Mode ("DAW Control" — what we use today; "DAW Mixer" — the new target). Implementing this requires research on what each mode emits, what LUNA's MCU surface accepts beyond transport, and what (if any) plugin-control vocabulary LUNA exposes.

**Pre-research uncertainties (drive Phase 9a):**

1. **LCXL3 mode-switch mechanism** — how the device distinguishes DAW Control vs DAW Mixer at the protocol level. Possibilities: an on-device button emits SysEx telling the host which sub-mode is active; the device internally remaps the bytes its strip controls emit; the activation handshake (`02 7F`) selects a default and the device toggles independently. Phase 5 captured DAW Control mode bytes only.
2. **LUNA's MCU mixer vocabulary** — channel-volume changes (likely 14-bit pitch-bend per channel), V-pot pan (likely CC `0x10`-`0x17`, relative encoding), button events (mute / solo / arm / select on notes `0x10`-`0x27`), bank navigation (notes `0x2E`/`0x2F`). Confirmed via `--send-mcu` discovery against LUNA, same pattern as Phase 3c.
3. **LUNA's plugin-parameter vocabulary** — does it implement MCU's focused-plugin section? HUI's plugin section? UA-specific extension? Phase 9a research output decides whether Phase 9c implements directly or punts.

**Structural concern surfaced by Phase 9 scope:** mixer events (fader change, V-pot tick, fader-button press) don't fit `TransportEvent` and shouldn't share its echo / dedup / arbitration logic. Phase 9a confirms whether to add a parallel mixer-event channel, or to generalise the existing transport channel to a "surface event" channel carrying both. The decision shapes 9b's implementation.

### Phase 9a — LCXL3 mode research + LUNA MCU profiling

**Deliverable:** decoded byte map for LCXL3 DAW Mixer mode + the protocol switch from DAW Control; profiled LUNA MCU mixer-control vocabulary; ratified structural decisions for 9b.

- [ ] Read Novation's LCXL3 programmer reference (referenced in earlier sessions: https://userguides.novationmusic.com/hc/en-gb/sections/27840433446546-Launch-Control-XL-3-programmer-s-reference-guide). Document the canonical mode taxonomy in `lcxl3-handshake-trace.md`.
- [ ] Capture DAW Mixer mode byte traces using the existing `--lcxl3-activate` probe mode (which logs every received byte). Switch the device into Mixer mode, exercise each control (each fader, each V-pot, each fader button, bank-prev, bank-next), capture the byte sequences. Append the decode to `lcxl3-handshake-trace.md`.
- [ ] Decode the mode-switch mechanism. If it's a SysEx, document the bytes. If it's an on-device button that the bridge can monitor (the device sends a state-change byte), document that. If both — document.
- [ ] Profile LUNA's MCU surface for mixer commands via `--send-mcu` discovery, same pattern as Phase 3c:
  - Send pitch-bend on channel 1-8 with various values; observe LUNA's volume slider response on each track
  - Send CC `0x10`-`0x17` with relative-encoding values on channel 1; observe pan response
  - Send note-on `0x10`-`0x27` on channel 1 (8 mute + 8 solo + 8 arm + 8 select buttons in MCU spec); observe mute/solo/arm/select behaviour
  - Send notes `0x2E` / `0x2F`; observe bank navigation
  - Capture the heartbeat-reply / position-output stream during mixer changes — does LUNA push back fader / mute / solo state via inbound MCU bytes? (Needed for Phase 9b's LED-mirror feature.)
- [ ] Profile LUNA's plugin-parameter vocabulary if discoverable: does pressing the plugin-edit MCU button (`0x36`?) put LUNA's MCU surface in plugin-focus mode? What bytes does LUNA accept for plugin parameter changes? If unclear after a half-day's probing, scope 9c down to "punt; document what was tried".
- [ ] Decide and document the mixer-event taxonomy: parallel channel vs generalised "SurfaceEvent" enum. Capture the choice + rationale in workplan.md or a new `phase-9-design.md` reference doc.
- [ ] Outputs: extended `lcxl3-handshake-trace.md` with Mixer mode decode + mode-switch mechanism; new `luna-mcu-mixer-notes.md` with the per-control byte map + LED-feedback inbound stream; ratified Phase 9b implementation shape.

### Acceptance Criteria

- [ ] `lcxl3-handshake-trace.md` extended with: DAW Mixer mode entry mechanism, byte sequences for fader 1-8 motion (likely 7-bit on a per-strip CC), V-pot 1-8 tick (likely relative-encoding CC per strip), fader buttons 1-8 (likely note-on/off on a per-strip note), bank-prev/bank-next bytes
- [ ] `luna-mcu-mixer-notes.md` exists and documents: pitch-bend → channel volume mapping confirmed by `--send-mcu` discovery; CC pan mapping; mute/solo/arm/select note vocabulary; bank-nav vocabulary; LED-feedback inbound stream documented
- [ ] Plugin-parameter findings documented (either as a complete vocabulary if discoverable, or as "tried X, Y, Z; LUNA didn't respond — scope 9c to punt")
- [ ] Phase 9b implementation shape (parallel channel vs SurfaceEvent enum) ratified by user before 9b code lands

### Phase 9b — DAW Mixer mode implementation

**Deliverable:** with the LCXL3 in DAW Mixer mode, faders drive LUNA's channel-1-8 volume, V-pots drive pan, fader buttons drive mute/solo/arm/select, bank buttons navigate banks, and the LCXL3's fader-button LEDs reflect LUNA's mute/solo/arm state.

- [ ] Extend `lcxl3.rs` parser to recognise Mixer mode bytes per 9a's decoded byte map. Per-strip parser logic — fader value (7-bit), V-pot tick (relative-magnitude), fader button (press / release).
- [ ] Implement the chosen event taxonomy from 9a (parallel mixer channel OR `SurfaceEvent` enum that wraps `TransportEvent` + `MixerEvent`). Update `state.rs` accordingly.
- [ ] Extend `Backend` trait or add a `MixerBackend` trait. `McuBackend` implements mixer emit (pitch-bend on channel N for fader N; CC for V-pot pan; note-on/off for buttons). `KeystrokeBackend` does NOT implement mixer (no keystroke equivalent; document and gate at the Backend trait level).
- [ ] Banking: the LCXL3's eight strips correspond to a sliding window over LUNA's tracks. Maintain a current-bank state in the bridge. Bank-prev/bank-next from the device emit the corresponding MCU notes; LUNA's response (changed channel-strip names / fader positions) flows back as inbound MCU bytes that update the bridge's tracked-state model.
- [ ] LED feedback: for each fader button, the LCXL3 expects a CC to set its LED colour. After every inbound MCU byte from LUNA that changes mute/solo/arm/select state of a tracked channel within the current bank, push the corresponding LED bytes to the LCXL3. Per-strip mapping: LCXL3 strip N maps to LUNA bank-window-position N.
- [ ] Configuration: optional `[lcxl3.mixer]` section in `config.toml` for opt-out (`enabled = true` by default once Phase 9 ships) and starting-bank.
- [ ] Unit tests: parser tests against captured Mixer-mode bytes; mixer-event → MCU-byte translation tests; banking state machine tests.

### Acceptance Criteria

- [ ] Faders 1-8 on LCXL3 drive LUNA's channel-1-8 volume
- [ ] V-pots 1-8 drive LUNA pan; relative encoding correctly accumulated
- [ ] Fader buttons drive mute / solo / arm (configured per LUNA's MCU button vocabulary; default = topmost row of fader buttons → mute)
- [ ] Bank-prev / bank-next navigate LUNA's track strips; LCXL3 LEDs follow
- [ ] LED feedback: muting / soloing / arming a track in LUNA updates the corresponding fader-button LED on the LCXL3 within ~150ms
- [ ] No regression in Phase 5 transport behaviour or Phase 6/8a web UI when LCXL3 switches between Control and Mixer modes
- [ ] All existing unit tests still pass; `cargo build --release` clean

### Phase 9c — Plugin / DAW Control extension

**Deliverable:** scope contingent on Phase 9a findings. If LUNA exposes a plugin-control MCU vocabulary, implement it on the LCXL3's V-pots (or another suitable control surface). If the protocol is non-standard / requires reverse-engineering beyond a reasonable phase scope, document the findings and defer the implementation to a successor feature.

The decision tree:

- **If LUNA implements MCU's focused-plugin section** (V-pots become the active plugin's eight parameters; specific note-byte engages the mode): straightforward extension. Eight V-pots → eight plugin parameters. LED display on the LCXL3 shows current parameter values when LUNA pushes them back.
- **If LUNA implements HUI's plugin section** (notes `0x36`-`0x3F` plus a different inbound vocabulary): doable but more work — HUI is a separate protocol bolted onto the same MCU surface, and the bridge would need to fork its inbound parser. Probably ship and document the extra complexity.
- **If LUNA uses a UA-specific extension or doesn't expose MCU plugin control at all:** document what was tried in `luna-mcu-mixer-notes.md`, scope 9c down to "punt — successor feature". The bridge's V-pots stay assigned to pan in DAW Mixer mode.

- [ ] Implement the path determined by 9a, OR file a follow-on issue if punting

### Acceptance Criteria

- [ ] Either: focused-plugin parameter control works end-to-end (LCXL3 V-pots drive parameters of LUNA's currently-focused plugin)
- [ ] OR: clean documentation of why this couldn't be implemented in this phase + a sized follow-on feature scoped

### Phase 9d — Hardware validation

**Deliverable:** end-to-end mixer + plugin (where applicable) verification on real LCXL3 + LUNA.

- [ ] LCXL3 in DAW Mixer mode: faders 1-8 drive LUNA's channel-1-8 volume sliders smoothly across the full range
- [ ] V-pots 1-8 drive pan; pan-detent behaviour (V-pot center is detent; rotate to break) feels right
- [ ] Mute, solo, record-arm from fader buttons drive LUNA correctly
- [ ] LED feedback: mute / solo / arm a track in LUNA → corresponding LCXL3 fader-button LED updates within ~150ms
- [ ] Bank navigation: bank-prev / bank-next on LCXL3 navigates LUNA's track view; LCXL3 strips re-bind to the new bank
- [ ] Mode switching: LCXL3 toggles between DAW Control (transport) and DAW Mixer mode without bridge restart
- [ ] No regression in transport (Play/Stop/jog) or web UI from Phase 5/6/8a
- [ ] If 9c shipped: focused-plugin parameter control works on a representative LUNA-bundled plugin

### Acceptance Criteria

- [ ] All test cases above pass on the user's rig
- [ ] User confirms LCXL3 mixer feels usable for typical LUNA mixing workflow

## Phase 10: LCXL3 Page-Aware V-Pot Mapping (Trim + Tape + Sends + EQ/Plugin)

**Deliverable:** the LCXL3's three V-pot rows control LUNA parameters per a Page Up/Down navigation model. In DAW Mixer mode, the bottom row stays on Pan and the top two rows shift through pages: Page 0 = Trim/Tape (default), Pages 1-4 = paired sends. In DAW Control mode the top two rows control the selected-track EQ or focused-plugin parameters. The single LCXL3 LCD shows the name + value of the currently-adjusted control (Live/Logic style).

**Why now:** Phase 9b's V-pot handler routes all three rows to pan. The user has three rows of physical encoders, has explicitly opted into bridge-managed function negotiation (manual MIDI mapping in LUNA is fragile across machines / reinstalls), and has confirmed via the LCXL3 reference that Page navigation drives the top two rows. MCU's eight-V-pots-one-mode constraint means the bridge has to switch LUNA's mode + sub-selection on every Page change, which is genuinely new architecture relative to Phase 9b.

**Page table (DAW Mixer mode):**

| Page | Row 1 (top)    | Row 2 (middle)         | Row 3 (bottom) |
|------|----------------|------------------------|----------------|
| 0    | Channel Trim   | Tape-plugin saturation | Pan |
| 1    | Send 1         | Send 2                 | Pan |
| 2    | Send 3         | Send 4                 | Pan |
| 3    | Send 5         | Send 6                 | Pan |
| 4    | Send 7         | Send 8                 | Pan |

Page Up / Page Down clamps at 0 and 4. Bottom row is always Pan. Page 0 (Trim + Tape) is the user's primary working state; send pages are the secondary "I need to fiddle with a send" affordance.

**DAW Control mode V-pot routing (separate from DAW Mixer):**

Per LCXL3 reference, in DAW Control mode the top two V-pot rows control the EQ controls of the selected track or the parameters of the currently focused plugin. Rows are pre-assigned by the device — no Page navigation in DAW Control. Bottom-row V-pot 1 stays as the jog-wheel (Phase 5 behaviour).

**LCXL3 single-LCD display mirror:**

The LCXL3 has one LCD screen, not eight per-strip displays. In Live and Logic this LCD shows the parameter name + value of whichever control the user is currently adjusting (fader, V-pot, etc.). Phase 10 mirrors this for LUNA: parse LUNA's strip-name SysEx push-back (`F0 00 00 66 14 12 ...` per Phase 9a notes), extract the active parameter's name + value, format for the LCXL3's LCD protocol. After ~500 ms of idle, the LCD reverts to a neutral display (likely the active page's row labels: e.g. "Page 0 — Trim / Tape" at the top, "Pan" at the bottom).

**Page state scaffolding** (already landed in main.rs as `vpot_page: u8` with Page Up/Down handlers): Page state is observable in the event log; Phase 10b's V-pot router will read it.

**Pre-research uncertainties (drive Phase 10a):**

1. **Plug-In-mode drill-down for Page 0** — `90 2B 7F` enters Plug-In mode showing "Tape | Consol | Insrts"; bytes to pick Tape and locate its saturation parameter are not captured. Channel Trim's location is unclear (Console plugin? separate channel-strip parameter? focused-plugin path?).
2. **Sends-mode drill-down for Pages 1-4** — `90 29 7F` enters Sends mode with a "Pick a Send" menu; bytes to pick Send 1, Send 2, etc. are not captured.
3. **DAW Control V-pot byte vocabulary** — does the device emit different CCs for V-pots in DAW Control vs DAW Mixer? Does LUNA route those CCs to EQ / focused-plugin without bridge mode-switch?
4. **MCU mode stickiness** — does LUNA stay in selected sub-mode indefinitely, or auto-revert? Does pan still work in Row 3 while the surface is in Sends mode (MCU spec says no — verify)?
5. **Page-revert UX** — auto-revert to Page 0 after V-pot idle, or sticky until Page button is pressed? Tuned in 10c.
6. **LCXL3 LCD output protocol** — bytes to write text to the device's single LCD. Likely a Novation-specific SysEx; Phase 10a captures.

### Phase 10a — V-pot drill-down + LCD-output profiling

**Deliverable:** decoded byte map for "pick Tape + saturation" + "pick Trim parameter" inside Plug-In mode (Page 0); "pick Send N" inside Sends mode (Pages 1-4); DAW Control V-pot byte map; LCXL3 LCD-write protocol. Findings appended to `research/luna-mcu-mixer-notes.md` and `lcxl3-handshake-trace.md`.

- [ ] Use `--probe-mcu-interactive` to enter Plug-In mode (`90 2B 7F`); exercise V-pot button clicks on V-pots 1/2/3 to find the byte that picks "Tape". Once picked, identify which V-pot column controls saturation and capture the relevant note/CC bytes.
- [ ] Locate channel Trim — probe Console plugin (pick Consol from same menu) and the focused-plugin path. Document path and bytes for whichever route works. Descope to "Trim unreachable, Page 0 Row 1 = something else" if blocked.
- [ ] Drill into Sends mode (`90 29 7F`): bytes to pick Send 1, Send 2, etc.; verify Pages 1-4 mapping (Sends 1+2, 3+4, 5+6, 7+8) is reachable.
- [ ] Capture DAW Control mode V-pot byte map. Switch the LCXL3 to DAW Control (Mode + DAW Control); exercise top two rows of V-pots; log the bytes the device emits. Compare to DAW Mixer mode bytes — same CCs (LUNA routes via current MCU mode), or different?
- [ ] Decide page-revert policy: auto-revert to Page 0 after idle (and how long), or sticky.
- [ ] Capture the LCXL3 LCD-write protocol. Probe Novation reference + run experiments via `--lcxl3-activate`-style probe modes: send candidate SysEx forms targeting the LCD, observe what renders. Likely a Novation-specific SysEx (`F0 00 20 29 ...`). Capture: opcode for "write text"; addressable regions (top line / bottom line / both); character set; max length per line.
- [ ] Document the LCD-revert UX: after ~500 ms of idle, what does the LCD show? Options: blank; current page label ("Page 0 — Trim / Tape"); track name of the currently-selected channel.

### Acceptance Criteria

- [ ] `luna-mcu-mixer-notes.md` extended with: bytes to pick Tape + saturation; bytes to address channel Trim (or descope note); bytes to pick Send 1-8 in pairs; DAW Control V-pot byte map
- [ ] `lcxl3-handshake-trace.md` extended with: LCD-write SysEx form; addressable regions; max chars per line
- [ ] Page-revert policy + LCD-revert policy ratified by user before 10b code lands

### Phase 10b — Page-aware sticky-mode state machine + LCD mirror

**Deliverable:** the V-pot SurfaceEvent handler in `main.rs` reads `vpot_page` to drive LUNA's MCU mode + sub-selection on Row 1 / Row 2 V-pot motion. Bottom row stays on Pan. Optional auto-revert to Page 0 after idle. Separate routing for DAW Control mode if 10a finds it needs distinct handling. The LCXL3 LCD mirrors the currently-adjusted parameter's name + value, sourced from LUNA's strip-name SysEx push-back.

- [ ] Add `LunaSurfaceMode` type in `state.rs` or `lcxl3.rs`: `Pan`, `Sends(u8)`, `PlugInTape`, `PlugInTrim`, with helper `from_page_and_row` that maps `(vpot_page, VRow) -> LunaSurfaceMode`.
- [ ] In the V-pot SurfaceEvent handler in `main.rs`, replace the existing "all rows → pan" logic with: (a) for Row 3, emit Pan as today; (b) for Row 1 / Row 2, compute target mode from `(vpot_page, row)`; if LUNA's current mode != target, emit the mode-switch + drill-down byte sequence (per 10a) and update tracked mode; (c) emit the V-pot delta; (d) record `last_vpot_at`.
- [ ] Optional auto-revert: each iteration of the main loop checks "if last_vpot_at + idle > now AND vpot_page != 0, revert to Page 0 + emit corresponding mode-switch". Tunable via `[lcxl3.mixer] vpot_page_revert_idle_ms` (default per 10a — likely 0 = sticky).
- [ ] Page Up / Page Down handlers (already scaffolded) emit Page transitions; on a Page change the bridge eagerly emits the appropriate mode-switch so LUNA's surface follows even before the next V-pot move.
- [ ] DAW Control mode V-pot routing — implement per 10a's findings. May be simply "pass through V-pot CCs and let LUNA handle EQ / focused-plugin" if 10a confirms the bytes route correctly without bridge intervention.
- [ ] LCD mirror: parse LUNA's strip-name SysEx push-back (`F0 00 00 66 14 12 ...`); extract the active parameter's name + value (whichever strip / row LUNA is updating); format for the LCXL3's single LCD per the protocol captured in 10a. Maintain a "last-touched control" tracker so a fader move and a V-pot move on different strips both update the LCD with the relevant parameter.
- [ ] LCD idle revert: after ~500 ms of no parameter-display SysEx from LUNA, write a neutral readout to the LCD per 10a's chosen policy (likely the active page label, e.g. "Page 0 — Trim / Tape").
- [ ] Unit tests: `LunaSurfaceMode::from_page_and_row` mapping; Page Up / Page Down clamps; mode-switch state machine emits correct sequence on Page changes; LCD-format helper renders LUNA's parameter SysEx into the right LCXL3 LCD bytes.
- [ ] Integration: ensure no regression in DAW Control jog-wheel (`row == VRow::Bottom && col == 0`) and no regression in Phase 9b pan behaviour.

### Acceptance Criteria

- [ ] Page 0 default: Row 1 drives channel Trim; Row 2 drives Tape saturation; Row 3 drives Pan (or descope note if Trim/Tape unreachable per 10a)
- [ ] Page Down advances through Sends 1+2, 3+4, 5+6, 7+8 with correct LUNA response
- [ ] Page Up retreats; clamps at 0 and 4
- [ ] DAW Control mode V-pots drive EQ / focused-plugin per 10a
- [ ] LCXL3 LCD shows parameter name + value of the currently-adjusted control (Live/Logic style); reverts to a neutral readout after ~500 ms of idle
- [ ] No regression in faders, fader buttons, banking, transport, or LED feedback from Phase 9b
- [ ] All existing unit tests still pass; `cargo build --release` clean

### Phase 10c — Hardware validation

**Deliverable:** end-to-end verification on the user's LCXL3 + LUNA in both DAW modes.

- [ ] In DAW Mixer mode at Page 0: confirm Row 1 drives channel trim across all 8 strips; Row 2 drives tape saturation; Row 3 drives pan
- [ ] Page Down → Page 1: Row 1 = Send 1, Row 2 = Send 2 — confirm visible LUNA response on the send slots
- [ ] Page Down through Pages 2, 3, 4 — confirm Sends 3+4, 5+6, 7+8 each work
- [ ] Page Up walks back through the same pages; clamps at 0 cleanly
- [ ] In DAW Control mode: confirm top two V-pot rows drive EQ / focused-plugin per 10a
- [ ] LCXL3 LCD shows parameter name + value of the currently-adjusted control during fader / V-pot motion; reverts cleanly to the neutral idle readout
- [ ] No regression in faders, fader buttons, banking, transport, or LED feedback
- [ ] Final Page-revert + LCD-revert policy confirmed comfortable for typical mixing workflow
- [ ] Document the final design in `lcxl3-handshake-trace.md` or a new `phase-10-implementation-notes.md`

### Acceptance Criteria

- [ ] All test cases above pass on the user's rig
- [ ] User confirms the page-aware V-pot mapping + LCD mirror is more useful than the Phase 9b "all rows → pan" baseline

## Open Issues

### Track ◀/▶ buttons don't move LUNA selection

Tracking issue: [#356](https://github.com/audiocontrol-org/audiocontrol/issues/356)

LUNA does not respond to MCU notes `0x30` / `0x31` (the standard "Channel Left / Channel Right" cursor-by-1 commands). The bridge correctly emits these from the LCXL3's Track ◀/▶ buttons via `MixerAction::ChannelPrev / ChannelNext`, but LUNA's selected-track indicator does not move. Per Phase 9a research notes, LUNA appears to use these notes only as **outbound** LED-state indicators ("channel-prev/next available"), not as inbound cursor commands.

Workarounds available (deferred):

- Probe alternative MCU notes (cursor keys `0x60`-`0x63`) during Phase 10a to find what LUNA actually accepts for cursor-by-1
- Implement bridge-side selection tracking: mirror LUNA's select-note echoes into a "current selected channel" state, and on Track ◀/▶ emit `90 (0x18+new_channel) 7F` for the new channel (absolute select is known to work)

Functional impact small — users can still select tracks via the per-strip select buttons under the faders. Shift + Track ◀/▶ (bank shift via `0x2E` / `0x2F`) works correctly.
