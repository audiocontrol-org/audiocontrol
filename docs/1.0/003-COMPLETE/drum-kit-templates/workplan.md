# Drum Kit Template System - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Add a drum kit template system that allows users to import complete drum kits from WAV sample bundles. The system auto-detects drum types from filenames, supports optional YAML configuration, and creates tones + patch on the device with correct MIDI mappings.

**Key design decisions:**

1. **Filename convention** - Auto-detect drum type and kit number from `{TYPE} {##}.wav` pattern
2. **Optional YAML config** - Override auto-detection with explicit `kit.yaml`
3. **4-note kits** - Each kit maps to 4 consecutive MIDI notes (kick, snare, closed HH, open HH)
4. **One-shot tones** - Drum samples imported with one-shot loop mode

## Module Structure

### Library Module Additions

```
modules/sampler-library/src/
├── schemas/
│   └── drum-kit-bundle-schema.ts      # NEW: Zod schema for kit.yaml
└── drum-kits/
    ├── drum-kit-parser.ts             # NEW: Filename parsing and kit detection
    └── index.ts                       # NEW: Exports
```

### Editor UI Additions

```
modules/s330-editor/src/
├── lib/
│   └── library-service.ts             # MODIFY: Add drum kit functions
├── components/library/
│   ├── LibraryTreePanel.tsx           # MODIFY: Add "Drum Kits" section
│   ├── DrumKitPreviewPanel.tsx        # NEW: Kit preview with MIDI mapping
│   └── ImportDrumKitDialog.tsx        # NEW: Slot selection dialog
├── hooks/
│   └── useImportDrumKit.ts            # NEW: Import logic
└── pages/
    └── LibraryPage.tsx                # MODIFY: Wire drum kit flow
```

## Implementation Phases

### Phase 1: Drum Kit Schema

Create Zod schema for `kit.yaml` format.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/schemas/drum-kit-bundle-schema.ts` | Schema for kit.yaml |

**Schema:**

```typescript
import { z } from 'zod';
import { MidiNoteSchema } from './common-schema';

export const DrumKitSamplesSchema = z.object({
  kick: z.string(),
  snare: z.string(),
  hhClosed: z.string(),
  hhOpen: z.string(),
});

export const DrumKitEntrySchema = z.object({
  samples: DrumKitSamplesSchema,
});

export const DrumKitBundleSchema = z.object({
  format: z.literal('drum-kit-bundle'),
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sampleRate: z.union([z.literal(15000), z.literal(30000)]).default(30000),
  baseNote: MidiNoteSchema.default('C2'),
  kits: z.array(DrumKitEntrySchema).optional(),
});

export type DrumKitBundle = z.infer<typeof DrumKitBundleSchema>;
export type DrumKitEntry = z.infer<typeof DrumKitEntrySchema>;
export type DrumKitSamples = z.infer<typeof DrumKitSamplesSchema>;
```

**Success criteria:**

- Schema validates well-formed kit.yaml
- Schema rejects invalid formats
- Type exports work

### Phase 2: Drum Kit Parser

Create parser for auto-detecting kits from filenames.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/drum-kits/drum-kit-parser.ts` | Filename parsing and kit detection |
| `modules/sampler-library/src/drum-kits/index.ts` | Module exports |

**Parser Functions:**

```typescript
// Detected drum sample info
export interface DetectedDrumSample {
  type: 'kick' | 'snare' | 'hhClosed' | 'hhOpen';
  kitNumber: number;
  filename: string;
}

// Complete detected kit
export interface DetectedKit {
  kitNumber: number;
  samples: {
    kick?: string;
    snare?: string;
    hhClosed?: string;
    hhOpen?: string;
  };
  midiNotes: {
    kick: number;
    snare: number;
    hhClosed: number;
    hhOpen: number;
  };
}

// Resolved drum kit bundle (merged config + detection)
export interface ResolvedDrumKitBundle {
  name: string;
  description?: string;
  sampleRate: 15000 | 30000;
  kits: DetectedKit[];
  totalSamples: number;
}

// Parse filename to detect drum type and kit number
export function parseDrumFilename(filename: string): DetectedDrumSample | null;

// Scan directory files and detect kits
export function parseDrumKitDirectory(files: string[]): DetectedKit[];

// Merge YAML config with auto-detection
export function loadDrumKitBundle(
  yaml: DrumKitBundle | null,
  files: string[],
  directoryName: string
): ResolvedDrumKitBundle;

// Calculate MIDI notes for a kit
export function resolveMidiNotes(baseNote: number, kitIndex: number): {
  kick: number;
  snare: number;
  hhClosed: number;
  hhOpen: number;
};
```

