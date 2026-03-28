# Library Page and Sets - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Add a dedicated Library page to the S-330 web editor with three-column layout showing device memory, library contents, and item preview. Introduce "Sets" as a new organizational unit that mirrors the S-330's floppy disk workflow, allowing bulk save/restore of complete device state.

**Key design decisions:**

1. **Sets as storage units** - Group tones/patches under named directories
2. **Manifest-based organization** - `set.yaml` defines slot assignments and wave allocation
3. **Namespace isolation** - Tones/patches within sets are scoped to that set
4. **Backward compatibility** - Global library (existing structure) remains functional

## Module Structure

### Library Module Additions

```
modules/sampler-library/src/
├── schemas/
│   └── set-schema.ts              # NEW: Zod schema for set.yaml
├── storage/
│   ├── library-paths.ts           # MODIFY: Add getSetsDirectory()
│   ├── set-paths.ts               # NEW: Set-specific path utilities
│   └── set-storage.ts             # NEW: Set CRUD operations
└── converters/s330/
    └── set-converter.ts           # NEW: Device state ↔ Set conversion
```

### Editor UI Additions

```
modules/s330-editor/src/
├── pages/
│   └── LibraryPage.tsx            # NEW: Main library page
├── components/library/
│   ├── DeviceMemoryPanel.tsx      # NEW: Left panel (device state)
│   ├── LibraryTreePanel.tsx       # NEW: Center panel (library tree)
│   ├── ItemPreviewPanel.tsx       # NEW: Right panel (preview/actions)
│   ├── SaveSetDialog.tsx          # NEW: Save device to set
│   └── LoadSetDialog.tsx          # NEW: Load set to device
└── stores/
    └── libraryStore.ts            # MODIFY: Add sets state
```

## Implementation Phases

### Phase 1: Set Schema and Paths

Create the Zod schema for `set.yaml` and path utilities for set directories.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/schemas/set-schema.ts` | Zod schema for set.yaml manifest |
| `modules/sampler-library/src/storage/set-paths.ts` | Path utilities for sets |

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/sampler-library/src/storage/library-paths.ts` | Add `getSetsDirectory()` |
| `modules/sampler-library/src/schemas/index.ts` | Export set schema |

**Set Schema:**

```typescript
import { z } from 'zod';
import { DeviceTypeSchema } from './common-schema';

export const WaveSegmentAllocationSchema = z.object({
  bank: z.union([z.literal(0), z.literal(1)]),
  segmentTop: z.number().int().min(0).max(17),
  segmentLength: z.number().int().min(1).max(18),
});

export const SetToneEntrySchema = z.object({
  slot: z.number().int().min(0).max(31),
  file: z.string().min(1),
  waveAllocation: WaveSegmentAllocationSchema,
  isEmpty: z.boolean().default(false),
});

export const SetPatchEntrySchema = z.object({
  slot: z.number().int().min(0).max(15),
  file: z.string().min(1),
  isEmpty: z.boolean().default(false),
});

export const SetYamlSchema = z.object({
  format: z.literal('sampler-set'),
  device: DeviceTypeSchema,
  version: z.number().int().positive(),
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
  tones: z.array(SetToneEntrySchema),
  patches: z.array(SetPatchEntrySchema),
  system: z.record(z.unknown()).optional(),
});

export type SetYaml = z.infer<typeof SetYamlSchema>;
export type SetToneEntry = z.infer<typeof SetToneEntrySchema>;
export type SetPatchEntry = z.infer<typeof SetPatchEntrySchema>;
export type WaveSegmentAllocation = z.infer<typeof WaveSegmentAllocationSchema>;
```

**Success criteria:**

- Schema validation tests pass
- Path functions return correct paths for sets

### Phase 2: Set Storage

Implement CRUD operations for sets including tone/patch file management.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/storage/set-storage.ts` | Set CRUD operations |
| `modules/sampler-library/test/unit/storage/set-storage.test.ts` | Storage tests |

**Set Storage Interface:**

```typescript
export interface SetInfo {
  name: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
  toneCount: number;
  patchCount: number;
}

export interface SetData {
  manifest: SetYaml;
  tones: Map<number, { yaml: ToneYaml; wavPath: string }>;
  patches: Map<number, PatchYaml>;
}

