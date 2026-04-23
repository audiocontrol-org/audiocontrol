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

### Phases 3-4 — closed-loop locate

- **Reverse-engineer first, then build.** Phase 3 opens with a hardware probe session (LUNA running, MCU output routed to the bridge) to capture the actual position message format LUNA emits and measure the post-keystroke position-update latency. The parser and closed-loop timing are informed by what we observe, not assumed.
- Add an MCU position parser (new `src/mcu.rs`) that consumes raw MIDI bytes and surfaces `PositionUpdate { bar, beat, sub }` events.
- Add a `PositionTracker` that ingests `PositionUpdate` events and exposes "current bar" to the locate controller.
- Add a closed-loop `LocateController` that, given an SPP-derived target bar, iteratively: reads tracked position, computes signed delta, emits one `BarForward` or `BarBackward` keystroke, waits for the next position update (bounded by a timeout), repeats until delta is zero or `max_iterations` is exhausted.
- Detect oscillation: if delta reverses sign between iterations without hitting zero, LUNA's nudge is larger than one bar. Abort locate with a clear log message and return an actionable error; do not silently loop.
- Extend the transport state machine with a `Locating` state; the atomic-locate semantics (coalesce SPP, Stop cancels, Start-during-locate becomes Continue) stay the same as the open-loop design.
- Hardware validation in Phase 4 covers forward/backward/from-zero locate, time-signature changes mid-song (should now work automatically), and the oscillation-abort path for nudge > 1 bar.

## Modules Affected

### Phases 1-2 (shipped in PR #316)

- `services/midi-macro-bridge/` (new)
- Root `Makefile`

### Phases 3-4

- `services/midi-macro-bridge/src/mcu.rs` (new) — MCU position parser
- `services/midi-macro-bridge/src/locate.rs` (new) — `PositionTracker`, `LocateController` (closed-loop)
- `services/midi-macro-bridge/src/state.rs` — add `Locating` state and SPP handling
- `services/midi-macro-bridge/src/midi.rs` — add `Event::Spp(u16)` and SPP parsing; virtual MCU endpoint registration (done in Phase 3 scaffolding commit)
- `services/midi-macro-bridge/src/keys.rs` — add `BarForward` / `BarBackward` match arms (verify `Key::Unicode` vs `Key::Layout` on enigo 0.2.1)
- `services/midi-macro-bridge/src/config.rs` — add `[locate]` section
- `services/midi-macro-bridge/src/main.rs` — open transport input, register the virtual MCU endpoint, drive the closed-loop controller (already has `--probe-midi` / `--probe-mcu` from scaffolding)
- `services/midi-macro-bridge/README.md` — document the LUNA control-surface selection flow and `[locate]` config
- `services/midi-macro-bridge/MCU-NOTES.md` (new) — capture log of LUNA's MCU output format + latency measurements

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

## Phase 3: Closed-Loop Locate Implementation

**Deliverable:** Bridge drives LUNA's playhead to the bar specified by an MC-500 SPP message using closed-loop nudging — emit `[` or `]`, read LUNA's MCU position output, recompute delta, repeat until the target bar is reached (or oscillation/iteration cap triggers abort).

### Tasks

**Bridge registers as a virtual MCU device (foundation for the probe)**

- [x] Add `midi::create_virtual_mcu` using `midir::os::unix::{VirtualInput, VirtualOutput}`; bridge registers the endpoint pair `MIDI Macro Bridge` in CoreMIDI so LUNA sees it in the MIDI Control Surfaces dropdown
- [x] Add `--probe-midi <port>` CLI mode for generic physical-port probing
- [x] Add `--probe-mcu` CLI mode: register the virtual endpoint and dump every byte arriving on its virtual input

**Hardware probe (do this first; the parser design depends on it)**

- [ ] User configures LUNA's MIDI Control Surfaces: pick `MIDI Macro Bridge` as both INPUT DEVICE and OUTPUT DEVICE on a free row, protocol MCU
- [ ] Run `./target/release/midi-macro-bridge --probe-mcu > probe-<scenario>.log` while exercising LUNA in each scenario: idle, playback, scrubbing, bar-step with `[` / `]`, time-signature change mid-song
- [ ] Document LUNA's position message format (SysEx vs CC, byte layout, units — bars/beats/sub vs timecode) in `services/midi-macro-bridge/MCU-NOTES.md`
- [ ] Measure round-trip latency: time between emitting a `]` keystroke and seeing the resulting position update on the probe. Informs the closed-loop per-iteration timeout default.

**Core implementation**

