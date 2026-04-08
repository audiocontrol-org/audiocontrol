# Library UX Improvements - Workplan

**Source PRD:** [prd.md](./prd.md)
**Updated:** 2026-04-07

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Milestone** | [Backlog](https://github.com/audiocontrol-org/audiocontrol/milestone/8) |
| **Parent Issue** | [#165 - [roland-sxx0-editor] Library page UX improvements](https://github.com/audiocontrol-org/audiocontrol/issues/165) |
| **Labels** | `s330-editor`, `enhancement`, `refactor` |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | [#166](https://github.com/audiocontrol-org/audiocontrol/issues/166) | Panel focus indicators and empty states |
| Phase 1 | [#167](https://github.com/audiocontrol-org/audiocontrol/issues/167) | Loading states and progress indicators |
| Phase 2 | [#168](https://github.com/audiocontrol-org/audiocontrol/issues/168) | Drag-drop affordances and context menus |
| Phase 2 | [#169](https://github.com/audiocontrol-org/audiocontrol/issues/169) | Keyboard and breadcrumb navigation |
| Phase 3 | [#170](https://github.com/audiocontrol-org/audiocontrol/issues/170) | Extract dialog and panel hooks |
| Phase 3 | [#171](https://github.com/audiocontrol-org/audiocontrol/issues/171) | Consolidate preview panels |
| Phase 4 | [#172](https://github.com/audiocontrol-org/audiocontrol/issues/172) | Tests and documentation |

---

## Overview

Align both editors on `PluginLibraryBrowser`, then polish the shared components. The Roland editor is the UX reference standard; `PluginLibraryBrowser` must match it before Roland migrates onto it.

### Current State
- **Roland** `LibraryPage.tsx`: 908 lines, bespoke three-column layout, 11+ inline dialogs
- **S3K** `LibraryPage.tsx`: 596 lines, uses `PluginLibraryBrowser` from editor-core
- **editor-core** `PluginLibraryBrowser`: shared component that S3K uses but Roland doesn't

### Target State
- Both editors use `PluginLibraryBrowser` from editor-core
- Roland `LibraryPage.tsx` under 500 lines via hook extraction
- Shared `useEditorDialogs` hook in editor-core
- UX polish (empty states, skeletons, keyboard nav, drag-drop affordances) in shared components

---

## Phase 1: Extract Roland LibraryPage into Hooks

**Goal:** Get Roland's `LibraryPage.tsx` under 500 lines via pure refactoring. No rendering changes, no behavior changes.

### Task 1.1: Extract editor dialog management

Create `modules/roland-sxx0-editor/src/hooks/useRolandEditorDialogs.ts`

Move all dialog state (slice editor, loop editor, chopper, sample editor) and their open/close/save handlers out of LibraryPage. Follow the pattern of S3K's `useEditorDialogs` (`modules/akai-s3k-editor/src/hooks/useEditorDialogs.ts`).

**Files:**
- Create: `modules/roland-sxx0-editor/src/hooks/useRolandEditorDialogs.ts`
- Modify: `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] All dialog state and handlers extracted to hook
- [ ] LibraryPage imports and calls the hook
- [ ] No rendering or behavioral changes
- [ ] Builds cleanly

### Task 1.2: Extract library data loading

Create `modules/roland-sxx0-editor/src/hooks/useRolandLibraryData.ts`

Move `loadAllLibraryData`, the loading useEffect, refresh handlers, and all tree state (`tonesTree`, `patchesTree`, `drumKitsTree`, `commonSamplesTree`, `sets`, `drumKits`) out of LibraryPage.

**Files:**
- Create: `modules/roland-sxx0-editor/src/hooks/useRolandLibraryData.ts`
- Modify: `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] All data loading state and effects extracted
- [ ] Refresh callbacks exposed from hook
- [ ] No rendering or behavioral changes

### Task 1.3: Extract selection mapping

Create `modules/roland-sxx0-editor/src/hooks/useRolandSelectionMapping.ts`

Move `handlePluginSelectionChange` and related selection state. This callback maps editor-core's `ItemSelection` to Roland's page-level `ItemSelection` type and handles side effects (e.g., loading drum kit bundles on selection).

**Files:**
- Create: `modules/roland-sxx0-editor/src/hooks/useRolandSelectionMapping.ts`
- Modify: `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] Selection mapping logic extracted to hook
- [ ] Side effects (drum kit bundle loading) preserved
- [ ] No rendering or behavioral changes

### Task 1.4: Extract operation handlers

Move complex operation logic (sample/loop/chopper save callbacks) into existing hooks.

**Files:**
- Modify: `modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts`
- Modify: `modules/roland-sxx0-editor/src/hooks/useLibraryImportDialogs.ts`
- Modify: `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] Save handlers for sample editor, loop editor, chopper extracted
- [ ] LibraryPage under 500 lines
- [ ] No rendering or behavioral changes

**Phase 1 Verification:** All existing E2E tests pass (`make test-e2e-roland-library`, `make test-e2e-roland-ui`). No visual changes.

---

## Phase 2: Upstream Roland Patterns to editor-core

**Goal:** Make `PluginLibraryBrowser` capable of everything Roland's bespoke layout does. Roland's UX is the standard.

### Task 2.1: Audit Roland vs PluginLibraryBrowser gaps

Read these files side-by-side and document every feature in Roland's bespoke components that `PluginLibraryBrowser` lacks:

- `modules/roland-sxx0-editor/src/components/library/PluginLibraryTreePanel.tsx` (Roland's bespoke tree panel)
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` (shared component)
- `modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx`
- `modules/roland-sxx0-editor/src/components/library/ItemPreviewPanel.tsx`

**Known gaps:**
- Context menu rendering and action wiring
- Sets section with expandable manifests
- Device memory panel rendering differences
- `libraryHandle` typed as `FileSystemDirectoryHandle` (S3K casts `StorageDirectoryHandle`)

**Acceptance Criteria:**
- [ ] Complete gap list documented
- [ ] Each gap has a proposed resolution (upstream vs plugin-level vs skip)

### Task 2.2: Add context menu support to PluginLibraryBrowser

Roland's `PluginLibraryTreePanel` renders `ContextMenu` internally and converts `PluginContextMenuAction` to `ContextMenuAction` with click handlers. Upstream this pattern into `PluginLibraryBrowser`.

**Files:**
- Modify: `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`

**Acceptance Criteria:**
- [ ] PluginLibraryBrowser renders context menus using plugin-provided `getContextMenuActions`
- [ ] `onContextMenuAction` callback dispatches to consumer
- [ ] S3K editor gets context menus for free (already defines actions in plugin)

### Task 2.3: Model Sets as a CategoryPlugin

Create a Sets category definition for the Roland plugin. Sets become a `CategoryPlugin` with `categoryId: 'sets'`. Set manifest loading and expansion logic moves from `PluginLibraryTreePanel` into a `useSetsTree` hook that produces `TreeNode[]`.

If Sets don't fit cleanly as a `CategoryPlugin`, fall back to a `headerSections` render slot in `PluginLibraryBrowser`.

**Files:**
- Create: `modules/roland-sxx0-editor/src/plugins/shared/sets-category.ts`
- Create: `modules/roland-sxx0-editor/src/hooks/useSetsTree.ts`
- Modify: `modules/roland-sxx0-editor/src/plugins/s330-library-plugin.tsx`
- Modify: `modules/roland-sxx0-editor/src/plugins/s550-library-plugin.tsx`

**Acceptance Criteria:**
- [ ] Sets rendered via CategoryPlugin or headerSections slot
- [ ] Set expansion/manifest loading preserved
- [ ] No behavioral regression

### Task 2.4: Widen `libraryHandle` prop type

**Files:**
- Modify: `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- Modify: `modules/akai-s3k-editor/src/pages/LibraryPage.tsx` (remove cast)

**Acceptance Criteria:**
- [ ] Prop accepts `StorageDirectoryHandle`
- [ ] S3K no longer needs the `as unknown as FileSystemDirectoryHandle` cast

### Task 2.5: Extract shared useEditorDialogs to editor-core

Generalize the pattern from S3K's `useEditorDialogs` and Roland's `useRolandEditorDialogs`. The shared hook accepts a `WavLoaderStrategy` interface:

```typescript
interface WavLoaderStrategy {
  loadWav(root, name, nodeType, path?): Promise<WavData>;
  saveLoopPoints(root, name, nodeType, path?, loopStart, loopEnd): Promise<void>;
  saveSample(root, name, nodeType, path?, samples, sampleRate): Promise<void>;
}
```

Each editor provides a device-specific strategy. The hook manages dialog state identically.

**Files:**
- Create: `modules/editor-core/src/hooks/useEditorDialogs.ts`
- Modify: `modules/akai-s3k-editor/src/hooks/useEditorDialogs.ts` (delegate to shared)
- Modify: `modules/roland-sxx0-editor/src/hooks/useRolandEditorDialogs.ts` (delegate to shared)

**Acceptance Criteria:**
- [ ] Shared hook in editor-core
- [ ] Both editors use it with device-specific strategies
- [ ] No behavioral regression

**Phase 2 Verification:** Build both editors (`make`). All existing E2E tests pass.

---

## Phase 3: Migrate Roland to PluginLibraryBrowser

**Goal:** Replace Roland's bespoke three-column layout with `PluginLibraryBrowser`. Highest-risk phase.

### Task 3.1: Update Roland plugins for complete rendering

Ensure plugins provide everything `PluginLibraryBrowser` needs:
- Device memory panel via `deviceMemory.renderMemoryPanel`
- Preview panel via `previewPanel.renderPreview`
- All categories including Sets
- Context menu actions for all item types

**Files:**
- Modify: `modules/roland-sxx0-editor/src/plugins/s330-library-plugin.tsx`
- Modify: `modules/roland-sxx0-editor/src/plugins/s550-library-plugin.tsx`
- Modify: `modules/roland-sxx0-editor/src/plugins/shared/categories.tsx`

**Acceptance Criteria:**
- [ ] Plugins fully configure PluginLibraryBrowser
- [ ] All item types have context menu actions
- [ ] Both s330 and s550 plugins updated

### Task 3.2: Rewrite LibraryPage to use PluginLibraryBrowser

Replace the bespoke three-column grid with a single `<PluginLibraryBrowser>` call. Model after S3K's `LibraryPage.tsx`.

**Files:**
- Modify: `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] Uses `PluginLibraryBrowser` from editor-core
- [ ] All categories rendered (tones, patches, drumKits, commonSamples, sets)
- [ ] Device memory panel works
- [ ] Preview panel works
- [ ] All dialogs still work
- [ ] LibraryPage.tsx is 350-400 lines

### Task 3.3: Delete bespoke components

**Files to delete:**
- `modules/roland-sxx0-editor/src/components/library/PluginLibraryTreePanel.tsx` (~579 lines)
- Any other now-unused bespoke layout components

**Files to keep** (still used by plugin adapters):
- `DeviceMemoryPanel.tsx` (rendered by plugin's `renderMemoryPanel`)
- `ItemPreviewPanel.tsx` (rendered by plugin's `renderPreview`)
- `SampleBundlePreviewPanel.tsx`, `CommonSamplePreviewPanel.tsx` (sub-panels)
- All dialog components

### Task 3.4: Preserve test selectors

Add `data-testid` attributes to `PluginLibraryBrowser` and `TreeSection` in editor-core to match existing Roland E2E test selectors.

**E2E test files to verify:**
- `modules/roland-sxx0-editor/e2e/library-sets.spec.ts`
- `modules/roland-sxx0-editor/e2e/library-directories.spec.ts`
- `modules/roland-sxx0-editor/e2e/library-opfs.spec.ts`
- `modules/roland-sxx0-editor/e2e/library-chopper-save.spec.ts`

**Phase 3 Verification:** All Roland E2E tests pass. All S3K E2E tests pass. Visual regression check on both editors.

---

## Phase 4: UX Polish on Shared Components

**Goal:** Improve UX in editor-core so both editors benefit simultaneously.

### Task 4.1: Empty states

- `PluginLibraryBrowser`: styled empty state with icon and connect prompt
- `TreeSection`: empty category message with icon and action hint

**Files:**
- Modify: `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- Modify: `modules/editor-core/src/components/library/TreeSection.tsx`

### Task 4.2: Loading skeletons

Replace "Loading library..." text with animated skeleton placeholders matching tree section layout.

**Files:**
- Modify: `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- Create: `modules/editor-core/src/components/library/TreeSkeleton.tsx` (if needed)

### Task 4.3: Progress indicators

Progress bar component for import/export operations. Inline progress in preview panel during active transfers.

**Files:**
- Modify: `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`

### Task 4.4: Drag-drop affordances

- Grab cursor on draggable items
- Drop zone highlight during drag
- Invalid drop target indicator
- Drag preview showing item name/icon

**Files:**
- Modify: `modules/editor-core/src/components/library/TreeView.tsx`
- Modify: `modules/editor-core/src/components/library/TreeSection.tsx`
- Modify: `modules/editor-core/src/design/library.css`

### Task 4.5: Keyboard navigation

- Arrow keys: up/down to move selection, left/right to collapse/expand
- Enter to select/activate
- Delete to delete with confirmation
- Escape to deselect/close

**Files:**
- Modify: `modules/editor-core/src/components/library/TreeView.tsx`

**Phase 4 Verification:** Manual testing on both editors. All E2E tests pass.

---

## Phase 5: Zone 3 → Zone 4 Promotion (S3K)

**Goal:** Enable promoting S3K device-specific programs to the common area, crossing the conversion boundary defined in [SAMPLER-LIBRARY.md](/SAMPLER-LIBRARY.md).

### Task 5.1: Promotion function

Create `modules/akai-s3k-editor/src/lib/program-promotion.ts` with:
- Adapter mapping serialized keygroup fields (`lowNote`, `highNote`, `sampleNames`) to `AkaiDiskKeygroup` format
- `promoteToCommonArea()` function that loads an S3K library program, converts via `akaiProgramToCommon()`, copies sample WAVs, and saves a `ProgramYaml` bundle to `library/common/samples/`
- Handles both SysEx-origin (`s3000xl-program`) and disk-origin (`s3000xl-disk-program`) formats

**Reuses:**
- `akaiProgramToCommon()` from `sampler-devices/src/devices/s3000xl/akai-to-common.ts`
- `deserializeProgram()` / `deserializeDiskProgram()` from `akai-s3k-editor/src/lib/program-serialization.ts`
- `loadStoredProgram()` from `akai-s3k-editor/src/lib/program-storage.ts`

### Task 5.2: Promotion UI

Add "Promote to Common Area" button to `S3kItemPreviewPanel.tsx` for S3K library programs. Wire callback through `LibraryPage.tsx` preview state.

**Files:**
- Modify: `modules/akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx`
- Modify: `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`

**Phase 5 Verification:** Build passes. Manual test: export S3K program → promote to common area → verify program.yaml + WAVs in common area → reimport via ImportInstrumentDialog.

---

## Phase 6: Shared Editor Dialogs (Stub)

**Goal:** Extract shared `useEditorDialogs` hook to editor-core, eliminating duplicate dialog management between Roland (`useRolandEditorDialogs`) and S3K (`useEditorDialogs`).

**Status:** Not started. This is the next priority after Phase 5.

**Approach:** Create a shared hook in `modules/editor-core/src/hooks/useEditorDialogs.ts` with a `WavLoaderStrategy` interface. Each editor provides a device-specific strategy for loading/saving WAV data. The hook manages dialog state (open/close, loading, saving) identically in both cases.

**Why deferred:** Both editors already have working hooks. The shared extraction reduces duplication but doesn't unblock new functionality. Phase 5 (promotion) enables new workflows that users can't do today.

---

## Dependency Graph

```
Phase 1 (pure Roland refactor, no deps) — COMPLETE
  1.1 -> 1.2 -> 1.3 -> 1.4

Phase 2 (editor-core changes) — COMPLETE
  2.1 (audit) -> 2.2, 2.3, 2.4 (2.5 deferred to Phase 6)

Phase 3 (Roland migration) — COMPLETE
  3.1 -> 3.2 -> 3.3

Phase 4 (UX polish, tasks independent) — 4.1-4.4 COMPLETE, 4.5 deferred
  4.1, 4.2, 4.3, 4.4 (done), 4.5 (deferred: keyboard nav)

Phase 5 (S3K Zone 3→4 promotion, no deps on Phase 4)
  5.1 -> 5.2

Phase 6 (shared useEditorDialogs, after Phase 5)
  Stub — not started
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| E2E breakage during migration (Phase 3) | Run `make test-e2e-roland` after each step. Add `data-testid` attrs early. |
| Sets don't fit as CategoryPlugin | Prototype first; fall back to `headerSections` render slot if needed. |
| Selection type divergence | Roland page-level `ItemSelection` may persist for dialog callbacks; mapping hook bridges it to editor-core's type. |
| Two Roland plugins (s330/s550) | Both implement same `DeviceLibraryPlugin` interface. Test with both device configs. |

---

## Critical Files

| File | Role |
|------|------|
| `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx` | 908-line file to decompose and migrate |
| `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` | Shared component to match Roland UX |
| `modules/editor-core/src/components/library/plugins/types.ts` | Plugin interface definitions |
| `modules/roland-sxx0-editor/src/components/library/PluginLibraryTreePanel.tsx` | Bespoke component to be replaced |
| `modules/roland-sxx0-editor/src/plugins/shared/categories.tsx` | Category definitions to extend with Sets |
| `modules/akai-s3k-editor/src/hooks/useEditorDialogs.ts` | Pattern to generalize into editor-core |
| `modules/akai-s3k-editor/src/pages/LibraryPage.tsx` | Reference for PluginLibraryBrowser usage |
