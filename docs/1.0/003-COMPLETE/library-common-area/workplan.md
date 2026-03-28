# Library Common Area - Workplan

**Status:** Draft

---

## Overview

This workplan implements the unified library common area defined in the PRD. Two device-agnostic schemas — **Sample** (audio + intrinsic properties) and **Program** (instrument mapping with zones) — replace the existing `ChoppedSampleSchema` and provide the foundation for device-agnostic audio management.

Phases 5 and 6 are independent and can be worked in parallel after Phase 4.

---

## Phase 1: Sample Schema

Define `SampleYamlSchema` — the device-agnostic representation of a single audio file with intrinsic properties.

### Tasks

- [ ] Create `sampler-library/src/schemas/sample-schema.ts` with `SampleYamlSchema`
  - `format: z.literal('sample')`
  - `version: z.literal(1)`
  - `name: z.string().min(1).max(128)`
  - `file: z.string().min(1)` (WAV filename)
  - `sampleRate: z.number().int().positive()`
  - `loopMode: LoopModeSchema.optional()` (defaults to `oneShot` if absent)
  - `loopStart: z.number().int().min(0).optional()`
  - `loopEnd: z.number().int().min(0).optional()`
  - `rootKey: MidiNoteSchema.optional()` (original pitch / SFZ `pitch_keycenter`)
  - Optional: `tags`, `description`, `sourceDevice`, `createdAt`, `modifiedAt`
  - Export `SampleYaml` type and `SampleInfo` summary interface
- [ ] Add exports to `schemas/index.ts`, `index.ts`, `browser.ts`
- [ ] Write unit tests in `test/unit/schemas/sample-schema.test.ts`
  - Valid sample parses (minimal and with all optional fields)
  - Missing required fields rejected
  - Name length limits enforced
  - Invalid format/version rejected
  - Loop fields validated (loopEnd >= loopStart when both present)
  - rootKey accepts both note names and numbers

### Success Criteria

- `SampleYamlSchema` validates correctly
- Schema and types importable from both entry points
- All tests pass

---

## Phase 2: Program Schema

Define `ProgramYamlSchema` — the device-agnostic instrument mapping that references samples and defines zones.

### Tasks

- [ ] Create `sampler-library/src/schemas/program-schema.ts` with `ZoneSchema` and `ProgramYamlSchema`
  - `ZoneSchema`: `sample`, optional `keyRange`, `velocityRange`, `rootKey`, `transpose`, `fineTune`, `muteGroup`, `label`
  - `ProgramYamlSchema`: `format: 'program'`, `version: 1`, `name`, `zones[]`, optional `polyphony`, `playbackMode`, `description`, `tags`, timestamps
  - Reuse `KeyRangeSchema`, `VelocityRangeSchema`, `MidiNoteSchema`, `PolyphonyModeSchema`, `PlaybackModeSchema` from existing schemas
- [ ] Add exports to `schemas/index.ts`, `index.ts`, `browser.ts`
- [ ] Write unit tests in `test/unit/schemas/program-schema.test.ts`
  - Valid program with single zone
  - Valid program with multiple zones (key splits, velocity layers, drum kit)
  - Zone key ranges and velocity ranges validated
  - Missing required fields rejected
  - Polyphony and playback mode validated

### Success Criteria

- `ProgramYamlSchema` validates correctly
- A drum kit can be represented as a program (zones with ascending key ranges, muteGroups for hi-hat choke)
- A velocity-layer instrument can be represented (zones with same key range, different velocity ranges)

---

## Phase 3: Scanner Integration

Add detectors and scanner functions for both schemas to the library filesystem layer.

### Tasks

- [ ] Add `'sample'` and `'program'` to `LibraryTreeNode.type` union (`library-fs.ts:69`)
- [ ] Implement `detectSample` item detector
  - Checks `.yaml` extension, parses YAML, validates `format: 'sample'` via `SampleYamlSchema.safeParse`
  - Returns `LibraryTreeNode` with `type: 'sample'`
  - Pattern: follows `detectChoppedSample` (`library-fs.ts:364-390`)
- [ ] Implement `detectProgram` item detector
  - Checks for directory containing `program.yaml`, validates `format: 'program'`
  - Returns `LibraryTreeNode` with `type: 'program'`, zone count, description
  - Pattern: follows `detectChoppedSample`
- [ ] Implement `listCommonSamplesTree()` — scans `library/common/samples/` using a combined detector that recognizes samples, programs, AND legacy chopped samples (for backward compatibility during migration)
- [ ] Export new functions and types from `library-fs.ts` and `browser.ts`
- [ ] Write unit tests for detectors

