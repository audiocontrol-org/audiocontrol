# Library E2E Test Plan

## Overview

Comprehensive e2e tests for library operations across both editors. Tests are organized into three tiers based on hardware requirements:

- **Tier 1: Library-only** (OPFS, no device) — runs via `make test-e2e-{roland,s3k}-library`
- **Tier 2: Roland device** (S-550 via midi-server) — runs via `make test-e2e-roland-device-library`
- **Tier 3: S3K device** (S3000XL via SCSI bridge) — runs via `make test-e2e-s3k-device-library`

E2E tenets apply: real storage, real browser APIs, real hardware for device tests. No mocking. Device tests must be atomic round trips.

## Test Infrastructure Needed

### New Playwright configs

Device+library tests need configs combining device connection with OPFS:
- `modules/roland-sxx0-editor/playwright.device-library.config.ts` — testMatch: `device-library-*.spec.ts`
- `modules/akai-s3k-editor/playwright.device-library.config.ts` — testMatch: `device-library-*.spec.ts`

### New Make targets

```makefile
test-e2e-roland-device-library   # S-550 + OPFS
test-e2e-s3k-device-library      # S3000XL SCSI + OPFS
```

### Shared test helpers (extend `e2e-infra/helpers/library-ui-helpers.ts`)

- Device memory helpers: `waitForDeviceMemoryLoaded`, `selectDeviceSlot`, `getDeviceSlotName`
- Transfer helpers: `waitForTransferComplete`, `waitForDialogClose`
- Assertion helpers: `verifyToneInOPFS`, `verifyProgramInOPFS`, `verifySampleInOPFS`

---

## Tier 1: Library-Only Tests (no device)

Files: `library-ui-operations.spec.ts`, `library-editor-dialogs.spec.ts`

### Tree operations
- [x] Select common-area sample → preview shows details
- [x] Select drum kit → page doesn't crash
- [x] Create folder in common area → persists in OPFS
- [x] Create folder in device-specific category → persists in OPFS (Roland)
- [ ] Delete sample from library → removed from OPFS
- [ ] Delete folder from library → removed from OPFS
- [ ] Rename sample → name changes in OPFS
- [ ] Move sample to subfolder → moved in OPFS
- [ ] File drop WAV into samples → sample appears in tree and OPFS
- [ ] Context menu → rename action triggers inline edit
- [ ] Context menu → delete action removes item
- [ ] Context menu → open loop editor opens dialog
- [ ] Context menu → open chopper opens dialog
- [ ] Context menu → open sample editor opens dialog

### Editor dialogs
- [ ] Loop editor → save loop points → sample.yaml updated in OPFS
- [ ] Sample editor → save modified audio → WAV updated in OPFS
- [ ] Sample chopper → chop and save → new chopped sample in OPFS
- [ ] Drum kit editor → save changes → kit metadata updated in OPFS

### Preview panel
- [ ] Select sample → shows sample rate, loop mode, root key
- [ ] Select program → shows zone count
- [ ] Select drum kit → shows kit info
- [ ] Deselect → shows "Select an item" empty state

### Sets (Roland only)
- [ ] Expand set → shows tones and patches
- [ ] Select set → preview shows set info
- [ ] Delete set → removed from OPFS
- [ ] Rename set → name changes in OPFS

### Storage connection
- [ ] Connect to OPFS → tree loads
- [ ] Disconnect → tree clears
- [ ] Reconnect → tree reloads

---

## Tier 2: Roland Device Tests (S-550 via midi-server)

File: `device-library-roundtrip.spec.ts`

Setup: connect to S-550 via HTTP MIDI, navigate to library, connect OPFS.

### Export (device → library)
- [ ] Export tone from device → tone file in OPFS
- [ ] Export patch from device → patch file in OPFS
- [ ] Save set from device → set directory with manifest in OPFS

### Import (library → device)
- [ ] Import tone from library → device tone slot populated (verify by re-exporting)
- [ ] Import patch from library → device patch slot populated
- [ ] Load set into device → tones and patches loaded

### Round trip (atomic: import → export → compare)
- [ ] Tone round trip: create fixture → import to device → export back → compare YAML
- [ ] Patch round trip: create fixture → import → export → compare
- [ ] Set round trip: save set → clear device → load set → verify device state

### Conversion boundary: device-specific ↔ common area
- [ ] Promote tone to common area → verify SampleYaml + WAV (requires new "Promote to Common Area" button)
- [ ] Promote patch to common area → verify ProgramYaml (requires new button)
- [ ] Edit device-specific tone in sample editor → result saved to common area
- [ ] Edit device-specific tone in loop editor → loop points saved to common area
- [ ] Import common-area sample to device as tone → verify tone on device

### Drag and drop
- [ ] Drag library tone to device slot → import dialog opens
- [ ] Drag device tone to library tree → export dialog opens

---

## Tier 3: S3K Device Tests (S3000XL via SCSI bridge)

File: `device-library-roundtrip.spec.ts`

Setup: connect to S3000XL via SCSI bridge, navigate to library, connect OPFS.

### Export (device → library)
- [ ] Export sample from device via SDS → WAV file in OPFS
- [ ] Export program from device via SysEx → program YAML in OPFS