- [ ] Create `src/mcu.rs` with `parse_mcu_bytes(bytes: &[u8]) -> Option<PositionUpdate>` (pure; returns `Some` only when bytes form a valid position message based on what we observed in the probe)
- [ ] Unit tests for `parse_mcu_bytes`: the captured sample messages, plus malformed-input rejection
- [ ] `PositionTracker` struct: ingests `PositionUpdate` events via an mpsc channel; exposes `current_bar() -> Option<u32>` (`None` until the first update arrives)
- [ ] Extend `KeyAction` with `BarForward` and `BarBackward`
- [ ] Extend `Emitter` with match arms for `[` / `]`; verify `Key::Unicode('[' / ']')` vs `Key::Layout` on enigo 0.2.1 (probe before writing)
- [ ] Add `Locating` state to `TransportState`
- [ ] Add `Event::Spp(u16)` variant to the event enum; extend the MIDI input parser to surface SPP
- [ ] Extend `Machine::handle` for SPP events and state transitions: SPP-while-Stopped → enter Locating with the target bar; SPP-while-Playing → ignored; SPP-while-Locating → update the target bar in-place (coalesce); Stop-while-Locating → cancel; Start-while-Locating → queue as Continue for post-locate so the played-from-zero rewind doesn't undo the locate
- [ ] `LocateController::run(target_bar, tracker, emitter, cfg) -> Result<LocateOutcome>`:
  - Loop up to `cfg.max_iterations` times
  - Read `tracker.current_bar()`; if `None`, wait up to `cfg.position_timeout_ms` for first update; abort if still `None`
  - Compute signed delta; if zero, return `Outcome::Reached { iterations }`
  - If delta has reversed sign since the previous iteration without reaching zero, return `Outcome::NudgeTooLarge { consecutive_overshoots }` — abort and log actionable error
  - Emit `BarForward` if delta > 0, `BarBackward` if delta < 0
  - Wait up to `cfg.position_timeout_ms` for a new `PositionUpdate`
  - If no update within timeout, return `Outcome::Timeout { last_known_bar }`
- [ ] Add `[locate]` TOML section with `enabled` (default `false`), `max_iterations` (default e.g. 64), `position_timeout_ms` (default informed by probe measurements), `use_numpad_keys` (default `false`). The MCU input comes from the bridge's own virtual endpoint — no port config.
- [ ] Main loop: at startup (when `locate.enabled = true`) register the virtual MCU endpoint pair; forward incoming MCU bytes into the `PositionTracker`; forward transport+SPP from the physical MC-500 input into the state machine; when the state machine transitions to Locating, spawn the `LocateController::run` on a helper thread (keeping the main event loop responsive to Stop during locate)
- [ ] `info!`-level log on each locate: target bar (from SPP), starting bar (from MCU), each iteration's delta + keystroke, final bar, total iterations, outcome
- [ ] Startup log: configured locate mode (enabled/disabled, MCU port, iteration cap, timeout)
- [ ] README: "Closed-loop locate" section with the MCU routing prerequisite, config example, troubleshooting (timeouts, oscillation errors)

### Acceptance Criteria

- [ ] `MCU-NOTES.md` committed; position parser is backed by captured real-hardware bytes, not guessed
- [ ] All new unit tests pass: `parse_mcu_bytes` sample + rejection cases, state machine Locating transitions, `LocateController` simulation with a mocked `PositionTracker` (fake updates driven into the tracker to exercise the control loop's delta / overshoot / timeout / reached outcomes)
- [ ] All existing tests (state, config, MIDI parser) still pass
- [ ] `cargo build --release` succeeds; `make build-midi-macro-bridge` green
- [ ] Config with `[locate]` section parses; startup log reports locate mode
- [ ] Config without `[locate]` section still parses (backward-compat with Phase 1-2 configs)
- [ ] Oscillation detection triggers a clean abort with a user-actionable error message, not a runaway loop

## Phase 4: Closed-Loop Locate Hardware Validation

**Deliverable:** MC-500 LOCATE operations drive LUNA's playhead to the matching bar, verified end-to-end, regardless of time signature.

### Tasks

- [ ] Configure `[locate]` with `enabled = true` and the MCU input port observed during the probe
- [ ] MC-500 locate to bar 5 from bar 0 in 4/4 — LUNA lands on bar 5; log shows finite iteration count, no overshoots
- [ ] MC-500 locate to bar 33 from bar 5 in 4/4 — LUNA lands on bar 33 via forward nudges
- [ ] MC-500 locate back to bar 1 from bar 33 — LUNA lands on bar 1 via backward nudges (no full rewind)
- [ ] MC-500 locate to bar 7 in a 3/4 section of the song — LUNA lands on bar 7 (validates that no hardcoded time signature is in play)
- [ ] After a locate, hit PLAY on MC-500 — LUNA starts from the located position (not zero), because Start-while-Locating was queued as Continue
- [ ] Rapid SPP during MC-500 value-dial entry — bridge coalesces to the final SPP; no intermediate locates fire; log shows target-bar update without restart
- [ ] Hit LOCATE while LUNA is playing — SPP ignored, playback uninterrupted
- [ ] Deliberately set LUNA's nudge value to > 1 bar — bridge detects oscillation, aborts, logs an actionable error, and does not leak keystrokes indefinitely
- [ ] Disconnect LUNA's MCU output mid-locate — bridge times out per-iteration with a clean error, doesn't hang

### Acceptance Criteria

- [ ] Locate lands on the correct bar for forward, backward, from-zero, and cross-time-signature cases
- [ ] Locate sequence is atomic (rapid SPP coalesced; no mid-sequence restart)
- [ ] Post-locate PLAY uses the located position, not zero
- [ ] SPP during playback is ignored
- [ ] Nudge-value > 1 bar is detected and surfaces as a clear configuration error, not silent misbehaviour
- [ ] Missing / stalled MCU position feed is detected and surfaces as a clean timeout, not a hang
