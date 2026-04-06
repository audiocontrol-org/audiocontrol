# S3000XL Library Page Conformance - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Refactor the S3K library page from its current two-column metadata-only layout to the three-column plugin-driven architecture established by the Roland S-330/S-550 editor. The implementation reuses existing editor-core components and patterns while adding S3K-specific device panel, preview panel, import/export dialogs, and drag-and-drop integration. Sample transfer uses the existing SDS implementation in `midi-core` + `sampler-devices`; program transfer uses the existing Akai SysEx read/write methods.

**Key architectural decisions:**

- **Plugin architecture** — Create an S3K library plugin conforming to editor-core's `LibraryPlugin` interface, following the pattern of `s330-library-plugin.tsx` and `s550-library-plugin.tsx`
- **Reuse editor-core components** — Use `PluginLibraryTreePanel` (or equivalent shared layout) rather than building a bespoke three-column layout
- **Composition with existing client** — All device operations go through the existing `S3000xlClientInterface` methods; no new SysEx protocol work needed for samples or programs
- **Library file formats** — Programs serialized as YAML files (matching Roland editor convention) containing program header + keygroup array + sample name references
- **Drag-and-drop types** — Define S3K-specific drag data types (`application/x-s3k-device-item`, `application/x-s3k-library-item`) following the Roland editor's MIME type pattern

## Implementation Phases

### Phase 1: Device Memory Panel

Build the left column showing resident programs and samples on the S3000XL.

#### 1.1 Device Memory Panel Component

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/DeviceMemoryPanel.tsx`

**Layout:**

```
┌─────────────────────────┐
│ Device Memory   [↻]     │
├─────────────────────────┤
│ Programs:               │
│  0: Piano Prog          │
│  1: Bass Prog           │
│  2: Strings             │
│  ...                    │
├─────────────────────────┤
│ Samples:                │
│  0: Piano-C3            │
│  1: Piano-G3            │
│  2: Bass-E1             │
│  ...                    │
└─────────────────────────┘
```

**Features:**
- Two scrollable sections: Programs and Samples
- Each item shows index + name
- Selection highlight (click to select, populates preview panel)
- Refresh button to re-fetch names from device
- Drag-out support (drag device item to library browser to export)
- Drop target support (drop library item on device section to import)
- Empty state when no MIDI connection

**Props interface:**

```typescript
interface DeviceMemoryPanelProps {
  programNames: string[];
  sampleNames: string[];
  selectedIndex?: number;
  selectedType?: 'program' | 'sample';
  onSelectProgram: (index: number) => void;
  onSelectSample: (index: number) => void;
  onRefresh: () => void;
  onDropLibrarySample?: (data: LibraryDragData, targetIndex: number) => void;
  onDropLibraryProgram?: (data: LibraryDragData, targetIndex: number) => void;
}
```

**Success criteria:**
- Displays all resident program and sample names from device
- Selection drives preview panel content
- Refresh re-fetches from device
- Drag-out produces correctly typed drag data

#### 1.2 Device State in Library Store

**Files to modify:**
- `modules/akai-s3k-editor/src/stores/libraryStore.ts`

**New state fields:**

```typescript
// Device state
deviceProgramNames: string[];
deviceSampleNames: string[];
selectedDeviceIndex: number | null;
selectedDeviceType: 'program' | 'sample' | null;

