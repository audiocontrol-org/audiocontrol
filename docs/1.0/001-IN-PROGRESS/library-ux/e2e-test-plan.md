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

#### `test-disk-browser.ts` (5 tests)
- [x] Disk enumerate: probe all SCSI IDs, parse Akai partitions/volumes/files
- [x] Disk read sample: read sample from disk, parse header, extract audio, convert to WAV
- [x] Disk read program: read program from disk, parse keygroups, convert to common area ("MOOGB" → 11 keygroups → 22 zones)
- [x] Disk save sample: read sample → convert to WAV → save to common area via NodeDirectoryHandle → verify YAML + WAV
- [x] Disk save program: read program + referenced samples → save all to common area → verify program.yaml + sample WAVs

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
- [x] Disk browser: read disk program, convert to common area (node test — fixed parser to use 192-byte records)
- [x] Disk browser: save disk sample to library — read from disk, convert to WAV, write to common area (node test)
- [x] Disk browser: save disk program to library — read program + referenced samples, write to common area (node test, 3 samples saved with correct names)
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
modules/e2e-infra/
  specs/                                 # Shared common-area tests (env-parameterized)
    library-opfs.spec.ts                 #   8 tests — OPFS infrastructure
    library-directories.spec.ts          #   19 tests — directory CRUD
    library-ui-operations.spec.ts        #   7 tests — sample preview, folder, delete, connect
    library-drumkit-editor.spec.ts       #   5 tests — drum kit pad preview, MIDI notes
    library-drumkit-error.spec.ts        #   2 tests — missing WAV error handling
  playwright.library.config.ts           # Shared Playwright config for common-area tests
  scripts/run-common-library-e2e.sh      # Dev server + Playwright + watchdog runner
  src/node/lib/                          # Node-based S3K device tests
    test-sds.ts                          #   3 tests — SDS round trip + rename
    test-multi-sds.ts                    #   1 test — 4 back-to-back SDS uploads
    test-drumkit.ts                      #   1 test — staged drum kit import
    test-program-export.ts               #   1 test — program → common area
    test-disk-browser.ts                 #   3 tests — enumerate, read sample, read program
    test-reads.ts                        #   3 tests — header reads
    test-writes.ts                       #   4 tests — header writes
  helpers/
    library-ui-helpers.ts                # Shared OPFS + UI helpers
    library-fixtures.ts                  # Shared OPFS fixture writers
    opfs-page-helpers.ts                 # page.evaluate OPFS helpers
    connection-helper.ts                 # Device connection helpers

modules/roland-sxx0-editor/e2e/
  library-tones.spec.ts                  # Roland-specific — tone CRUD (20 tests)
  library-patches.spec.ts                # Roland-specific — patch CRUD (21 tests)
  library-sets.spec.ts                   # Roland-specific — set operations (23 tests)
  library-chopper-save.spec.ts           # Roland-specific — chopper save (7 tests)
  library-ui-operations.spec.ts          # Roland-specific — tones folder test (1 test)
  device-*.spec.ts (17 files)            # Tier 2 — device tests (~80 tests)

modules/akai-s3k-editor/e2e/
  library-chopper-save.spec.ts           # S3K-specific — chopper save (4 tests)
  device-*.spec.ts (7 files)             # Tier 3 — device tests (~50 tests)
  device-library-*.spec.ts (2 files)     # Tier 3 — device+library round trips
```

No common-area test files in editor e2e/ directories. Common-area tests run from
e2e-infra/specs/ via env-parameterized make targets. Editor directories contain
ONLY device-specific tests.

## Verification

Always use run-and-watch.sh:
```bash
# Common-area library tests (shared specs, no hardware)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-common-library-s3k
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-common-library-roland

# Editor-specific library tests (no hardware)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library

# Tier 2 Roland device tests (requires S-550 via midi-server)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-device
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-device-library

# Tier 3 S3K node tests (requires S3000XL via SCSI)
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test drumkit --verbose'

# Tier 3 S3K browser tests (requires S3000XL via SCSI)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library
```

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Shared common-area tests | **Done** | 43 tests in e2e-infra/specs/, env-parameterized, run against both editors |
| Roland device-specific library | **Done** | ~72 tests (tones, patches, sets, chopper, UI ops) |
| Roland Tier 2 (device) | **Done** | ~80 tests, 17 spec files |
| S3K device-specific library | **Done** | 4 chopper tests |
| S3K Tier 3 node tests | **Done** | 18 tests (SDS, reads, writes, multi-sds, drumkit, program-export, disk-browser×5) |
| S3K Tier 3 browser (device) | **Done** | ~50 tests, 7 spec files |
| S3K Tier 3 browser (library round trip) | **Done** | 5 tests + drum kit import |
| Tier 1 parity report | **Done** | See `parity-report-tier-1.md` — all items resolved (#174, #175, #182 fixed) |
| Tier 2/3 parity reports | **Not started** | Required before closing out |

## Structural Refactors Completed

| Issue | What | Result |
|-------|------|--------|
| #174 | S3K LibraryPage hook extraction | 604→479 lines, 4 hooks extracted |
| #175 | Shared EditorDialogGroup | Dialogs rendered from editor-core, device config via render props |
| #182 | Roland drum kit storage violation | Deleted library/s330/drum-kits/, -1,329 lines |
| — | Unified sample node type | chopped-sample + drum-kit → sample with metadata |
| — | Common-area extraction | Item types, categories, icons, DrumKitPadList in editor-core |
| — | Category ID standardization | commonSamples/commonPrograms → samples/programs |
| — | Duplicate code removal | library-chopped-samples.ts, library-drumkits.ts, choppedSamples category |
| — | Disk program parser fix | 192-byte record size (not 8192), GROUPS offset 0x2A, ZONE_SNAME 0x22, zone stride 0x18 per akaitools |
