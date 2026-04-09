# Library E2E Test Plan

## Overview

Comprehensive e2e tests for library operations across both editors. Tests are organized into three tiers based on hardware requirements:

- **Tier 1: Library-only** (OPFS, no device) — runs via `make test-e2e-{roland,s3k}-library`
- **Tier 2: Roland device** (S-550 via midi-server) — runs via `make test-e2e-roland-device`
- **Tier 3: S3K device** (S3000XL via SCSI bridge) — runs via `make test-e2e-s3k-device` / `test-e2e-s3k-device-library`

E2E tenets apply: real storage, real browser APIs, real hardware for device tests. No mocking. Device tests must be atomic round trips.

Always run e2e tests via `run-and-watch.sh`, never directly with make:
```bash
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
```

---

## Tier 1: Library-Only Tests (no device)

### Roland (~104 tests across 9 spec files) — DONE

#### `library-ui-operations.spec.ts` (8 tests)
- [x] Select common-area sample → preview shows details
- [x] Select drum kit → page doesn't crash
- [x] Create folder in common area / tones category → persists in OPFS
- [x] Delete sample from library → removed from OPFS
- [x] Connect/disconnect OPFS → tree loads/clears
- [x] Sample fixture in OPFS → appears in library tree
- [x] Context menu opens on right-click with expected actions

#### `library-opfs.spec.ts` (8 tests)
- [x] OPFS availability, init structure, read/write, fixtures, list, cleanup, isolation

#### `library-directories.spec.ts` (17 tests)
- [x] Create in tones/patches/sets, nested, empty name, duplicate
- [x] Rename (success, empty, existing, with contents)
- [x] Delete (empty, non-empty, non-existent)
- [x] Move (success, with contents, into itself)
- [x] Edge cases (special chars, unicode, deeply nested)

#### `library-tones.spec.ts` (20 tests)
- [x] List, metadata, create, rename, delete, move, edge cases

#### `library-patches.spec.ts` (18 tests)
- [x] List, metadata, create, rename, delete, move, tone references, edge cases

#### `library-sets.spec.ts` (19 tests)
- [x] List, manifest, create, content access, rename, delete, move, edge cases

#### `library-chopper-save.spec.ts` (7 tests)
- [x] Fixed slicing save, 8-slice count, persistence, labels, drum kit output

#### `library-drumkit-editor.spec.ts` (5 tests)
- [x] Pad preview, load audio button, play button, MIDI note assignment

#### `library-drumkit-error.spec.ts` (2 tests)
- [x] v2 kit missing source.wav, v1 kit no WAV files

### S3K (6 tests in 1 spec file) — GAP

#### `library-ui-operations.spec.ts` (6 tests)
- [x] Select sample → preview, create folder, fixture appears, connect/disconnect, context menu, delete

#### `library-chopper-save.spec.ts` (4 tests)
- [x] Fixed slicing → save writes sample.yaml with slice definitions
- [x] Fixed slicing with 8 slices saves correct count
- [x] Saved slice boundaries persist when chopper is reopened
- [x] Save writes sample.yaml with correct slice labels

**S3K Tier 1 gaps:** No directory CRUD, sample/program YAML CRUD, drum kit editor, OPFS infra, or edge case tests.

---

## Tier 2: Roland Device Tests (~80 tests across 17 spec files) — DONE

### Connection and state

#### `device-connected.spec.ts` (15 tests)
- [x] Disconnected state on init, connection UI, connect/disconnect, persist across nav
- [x] Navigate to tones/patches pages, load data from device
- [x] Tone details show parameters, sample playback, keyboard input
- [x] Error state on connection failure

#### `device-state.spec.ts` (5 tests)
- [x] midi-server running, ports listed, discovered ports available, open ports, SysEx response

#### `device-error-recovery.spec.ts` (4 tests)
- [x] MIDI send failure, timeout, recovery after retry, SSE disconnect

### Parameter editing (round-trip to device)

#### `device-tone-controls.spec.ts` (13 tests)
- [x] Tone name, loop mode, TVF cutoff/resonance/key-follow, LFO rate/delay, original key, output assign, TVF enabled, TVA level, pitch follow

#### `device-tone-envelope-controls.spec.ts` (7 tests)
- [x] TVA/TVF envelope rate, sustain point, level, end point