// Transfer state
transferInProgress: boolean;
transferDirection: 'send' | 'receive' | null;
transferProgress: SdsTransferProgress | null;
transferError: string | null;
```

**New actions:**

```typescript
setDeviceProgramNames(names: string[]): void;
setDeviceSampleNames(names: string[]): void;
setSelectedDevice(type: 'program' | 'sample', index: number): void;
clearSelectedDevice(): void;
setTransferState(state: TransferState): void;
clearTransferState(): void;
```

**Success criteria:**
- Device names stored and accessible from all library components
- Transfer state drives progress UI across components
- Selection state distinguishes between device and library selections

#### 1.3 Device Data Hook

**Files to create:**
- `modules/akai-s3k-editor/src/hooks/useDeviceLibraryData.ts`

**Responsibilities:**
- Fetch program names and sample names on mount (when MIDI connected)
- Store results in libraryStore
- Provide `refresh()` for manual refresh
- Handle errors (device not responding, connection lost)

**Success criteria:**
- Auto-fetches on MIDI connect
- Clears device data on disconnect
- Errors displayed in device panel

### Phase 2: Three-Column Layout & Plugin Architecture

Refactor the library page to the three-column layout and wire it through the plugin system.

#### 2.1 S3K Library Plugin

**Files to create:**
- `modules/akai-s3k-editor/src/plugins/s3k-library-plugin.tsx`

**Plugin provides:**
- Categories: Samples, Programs, Multis
- Device memory panel adapter (routes to `DeviceMemoryPanel`)
- Preview panel adapter (routes to context-aware `S3kItemPreviewPanel`)
- Library tree configuration (sections for samples, programs, multis)
- Drag data types and handlers

**Success criteria:**
- Plugin conforms to editor-core's library plugin interface
- Swappable without changing the library page structure
- Categories reflect S3K data model (not Roland terminology)

#### 2.2 Three-Column Library Page Layout

**Files to modify:**
- `modules/akai-s3k-editor/src/pages/LibraryPage.tsx` — Rewrite to three-column layout

**Layout structure:**

```
┌──────────────┬─────────────────────┬──────────────────┐
│ Device       │ Library Browser      │ Preview /        │
│ Memory       │                      │ Actions          │
│ Panel        │ Storage connection   │                  │
│              │ Samples tree         │ [Context-aware   │
│ Programs:    │ Programs tree        │  metadata and    │
│  ...         │ Multis tree          │  action buttons] │
│              │                      │                  │
│ Samples:     │ Folder ops           │                  │
│  ...         │ Import WAV           │                  │
│              │ Drag-and-drop zones  │                  │
└──────────────┴─────────────────────┴──────────────────┘
```

**Grid layout:** `grid grid-cols-[280px_1fr_320px]` (matching Roland editor proportions)

**Success criteria:**
- Three-column layout renders correctly at typical screen sizes
- Left column shows device state
- Center column shows library browser with all existing functionality preserved
- Right column shows context-aware preview
- Storage backend connection UI remains accessible

#### 2.3 Library Browser Updates

**Files to modify:**
- `modules/akai-s3k-editor/src/hooks/useLibraryData.ts` — Add program and multi tree scanning
- `modules/akai-s3k-editor/src/lib/library-tree.ts` — Add tree conversion for programs/multis

**New tree sections in browser:**
- **Samples** (existing, no change)
- **Programs** (new — scanned from library storage `programs/` directory)
- **Multis** (new — scanned from library storage `multis/` directory)

**Success criteria:**
- Library browser shows three collapsible sections
- Programs and multis load from their respective library directories
- Folder operations (create, delete, move) work for all sections

### Phase 3: Sample Import/Export via SDS

Wire SDS sample transfer into the library page UI.

#### 3.1 Sample Send Dialog (Library -> Device)

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/SendSampleDialog.tsx`

**Dialog flow:**
1. Shows sample name, format info (sample rate, length, channels)
2. Send mode: "Add as new sample" or "Replace existing" (with sample selector)
3. Progress bar during SDS transfer
4. Success/error display
5. Cancel button

**Invoked from:**
- "Send to Device" button in preview panel when library sample selected
- Drop handler when library sample dropped on device samples section

**Success criteria:**
- WAV file read from library storage, parsed, converted to Int16Array
- Calls `client.sendSampleViaSds()` with progress callback
- Progress bar updates in real time
- Device sample names refresh after successful send
- Errors displayed with clear messages

#### 3.2 Sample Receive Dialog (Device -> Library)

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/ReceiveSampleDialog.tsx`

**Dialog flow:**
1. Shows device sample name and index
2. Library save location (path picker within library)
3. Optional: rename before saving
4. Progress bar during SDS receive
5. WAV file written to library storage
6. Success/error display

**Invoked from:**
- "Save to Library" button in preview panel when device sample selected
- Drop handler when device sample dropped on library browser

**Success criteria:**
- Calls `client.receiveSampleViaSds()` with progress callback
- Received Int16Array converted to WAV format
- WAV saved to library storage at chosen path
- Library tree refreshes after successful receive
- Progress bar updates in real time

#### 3.3 Drag-and-Drop for Samples

**Files to create:**
- `modules/akai-s3k-editor/src/lib/library-drag-data.ts` — Drag data type definitions

**Drag interactions:**

| Drag Source | Drop Target | Action |
|-------------|-------------|--------|
| Device sample | Library browser | Open ReceiveSampleDialog |
| Library sample | Device samples section | Open SendSampleDialog |

**Data types:**

```typescript
interface S3kDeviceDragData {
  source: 'device';
  type: 'program' | 'sample';
  index: number;
  name: string;
}

interface S3kLibraryDragData {
  source: 'library';
  type: 'sample' | 'program' | 'multi';
  name: string;
  path: string[];
}
```

**Success criteria:**
- Drag-over highlights drop zones with visual feedback
- Invalid drops rejected (e.g., program dropped on sample zone)
- Drag data correctly typed and passed to dialog handlers

### Phase 4: Program Import/Export via Akai SysEx

Add the ability to save and restore complete programs (header + all keygroups) between the library and the device.

#### 4.1 Program Serialization Format

**Files to create:**
- `modules/akai-s3k-editor/src/lib/program-serialization.ts`

**Format:** YAML file containing:

```yaml
format: s3000xl-program
version: 1
program:
  name: "Piano Prog"
  # ... all ProgramHeader fields
