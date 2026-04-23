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

- Copy existing scaffolded Rust code into `services/midi-macro-bridge/`
- 5 source files: main.rs, config.rs, state.rs, midi.rs, keys.rs
- Resolve dependency version skew if needed (enigo 0.2, midir 0.10)
- Add Makefile build target following scsi-midi-bridge pattern
- Hardware validation with MC-500 + LUNA

## Modules Affected

- `services/midi-macro-bridge/` (new)
- Root `Makefile`

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

## Phase 3: SPP Locate Implementation

**Deliverable:** Bridge translates MIDI SPP into bar-step keystrokes driving LUNA's playhead, with an atomic-locate state machine that coalesces rapid SPP and collapses post-locate Start into Continue.

### Tasks

- [ ] Create `src/locate.rs` with pure `spp_to_bar(spp: u16, numerator: u8, denominator: u8) -> u32`
- [ ] Unit tests for `spp_to_bar`: 4/4, 3/4, 6/8, 7/8, 5/4 (including non-bar-boundary round-down behaviour)
- [ ] Add `LocateController::compute_keystrokes(target_bar: u32) -> Vec<KeyAction>` (pure, tested; always-rewind-on-locate)
- [ ] Extend `KeyAction` with `BarForward` and `BarBackward`
- [ ] Extend `Emitter` with match arms for bracket keys; verify `Key::Unicode('[' / ']')` vs `Key::Layout` on enigo 0.2.1
- [ ] Add `Locating` state to `TransportState`
- [ ] Extend `Machine::handle` for SPP events and state transitions (SPP-while-Stopped → Locating; SPP-while-Playing ignored; Stop-during-Locating cancels; Start-during-Locating queued as Continue to suppress the post-locate rewind; duplicate SPP during Locating ignored)
- [ ] Add `Event::Spp(u16)` variant to the event enum; extend `parse_transport` (or rename to `parse_bridge_event`) to surface SPP
- [ ] Add `[locate]` TOML section with `enabled` (default false), `time_signature_numerator` (default 4), `time_signature_denominator` (default 4), `use_numpad_keys` (default false)
- [ ] Main loop: handle SPP events, drive the Locating state, and log configured locate mode at startup (`info!`)
- [ ] `info!`-level log on each locate: raw SPP value, target bar, time signature used, keystroke count
- [ ] README: document the LUNA nudge-value precondition; add a "SPP-driven locate" section with config example

### Acceptance Criteria

- [ ] All new unit tests pass (spp_to_bar across time signatures, compute_keystrokes, new Locating state transitions)
- [ ] All existing tests (state, config, MIDI parser) still pass
- [ ] `cargo build --release` succeeds; `make build-midi-macro-bridge` green
- [ ] Config with `[locate]` section parses; startup log reports locate mode
- [ ] Config without `[locate]` section still parses (backward-compat with Phase 1-2 configs)

## Phase 4: SPP Locate Hardware Validation

**Deliverable:** MC-500 LOCATE operations drive LUNA's playhead to the matching bar.

### Tasks

- [ ] Set `[locate]` config to 4/4, `enabled = true`
- [ ] MC-500 locate to bar 5 -- LUNA lands on bar 5
- [ ] MC-500 locate to bar 33 -- LUNA lands on bar 33
- [ ] MC-500 locate back to bar 1 from bar 33 -- LUNA lands on bar 1
- [ ] After a locate, hit PLAY on MC-500 -- LUNA starts from the located position (not zero)
- [ ] Rapid SPP during MC-500 value-dial entry does not cause LUNA to re-seek mid-sequence
- [ ] Hit LOCATE while LUNA is playing -- SPP ignored, playback uninterrupted
- [ ] Confirm empirically whether LUNA's `[` / `]` always move exactly one bar (regardless of nudge value). If yes, drop the nudge-value caveat from the README; if no, keep it and document the workaround.

### Acceptance Criteria

- [ ] Locate lands on the correct bar in 4/4 for forward, backward, and from-zero cases
- [ ] Locate sequence is atomic (no restart from mid-entry SPP)
- [ ] Post-locate PLAY uses the located position, not zero
- [ ] SPP during playback is ignored
- [ ] README's nudge-value guidance matches observed LUNA behaviour