#### `device-patch-controls.spec.ts` (11 tests)
- [x] Patch name, key mode, bender range, level, aftertouch, key assign, output assign, velocity threshold/mix, tone zone assignment

#### `device-play-controls.spec.ts` (4 tests)
- [x] Channel, output routing, level, patch assignment

#### `device-loop-editor.spec.ts` (3 tests)
- [x] Render after loading wave data, loop point sync, end point sync

### Library integration (device ↔ OPFS)

#### `device-library-roundtrip.spec.ts` (2 tests)
- [x] Tone round trip: import from library → export from device → compare
- [x] Patch round trip: import from library → export from device → compare

#### `device-library-set-roundtrip.spec.ts` (1 test)
- [x] Set round trip: save device state → load back → compare

#### `device-library-autofit.spec.ts` (2 tests)
- [x] Tone auto-fit round trip: best-fit import → export → compare
- [x] Patch auto-fit round trip: best-fit import → export → compare

#### `device-sets.spec.ts` (9 tests)
- [x] Save device state to new set, verify tones/patches/manifest
- [x] Load set from library, progress indicator, missing files error
- [x] Set directory structure, tone WAV data

#### `device-set-individual-load.spec.ts` (2 tests)
- [x] Load individual tone from set to device
- [x] Load individual patch from set to device

### Sample operations

#### `device-sample-operations.spec.ts` (3 tests)
- [x] Export sample downloads WAV, import from WAV, import to wave bank B

#### `device-tone-edge-cases.spec.ts` (3 tests)
- [x] Empty tone state, unsupported format error, corrupted WAV error

#### `device-tone-chopper.spec.ts` (2 tests)
- [x] Chop device tone opens chopper with audio
- [x] Chop and save creates drum kit in OPFS

### Drum kit

#### `device-drumkit.spec.ts` (2 tests)
- [x] v2 drum kit import creates tones + patch on device
- [x] v1 drum kit import creates tones + patch on device

---

## Tier 3: S3K Device Tests (~53 browser tests + ~10 node tests) — PARTIALLY DONE

### Node-based tests (e2e-infra, no browser) — DONE

Run via: `modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test <group> --verbose'`

#### `test-sds.ts` (3 tests)
- [x] Fetch all sample headers (7-bit encoding for indices >= 16)
- [x] SDS round trip: send → poll RSLIST → rename → receive → compare
- [x] Post-SDS rename verified

#### `test-reads.ts` (3 tests)
- [x] Read sample/program/keygroup headers

#### `test-writes.ts` (4 tests)
- [x] Write program name, polyphony, filter frequency, sample name (all round-trip with restore)

#### `test-multi-sds.ts` (1 test)
- [x] Send 4 SDS samples back-to-back (no SysEx between), verify all arrive via RSLIST

#### `test-drumkit.ts` (1 test)
- [x] Staged drum kit import: 4 SDS uploads → RSLIST verify → 4 renames → program creation → 4 keygroups → readback verify → cleanup

#### `test-program-export.ts` (1 test)
- [x] Program export to common area: fetch program + keygroups → akaiProgramToCommon → write ProgramYaml to filesystem → verify zones

#### `test-disk-browser.ts` (3 tests)
- [x] Disk enumerate: probe all SCSI IDs, parse Akai partitions/volumes/files
- [x] Disk read sample: read sample from disk, parse header, extract audio, convert to WAV
- [x] Disk read program: read program from disk, parse keygroups, convert to common area (skipped — no S3000-format programs on test disks, only S1000)

### Browser-based tests (Playwright) — DONE

#### `device-connected.spec.ts` (4 tests)
- [x] Disconnected state, connection UI, connect, persist across nav

#### `device-programs.spec.ts` (17 tests)
- [x] Navigate, load program names, select → editor, Load All
- [x] Edit name, name round-trip
- [x] Polyphony, level, pan, LFO rate, portamento, soft pedal round-trips
- [x] Priority select, legato toggle round-trips
- [x] Output/LFO/Soft Pedal section visibility

#### `device-keygroups.spec.ts` (11 tests)
- [x] Navigate, no-program prompt, load after selection, select → editor
- [x] Note range inputs, filter frequency round-trip
- [x] Amplitude envelope inputs, attack/sustain round-trips
- [x] Low note round-trip
- [x] Keygroup chain navigation (create KG 2, navigate, cleanup)