keygroups:
  - keygroupNumber: 0
    # ... all KeygroupHeader fields for keygroup 0
  - keygroupNumber: 1
    # ... all KeygroupHeader fields for keygroup 1
sampleReferences:
  - "Piano-C3"
  - "Piano-G3"
  - "Piano-C5"
```

**Functions:**

| Function | Purpose |
|----------|---------|
| `serializeProgram(header, keygroups, sampleNames)` | Convert to YAML string |
| `deserializeProgram(yaml)` | Parse YAML to header + keygroups + sample refs |

**Success criteria:**
- Round-trip serialize/deserialize preserves all fields
- Sample references are names (not indices) for portability
- Format version allows future extension

#### 4.2 Program Export (Device -> Library)

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/ExportProgramDialog.tsx`

**Dialog flow:**
1. Shows program name and keygroup count
2. Reads program header from device
3. Reads all keygroup headers for the program
4. Resolves sample names from zone sample indices
5. Library save location picker
6. Progress bar (reading keygroups can take time)
7. Serializes and saves to library storage

**Invoked from:**
- "Save to Library" button in preview panel when device program selected

**Success criteria:**
- All keygroup headers fetched (may be 1-99 keygroups)
- Sample name references resolved from device sample list
- Progress shows keygroup fetch progress
- Saved file readable by import dialog

#### 4.3 Program Import (Library -> Device)

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/ImportProgramDialog.tsx`

**Dialog flow:**
1. Shows program name, keygroup count, referenced samples
2. Validates sample dependencies (warns if referenced samples not on device)
3. Write mode: creates new program or overwrites existing (with program selector)
4. Progress bar during write
5. Writes program header, then creates and writes each keygroup
6. Success/error display

**Invoked from:**
- "Send to Device" button in preview panel when library program selected
- Drop handler when library program dropped on device programs section

**Success criteria:**
- Program header written first, then keygroups created sequentially
- Sample indices remapped from names to current device sample list indices
- Warning if referenced samples are missing (with option to proceed anyway)
- Device program list refreshes after successful import

### Phase 5: Multi Import/Export

Add multi (multi-timbral setup) save/restore. This phase depends on resolving the open question about S3000XL multi SysEx support.

#### 5.1 Multi Protocol Investigation

**Task:** Investigate whether the S3000XL SysEx protocol supports reading/writing multi configurations. The current protocol file (`s3000xl-protocol.ts`) has opcodes for miscellaneous data (RMDATA/MDATA) which may contain multi settings.

**Outcome:** Either:
- a) Confirm multi read/write is possible via existing opcodes and document the format
- b) Determine that multi transfer is not supported via SysEx and descope from this feature

#### 5.2 Multi Serialization, Export, and Import

Contingent on Phase 5.1 confirming multi SysEx support.

**Files to create (if supported):**
- `modules/akai-s3k-editor/src/lib/multi-serialization.ts`
- `modules/akai-s3k-editor/src/components/library/ExportMultiDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/ImportMultiDialog.tsx`

**Pattern:** Follows the same dialog and serialization patterns as program import/export from Phase 4.

### Phase 6: Preview Panel

Build the context-aware right column that adapts to the current selection.

#### 6.1 S3K Item Preview Panel

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx`

**Selection-driven rendering:**

| Selection | What Shows | Actions |
|-----------|-----------|---------|
| Device program | Program name, keygroup count, polyphony, output | "Save to Library" |
| Device sample | Sample name, index, sample rate, length | "Save to Library" |
| Library sample | Sample name, format, path, rate, length | "Send to Device", "Open in Editor" |
| Library program | Program name, keygroups, sample refs, path | "Send to Device" |
| Library multi | Multi name, channel map, path | "Send to Device" |
| Directory | Folder name, item count | (none) |
| Nothing selected | "Select an item to view details" | (none) |

**For device items:** Fetch header data on selection (program header or sample header) to display detailed metadata.

**Success criteria:**
- Correct panel renders for each selection type
- Action buttons trigger appropriate dialogs
- Loading state while fetching device headers
- Error display if fetch fails

### Phase 7: Testing

#### 7.1 Unit Tests

**Files to create:**
- `modules/akai-s3k-editor/src/lib/__tests__/program-serialization.test.ts`
- `modules/akai-s3k-editor/src/lib/__tests__/library-drag-data.test.ts`

**Coverage:**
- Program serialization round-trip
- Sample name reference resolution
- Drag data type creation and parsing

#### 7.2 E2E Tests with Hardware