### Success Criteria

- `listCommonSamplesTree()` returns a tree containing samples, programs, and legacy chopped samples
- Invalid YAML files are silently skipped
- Subdirectories are treated as organizational folders
- `LibraryTreeNode.type` includes `'sample'` and `'program'`

### Risks

- **`library-fs.ts` is 574 lines** — adding two detectors plus a combined scanner will push it over 600 lines. Extract all item detectors into `item-detectors.ts` during this phase.
- **`detectSample` is more expensive than `detectTone`** because it parses YAML to check the format field. Acceptable for `library/common/samples/` which is expected to be smaller than device tone directories.

---

## Phase 4: UI — Tree & Preview

Add the "Samples" section to LibraryTreePanel and implement preview for both samples and programs.

### Tasks

- [ ] Add `commonSamplesTree?: LibraryTreeNode[]` prop to `LibraryTreePanelProps`
- [ ] Add `'commonSamples'` to `expandedPaths` keys in `ExpandedPaths` interface (`libraryStore.ts:61-66`)
- [ ] Add `'sample' | 'program'` to `selectedType` union in `ItemSelection` (`LibraryPage.tsx:55`)
- [ ] Add `onSelectSample` and `onSelectProgram` callback props
- [ ] Replace the existing "Samples" `TreeSection` (which only shows chopped samples) with a unified section showing samples, programs, and legacy chopped samples
- [ ] Create `sampler-editor/src/lib/library-common-samples.ts` with helpers for loading sample/program metadata and WAV paths
- [ ] Wire `listCommonSamplesTree()` into library data loading (`LibraryPage.tsx:64-70`)
- [ ] Implement sample preview panel: name, description, tags, root key, sample rate, loop mode, waveform visualization
- [ ] Implement program preview panel: name, description, zone count, zone map (key range visualization), zone list with sample names

### Success Criteria

- Common-area samples and programs appear in the library tree
- Clicking a sample shows metadata + waveform preview
- Clicking a program shows zone map + zone list
- Subdirectory expansion/collapse works
- Legacy chopped samples still display correctly during migration

### Risks

- **`LibraryTreePanel.tsx` is 611 lines** — already over the 500-line guideline. Consider extracting section rendering into sub-components.

---

## Phase 5: WAV Import

Enable importing WAV files directly to the common area as samples.

### Tasks

- [ ] Add "Import WAV" button to the Samples section header in `LibraryTreePanel`
- [ ] Implement file picker using environment capability interfaces (from `edit-workflow-architecture`)
- [ ] Create `sampler-library/src/common-area/import.ts` with `importWavToCommonArea()`
  - Accepts WAV `File` or `Uint8Array`, target directory handle, optional metadata
  - Parses WAV header to extract sample rate
  - Generates `SampleYaml` with defaults: `loopMode` absent (defaults to one-shot), no `rootKey`
  - Writes YAML + WAV pair to `library/common/samples/`
- [ ] Handle name derivation from filename (strip extension, truncate to 128)
- [ ] Trigger library tree refresh after import
- [ ] Write unit tests for `importWavToCommonArea`

### Success Criteria

- User can import a WAV and see it appear in the Samples tree
- Imported samples have correct sample rate
- Import works into subdirectories

### Depends On

- Phase 1 (schema)
- Phase 4 (UI with import button)

---

## Phase 6: Promotion/Demotion Converters

Implement promotion converters for samples → device tones and programs → device patches.

### Tasks

- [ ] Create `sampler-library/src/converters/promotion.ts` with interfaces:
  ```typescript
  interface SamplePromotionConverter<TDefaults> {
    promote(sample: SampleYaml, defaults: TDefaults): ToneYaml;
    demote(tone: ToneYaml): SampleYaml;
  }
  interface ProgramPromotionConverter<TDefaults> {
    promote(program: ProgramYaml, defaults: TDefaults): PatchYaml;
    demote(patch: PatchYaml): ProgramYaml;
  }
  ```
- [ ] Define `S330SamplePromotionDefaults`: `{ originalKey: number; outputAssign?: number; transpose?: number; fineTune?: number; ... }`
- [ ] Implement `s330SamplePromotionConverter`
  - `promote`: creates `ToneYaml` with `device: 's330'`, truncates name to 12 chars, maps `rootKey` to `originalKey`, builds `s330` extension
  - `demote`: strips `s330` extension, sets `sourceDevice: 's330'`, maps `originalKey` to `rootKey`