export interface SetStorage {
  createSet(device: DeviceType, manifest: SetYaml): Promise<void>;
  loadSet(device: DeviceType, setName: string): Promise<SetData>;
  loadSetManifest(device: DeviceType, setName: string): Promise<SetYaml>;
  updateSetManifest(device: DeviceType, setName: string, manifest: SetYaml): Promise<void>;
  deleteSet(device: DeviceType, setName: string): Promise<void>;
  listSets(device: DeviceType): Promise<SetInfo[]>;
  setExists(device: DeviceType, setName: string): Promise<boolean>;

  saveToneToSet(
    device: DeviceType,
    setName: string,
    slot: number,
    yaml: ToneYaml,
    wavData: Uint8Array,
    sampleRate: number,
    allocation: WaveSegmentAllocation
  ): Promise<void>;

  loadToneFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<{ yaml: ToneYaml; wavPath: string }>;

  savePatchToSet(
    device: DeviceType,
    setName: string,
    slot: number,
    yaml: PatchYaml
  ): Promise<void>;

  loadPatchFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<PatchYaml>;
}
```

**Success criteria:**

- Create, load, update, delete operations work
- Tone/patch files saved in correct locations
- Unit tests achieve 80%+ coverage

### Phase 3: Set Converter

Implement bidirectional conversion between device state and set format.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/converters/s330/set-converter.ts` | Device state ↔ Set conversion |
| `modules/sampler-library/test/unit/converters/s330/set-converter.test.ts` | Converter tests |

**Converter Functions:**

```typescript
// Convert device state to a set
export function deviceStateToSet(
  setName: string,
  input: {
    tones: (S330Tone | null)[];
    patches: (S330Patch | null)[];
    waveData: Map<number, { data: Uint8Array; sampleRate: number }>;
    systemParams?: S330SystemParams;
  }
): {
  manifest: SetYaml;
  tones: Map<number, ToneYaml>;
  patches: Map<number, PatchYaml>;
};

// Convert a set to device upload format
export function setToDeviceState(setData: SetData): {
  tones: Map<number, { tone: S330Tone; waveData: Uint8Array }>;
  patches: Map<number, S330Patch>;
  segmentPlan: WaveSegmentPlan;
};
```

**Success criteria:**

- Round-trip conversion preserves all data
- Empty slots handled correctly
- Wave allocation preserved

### Phase 4: Library Service Integration

Add set methods to the editor's library service for browser-based operations.

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/s330-editor/src/lib/library-service.ts` | Add set export/import methods |
| `modules/s330-editor/src/stores/libraryStore.ts` | Add sets state and actions |
| `modules/sampler-library/src/index.ts` | Export set modules |

**Library Service Methods:**

```typescript
// Add to library-service.ts
export async function saveDeviceToSet(
  setName: string,
  description: string,
  deviceState: DeviceState
): Promise<void>;

export async function loadSetToDevice(
  setName: string,
  options: { overwriteExisting: boolean }
): Promise<DeviceState>;

export async function listSets(): Promise<SetInfo[]>;

export async function deleteSet(setName: string): Promise<void>;
```

**Success criteria:**

- Browser File System Access API integration works
- Set operations available from libraryStore

### Phase 5: Library Page UI

Create the main Library page with three-column layout.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/s330-editor/src/pages/LibraryPage.tsx` | Main library page component |
| `modules/s330-editor/src/components/library/DeviceMemoryPanel.tsx` | Device tones/patches list |
| `modules/s330-editor/src/components/library/LibraryTreePanel.tsx` | Library sets/items tree |
| `modules/s330-editor/src/components/library/ItemPreviewPanel.tsx` | Selected item details |

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/s330-editor/src/App.tsx` | Add `/library` route |
| `modules/s330-editor/src/components/layout/Layout.tsx` | Add "Library" nav item |

**DeviceMemoryPanel:**

- Shows all 32 tone slots (T11-T42) with names
- Shows all 16 patch slots (P01-P16) with names
- Empty slots shown as "(empty)"
- Refresh button to reload from device
- Click to select for preview/export

**LibraryTreePanel:**

- Tree view: Sets → Global Tones → Global Patches
- Expandable set folders showing contents
- Search/filter functionality
- Click item to preview

**ItemPreviewPanel:**

- Shows selected item (from either device or library)
- Waveform visualization for tones
- Parameter summary
- Import button (library → device)
- Export button (device → library)

**Success criteria:**

- Three-column layout renders correctly
- Selection syncs between panels
- Preview updates on selection

### Phase 6: Bulk Operation Dialogs

Create dialogs for saving device to set and loading set to device.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/s330-editor/src/components/library/SaveSetDialog.tsx` | Save device to set dialog |
| `modules/s330-editor/src/components/library/LoadSetDialog.tsx` | Load set to device dialog |

