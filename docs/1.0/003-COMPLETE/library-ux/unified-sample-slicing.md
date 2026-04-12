# Unified Sample Slicing: Merge chopped-sample and drum-kit node types

## Problem

The S3K editor treats `chopped-sample` and `drum-kit` as separate node types with separate preview components (`ChoppedSamplePreview`, `DrumKitPreview`) and separate type checks scattered throughout the codebase. Every function that handles one must be separately patched to handle the other:

- `loadWavData` didn't handle `drum-kit` → threw "Unsupported node type"
- `handleOpenInChopper` didn't load initial slices for `drum-kit`
- `DrumKitPreview` was missing `EditorActions` (no Chop/Loop/Edit buttons)

Per SAMPLER-LIBRARY.md, a drum kit is a sample with slice definitions plus drum kit metadata (`drumKit.baseNote`). It's not a fundamentally different thing — it's a metadata state of the same underlying sample.

## Design

See SAMPLER-LIBRARY.md "Sample Slicing" section for the theory.

### Single node type: `sample`

Remove `chopped-sample` and `drum-kit` as separate node types. All items in `library/common/samples/` are type `sample`. The tree scanner determines visual indicators from metadata:

- No `slices` in YAML → plain sample
- Has `slices` → badge showing slice count (e.g., "4 slices")
- Has `slices` + `drumKit` → badge showing pad count (e.g., "4 pads")

### Single preview component

Replace `SamplePreview`, `ChoppedSamplePreview`, and `DrumKitPreview` with one adaptive component:

- Always shows: name, sample rate, type indicator, path
- If slices present: slice count, slice labels
- If drumKit present: base note, MIDI note range, "Import as Drum Program" button
- Always shows: EditorActions (Loop Editor, Edit Sample, Chop), Send to Device

### Chopper dialog

- Opens from any sample — loads existing slices if present
- Output mode: "Slices only" vs "Drum Kit" (adds base note config)
- Save always writes to the same `sample.yaml` — no type change

## Files to modify

| File | Change |
|------|--------|
| `modules/akai-s3k-editor/src/plugins/item-types.tsx` | Remove `chopped-sample` and `drum-kit` types; merge into `sample` with conditional metadata |
| `modules/akai-s3k-editor/src/plugins/categories.tsx` | Update category to use single `sample` type |
| `modules/akai-s3k-editor/src/lib/library-tree.ts` | Stop classifying by type — always return `sample` |
| `modules/akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx` | Merge three preview components into one adaptive component |
| `modules/editor-core/src/hooks/useEditorDialogsCore.ts` | Remove `chopped-sample` / `drum-kit` special cases — treat all as `sample` |
| `modules/sampler-library/src/common-area/samples.ts` | Update tree scanner to return `sample` type with metadata flags |

## Verification

```bash
# Chopper tests
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library 'ARGS=--grep "Chopper"'

# Library UI tests
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library

# Drum kit import (device test)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "Drum Kit Import"'

# Roland library tests (parity — should still pass)
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
```
