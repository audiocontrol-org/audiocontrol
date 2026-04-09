# Tier 2/3 Parity Report

Audit of code paths exercised by Tier 2 (Roland device) and Tier 3 (S3K device + SCSI) e2e tests, comparing behavior across editors for common-area operations. Device-specific operations (tones, patches, sets for Roland; SDS transfer for S3K) are excluded — they're legitimately different.

## Operations Audited

### 1. Sample transfer: library ↔ device

| Aspect | Roland | S3K | Status |
|--------|--------|-----|--------|
| Send sample to device | Import WAV as tone (device-specific) | SDS upload with post-rename | Different (correct — different protocols) |
| Receive sample from device | Export tone as WAV | SDS download | Different (correct) |
| Round trip | Tone import → export → compare YAML | SDS send → receive → compare PCM | Different (correct) |
| Transfer dialog | ImportSamplesDialog | SendSampleDialog / ReceiveSampleDialog | Different (correct — different UX) |

**Parity status:** No duplication. Transfer protocols are fundamentally different (Roland SysEx DT1/RQD vs Akai SDS). Each editor has its own transfer dialogs, which is correct.

### 2. Program export: device → library

| Aspect | Roland | S3K | Status |
|--------|--------|-----|--------|
| Export to device-specific library | Tone/patch YAML + WAV | Program YAML (serialized SysEx) | Different (correct — different formats) |
| Export to common area | Not implemented | `akaiProgramToCommon` → ProgramYaml with zones | **Gap: Roland has no "promote to common area" for tones/patches** |

**Finding:** Roland can export tones/patches to device-specific library but cannot promote them to common-area programs. S3K can promote programs to common area via `promoteToCommonArea`. This is a feature gap, not a code duplication issue.

**Filed as:** Future work — Roland "promote to common area" would convert tones to common-area samples and patches to common-area programs.

### 3. Drum kit import: library → device

| Aspect | Roland | S3K | Status |
|--------|--------|-----|--------|
| Source format | Common-area chopped sample (sample.yaml with slices + drumKit) | Same | **Parity** |
| Import dialog | ImportSamplesDialog (batch tone import) | ImportDrumKitDialog (staged SDS + program/keygroups) | Different (correct — different device APIs) |
| Device result | Tones + patch on device | Samples + program + keygroups on device | Different (correct) |
| Node e2e test | Not applicable (no Node MIDI path) | `test-drumkit.ts` — staged SDS batch | S3K only |
| Browser e2e test | `device-drumkit.spec.ts` | `device-library-drumkit-import.spec.ts` | Both have tests |

**Parity status:** Both editors read drum kits from the same common-area format. Import mechanisms differ by device protocol.

