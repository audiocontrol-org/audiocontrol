# Extract Common-Area UI to editor-core

## Problem

Common-area sample/program UI is duplicated between the S3K and Roland editors. Every fix to one editor must be manually replicated in the other. This has caused repeated bugs:
- Node type handling for chopped-sample/drum-kit had to be patched independently in both editors
- Preview panels, item types, and categories are near-identical but maintained separately
- Icons are identical SVGs copied between editors

## What's duplicated

### Identical code (Priority 1)
- `sampleItemType` — context menu actions, icons, drag/rename support
- `programItemType` — context menu actions
- `createCommonSamplesCategory()` / `createCommonProgramsCategory()` — factory functions
- `NewFolderButton` component — identical SVG, minor CSS theme difference

### Similar code (Priority 2)
- Sample preview — name/type/path with editor action buttons (Loop Editor, Edit Sample, Chop)
- Program preview — zones display
- `EditorActions` component — Loop Editor, Edit Sample, Chop buttons

### Icons (Priority 3)
- `SampleIcon` / `WaveIcon` — identical SVG paths
- `ProgramIcon` / `PatchIcon` — identical
- `DrumKitIcon` — identical

### Already shared (no action needed)
- `useEditorDialogsCore` — strategy pattern, well-designed
- `PluginLibraryBrowser` — shared component
- Library connection/operations hooks

## Approach

### Step 1: Common-area item types + categories in editor-core

Create `modules/editor-core/src/plugins/common-area/`:
- `item-types.tsx` — `sampleItemType`, `programItemType`
- `categories.tsx` — `createCommonSamplesCategory()`, `createCommonProgramsCategory()`, `NewFolderButton`
- `icons.tsx` — `SampleIcon`, `ProgramIcon` (theme-aware)
- `index.ts` — re-exports

Both editors import and compose with device-specific types.

### Step 2: Common-area preview components in editor-core

Create `modules/editor-core/src/components/library/`:
- `SamplePreview.tsx` — unified preview (plain, sliced, drum kit via metadata)
- `EditorActions.tsx` — shared Loop Editor / Edit Sample / Chop buttons

Both editors use for common-area items, extend via custom state callbacks.

### Step 3: Update both editors

Remove duplicated item types, categories, icons, and preview components. Each editor's plugin only defines device-specific types (tone, patch, s3k-program).

## Files to create

| File | Contents |
|------|----------|
| `editor-core/src/plugins/common-area/item-types.tsx` | sampleItemType, programItemType |
| `editor-core/src/plugins/common-area/categories.tsx` | createCommonSamplesCategory, createCommonProgramsCategory, NewFolderButton |
| `editor-core/src/plugins/common-area/icons.tsx` | SampleIcon, ProgramIcon |
| `editor-core/src/plugins/common-area/index.ts` | Re-exports |
| `editor-core/src/components/library/SamplePreview.tsx` | Unified sample preview |
| `editor-core/src/components/library/EditorActions.tsx` | Shared editor action buttons |

## Files to modify

| File | Change |
|------|--------|
| `akai-s3k-editor/src/plugins/item-types.tsx` | Remove sample/program, import from editor-core |
| `akai-s3k-editor/src/plugins/categories.tsx` | Import category factories from editor-core |
| `akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx` | Use shared SamplePreview |
| `roland-sxx0-editor/src/plugins/shared/item-types.tsx` | Remove sample/program, import from editor-core |
| `roland-sxx0-editor/src/plugins/shared/categories.tsx` | Import category factories from editor-core |

## Verification

```bash
# All modules build
pnpm --filter editor-core build
pnpm --filter akai-s3k-editor build
pnpm --filter roland-sxx0-editor build

# E2E tests
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library

# Unit tests
pnpm --filter akai-s3k-editor test
pnpm --filter roland-sxx0-editor test
```