- [ ] Implement `s550SamplePromotionConverter` (same pattern, extended ranges)
- [ ] Define `S330ProgramPromotionDefaults` and implement `s330ProgramPromotionConverter`
  - `promote`: maps program zones to patch key groups
  - `demote`: maps patch key groups back to program zones
- [ ] Export converters from `converters/index.ts` and `browser.ts`
- [ ] Write unit tests
  - Round-trip: promote then demote preserves base fields
  - Name truncation on promote
  - `sourceDevice` set on demote
  - `rootKey` ↔ `originalKey` mapping
  - Program zones ↔ patch key groups mapping

### Success Criteria

- Promoted samples produce valid `ToneYaml` (passes schema validation including `.refine()`)
- Promoted programs produce valid `PatchYaml`
- Demoted content produces valid `SampleYaml` / `ProgramYaml`
- Round-trip preserves audio references and base metadata

### Depends On

- Phase 1 (sample schema)
- Phase 2 (program schema)

---

## Phase 7: Promotion/Demotion UI

Wire promotion and demotion converters into the editor UI.

### Tasks

- [ ] Add "Promote to [device]" dropdown to sample preview panel
  - Lists available devices (S-330, S-550)
  - Opens promotion form for device-specific required fields
- [ ] Create `PromotionForm.tsx` component
  - Required fields for selected device (e.g., `originalKey` for S-330)
  - Name field pre-filled, truncated to device limit, editable
  - Submit calls `promote()`, writes to device library, refreshes tree
- [ ] Add "Promote to [device]" for programs → device patches
- [ ] Add "Demote to Common Area" button to device tone and patch preview panels
- [ ] Handle file copying (WAV files copied between common and device libraries)

### Success Criteria

- User can promote a sample to S-330/S-550 tone
- User can promote a program to S-330/S-550 patch
- User can demote a device tone/patch to common area
- Library tree refreshes after each operation

### Depends On

- Phase 4 (preview panels)
- Phase 5 (so there are samples to promote)
- Phase 6 (converters)

---

## Phase 8: ChoppedSample Migration

Migrate existing `ChoppedSampleSchema` consumers to the new sample/program model.

### Tasks

- [ ] Create `sampler-library/src/converters/chopped-sample-migration.ts`
  - `choppedSampleToProgram(chopped: ChoppedSample): { samples: SampleYaml[]; program: ProgramYaml }`
  - Maps `source` → sample file reference, `slices` → zones with key ranges, `drumKit.baseNote` → zone root keys
- [ ] Update sample chopper output to produce `ProgramYaml` + `SampleYaml` instead of `ChoppedSample`
- [ ] Update `SampleBundlePreviewPanel` to handle both legacy chopped samples and new programs
- [ ] Update import flow (`useImportSamples`) to work with programs
- [ ] Deprecate `ChoppedSampleSchema` (keep for reading, stop producing)
- [ ] Update `detectChoppedSample` to show legacy items with a migration indicator in the UI

### Success Criteria

- Existing chopped samples remain readable and displayable
- New chopping operations produce programs
- Import-to-device flow works from programs
- No user-visible regression for existing library content

### Risks

- **Sample chopper integration** — the sample chopper module has its own UI (`SampleChopperDialog`) that produces `ChoppedSample` output. Changing its output type requires updating both the algorithm layer and the UI layer.
- **Scope** — this phase touches many files across modules. May need to be split into sub-phases.

---

## Dependencies

- **`edit-workflow-architecture`** (complete) — environment capability interfaces for file I/O in Phase 5

---

## Risks

- **`library-fs.ts` size (574 lines)** — adding detectors for two new types will exceed the guideline. Mitigation: extract item detectors into `item-detectors.ts` in Phase 3.
- **`LibraryTreePanel.tsx` size (611 lines)** — already over guideline. Mitigation: extract sections into sub-components in Phase 4.
- **ChoppedSample migration scope** — touching the sample chopper module, import flows, and preview panels is a large surface area. Mitigation: Phase 8 is isolated and can be deferred. The combined scanner in Phase 3 handles both old and new formats during the transition.
- **Name truncation UX** — promoting a 128-char name to a 12-char device limit could frustrate users. Mitigation: promotion form pre-fills truncated name and lets user edit before confirming.
- **WAV duplication** — copy-on-promote/demote doubles disk usage. Acceptable for vintage sampler WAVs (S-330 has 768KB wave memory). Revisit for larger-memory devices.
