# Sample Format Consolidation — Implementation Workplan

**Feature:** Sample Format Consolidation
**PRD:** [prd.md](./prd.md)

## Technical Approach

Extend `SampleYamlSchema` with the slice-related fields from `ChoppedSampleSchema`, update all save/load/detect code paths, remove the duplicate "Chopped Samples" category from the library UI, and maintain backward compatibility for reading legacy `manifest.yaml` files.

## Implementation Phases

### Phase 1: Extend SampleYaml schema

Add optional `slices`, `triggers`, `playback`, `drumKit` fields to `SampleYamlSchema` in `modules/sampler-library/src/schemas/sample-schema.ts`. These mirror the fields from `ChoppedSampleSchema`.

### Phase 2: Update library-fs detectors

In `modules/sampler-library/src/library-fs.ts`:
- Update `detectSample()` to read slice count from `sample.yaml` and set `sliceCount` on tree node
- Update `detectCommonItem()` to try legacy `manifest.yaml` detection as a fallback, returning `type: 'sample'` with slice data
- Remove `listChoppedSamplesTree()` and `scanChoppedSamplesDirectory()`

### Phase 3: Update save/load in common-area

In `modules/sampler-library/src/common-area/samples.ts`:
- Update `saveChoppedSample()` to write `sample.yaml` + `sample.wav` format
- Update `loadChoppedSample()` to check `sample.yaml` first, fall back to `manifest.yaml`

### Phase 4: Remove choppedSamples category from plugins

- Remove `createChoppedSamplesCategory()` from categories.tsx
- Remove `choppedSampleItemType` from item-types.tsx
- Remove from s330/s550 plugin category arrays

### Phase 5: Update LibraryPage

- Remove `choppedSamplesTree` state
- Remove `listChoppedSamplesTree` from `loadAllLibraryData`
- Remove `choppedSamples` from `categoryData` and `expandedPaths`
- Simplify selection handler (no `choppedSamples` category)

### Phase 6: Update CommonSamplePreviewPanel

- Show slice count and slice list when `sample.slices` is defined
- "Open in Chopper" button already exists

### Phase 7: Update tests and verify

- Update sample schema tests for new fields
- Update detection tests
- Full build and test

## Task Breakdown

1. Extend SampleYaml schema with slice fields
2. Update detectSample and detectCommonItem in library-fs
3. Update saveChoppedSample/loadChoppedSample in common-area/samples
4. Remove choppedSamples category from plugins and library page
5. Update CommonSamplePreviewPanel to show slice info
6. Update sample-chopper dev harness to save new format
7. Update tests, build, verify
