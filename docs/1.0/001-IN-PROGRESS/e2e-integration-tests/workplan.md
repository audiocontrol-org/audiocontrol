# E2E Integration Tests — Workplan

**Feature:** E2E Integration Tests
**PRD:** [prd.md](./prd.md)
**GitHub Issues:** [#176](https://github.com/audiocontrol-org/audiocontrol/issues/176), [#178](https://github.com/audiocontrol-org/audiocontrol/issues/178)
**Test Plan:** [comprehensive-test-plan.md](./comprehensive-test-plan.md)
**Coverage:** 145/229 (63%) — 14 partial, 70 remaining

## Implementation Phases

### Phase 1: OPFS Library Integration ✅ COMPLETE

OPFS-based library storage for e2e tests — no permission prompts, real filesystem semantics.

**Deliverables:**
- [x] OPFS initialization helper (`initializeRolandOPFS`)
- [x] Test fixture population utilities (`writeToneFixture`, `writeSampleFixture`, etc.)
- [x] Cleanup utilities (`cleanupOPFS`)
- [x] MIDI permission handling via HTTP MIDI transport

### Phase 2: Test Infrastructure Setup ✅ COMPLETE

**Deliverables:**
- [x] Shared helpers in `e2e-infra/helpers/` (library-fixtures, library-ui-helpers, opfs-page-helpers)
- [x] Module-specific helpers in `roland-sxx0-editor/e2e/helpers/` (connection, device-readback, device-state)
- [x] Heartbeat/watchdog for stuck test detection (5s threshold)
- [x] Playwright configs: library, hardware, device-library
- [x] Run scripts via devenv (`run-library-e2e.sh`, `run-http-midi-e2e.sh`, `run-hardware-e2e.sh`)
- [x] Make targets: `test-e2e-roland-library`, `test-e2e-roland-device`

### Phase 3: Library CRUD Tests ✅ COMPLETE

- [x] Directory management: create, rename, delete, move, nesting, special chars (`library-directories.spec.ts`)
- [x] Tone operations: list, create, rename, delete, move, edge cases (`library-tones.spec.ts`)
- [x] Patch operations: list, create, rename, delete, move, edge cases (`library-patches.spec.ts`)
- [x] Set operations: list, create, rename, delete, move, edge cases (`library-sets.spec.ts`)

### Phase 4: Device ↔ Library Integration ✅ COMPLETE

- [x] Tone round trip: import → export → compare (`device-library-roundtrip.spec.ts`)
- [x] Patch round trip: import → export → compare (`device-library-roundtrip.spec.ts`)
- [x] Set save: device state → library set (`device-library-set-roundtrip.spec.ts`)
- [x] Set load: library set → device (`device-library-set-roundtrip.spec.ts`)

### Phase 5: Editor Controls ✅ COMPLETE

- [x] Play page: per-part channel, patch, output, level (`device-play-controls.spec.ts`)
- [x] Patch editing: name, key mode, bender range, aftertouch, key assign, velocity, zones (`device-patch-controls.spec.ts`)
- [x] Tone editing: name, loop, TVF cutoff/resonance/key follow, TVA level, LFO rate/delay, pitch (`device-tone-controls.spec.ts`)
- [x] Envelope editing: TVA/TVF rate, level, sustain point, end point (`device-tone-envelope-controls.spec.ts`)
- [x] Error recovery: timeout, SysEx rejection, disconnect (`device-error-recovery.spec.ts`)

### Phase 6: Drum Kit & Slice Workflows ✅ COMPLETE

- [x] v1 + v2 drum kit import (`device-drumkit.spec.ts`)
- [x] Chopper save: fixed slicing, 8 slices, labels, drum kit creation (`library-chopper-save.spec.ts`)
- [x] Slice persistence: save then reopen restores boundaries (`library-chopper-save.spec.ts`)
- [x] Device tone chopper: chop into drum kit from Tones page (`device-tone-chopper.spec.ts`)
- [x] Drum kit pad editor: playback, MIDI notes, base note, load audio (`library-drumkit-editor.spec.ts`)
- [x] Missing WAV file handling: v1 + v2 kits don't crash (`library-drumkit-error.spec.ts`)

### Phase 7: Sample Operations ✅ COMPLETE

- [x] Export sample as WAV download (`device-sample-operations.spec.ts`)
- [x] Import WAV file to device (`device-sample-operations.spec.ts`)
- [x] Wave bank selection during import (`device-sample-operations.spec.ts`)
- [x] Tone edge cases: empty tone, unsupported format, corrupt WAV (`device-tone-edge-cases.spec.ts`)

### Phase 8: Remaining P1 Gaps ⚠️ IN PROGRESS

Written but not yet hardware-verified:
- [ ] Set individual tone load (`device-set-individual-load.spec.ts`) — fixture format needs debugging
- [ ] Set individual patch load (`device-set-individual-load.spec.ts`) — fixture format needs debugging

Not yet implemented:
- [ ] Auto-fit slot allocation (P0) — deprioritized per user direction
- [ ] Loop editor from Library page
- [ ] Parameter persistence after page reload
- [ ] Patch tone zone editor
- [ ] Set with missing files error handling

### Phase 9: Deferred

- Multi-device S-550 specific tests — deferred per architecture constraints
- Per-pad output routing — S-330 architecture limitation (single output per patch)
- Per-pad MIDI note editing — needs schema extension

## Open Issues

- [#176](https://github.com/audiocontrol-org/audiocontrol/issues/176) — MIDI port selector not visible in device-library tests
- [#178](https://github.com/audiocontrol-org/audiocontrol/issues/178) — Roland tone export fails (libraryHandle null on Tones page)

## Merged PRs

- [#146](https://github.com/audiocontrol-org/audiocontrol/pull/146) — E2E coverage 118 → 145/229 (Phase 5 completion, tone params, sample ops)
- [#161](https://github.com/audiocontrol-org/audiocontrol/pull/161) — Edit Sample for drum kits, edge cases, set individual load tests

## Dependencies

- `devenv` shell (auto-installed by make)
- Playwright browsers (auto-installed by make)
- midi-server (auto-provisioned to `.deps/` by make)
- Hardware: Roland S-330 or S-550 for device tests