**Test scenarios:**
- Send library sample to device via SDS, verify on device
- Receive device sample via SDS, verify in library
- Export program from device, verify YAML contains all keygroups
- Import program to device, verify program and keygroups match
- Drag-and-drop sample from device to library
- Drag-and-drop sample from library to device

## Task Breakdown

| # | Task | Phase | Est. |
|---|------|-------|------|
| 1 | Build DeviceMemoryPanel component | 1.1 | 1d |
| 2 | Extend libraryStore with device and transfer state | 1.2 | 0.5d |
| 3 | Create useDeviceLibraryData hook | 1.3 | 0.5d |
| 4 | Create S3K library plugin | 2.1 | 1d |
| 5 | Refactor LibraryPage to three-column layout | 2.2 | 1d |
| 6 | Add program and multi tree scanning to library browser | 2.3 | 0.5d |
| 7 | Build SendSampleDialog (library -> device via SDS) | 3.1 | 1d |
| 8 | Build ReceiveSampleDialog (device -> library via SDS) | 3.2 | 1d |
| 9 | Implement drag-and-drop for samples | 3.3 | 1d |
| 10 | Define program serialization format and functions | 4.1 | 0.5d |
| 11 | Build ExportProgramDialog (device -> library) | 4.2 | 1d |
| 12 | Build ImportProgramDialog (library -> device) | 4.3 | 1.5d |
| 13 | Investigate multi SysEx protocol support | 5.1 | 0.5d |
| 14 | Build multi serialization, export, and import (if supported) | 5.2 | 1.5d |
| 15 | Build S3kItemPreviewPanel | 6.1 | 1d |
| 16 | Write unit tests for serialization and drag data | 7.1 | 0.5d |
| 17 | Write E2E tests with S3000XL hardware | 7.2 | 1d |

## Known Issues to Fix

### Node.js Module Pollution in Browser Code

The `akai-s3k-editor` Vite build fails because browser-targeted code transitively imports Node.js modules (`os`, `path`, `fs`) via `sampler-lib/server`. This is legacy cruft from the original project architecture, which used a Node.js API server to talk to samplers. The new project uses WebMIDI directly in the browser, but several modules still re-export or depend on Node.js-only code paths.

**What needs to happen:**
- Audit import chains in `akai-s3k-editor` and other browser modules for Node.js dependencies
- Ensure subpath exports (e.g., `sampler-lib/server` vs `sampler-lib`) cleanly separate browser-safe and Node-only code
- Remove or gate any remaining Node.js-only imports from browser entry points

### Replace akaitools (Perl) with Browser-Safe TypeScript

The codebase currently depends on `akaitools`, a Perl library, for reading and writing Akai disk images, programs, and samples. This dependency lives in `sampler-devices/src/io/akaitools*.ts` — TypeScript wrappers that shell out to Perl binaries. This obviously cannot run in the browser, and is part of the legacy Node.js API server architecture that should be retired.

The `akaitools` Perl source is an excellent reference implementation for the Akai binary formats (disk structure, program headers, keygroup headers, sample headers). We need this functionality for library operations like reading/writing `.a3p` program files and `.a3s` sample files directly in the browser.

**What needs to happen:**
- Use the `akaitools` Perl source as a reference to create a browser-safe TypeScript implementation of Akai binary format parsing and serialization
- Cover at minimum: program file read/write, keygroup parsing, sample header parsing, nibble encoding/decoding (some of this already exists in `sampler-devices/src/devices/s3000xl/`)
- The new implementation should work with `Uint8Array` / `ArrayBuffer` — no filesystem, no child processes
- Migrate `sampler-export` and any other consumers off the Perl-based `readAkaiData` / `writeAkaiData` to the new TypeScript implementation
- Eventually remove the akaitools Perl dependency entirely

### E2E Tests in Default Test Target

The `akai-s3k-editor` module's default `pnpm test` target (Vitest) collects both unit tests and Playwright e2e spec files. The e2e specs fail at collection time because they import from `e2e-infra` and reference hardware-specific globals. E2E tests should only run via dedicated `make test-e2e-*` targets, never as part of the default `pnpm test` / `vitest run`.

**What needs to happen:**
- Configure `vitest.config.ts` in `akai-s3k-editor` to exclude `e2e/` from the default test glob
- Ensure `make test-e2e-*` targets continue to work independently via Playwright configs

## Dependencies

- Phase 1 and Phase 6 can be developed in parallel
- Phase 2 depends on Phase 1 (device panel must exist before layout integration)
- Phase 3 depends on Phase 2 (three-column layout must exist for dialog integration)
- Phase 4 depends on Phase 2 (same layout dependency)
- Phase 5 depends on Phase 5.1 investigation result
- Phase 7 depends on Phases 3-5 (tests require complete functionality)