### 4. Editor dialogs (Loop Editor, Sample Chopper, Sample Editor)

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| State management | `useEditorDialogsCore` (shared) | Same | Already shared |
| Dialog rendering | Duplicated ~50 lines JSX in each LibraryPage | `EditorDialogGroup` in editor-core (#175) | **Fixed** |
| Device-specific config | S3K: `S3kKitOutputConfig` via `renderChopperOutputConfig` | Same — injected via render prop | **Parity** |
| Chopper initial slices | Roland passed `initialSlices`; S3K didn't | Both now pass `initialSlices` + `editMode` | **Fixed** |

### 5. Common-area item types and categories

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| Sample item type | Duplicated in both editors | `commonSampleItemType` in editor-core | **Fixed** |
| Program item type | Duplicated | `commonProgramItemType` in editor-core | **Fixed** |
| Category factories | Duplicated | `createCommonSamplesCategory` / `createCommonProgramsCategory` in editor-core | **Fixed** |
| Category IDs | Roland: `commonSamples`/`commonPrograms`, S3K: `samples`/`programs` | Both: `samples`/`programs` | **Fixed** |
| Icons | Duplicated SVGs | `SampleIcon`, `ProgramIcon` in editor-core | **Fixed** |
| `NewFolderButton` | Duplicated | Shared in editor-core | **Fixed** |

### 6. Sample node types

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| Node types | `sample`, `chopped-sample`, `drum-kit` (3 types) | `sample` with `sliceCount` + `hasDrumKit` metadata | **Fixed** |
| Preview panels | 3 separate components per editor | S3K: unified `SamplePreview`. Roland: `SampleBundlePreviewPanel` (still separate) | **Partial** |
| `choppedSamples` category | Roland had separate category | Eliminated | **Fixed** |

**Remaining gap:** Roland's `SampleBundlePreviewPanel` is still a separate component from the shared `SamplePreview` in editor-core. Both work correctly but aren't consolidated. Low priority — not a nucleation site since the Roland component handles device-specific preview features (tone import, set load).

### 7. Drum kit storage

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| Storage path | Roland: `library/s330/drum-kits/` (device-specific). S3K: `library/common/samples/` | Both: `library/common/samples/` | **Fixed** (#182) |
| Storage format | Roland: `kit.yaml`. S3K: `sample.yaml` with `drumKit` + `slices` | Both: `sample.yaml` | **Fixed** |
| Deleted code | `library-drumkits.ts` (366 lines), `detectDrumKit`, `scanDrumKitsDirectory` | — | **-1,329 lines** |

### 8. Disk browser

| Aspect | Roland | S3K | Status |
|--------|--------|-----|--------|
| Disk browsing | Not implemented | DiskBrowserPanel + DiskToLibraryDialog | S3K only (correct — Roland uses floppy, not SCSI) |
| Disk program parser | N/A | Fixed: 192-byte records, correct offsets per akaitools | S3K only |
| Save to library | N/A | Both S3K library + common area paths | S3K only |

### 9. SCSI bridge

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| MIDI send paths | Two paths: protobuf `send_sysex` + raw CDB `scsi_midi_send` | One path: raw CDB only | **Fixed** |
| MIDI mode lifecycle | Not managed after SDS | Enable before SysEx, disable after | **Fixed** |
| SysEx response dispatch | Matched any Akai response (F0 47) | Precise opcode matching | **Fixed** |
| Background poll loop | 50ms poll racing with send/receive | Removed (vestigial) | **Fixed** |

## Duplication Audit Summary

### Fixed during this effort

| Duplication | Lines removed | Reference |
|-------------|---------------|-----------|
| Roland drum kit storage (`library-drumkits.ts`) | 366 | #182 |
| Roland `library-chopped-samples.ts` | 77 | Duplicate of `loadSampleMeta` |
| `choppedSamples` category in Roland | ~50 | Separate category for same concept |
| `commonSamples`/`commonPrograms` category IDs | ~30 | Standardized to `samples`/`programs` |
| Editor dialog JSX in both LibraryPages | ~100 | `EditorDialogGroup` in editor-core (#175) |
| Item types + categories in both editors | ~200 | Moved to editor-core |
| Icons (SVGs) in both editors | ~60 | Moved to editor-core |
| S3K LibraryPage inline hooks | ~135 | Extracted to 4 hooks (#174) |
| Bridge protobuf MIDI layer | ~100 | Eliminated duplicate send path |

### Remaining (acceptable)

| Item | Reason |
|------|--------|
| Roland `SampleBundlePreviewPanel` | Handles device-specific preview features not in shared component |
| Transfer dialogs differ between editors | Different device protocols require different UX |
| Roland `ItemPreviewPanel` for tones/patches | Device-specific objects with no S3K equivalent |

### Not duplicated (confirmed shared)

- `useEditorDialogsCore` — strategy pattern, well-designed
- `PluginLibraryBrowser` — shared component
- `useLibraryOperations` — shared hook
- `useLibraryConnection` + `LibraryConnectionUI` — shared
- `DrumKitPadList` — shared in editor-core
- Common-area item types, categories, icons — shared in editor-core
- `EditorDialogGroup` — shared in editor-core
- E2E test specs — shared in e2e-infra/specs/, env-parameterized
