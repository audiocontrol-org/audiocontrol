# Phase 6: Shared Editor Dialogs

**Source:** [workplan.md](./workplan.md) Phase 6
**Status:** In progress

## Problem

Both editors have editor dialog hooks with substantial duplication:
- S3K: `useEditorDialogs` (304 lines)
- Roland: `useRolandEditorDialogs` (470 lines)

The common-area operations (load sample WAV, save loop points, save edited audio, save chopped samples, drum kit editing) are identical. The only differences are device-specific WAV loading paths.

## Design Principles

### All editors get the full complement of editing tools

Every sampler editor offers the same set of common-area editor dialogs:
- **Sample Editor** — trim, normalize, fade, reverse
- **Loop Editor** — edit loop points
- **Sample Chopper** — slice samples into drum kits
- **Drum Kit Editor** — edit kit metadata and per-pad configuration
- **Slice Edit Dialog** — edit existing drum kit slices and source audio

These are common-area operations on vendor-agnostic objects. The device type doesn't determine which editors are available.

### Editing device-specific objects promotes to common area

When a user opens a common-area editor on a device-specific library object (Roland tone, S3K program with samples):

1. **Load** from device-specific storage (Zone 3) — the strategy handles this
2. **Edit** in the common-area editor
3. **Save** to the common area (Zone 4) — always
4. **Notify** the user: the edited result is now in the common area

Editors produce vendor-agnostic output. The save path always goes to the common area. This is an implicit promotion with an elegant notification so the user understands what happened.

## Architecture

### Strategy interface

```typescript
interface EditorDialogStrategy {
  /** Load WAV data for a device-specific node type.
   * Return null for common-area types (shared hook handles those). */
  loadWav(root, name, nodeType, path?): Promise<WavData | null>;

  /** Transform chopper save payload before saving.
   * Use to inject device-specific kit metadata (e.g., S3K baseNote). */
  transformChopperYaml?(yaml: SampleYaml): SampleYaml;
}
```

### Shared hook

`useEditorDialogsCore(root, strategy, onRefresh, onError)` in editor-core:

- Manages all dialog state (loop editor, sample editor, chopper, drum kit editor, slice edit)
- Provides open/close/save handlers
- Loads WAV data: tries strategy first, falls back to common-area loading
- Saves always go to common area
- Handles drum kit slice editing and source → sample editor transitions

### Per-editor strategies

**Roland strategy:** loads tone WAV from `library/s330/tones/` for `tone`/`individualTone` node types.

**S3K strategy:** loads program sample WAVs from `library/s3k/programs/` for `program` node types. Provides `transformChopperYaml` to add S3K drum kit metadata (baseNote, transpose, velocitySensitivity).

**Common area fallback (built into shared hook):** loads from `library/common/samples/` for `sample`/`chopped-sample` node types.

## Files

### Create

| File | Purpose |
|------|---------|
| `modules/editor-core/src/hooks/useEditorDialogsCore.ts` | Shared hook + strategy interface + dialog state types |

### Modify

| File | Change |
|------|--------|
| `modules/editor-core/src/hooks/index.ts` | Export shared hook |
| `modules/akai-s3k-editor/src/hooks/useEditorDialogs.ts` | Refactor to use shared hook with S3K strategy |
| `modules/roland-sxx0-editor/src/hooks/useRolandEditorDialogs.ts` | Refactor to use shared hook with Roland strategy |

## Estimated sizes

- Shared hook: ~350 lines
- S3K strategy: ~40 lines
- Roland strategy: ~60 lines

## Verification

1. `make` — both editors build
2. Manual test: loop editor, sample editor, chopper, drum kit editor in both editors
3. Verify editing a Roland tone saves to common area (not back to tone directory)
4. Verify S3K chopper save includes drum kit metadata from kit config
5. No behavioral regression for common-area editing
