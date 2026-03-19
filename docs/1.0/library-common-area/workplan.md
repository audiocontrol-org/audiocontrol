# Library Common Area - Workplan

**Status:** Draft

---

## Overview

This workplan implements the library common area defined in the PRD. It is organized into 6 phases: schema and storage first, then scanner integration, then UI, then WAV import and promotion converters (in parallel), then promotion UI to tie everything together.

Phases 4 and 5 are independent and can be worked in parallel after Phase 3.

---

## Phase 1: Schema & Storage

Define the `CommonSampleYamlSchema` and path utilities.

### Tasks

- [ ] Create `sampler-library/src/schemas/common-sample-schema.ts` with `CommonSampleYamlSchema`
  - `format: z.literal('common-sample')`
  - `version: z.literal(1)`
  - `name: z.string().min(1).max(128)`
  - `wave: BaseWaveParamsSchema` (imported from `common-schema.ts`)
  - Optional: `tags`, `description`, `sourceDevice`, `createdAt`, `modifiedAt`
  - Export `CommonSampleYaml` type and `CommonSampleInfo` summary interface
- [ ] Add exports to `sampler-library/src/schemas/index.ts` (schema + types)
- [ ] Add exports to `sampler-library/src/browser.ts` (schema + types)
- [ ] Add exports to `sampler-library/src/index.ts` if it re-exports schemas
- [ ] Write unit tests in `sampler-library/test/unit/schemas/common-sample-schema.test.ts`
  - Valid common sample parses
  - Missing required fields rejected
  - Name over 128 chars rejected
  - Invalid format discriminator rejected
  - Optional fields accepted when present

### Success Criteria

- `CommonSampleYamlSchema` validates correctly
- Schema and types are importable from `@audiocontrol/sampler-library` and `@audiocontrol/sampler-library/browser`
- All tests pass

---

## Phase 2: Scanner Integration

Add `detectCommonTone` item detector and `listCommonTonesTree()` to the library filesystem layer.

### Tasks

- [ ] Add `'common-tone'` to `LibraryTreeNode.type` union in `library-fs.ts:69`
- [ ] Implement `detectCommonTone` item detector in `library-fs.ts`
  - Checks for `.yaml` file extension
  - Parses YAML content
  - Validates against `CommonSampleYamlSchema` via `safeParse`
  - Returns `LibraryTreeNode` with `type: 'common-tone'` on success, `null` on failure
  - Pattern: follows `detectChoppedSample` (`library-fs.ts:364-390`)
- [ ] Implement `listCommonTonesTree()` function
  - Scans `library/common/tones/` using `scanLibraryDirectory` with `detectCommonTone`
  - Pattern: follows `listChoppedSamplesTree()` (`library-fs.ts:491-497`)
- [ ] Export new function and updated types from `library-fs.ts`
- [ ] Update browser exports in `browser.ts`
- [ ] Write unit tests for `detectCommonTone` and `listCommonTonesTree`

### Success Criteria

- `listCommonTonesTree()` returns a tree of common tones from `library/common/tones/`
- Invalid YAML files in the directory are silently skipped
- Subdirectories are treated as organizational folders
- `LibraryTreeNode.type` includes `'common-tone'`

### Risks

- **`library-fs.ts` is 574 lines** -- adding another detector and scanner function will push it past 600 lines. Consider extracting all item detectors into a separate `item-detectors.ts` file during this phase if it exceeds 600 lines.
- **`detectCommonTone` is more expensive than `detectTone`** because it must parse YAML to check the `format` field, while `detectTone` only checks the file extension. For large libraries this could be noticeable. Mitigated by the fact that `library/common/tones/` is expected to be smaller than device-specific tone directories.

---

## Phase 3: UI -- Tree & Preview

Add the "Common Tones" section to LibraryTreePanel and implement preview.

### Tasks

- [ ] Add `commonTonesTree?: LibraryTreeNode[]` prop to `LibraryTreePanelProps`
- [ ] Add `'commonTones'` to `expandedPaths` keys
- [ ] Add `'commonTone'` to `selectedType` union
- [ ] Add `onSelectCommonTone?: (name: string, path?: string[]) => void` callback prop
- [ ] Add "Common Tones" `TreeSection` to `LibraryTreePanel` render output, positioned between device tones/patches and the existing "Samples" section
- [ ] Create `sampler-editor/src/lib/library-common-tones.ts` with helpers for loading common tone metadata and WAV path resolution
- [ ] Wire `listCommonTonesTree()` into the library data loading flow (wherever `listChoppedSamplesTree()` is called)
- [ ] Implement common tone preview panel showing: name, description, tags, wave params (sample rate, loop mode), waveform visualization
- [ ] Update `useLibraryTreeActions` hook to handle `'commonTones'` category for selection

### Success Criteria

- Common tones appear in their own section in the library tree
- Clicking a common tone shows its preview (metadata + waveform)
- Subdirectory expansion/collapse works
- Empty state shows appropriate message

### Risks

- **`LibraryTreePanel.tsx` is 611 lines** -- already over the 500-line guideline. Adding another `TreeSection` and props increases this further. Consider extracting section rendering into sub-components or extracting the props interface into a separate file during this phase.

---

## Phase 4: WAV Import

Enable importing WAV files directly to the common area.

### Tasks

- [ ] Add "Import WAV" button to the Common Tones section header in `LibraryTreePanel`
- [ ] Implement file picker integration using environment capability interfaces (from `edit-workflow-architecture`)
- [ ] Create `sampler-library/src/common-area/import.ts` with `importWavToCommonArea()` function
  - Accepts WAV `File` or `Uint8Array`, target directory handle, and optional metadata (name, tags, description)
  - Parses WAV to extract sample rate
  - Generates `CommonSampleYaml` with defaults: `loopMode: 'oneShot'`, `loopPoint` absent
  - Writes YAML + WAV pair to `library/common/tones/`
  - Returns the created `CommonSampleYaml`