#### `device-velocity-zones.spec.ts` (6 tests)
- [x] Zone tabs visible, click tab shows params
- [x] Sample name displayed, velocity range inputs
- [x] Velocity range round-trip, zone 2 tuning offset round-trip

#### `device-sample-headers.spec.ts` (2 tests)
- [x] Sample names loaded in dropdown, non-empty names

#### `device-sds-transfer.spec.ts` (5 tests)
- [x] Sample dropdown populated, receive button state
- [x] Receive completes with metadata
- [x] Send test sample via SDS, receive back and compare

#### `device-library-roundtrip.spec.ts` (5 tests)
- [x] Device memory panel shows connected state
- [x] Sample round trip: send via SDS → receive back → compare
- [x] Export program from device to library
- [x] Program round trip: export → import → verify
- [x] Delete device sample after receiving

### Remaining Tier 3 gaps (browser)

- [x] Import drum kit via browser UI → program + samples created on device (staged SDS batch + precise opcode matching)
- [ ] Import instrument (common-area program) → keygroups created — **blocked: multi-sample instruments not yet implemented**
- [x] Promote S3K program to common area → verify ProgramYaml (node test: fetch from device, convert via akaiProgramToCommon, write to filesystem, verify)
- [ ] Import common-area program to S3K → verify keygroups match zones — **blocked: multi-sample instruments not yet implemented**
- [x] Disk browser: enumerate SCSI disks, parse Akai partitions/volumes/files (node test)
- [x] Disk browser: read disk sample, convert to WAV (node test)
- [ ] Disk browser: save disk program to S3K library (skipped — no S3000-format programs on test disks)
- [ ] Disk browser: save disk sample to library as WAV (browser test)
- [ ] Conversion boundary: disk ↔ device-specific library
- [ ] Conversion boundary: disk ↔ common area

---

## Parity Summary

| Area | Roland | S3K | Status |
|------|--------|-----|--------|
| **Tier 1: Library OPFS** | ~104 tests, 9 files | 6 tests, 1 file | **Gap: S3K needs parity** |
| **Device connection** | 15 tests | 4 tests | Roland more thorough |
| **Parameter editing** | ~38 tests (tone, patch, play, envelope) | ~34 tests (program, keygroup, velocity) | Roughly comparable |
| **Library round-trip** | 5 tests (tone, patch, set, autofit) | 5 tests (sample, program, delete) | Comparable |
| **Sample transfer** | 3 tests (export WAV, import WAV, bank B) | 7 tests (SDS send/receive, dropdown) | S3K has more |
| **Drum kit** | 2 tests (v1/v2 import) | not tested | **Gap** |
| **Chopper** | 2 tests (chop device tone) | not tested | **Gap** |
| **Sets** | 9 tests (save/load/validate) | N/A (S3K has no sets) | N/A |
| **Error handling** | 7 tests (recovery, edge cases) | 0 tests | **Gap** |
| **Disk browser** | N/A | not tested | **Gap** |
| **Node SysEx tests** | N/A | 10 tests (reads, writes, SDS) | S3K only |

### Known parity gaps

1. **S3K Tier 1 coverage is minimal** — 6 tests vs Roland's ~104. Most common-area operations untested.
2. **S3K missing drum kit import tests** — Roland has v1/v2 drum kit import tests.
3. **S3K missing error handling tests** — Roland has MIDI failure, timeout, recovery, SSE disconnect tests.
4. **S3K missing disk browser tests** — partition listing, save-to-library.
5. **Roland has no "Promote to Common Area" button** — S3K has it. Roland needs equivalent.

---

## Test File Organization