**SaveSetDialog:**

- Text input for set name
- Optional description
- Progress indicator during save
- Error handling for name conflicts

**LoadSetDialog:**

- List of available sets
- Set preview (tone/patch count)
- Confirmation for overwrite
- Progress indicator during load

**Success criteria:**

- Save dialog creates valid set on disk
- Load dialog restores all tones/patches
- Progress feedback during operations

### Phase 7: Testing and Polish

Comprehensive testing and UI refinement.

**Test files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/test/unit/schemas/set-schema.test.ts` | Schema validation tests |
| `modules/sampler-library/test/unit/storage/set-storage.test.ts` | Storage operation tests |
| `modules/sampler-library/test/unit/converters/s330/set-converter.test.ts` | Converter tests |

**Success criteria:**

- All tests pass: `pnpm --filter @audiocontrol/sampler-library test`
- Build succeeds: `pnpm build`
- Manual testing confirms full workflow

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/schemas/set-schema.ts` | Zod schema for set.yaml manifest |
| `modules/sampler-library/src/storage/set-paths.ts` | Path utilities for sets |
| `modules/sampler-library/src/storage/set-storage.ts` | Set CRUD operations |
| `modules/sampler-library/src/converters/s330/set-converter.ts` | Device state ↔ Set conversion |
| `modules/s330-editor/src/pages/LibraryPage.tsx` | Main Library page |
| `modules/s330-editor/src/components/library/DeviceMemoryPanel.tsx` | Device tones/patches list |
| `modules/s330-editor/src/components/library/LibraryTreePanel.tsx` | Library sets/items tree |
| `modules/s330-editor/src/components/library/ItemPreviewPanel.tsx` | Selected item details |
| `modules/s330-editor/src/components/library/SaveSetDialog.tsx` | Save device to set dialog |
| `modules/s330-editor/src/components/library/LoadSetDialog.tsx` | Load set to device dialog |

### Modified Files

| File | Changes |
|------|---------|
| `modules/sampler-library/src/storage/library-paths.ts` | Add `getSetsDirectory()` |
| `modules/sampler-library/src/schemas/index.ts` | Export set schema |
| `modules/sampler-library/src/index.ts` | Export set modules |
| `modules/s330-editor/src/App.tsx` | Add `/library` route |
| `modules/s330-editor/src/components/layout/Layout.tsx` | Add "Library" nav item |
| `modules/s330-editor/src/lib/library-service.ts` | Add set export/import methods |
| `modules/s330-editor/src/stores/libraryStore.ts` | Add sets state and actions |

## Verification

1. **Unit tests**
   ```bash
   pnpm --filter @audiocontrol/sampler-library test
   ```

2. **Build check**
   ```bash
   pnpm build
   ```

3. **Library Page UI testing**
   - Navigate to `/library` route
   - Verify device memory panel shows tones/patches from device
   - Verify library panel shows sets and global items
   - Click items in both panels, verify preview updates
   - Test import button (library → device)
   - Test export button (device → library)

4. **Set operations testing**
   - Click "Save Device to Set..."
   - Enter set name, verify set created in library
   - Verify set.yaml is human-readable
   - Verify tones/ and patches/ directories contain correct files
   - Click "Load Set to Device..."
   - Select a set, verify all tones and patches restored correctly
   - Edit set.yaml manually, reload, verify changes visible

5. **Cross-browser testing**
   - Test in Chrome (File System Access API available)
   - Test in Firefox (fallback to downloads)
