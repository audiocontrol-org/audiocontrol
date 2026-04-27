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
| Phase 1-2 PR | [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged) |
| Phase 3-4 PR | [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged) |
| Tolerance fix PR | [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (merged) |
| Idle byte-trace PR | [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319) (merged) |

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

- [ ] In `main.rs` after the existing MC-500 `midi::connect`, add a second `midi::connect_raw` for the LCXL3 input port. Each callback's parser converts bytes to `Option<TransportEvent>` (`parse_transport` for MC-500, `lcxl3::parse` for LCXL3); both forward into the same `tx` channel
- [ ] Open the LCXL3 output port via `midi::connect_output` (same pattern as the existing `mc500_out` for sync-on-stop)
- [ ] On startup with LCXL3 enabled, call a new `lcxl3::handshake_send(&mut MidiOutputConnection, host_name: &str)` helper that fires the full activation sequence
- [ ] In the main loop, after `machine.handle(event)`, if `machine.state()` differs from the previous state, send the corresponding LED bytes to the LCXL3 output port (gated on the LCXL3 connection existing)
- [ ] In the Ctrl-C / shutdown path, send the deactivation SysEx so the LCXL3 returns to idle
- [ ] If the LCXL3 input port is not available at startup, log a warning and continue without LCXL3 input — the MC-500 path still works

### Acceptance Criteria

- [ ] Bridge starts cleanly with both MC-500 and LCXL3 enabled
- [ ] Bridge starts cleanly with only one of MC-500 / LCXL3 enabled (the other empty in config)
- [ ] Bridge starts cleanly with neither configured (effectively a no-op session, useful for `--list-ports`)
- [ ] Ctrl-C sends the deactivation SysEx visibly in the log

### Phase 5e — Hardware validation

**Deliverable:** End-to-end LCXL3 → bridge → LUNA verified on hardware.

- [ ] Bridge launches with `[lcxl3] enabled = true` and `mc500_*` empty. LCXL3 transport buttons illuminate. Press Play → LUNA plays. Press again → LUNA stops. Encoder ticks → LUNA's bar position advances/retreats by one bar each
- [ ] Bridge launches with both MC-500 and LCXL3 enabled. Hit Play on LCXL3 → LUNA plays. Hit Stop on MC-500 → LUNA stops. LED on LCXL3 follows. No echo loop or duplicate-event issues
- [ ] Ctrl-C the bridge → LCXL3 returns to idle (LEDs go off / factory state)
- [ ] Power-cycle the LCXL3 mid-session → bridge logs a port disconnect; user restarts the bridge and resumes (matches v1 documented behaviour)
- [ ] LCXL3 transport while LUNA is in the middle of a closed-loop locate (driven by MC-500 SPP) — events ignored cleanly, no state corruption

### Acceptance Criteria

- [ ] All Phase 5e hardware tasks pass on the user's rig
- [ ] No regression in MC-500 transport / locate behaviour with both inputs enabled
- [ ] LCXL3 LEDs reflect transport state correctly after every press