```
modules/roland-sxx0-editor/e2e/
  library-*.spec.ts (9 files)          # Tier 1 — OPFS library ops (~104 tests)
  device-connected.spec.ts             # Tier 2 — connection (15 tests)
  device-state.spec.ts                 # Tier 2 — HTTP MIDI transport (5 tests)
  device-error-recovery.spec.ts        # Tier 2 — error handling (4 tests)
  device-tone-controls.spec.ts         # Tier 2 — tone params (13 tests)
  device-tone-envelope-controls.spec.ts # Tier 2 — envelopes (7 tests)
  device-tone-edge-cases.spec.ts       # Tier 2 — edge cases (3 tests)
  device-tone-chopper.spec.ts          # Tier 2 — chopper (2 tests)
  device-patch-controls.spec.ts        # Tier 2 — patch params (11 tests)
  device-play-controls.spec.ts         # Tier 2 — play page (4 tests)
  device-loop-editor.spec.ts           # Tier 2 — loop editor (3 tests)
  device-sample-operations.spec.ts     # Tier 2 — sample import/export (3 tests)
  device-drumkit.spec.ts               # Tier 2 — drum kit import (2 tests)
  device-sets.spec.ts                  # Tier 2 — set save/load (9 tests)
  device-set-individual-load.spec.ts   # Tier 2 — individual load (2 tests)
  device-library-roundtrip.spec.ts     # Tier 2 — round trips (2 tests)
  device-library-set-roundtrip.spec.ts # Tier 2 — set round trip (1 test)
  device-library-autofit.spec.ts       # Tier 2 — autofit (2 tests)

modules/akai-s3k-editor/e2e/
  library-ui-operations.spec.ts        # Tier 1 — OPFS library ops (6 tests)
  device-connected.spec.ts             # Tier 3 — connection (4 tests)
  device-programs.spec.ts              # Tier 3 — program editing (17 tests)
  device-keygroups.spec.ts             # Tier 3 — keygroup editing (11 tests)
  device-velocity-zones.spec.ts        # Tier 3 — velocity zones (6 tests)
  device-sample-headers.spec.ts        # Tier 3 — sample headers (2 tests)
  device-sds-transfer.spec.ts          # Tier 3 — SDS transfer (5 tests)
  device-library-roundtrip.spec.ts     # Tier 3 — library round trips (5 tests)

modules/e2e-infra/
  src/node/lib/test-sds.ts             # Tier 3 node — SDS round trip (3 tests)
  src/node/lib/test-reads.ts           # Tier 3 node — header reads (3 tests)
  src/node/lib/test-writes.ts          # Tier 3 node — header writes (4 tests)
  src/node/lib/test-all-fields.ts      # Tier 3 node — field round trips
  helpers/library-ui-helpers.ts        # Shared OPFS + UI helpers
  helpers/connection-helper.ts         # Shared device connection helpers
```

## Verification

Always use run-and-watch.sh:
```bash
# Tier 1 (no hardware needed)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library

# Tier 2 (requires S-550 connected via midi-server)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-device
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-device-library

# Tier 3 Node tests (requires S3000XL via SCSI)
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test writes --verbose'

# Tier 3 browser tests (requires S3000XL via SCSI)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library
```

## Per-Tranche Deliverables

Each tranche of tests (Tier 1, 2, 3) must produce:

1. **Tests** — passing e2e tests for both editors
2. **Parity report** — document in feature docs comparing behavior across editors for every operation tested in that tranche. Explicitly note: what's identical, what diverges, what's missing in one editor
3. **Code duplication audit** — review the code paths exercised by the tranche's tests. Identify any duplicated logic between the two editors that should be shared. Document findings in the parity report. If duplication is found, file it as a follow-up task or fix it before moving to the next tranche.

Parity reports go in `docs/1.0/001-IN-PROGRESS/library-ux/parity-report-tier-{N}.md`.

**Fix-as-you-go:** Duplications found during each tranche's audit should be fixed immediately, before moving to the next tranche. Since fixing requires re-testing, it's most efficient to fix while the test infrastructure is already set up and the tests are fresh. Re-run the tranche's tests after fixing to confirm no regressions.

**Deferred fixes:** Any fix that can't be done immediately (too large, blocked, or out of scope) must be filed as a GitHub issue before moving on. The issue should reference the parity report and describe what's duplicated and where.

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Roland Tier 1 (library OPFS) | **Done** | ~104 tests, 9 spec files |
| S3K Tier 1 (library OPFS) | **Done** | 43 shared + 4 chopper = 47 tests |
| Shared common-area tests | **Done** | 43 tests in e2e-infra/specs/, run against both editors |
| Roland Tier 2 (device) | **Done** | ~80 tests, 17 spec files |
| S3K Tier 3 node tests | **Done** | 16 tests (SDS, reads, writes, multi-sds, drumkit, program-export, disk-browser×3) |
| S3K Tier 3 browser (device) | **Done** | ~50 tests, 7 spec files |
| S3K Tier 3 browser (library round trip) | **Partial** | 5 tests + drum kit import |
| Tier 1 parity report | **Done** | See `parity-report-tier-1.md` — 2 fixes applied, 3 deferred (#174, #175) |
| Tier 2/3 parity reports | **Not started** | Required before closing out |