### Import (library → device)
- [ ] Send sample to device via SDS → device sample slot populated
- [ ] Import program to device via SysEx → device program slot populated
- [ ] Import drum kit → program + samples created on device
- [ ] Import instrument (common-area program) → keygroups created on device

### Round trip (atomic)
- [ ] Sample round trip: write WAV fixture → send to device → receive back → compare WAV
- [ ] Program round trip: write program fixture → import → export → compare YAML

### Conversion boundary: device-specific ↔ common area
- [ ] Promote S3K program to common area → verify ProgramYaml with zones + WAV files
- [ ] Import common-area program to S3K device → verify keygroups match zones
- [ ] Full round trip: export program → promote → reimport as instrument → compare keygroup structure

### Conversion boundary: disk ↔ device-specific library
- [ ] Import disk program to device-specific library → verify s3k program YAML in OPFS
- [ ] Import disk sample to device-specific library → verify WAV in OPFS

### Conversion boundary: disk ↔ common area
- [ ] Import disk program to common area → verify ProgramYaml with zones in OPFS
- [ ] Import disk sample to common area → verify SampleYaml + WAV in OPFS

### Disk browser
- [ ] Disk browser shows partitions and volumes
- [ ] Save disk program to S3K library
- [ ] Save disk program to common area (vendor-neutral)
- [ ] Save disk sample to library as WAV

---

## Parity Tests: Same Operation, Both Editors

Tests verifying the same operation works identically in both editors. These catch divergence bugs.

| Operation | Roland | S3K | Parity Status |
|-----------|--------|-----|---------------|
| Create folder in common area | ✓ tested | ✓ tested | Parity |
| Delete item from common area | needs test | needs test | **Untested** |
| Rename item in common area | needs test | needs test | **Untested** |
| Move item in common area | needs test | needs test | **Untested** |
| File drop WAV into common area | needs test | needs test | **Untested** |
| Select item → preview shows details | ✓ tested | ✓ tested | Parity |
| Context menu → open loop editor | needs test | needs test | **Untested** |
| Context menu → open sample editor | needs test | needs test | **Untested** |
| Context menu → open chopper | needs test | needs test | **Untested** |
| Loop editor save → common area | needs test | needs test | **Untested** |
| Sample editor save → common area | needs test | needs test | **Untested** |
| Chopper save → common area | needs test | needs test | **Untested** |
| Promote device-specific to common area | needs UI + test | ✓ has button, needs test | **Gap: Roland has no button** |
| Connect/disconnect OPFS | needs test | needs test | **Untested** |

### Known parity gaps to fix

1. **Roland has no "Promote to Common Area" button** — S3K has it on program preview. Roland needs equivalent on tone/patch preview.
2. **Context menu actions** — verify both editors route actions identically through shared hook.
3. **Rename implementation** — Roland strategy handles device-specific rename. S3K strategy doesn't implement rename (throws). Need to verify both work for common-area items.

---

## Test File Organization

```
modules/roland-sxx0-editor/e2e/
  library-ui-operations.spec.ts      # Tier 1 (library-only)
  library-editor-dialogs.spec.ts     # Tier 1 (editor dialogs)
  library-sets.spec.ts               # Tier 1 (sets, existing)
  device-library-roundtrip.spec.ts   # Tier 2 (device transfer)

modules/akai-s3k-editor/e2e/
  library-ui-operations.spec.ts      # Tier 1 (library-only)
  library-editor-dialogs.spec.ts     # Tier 1 (editor dialogs)
  device-library-roundtrip.spec.ts   # Tier 3 (device transfer)
  device-library-disk.spec.ts        # Tier 3 (disk browser)

modules/e2e-infra/helpers/
  library-ui-helpers.ts              # Shared OPFS + UI helpers
  connection-helper.ts               # Shared device connection helpers
```

## Verification

```bash
# Tier 1 (no hardware needed)
make test-e2e-roland-library
make test-e2e-s3k-library

# Tier 2 (requires S-550 connected)
E2E_DEVICE_TYPE=s550 make test-e2e-roland-device-library

# Tier 3 (requires S3000XL via SCSI)
make test-e2e-s3k-device-library
```

## Per-Tranche Deliverables

Each tranche of tests (Tier 1, 2, 3) must produce:

1. **Tests** — passing e2e tests for both editors
2. **Parity report** — document in feature docs comparing behavior across editors for every operation tested in that tranche. Explicitly note: what's identical, what diverges, what's missing in one editor
3. **Code duplication audit** — review the code paths exercised by the tranche's tests. Identify any duplicated logic between the two editors that should be shared. Document findings in the parity report. If duplication is found, file it as a follow-up task or fix it before moving to the next tranche.

Parity reports go in `docs/1.0/001-IN-PROGRESS/library-ux/parity-report-tier-{N}.md`.

## Implementation Order

1. Extend Tier 1 tests in existing `library-ui-operations.spec.ts` files (both editors)
   - Write parity report for Tier 1 operations
   - Audit code paths for duplication
2. Create device-library configs and make targets for Tier 2 and 3
3. Write Tier 2 Roland tests (S-550 + library)
   - Write parity report for device transfer operations
   - Audit transfer code for duplication
4. Write Tier 3 S3K tests (SCSI + library)
   - Write parity report for SCSI/disk operations
   - Audit conversion boundary code for duplication