**Success criteria:**

- Parses `KICK 01.wav` → `{ type: 'kick', kitNumber: 1 }`
- Groups samples into kits by kit number
- Merges explicit YAML config with auto-detected files
- Calculates correct MIDI note assignments

### Phase 3: Module Exports

Export drum kit functionality from sampler-library.

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/sampler-library/src/browser.ts` | Export drum kit parser |
| `modules/sampler-library/src/schemas/index.ts` | Export drum kit schema |

**Success criteria:**

- `@audiocontrol/sampler-library/browser` exports drum kit functions
- Types available for import in s330-editor

### Phase 4: Library Service Extensions

Add drum kit directory functions to library service.

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/s330-editor/src/lib/library-service.ts` | Add drum kit functions |

**Library Service Functions:**

```typescript
// Info about a drum kit directory
export interface DrumKitInfo {
  name: string;
  description?: string;
  kitCount: number;
  sampleCount: number;
}

// List drum kit directories
export async function listDrumKits(
  directoryHandle: FileSystemDirectoryHandle
): Promise<DrumKitInfo[]>;

// Load complete drum kit bundle (config + file list)
export async function loadDrumKitBundle(
  directoryHandle: FileSystemDirectoryHandle,
  kitName: string
): Promise<ResolvedDrumKitBundle>;

// Load a single WAV from drum kit
export async function loadDrumKitSample(
  directoryHandle: FileSystemDirectoryHandle,
  kitName: string,
  fileName: string
): Promise<Uint8Array>;
```

**Success criteria:**

- Lists drum kit directories from `drum-kits/` subdirectory
- Loads and parses kit.yaml if present
- Returns resolved drum kit bundle with all metadata

### Phase 5: LibraryTreePanel Update

Add "Drum Kits" section to the library tree.

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/s330-editor/src/components/library/LibraryTreePanel.tsx` | Add Drum Kits section |

**Changes:**

- Add "Drum Kits" expandable section after "Sets"
- Show list of drum kit directories
- Show kit count and sample count for each
- Selection triggers preview panel update

**Success criteria:**

- Drum Kits section appears in library tree
- Directories listed with metadata
- Click selects kit for preview

### Phase 6: DrumKitPreviewPanel

Create preview panel showing kit details and MIDI mapping.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/s330-editor/src/components/library/DrumKitPreviewPanel.tsx` | Kit preview UI |

**Panel Contents:**

- Kit name and description
- List of detected kits (numbered)
- For each kit: sample filenames and MIDI note assignments
- Visual representation of MIDI keyboard range
- "Import to Device" button

**Success criteria:**

- Shows all detected kits with sample names
- Displays MIDI note range clearly
- Import button visible and clickable

### Phase 7: ImportDrumKitDialog

Create dialog for selecting import targets.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/s330-editor/src/components/library/ImportDrumKitDialog.tsx` | Slot selection dialog |

**Dialog Contents:**

- Starting tone slot selector (T11-T48, needs N consecutive slots)
- Wave bank selector (A/B)
- Starting segment selector
- Target patch slot selector (P01-P16)
- Preview of slot allocation
- Progress bar during import
- Error/success messages

**Success criteria:**

- Validates sufficient consecutive tone slots
- Shows allocation preview before import
- Displays progress during import

### Phase 8: useImportDrumKit Hook

Create hook to handle the import process.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/s330-editor/src/hooks/useImportDrumKit.ts` | Import logic |

