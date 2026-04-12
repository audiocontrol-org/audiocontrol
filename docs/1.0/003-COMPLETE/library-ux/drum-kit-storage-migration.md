# Drum Kit Storage Migration (#182)

## Problem

Roland drum kits are stored at `library/s330/drum-kits/` (device-specific zone) using `kit.yaml` format. Per SAMPLER-LIBRARY.md, drum kits are common-area objects that belong in `library/common/samples/` using `sample.yaml` with `slices` and `drumKit` metadata.

This means:
- Drum kits created in the Roland editor are invisible to the S3K editor
- Drum kits created via the S3K chopper (common area) are invisible to the Roland editor
- Two different storage formats for the same concept

## Current state

### Roland drum kit format (`kit.yaml`)
```yaml
format: drum-kit-bundle
version: 2
name: My Kit
drumKit:
  baseNote: 36
  transpose: 0
  velocitySensitivity: 0
kits:
  - name: default
    samples:
      - { file: kick.wav, label: Kick }
      - { file: snare.wav, label: Snare }
```
Stored at: `library/s330/drum-kits/{name}/kit.yaml` + individual WAV files per sample

### Common-area format (`sample.yaml`)
```yaml
format: sample
version: 1
name: My Kit
file: sample.wav
sampleRate: 44100
drumKit:
  baseNote: 36
slices:
  - { label: Kick, startSample: 0, endSample: 15000 }
  - { label: Snare, startSample: 15000, endSample: 30000 }
```
Stored at: `library/common/samples/{name}/sample.yaml` + single source WAV

### Key difference
The old format uses individual WAV files per sample. The new format uses a single source WAV with slice boundaries. The chopper creates the new format. The old format predates the chopper.

## Migration approach

### Phase 1: Make Roland read from common area

Update the Roland drum kits category to scan `library/common/samples/` for items with `drumKit` metadata, just like the S3K editor already does (via the unified `sample` node type).

Remove the `drumKits` category from the Roland plugin. Drum kits show up in the `samples` category with the "4 pads" badge, same as S3K.

### Phase 2: Remove old storage code

Delete `library-drumkits.ts` (366 lines) and the `detectDrumKit` / `scanDrumKitsDirectory` functions from `sampler-library/library-fs.ts`.

Remove the `drumKits` category from Roland plugin categories.

### Phase 3: Update tests

The Roland e2e test `library-ui-operations.spec.ts` has a drum kit crash test that writes to the old path. Remove it — the shared `library-drumkit-editor.spec.ts` and `library-drumkit-error.spec.ts` test drum kits via the common-area path.

### Phase 4: Migration for existing data

Users with existing drum kits at `library/s330/drum-kits/` need a migration path. Options:
- Auto-detect on startup and offer to migrate
- CLI migration tool
- Just document it and let users re-create

For now: document the change. Existing drum kits at the old path will stop appearing in the library. Users can re-create them via the chopper.

## Files to modify

| File | Change |
|------|--------|
| `roland-sxx0-editor/src/lib/library-drumkits.ts` | Delete entirely |
| `roland-sxx0-editor/src/plugins/shared/categories.tsx` | Remove `createDrumKitsCategory` |
| `roland-sxx0-editor/src/plugins/s330-library-plugin.tsx` | Remove drumKits category |
| `roland-sxx0-editor/src/plugins/s550-library-plugin.tsx` | Remove drumKits category |
| `roland-sxx0-editor/src/hooks/useRolandLibraryData.ts` | Remove drumKits data loading |
| `roland-sxx0-editor/src/hooks/useRolandEditorDialogs.ts` | Update drum kit loading to use common-area APIs |
| `roland-sxx0-editor/src/hooks/useDirectoryOperations.ts` | Remove drum-kit directory ops |
| `roland-sxx0-editor/src/hooks/useLibraryTreeActions.tsx` | Remove drumKits from category unions |
| `roland-sxx0-editor/src/components/library/LibraryTreePanel.tsx` | Remove drumKits section |
| `roland-sxx0-editor/src/components/library/LibraryTreeNode.tsx` | Remove drumKits category |
| `roland-sxx0-editor/src/stores/libraryStore.ts` | Remove drumKits state |
| `sampler-library/src/library-fs.ts` | Remove detectDrumKit, scanDrumKitsDirectory |
| `e2e-infra/helpers/library-ui-helpers.ts` | Remove ROLAND_DRUM_KITS_PATH |

## Verification

```bash
# Shared common-area tests (drum kit tests pass in both editors)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-common-library-s3k
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-common-library-roland

# Roland-specific tests
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library

# Build
pnpm --filter roland-sxx0-editor build
pnpm --filter sampler-library build
```
