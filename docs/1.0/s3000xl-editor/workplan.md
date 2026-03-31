# S3000XL Editor - Workplan

**GitHub Milestone:** [Backlog](https://github.com/audiocontrol-org/audiocontrol/milestone/8)
**GitHub Issues:**

- [Parent: [sampler-devices] S3000XL Editor (#2)](https://github.com/audiocontrol-org/audiocontrol/issues/2)

## Technical Approach

Build a web-based S3000XL editor as a new `akai-s3k-editor` module, reusing shared UI primitives extracted from the existing `roland-sxx0-editor`. The S3000XL MIDI client needs modernization to match S-330 client maturity before the editor can be built on top of it.

**Key architectural decisions:**
- Separate `akai-s3k-editor` module (not merged into roland-sxx0-editor)
- Device-specific pages with Akai terminology (Programs, Keygroups, Zones)
- Shared low-level UI primitives in `editor-core` (EnvelopeEditor, ParameterSlider, library panels)
- S3000XL client refactored to adapter pattern for browser compatibility

## Implementation Phases

### Phase 1: Extract Shared Primitives to editor-core

Refactor reusable components out of `roland-sxx0-editor` into `editor-core` so both editors can share them. The Roland editor must continue to build and pass all tests after extraction.

**Components to extract:**

| Component | Source Path | Purpose |
|-----------|------------|---------|
| EnvelopeEditor | `roland-sxx0-editor/src/components/ui/EnvelopeEditor.tsx` | Multi-stage envelope editing |
| EnvelopeDisplay | `roland-sxx0-editor/src/components/ui/EnvelopeDisplay.tsx` | Envelope visualization |
| ParameterSlider | `roland-sxx0-editor/src/components/ui/ParameterSlider.tsx` | Labeled slider with value display |
| MemoryMapPanel | `roland-sxx0-editor/src/components/ui/MemoryMapPanel.tsx` | Visual memory slot layout |
| Tooltip | `roland-sxx0-editor/src/components/ui/Tooltip.tsx` | Parameter tooltip |
| BestFitPicker | `roland-sxx0-editor/src/components/ui/BestFitPicker.tsx` | Slot allocation picker |

**Patterns to generalize:**

| Pattern | Source Path | What Changes |
|---------|------------|-------------|
| DeviceConfig interface | `roland-sxx0-editor/src/configs/types.ts` | Extract interface to editor-core, keep Roland implementations in roland-sxx0-editor |
| deviceDataStore | `roland-sxx0-editor/src/stores/deviceDataStore.ts` | Extract generic factory; Roland and Akai instantiate with their own types |
| editorStore | `roland-sxx0-editor/src/stores/editorStore.ts` | Extract selection/loading state factory |
| DeviceConfigContext | `roland-sxx0-editor/src/context/DeviceConfigContext.tsx` | Extract provider pattern; each editor creates its own typed context |

**Success criteria:**
- All extracted components exported from `@audiocontrol/editor-core`
- `roland-sxx0-editor` imports from `@audiocontrol/editor-core` instead of local paths
- `pnpm --filter @audiocontrol/roland-sxx0-editor... build` passes
- All existing tests pass

### Phase 2: Modernize S3000XL MIDI Client

Rewrite `modules/sampler-midi/src/client/client-akai-s3000xl.ts` to match the architecture and maturity of the S-330 client (`modules/sampler-devices/src/devices/s330/s330-client.ts`, 2278 lines).

**Current state (423 lines):**
- Direct easymidi binding (Node.js only, no browser support)
- No request serialization (concurrent SysEx conflicts possible)
- No caching (re-fetches every time)
- Only 2 parameter setters (name, polyphony)
- No progress callbacks
- No retry logic

**Target state:**
- Adapter pattern via `MidiIO` interface (browser + Node.js)
- Request serialization queue (one SysEx in flight at a time)
- Lazy-loaded header cache with invalidation
- Comprehensive parameter setters for all ProgramHeader, KeygroupHeader, and SampleHeader fields
- Progress callbacks for batch operations (program list loading, multi-keygroup fetch)
- Retry logic using `@audiocontrol/shared-midi` patterns
- Error handling with descriptive messages for REPLY opcode error codes

**New client interface (target):**

```typescript
export interface S3000XLClientInterface {
  // Program operations
  requestProgramNames(): Promise<string[]>
  requestProgramHeader(programNumber: number): Promise<ProgramHeader>
  sendProgramHeader(programNumber: number, header: ProgramHeader): Promise<void>

  // Keygroup operations
  requestKeygroupHeader(programNumber: number, keygroupNumber: number): Promise<KeygroupHeader>
  sendKeygroupHeader(programNumber: number, keygroupNumber: number, header: KeygroupHeader): Promise<void>
  requestAllKeygroups(programNumber: number, onProgress?: ProgressCallback): Promise<KeygroupHeader[]>

  // Sample operations
  requestSampleNames(): Promise<string[]>
  requestSampleHeader(sampleNumber: number): Promise<SampleHeader>
  sendSampleHeader(sampleNumber: number, header: SampleHeader): Promise<void>

  // Individual parameter setters (program)
  setProgramName(programNumber: number, name: string): Promise<void>
  setProgramPolyphony(programNumber: number, polyphony: number): Promise<void>
  setProgramOutput(programNumber: number, output: number): Promise<void>
  setProgramLoudness(programNumber: number, loudness: number): Promise<void>
  setProgramPan(programNumber: number, pan: number): Promise<void>
  setProgramTuning(programNumber: number, tuning: number): Promise<void>
  setProgramLFO1(programNumber: number, rate: number, depth: number, delay: number): Promise<void>
  // ... etc. for all parameter groups

  // Cache management
  invalidateProgramCache(): void
  invalidateSampleCache(): void

  // Connection
  panic(): void
}

export function createS3000XLClient(adapter: MidiIO, options?: { deviceId?: number }): S3000XLClientInterface
```

**Reference implementation:** `modules/sampler-devices/src/devices/s330/s330-client.ts`

**Success criteria:**
- Client works in browser via Web MIDI adapter
- Request queue prevents concurrent SysEx
- Can read/write all ProgramHeader parameters
- Can read/write all KeygroupHeader parameters
- Progress callbacks work for batch operations
- Integration test passes against real hardware (or is properly skipped)

### Phase 3: Create akai-s3k-editor Web App Scaffold

**New module:** `modules/akai-s3k-editor/`

**Setup:**
- Vite + React 18 + TypeScript strict mode
- TailwindCSS + Radix UI (same stack as roland-sxx0-editor)
- pnpm workspace dependency on `@audiocontrol/editor-core`, `@audiocontrol/sampler-devices`, `@audiocontrol/sampler-midi`, `@audiocontrol/shared-midi`
- `@/` import alias via tsconfig paths

**S3000XL DeviceConfig:**

```typescript
// configs/s3000xl.ts
const s3000xlConfig: DeviceConfig = {
  deviceType: 's3000xl',
  deviceName: 'Akai S3000XL',
  manufacturer: 'Akai',
  totalPrograms: 128,      // Max resident programs
  totalSamples: 128,       // Max resident samples
  maxKeygroups: 99,        // Per program
  velocityZonesPerKeygroup: 4,
  basePath: '/akai/s3000xl/editor',
  createClient: createS3000XLClient,
  memoryLayout: createS3000XLMemoryLayout(),
}
```

**Router (App.tsx):**
- `/akai/s3000xl/editor/` → MIDI connection (HomePage)
- `/akai/s3000xl/editor/programs` → ProgramsPage
- `/akai/s3000xl/editor/keygroups` → KeygroupsPage
- `/akai/s3000xl/editor/zones` → SampleZonesPage
- `/akai/s3000xl/editor/library` → LibraryPage

**Success criteria:**
- `pnpm --filter @audiocontrol/akai-s3k-editor... build` succeeds
- MIDI connection page renders and connects to device
- Device status request/response works through Web MIDI

### Phase 4: Implement Program List and Header Editing

**ProgramsPage:**
- Fetch and display resident program names (RPLIST/PLIST opcodes)
- Select program for editing
- Bank-style loading with progress feedback

**ProgramEditor sections:**

| Section | Parameters | ProgramHeader Fields |
|---------|-----------|---------------------|
| Basic | Name, MIDI program number, channel, polyphony, priority, voice stealing | PRNAME, PRGNUM, PMCHAN, POLYPH, PRIORT, VASSOQ |
| Output | Individual output, stereo L/R, pan, loudness, velocity-to-loudness | OUTPUT, STEREO, PANPOS, PRLOUD, V_LOUD |
| Pitch | Bend up/down, bend mode, pressure-to-pitch, tuning, transpose, portamento | B_PTCH, B_PTCHD, B_MODE, P_PTCH, PTUNO, TRANSPOSE, PORTIME, PORTYPE, PORTEN |
| LFO 1 (Vibrato) | Rate, depth, delay, waveform, desync | LFORAT, LFODEP, LFODEL, LFO1WAVE, DESYNC |
| LFO 2 (Pan) | Rate, depth, delay, waveform, retrigger | PANRAT, PANDEP, PANDEL, LFO2WAVE, LFO2TRIG |
| Mod Sources | Modwheel/pressure/velocity → LFO1 depth | MWLDEP, PRSDEP, VELDEP |
| Mod Routing | 3 sources each for pan, amplitude, filter, LFO speed/depth/delay, pitch | MODSPAN1-3, MODSAMP1-3, MODSFILT1-3, MODSLFOT/L/D, MODSPITCH + amounts |
| Soft Pedal | Loudness reduction, attack stretch, filter reduction | SPLOUD, SPATT, SPFILT |
| Advanced | Keygroup crossfade, legato, temperament, effects bus | KXFADE, LEGATO, TEMPER, PFXCHAN |

**Success criteria:**
- All program names displayed
- All ProgramHeader parameters editable via UI
- Changes written back to device in real time via SysEx
- Modulation routing editor shows source assignments and amounts

### Phase 5: Implement Keygroup Editing Interface

**KeygroupsPage:**
- List keygroups within selected program (traverse KGRP1 → NXTKG chain)
- Select keygroup for editing
- Visual keyboard range display (LONOTE/HINOTE)

**KeygroupEditor sections:**

| Section | Parameters | KeygroupHeader Fields |
|---------|-----------|----------------------|
| Note Range | Low/high note, tuning offset | LONOTE, HINOTE, KGTUNO |
| Amplitude Envelope | Attack, decay, sustain, release + velocity sensitivity | ATTAK1, DECAY1, SUSTN1, RELSE1, V_ATT1, V_REL1, O_REL1 |
| Filter Envelope | 4-stage envelope + velocity sensitivity | ENV2R1, ENV2R3, ENV2L3, ENV2R4, V_ATT2, V_REL2, O_REL2, V_ENV2 |
| Filter | Frequency, key tracking | FILFRQ, K_FREQ |
| Key Tracking | Decay/release rate tracking | K_DAR1, K_DAR2 |
| Crossfade | Velocity zone crossfade, keygroup crossfade factors | VXFADE, LKXF, RKXF |

**Shared component reuse:**
- Amplitude ADSR → `EnvelopeEditor` from editor-core
- Filter envelope → `EnvelopeEditor` from editor-core
- All numeric parameters → `ParameterSlider` from editor-core

**Success criteria:**
- Keygroup chain traversal works correctly
- Envelope editors display and edit ADSR values
- Filter parameters editable with real-time write-back
- Keyboard range visualization shows note coverage

### Phase 6: Implement Sample Zone and Modulation Editors

**VelocityZoneEditor (4 zones per keygroup):**

| Parameter | Per-Zone Fields |
|-----------|----------------|
| Sample name | SNAME1-4 |
| Velocity range | LOVEL1-4, HIVEL1-4 |
| Tuning offset | VTUNO1-4 |
| Loudness offset | VLOUD1-4 |
| Filter freq offset | VFREQ1-4 |
| Pan offset | VPANO1-4 |
| Playback mode | ZPLAY1-4 (as sample, loop in release, loop til release, no loops, play to end) |

**Visual design:**
- 4-lane velocity zone display showing velocity ranges
- Per-zone parameter panel when zone is selected
- Velocity crossfade toggle (VXFADE)

**Sample header viewing:**
- Display sample name, original pitch, bandwidth, loop count
- Edit loop points (LOOPAT1-4, LLNGTH1-4, LDWELL1-4)
- Edit playback type, start/end offsets
- Read-only: sample length, location in memory

**Success criteria:**
- All 4 velocity zones editable per keygroup
- Sample assignment works (select from resident sample list)
- Velocity range visualization
- Sample header parameters viewable and editable

### Phase 7: Library Integration

**S3000XL library plugin:**
- Program serialization/deserialization for library storage
- Sample header serialization
- Library categories: Programs, Samples

**Library features (reuse from editor-core):**
- TreeView for browsing library sets
- Import: library → device (send program/keygroup/sample headers via SysEx)
- Export: device → library (fetch headers, serialize to YAML)
- Drag-and-drop between device memory panel and library browser

**Success criteria:**
- Programs exportable to library as YAML
- Programs importable from library to device
- Library browser renders with Akai-specific categories
- Round-trip: export → import produces equivalent program

## Success Criteria Per Phase

| Phase | Gate Criteria |
|-------|-------------|
| Phase 1 | Shared components in editor-core; roland-sxx0-editor builds and tests pass |
| Phase 2 | S3000XL client works in browser; reads/writes all parameter types |
| Phase 3 | akai-s3k-editor builds; MIDI connection page works |
| Phase 4 | All ProgramHeader parameters editable via UI |
| Phase 5 | Keygroup editing with envelope editors works |
| Phase 6 | Velocity zones and sample assignment works |
| Phase 7 | Library import/export round-trip works |

## Dependencies

| Phase | Depends On |
|-------|-----------|
| Phase 2 | None (can run parallel with Phase 1) |
| Phase 1 | None |
| Phase 3 | Phase 1 (needs shared components), Phase 2 (needs modernized client) |
| Phase 4 | Phase 3 |
| Phase 5 | Phase 4 |
| Phase 6 | Phase 5 |
| Phase 7 | Phase 3 (can run parallel with Phases 4-6) |