**Import Process:**

```typescript
export interface ImportDrumKitOptions {
  bundle: ResolvedDrumKitBundle;
  startingToneSlot: number;       // 0-31 (T11-T48)
  waveBank: 0 | 1;                // A or B
  startingSegment: number;        // 0-17
  targetPatchSlot: number;        // 0-15 (P01-P16)
}

export interface UseImportDrumKitReturn {
  isImporting: boolean;
  importProgress: number | undefined;
  importError: string | null;
  importStatus: string | null;
  importDrumKit(options: ImportDrumKitOptions): Promise<void>;
}

// The import process:
// 1. Load all WAV files from the kit directory
// 2. Convert each to S330 format (wavToS330)
// 3. Create S330Tone objects with one-shot loop mode
// 4. Upload each tone to consecutive slots
// 5. Create S330Patch with toneLayer1 mapping MIDI notes to tone slots
// 6. Upload patch to device
// 7. Update local state
```

**Success criteria:**

- All samples converted and uploaded
- Tones created with one-shot loop mode
- Patch created with correct key mappings
- Progress updates during import
- Error handling for failures

### Phase 9: LibraryPage Integration

Wire drum kit selection and import into LibraryPage.

**Files to modify:**

| File | Changes |
|------|---------|
| `modules/s330-editor/src/pages/LibraryPage.tsx` | Add drum kit state and handlers |

**Changes:**

- Add state for selected drum kit
- Add ImportDrumKitDialog to page
- Add handler for drum kit selection from tree
- Show DrumKitPreviewPanel when drum kit selected
- Connect import button to dialog

**Success criteria:**

- Full flow works: select kit → preview → import → device updated
- Progress feedback during import
- Error messages displayed

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `modules/sampler-library/src/schemas/drum-kit-bundle-schema.ts` | Schema for kit.yaml |
| `modules/sampler-library/src/drum-kits/drum-kit-parser.ts` | Filename parsing and kit detection |
| `modules/sampler-library/src/drum-kits/index.ts` | Exports |
| `modules/s330-editor/src/components/library/DrumKitPreviewPanel.tsx` | Preview UI |
| `modules/s330-editor/src/components/library/ImportDrumKitDialog.tsx` | Import dialog |
| `modules/s330-editor/src/hooks/useImportDrumKit.ts` | Import logic |

### Modified Files

| File | Changes |
|------|---------|
| `modules/sampler-library/src/browser.ts` | Export drum kit parser |
| `modules/sampler-library/src/schemas/index.ts` | Export drum kit schema |
| `modules/s330-editor/src/lib/library-service.ts` | Add drum kit functions |
| `modules/s330-editor/src/components/library/LibraryTreePanel.tsx` | Add Drum Kits section |
| `modules/s330-editor/src/pages/LibraryPage.tsx` | Wire drum kit flow |

## Verification

1. **Build check**
   ```bash
   pnpm build
   ```

2. **Manual testing - Single kit**
   - Create `library/s330/drum-kits/test-kit/` with 4 WAV files (KICK 01, SNARE 01, HHC 01, HHO 01)
   - Open Library page in web editor
   - Expand "Drum Kits" section
   - Click on test-kit
   - Verify preview shows detected samples and MIDI mappings
   - Click "Import to Device"
   - Select tone slot, wave bank, patch slot
   - Confirm import
   - Verify tones created in selected range
   - Verify patch created with correct key mappings
   - Play C2, C#2, D2, D#2 on MIDI controller - verify correct samples play

3. **Manual testing - Multi-kit**
   - Add KICK 02, SNARE 02, HHC 02, HHO 02 samples
   - Verify two kits detected (8 samples total)
   - Import and verify 8 tones created
   - Verify MIDI notes C2-D#2 for kit 1, E2-G#2 for kit 2

4. **Manual testing - Custom config**
   - Create kit.yaml with explicit sample mappings
   - Verify preview shows configured samples, not auto-detected
   - Import and verify correct samples used
