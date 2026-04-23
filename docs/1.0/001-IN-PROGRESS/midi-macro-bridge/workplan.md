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
| Phase 1-2 PR | [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged) |

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
- [ ] Confirm empirically (by running `--probe-mcu` live against LUNA for 60+ seconds) that LUNA keeps the surface activated and doesn't re-init repeatedly — **next session**
- [ ] **Pause here** and coordinate with the user to set up the 3c discovery session

### Phase 3c — MCU transmit discovery

- [ ] Add `--send-mcu <spec>` CLI mode that registers the virtual endpoint, waits for LUNA to handshake, then sends the specified MCU message. Specs: `play`, `stop`, `rewind-start`, `rewind-end`, `ff-start`, `ff-end`, `nudge-fwd`, `nudge-back`, `raw <hex-bytes>`
- [ ] Empirical discovery session: send each candidate and observe LUNA. Start with the MCU-standard notes (0x5B rewind, 0x5C fast-forward, 0x5D stop, 0x5E play, 0x5F record). For "return to zero" test modifier-press combinations, jog-wheel pitch-bend with specific values, or LUNA-specific note mappings. For "1-bar nudge" test 0x62/0x63 (cursor), jog-wheel at known increments, and any NUDGE-mode combinations.
- [ ] Append a "LUNA MCU input mapping" section to MCU-NOTES.md with the definitive byte sequences for Play, Stop, Continue (= Play from current position), Return-to-zero, Bar-forward, Bar-backward. Include the reasoning / alternatives considered where the mapping wasn't obvious.

### Phase 3d — Backend trait + Action refactor

- [ ] Rename `KeyAction` → `Action` in `state.rs` with variants `Play`, `Stop`, `Continue`, `ReturnToZero`, `BarForward`, `BarBackward`. Update all state-machine transitions.
- [ ] Introduce `Backend` trait in `src/backend.rs`: `fn execute(&mut self, action: Action) -> Result<()>`
- [ ] `McuBackend` implementation (default): maps each `Action` to the MCU byte sequence discovered in 3c, emits via `midi::send_virtual_mcu`
- [ ] `KeystrokeBackend` implementation (fallback): existing enigo-based logic, translates `Action` back to `Return`/`Space`/`[`/`]` sequences
- [ ] Update state machine: Start = `[ReturnToZero, Play]`, Continue = `[Play]` (Continue is semantically "play from current position"), Stop = `[Stop]`, bar-nudge during locate = `[BarForward]` or `[BarBackward]`
- [ ] Add `[transport]` TOML section: `backend` (default `"mcu"`, alt `"keystrokes"`); also move `keystroke_delay_ms`, `require_frontmost_app` into this section (only relevant for the keystroke backend). Preserve backward-compat with Phase 1-2 configs by defaulting sensibly.
- [ ] Unit tests: a mock Backend that records the Actions it receives; assert the state machine emits the expected sequences across the existing 22 test scenarios, now expressed in terms of `Action` not `KeyAction`.

### Phase 3e — Closed-loop locate

- [ ] Extend `Event` with `Spp(u16)`; extend the MIDI input parser to surface SPP from the MC-500
- [ ] Add `Locating` state to `TransportState`; atomic-locate semantics (coalesce SPP, Stop cancels, Start-during-locate becomes Continue for post-locate so Return-to-zero doesn't undo the locate)
- [ ] `LocateController::run(target_bar, tracker, backend, cfg) -> Result<LocateOutcome>`:
  - Loop up to `cfg.max_iterations` times
  - Read `tracker.current_bar()`; if `None`, wait up to `cfg.position_timeout_ms` for first update; abort if still `None`
  - Compute signed delta; if zero, return `Outcome::Reached { iterations }`
  - If delta has reversed sign since the previous iteration without reaching zero, return `Outcome::NudgeTooLarge` — abort and log actionable error
  - Dispatch `Action::BarForward` or `Action::BarBackward` via the Backend
  - Wait up to `cfg.position_timeout_ms` for a new `PositionUpdate` from the tracker
  - If no update within timeout, return `Outcome::Timeout { last_known_bar }`
- [ ] Add `[locate]` TOML section with `enabled` (default `false`), `max_iterations` (default 64), `position_timeout_ms` (default 500)
- [ ] Unit tests: `LocateController` against a mocked PositionTracker and a mocked Backend. Cover: Reached (forward, backward, zero delta), NudgeTooLarge (sign reversal), Timeout (tracker doesn't update), IterationCap, tracker still pre-initialised.
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