- [ ] Handle name derivation from filename (strip extension, truncate to 128)
- [ ] Trigger library tree refresh after import
- [ ] Write unit tests for `importWavToCommonArea`

### Success Criteria

- User can click "Import WAV", select a file, and see it appear in the Common Tones tree
- Imported samples have correct sample rate and default wave params
- Name is derived from filename if not provided
- Import works into subdirectories (when a folder is selected)

### Depends On

- Phase 1 (schema)
- Phase 3 (UI tree section with import button)

---

## Phase 5: Promotion/Demotion Converters

Implement the `PromotionConverter` interface and device-specific implementations.

### Tasks

- [ ] Create `sampler-library/src/converters/promotion.ts` with `PromotionConverter<TDefaults>` interface
  ```typescript
  interface PromotionConverter<TDefaults> {
    promote(sample: CommonSampleYaml, defaults: TDefaults): ToneYaml;
    demote(tone: ToneYaml): CommonSampleYaml;
  }
  ```
- [ ] Define `S330PromotionDefaults` type: `{ originalKey: number; outputAssign?: number; transpose?: number; fineTune?: number; ... }`
- [ ] Implement `s330PromotionConverter: PromotionConverter<S330PromotionDefaults>`
  - `promote`: creates `ToneYaml` with `device: 's330'`, `format: 'sampler-tone'`, truncates name to 12 chars, builds `s330` extension from defaults
  - `demote`: strips `s330` extension, sets `format: 'common-sample'`, sets `sourceDevice: 's330'`, preserves `wave` params
- [ ] Define `S550PromotionDefaults` type (same shape, extended `sourceTone` range)
- [ ] Implement `s550PromotionConverter: PromotionConverter<S550PromotionDefaults>`
- [ ] Export converters from `sampler-library/src/converters/index.ts` and `browser.ts`
- [ ] Write unit tests in `sampler-library/test/unit/converters/promotion.test.ts`
  - Round-trip: promote then demote preserves base fields
  - Name truncation on promote (128 -> 12)
  - `sourceDevice` set on demote
  - Required fields validated (e.g., `originalKey` in range)
  - S-330 and S-550 extension fields populated correctly

### Success Criteria

- `promote()` produces a valid `ToneYaml` (passes `ToneYamlSchema` validation including `.refine()`)
- `demote()` produces a valid `CommonSampleYaml` (passes `CommonSampleYamlSchema` validation)
- Round-trip preserves `wave` params, `name` (within length limits), and audio reference
- All device-specific defaults are applied correctly

### Depends On

- Phase 1 (schema)

---

## Phase 6: Promotion/Demotion UI

Wire the promotion and demotion converters into the editor UI.

### Tasks

- [ ] Add "Promote to [device]" dropdown button to common tone preview panel
  - Lists available devices (S-330, S-550) -- populated from `DeviceType` enum
  - Selecting a device opens a promotion form
- [ ] Create `PromotionForm.tsx` component
  - Shows required fields for the selected device (e.g., `originalKey` for S-330)
  - Shows optional fields with defaults pre-filled
  - Name field pre-filled (truncated to device limit if needed, editable)
  - Submit calls `promote()`, writes resulting `ToneYaml` + copies WAV to device library
  - Refreshes library tree
- [ ] Add "Demote to Common Area" button to device tone preview panel
  - Calls `demote()`, writes resulting `CommonSampleYaml` + copies WAV to `library/common/tones/`
  - Refreshes library tree
- [ ] Handle file copying (WAV from common -> device on promote, device -> common on demote)
- [ ] Write integration tests for promote/demote UI flows

### Success Criteria

- User can promote a common sample to S-330 or S-550, providing required params via form
- User can demote a device tone to the common area with one click
- Both operations copy audio files (no cross-references)
- Library tree refreshes to show the new item in the correct location
- Promoted tones are valid (loadable by existing device tone infrastructure)

### Depends On

- Phase 3 (preview panel)
- Phase 4 (import, so there are common samples to promote)
- Phase 5 (converters)

---

## Dependencies

- **`edit-workflow-architecture`** (complete) -- environment capability interfaces for file I/O in Phase 4

---

## Risks

- **`library-fs.ts` size (574 lines)** -- adding `detectCommonTone` and `listCommonTonesTree` may push past 600 lines. Mitigation: extract item detectors into `item-detectors.ts` if needed during Phase 2.
- **`LibraryTreePanel.tsx` size (611 lines)** -- already over guideline. Adding another section and props increases complexity. Mitigation: extract tree sections into sub-components during Phase 3 if the file exceeds 650 lines.
- **`detectCommonTone` performance** -- must parse YAML to check the `format` field (unlike `detectTone` which only checks extension). For directories with many files this is slower. Mitigation: `library/common/tones/` is expected to be small; if performance becomes an issue, add a filename convention (e.g., `.common.yaml`) to enable fast-path detection.
- **Name truncation UX** -- promoting a 128-char name to a 12-char device limit could frustrate users. Mitigation: the promotion form pre-fills the truncated name and lets the user edit it before confirming.
- **WAV file duplication** -- copy-on-promote/demote doubles disk usage for the audio. Mitigation: WAV files for vintage samplers are small (the S-330 has 768KB of wave memory). If this becomes a concern for future devices with larger sample memory, a reference-based approach can be added later.
