# Tier 1 Parity Report

Audit of code paths exercised by Tier 1 library e2e tests, comparing the Roland (`roland-sxx0-editor`) and S3K (`akai-s3k-editor`) editors for code duplication, structural divergence, and shared-path usage.

## Files Audited

| Editor | File | Lines |
|--------|------|-------|
| Roland | `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx` | 431 |
| Roland | `modules/roland-sxx0-editor/src/hooks/useRolandLibraryStrategy.ts` | 172 |
| Roland | `modules/roland-sxx0-editor/src/hooks/useRolandSelectionMapping.ts` | 125 |
| Roland | `modules/roland-sxx0-editor/src/hooks/useRolandLibraryData.ts` | 143 |
| S3K | `modules/akai-s3k-editor/src/pages/LibraryPage.tsx` | 605 |
| S3K | `modules/akai-s3k-editor/src/hooks/useEditorDialogs.ts` | 81 |
| Shared | `modules/editor-core/src/hooks/useLibraryOperations.ts` | 245 |
| Shared | `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` | 453 |

---

## Operations Tested

### 1. Select item -> preview panel update

- **Shared path:** Both editors pass `selection` and `previewState` to `PluginLibraryBrowser`, which delegates to the plugin's `previewPanel.renderPreview(selection, { customState: previewState })`. The rendering is fully plugin-driven and shared.
- **Roland-specific:** Roland defines a custom `ItemSelection` type in `LibraryPage.tsx` (line 51-58) with `source: 'device' | 'library'` plus domain-specific types (`tone`, `patch`, `set`, `drumKit`, `individualTone`, `individualPatch`, `sample`, `program`). The `useRolandSelectionMapping` hook (125 lines) translates between editor-core's `ItemSelection` (categoryId/node/meta) and this custom type. The preview panel receives a `PreviewPanelCustomState` with Roland-specific callbacks.
- **S3K-specific:** S3K uses editor-core's `ItemSelection` directly (imported from `@audiocontrol/editor-core`). Selection changes are passed straight through via `setSelection` -- no mapping hook needed. Device selection builds `ItemSelection` objects inline in `handleDeviceSelectProgram` and `handleDeviceSelectSample` (lines 237-266). The preview panel receives an `S3kPreviewCustomState` with S3K-specific callbacks.
- **Parity status:** Divergence
- **Duplication found:** No -- the divergence is structural, not copy-paste. Roland has its own `ItemSelection` type that S3K does not use. Roland's mapping layer (`useRolandSelectionMapping`) exists because Roland's `LibraryPage` was written before editor-core's `ItemSelection` was standardized. S3K adopted editor-core's type directly.

### 2. Create folder (common area + device-specific)

- **Shared path:** Both editors use `useLibraryOperations` from editor-core. The hook's `onCreateFolder` calls `strategy?.createFolder?.(categoryId, parentPath, name)` first; if the strategy returns false (or is absent), it falls back to `createFolder(libraryRoot, parentPath, name)` from `sampler-library/browser`. Both editors wire up this hook identically:
  ```
  useLibraryOperations(root, strategy, refreshLibrary, onError, onEditorAction)
  ```
- **Roland-specific:** `useRolandLibraryStrategy` provides a `createFolder` implementation that handles device-specific categories (`tones`, `patches`, `drumKits`) via `createDirectory()` from `@/lib/library-service`, passing through `commonSamples`/`commonPrograms` to the shared fallback.
- **S3K-specific:** `libraryStrategy` (defined inline in LibraryPage, lines 184-194) only implements `deleteItem` for the `programs` category. No `createFolder` override -- all categories use the shared common-area fallback.
- **Parity status:** Parity -- both use the shared hook. Roland has richer device-specific category handling, but the architecture is the same.
- **Duplication found:** No

### 3. Delete item from library

- **Shared path:** Both editors use `useLibraryOperations.onDelete`, which calls `strategy?.deleteItem?.(categoryId, node)` first, then falls back to `deleteItem(libraryRoot, name, path)` from `sampler-library/browser`.
- **Roland-specific:** `useRolandLibraryStrategy.deleteItem` handles `tone`, `patch`, `drum-kit`, and `directory` types across device-specific categories, clearing selection when the deleted item was selected.
- **S3K-specific:** `libraryStrategy.deleteItem` handles only `programs` category via `deleteStoredProgram(root, dirName)`. Common-area samples fall through to the shared hook.
- **Parity status:** Parity -- same architecture, different device-specific implementations.
- **Duplication found:** No

### 4. Connect/disconnect OPFS

- **Shared path:** Both editors use `useLibraryConnection` from editor-core and render `LibraryConnectionUI` from editor-core. This is fully shared.
- **Roland-specific:** `useLibraryConnection({ pickerId: 'sampler-library', googleDrive: ... })`. Passes Google Drive config from env vars. Renders `LibraryConnectionUI` as a `connectionSlot` prop to `PluginLibraryBrowser`.
- **S3K-specific:** `useLibraryConnection({ pickerId: 'akai-s3k-library' })`. No Google Drive config. Renders `LibraryConnectionUI` as a `connectionSlot` prop to `PluginLibraryBrowser`. Wraps `connect` in a `handleConnect` callback (line 409-412) that adds `void` -- a minor difference.
- **Parity status:** Parity
- **Duplication found:** Yes, minor. Both editors construct the `connectionSlot` JSX identically (same props passed to `LibraryConnectionUI`). This is ~10 lines of boilerplate each. Not worth extracting unless more editors are added.

### 5. Context menu (right-click -> actions)

- **Shared path:** `PluginLibraryBrowser` handles context menu state, rendering (`ContextMenu` component), and dispatching. It gets actions from `plugin.categories[i].itemTypes[type].getContextMenuActions()`. Built-in `delete` action is handled internally; all others dispatch to `onContextMenuAction`. Both editors pass `libraryOps.onContextMenuAction` to this prop.
- **Roland-specific:** `useRolandLibraryStrategy` can provide `handleContextMenuAction` on the strategy, but currently does not (no implementation in the strategy). Editor actions (`open-loop-editor`, `open-chopper`, `open-sample-editor`) are handled by the `onEditorAction` callback passed to `useLibraryOperations`.
- **S3K-specific:** Same pattern -- `libraryStrategy` does not provide `handleContextMenuAction`. Editor actions handled via the same `onEditorAction` callback.
- **Parity status:** Parity
- **Duplication found:** Yes -- the `onEditorAction` callback wiring is nearly identical in both editors:
  - Roland (LibraryPage.tsx lines 140-144):
    ```typescript
    (actionId, name, nodeType, path) => {
      if (actionId === 'open-loop-editor') editorDialogs.handleOpenInLoopEditor(name, nodeType, path);
      else if (actionId === 'open-chopper') editorDialogs.handleOpenInChopper(name, nodeType, path);
      else if (actionId === 'open-sample-editor') editorDialogs.handleOpenInSampleEditor(name, nodeType, path);
    }
    ```
  - S3K (LibraryPage.tsx lines 201-205):
    ```typescript
    (actionId, name, nodeType, path) => {
      if (actionId === 'open-loop-editor') editorDialogs.handleOpenInLoopEditor(name, nodeType, path);
      else if (actionId === 'open-chopper') editorDialogs.handleOpenInChopper(name, nodeType, path);
      else if (actionId === 'open-sample-editor') editorDialogs.handleOpenInSampleEditor(name, nodeType, path);
    }
    ```
  These are character-for-character identical.

### 6. Tree node rendering (item appears in tree)

- **Shared path:** `PluginLibraryBrowser` renders `TreeSection` for each plugin category, passing `categoryData[categoryId]` as nodes. Icon rendering, trailing content, expand/collapse, and drag support are all driven by plugin `itemTypes` configuration. This is fully shared.
- **Roland-specific:** `useRolandLibraryData` provides `categoryData` with keys `tones`, `patches`, `drumKits`, `commonSamples`. Uses `loadAllLibraryData()` to scan 8 data sources in parallel.
- **S3K-specific:** `useLibraryTreeData` (inline in LibraryPage.tsx, lines 110-134) provides `categoryData` with keys `samples`, `programs`. Uses `listCommonSamplesTree()` plus `refreshPrograms()`.
- **Parity status:** Parity -- same rendering path, different data shapes driven by plugin config.
- **Duplication found:** No

---

## Code Duplication Summary

### Confirmed Duplications

1. **`onEditorAction` callback** -- Identical 5-line if/else-if block in both editors dispatching `open-loop-editor`, `open-chopper`, and `open-sample-editor` to `editorDialogs` methods. This should be a shared helper or a default implementation in `useLibraryOperations`.

2. **`getNodePath` / `getNodeName` helpers** -- The `getNodePath` function is duplicated between `useRolandLibraryStrategy.ts` (lines 32-39) and `useLibraryOperations.ts` (lines 62-70). They are identical. The `getNodeName`/`getNodeFileName` functions are near-identical (Roland's version also checks `directoryName`). These should be exported from editor-core.

3. **`LibraryConnectionUI` slot construction** -- Both editors build a `connectionSlot` JSX fragment passing the same 7 props to `LibraryConnectionUI`. Low severity, ~10 lines each.

4. **Editor dialog rendering (LoopEditorDialog, SampleChopperDialog, SampleEditorDialog)** -- Both editors render these three dialogs with nearly identical prop wiring. Compare:
   - Roland LibraryPage.tsx lines 391-427
   - S3K LibraryPage.tsx lines 552-592

   The prop patterns are the same; only minor differences exist (S3K's chopper has `renderOutputConfig`, Roland's chopper has `onOpenSampleEditor`).

5. **Library scan-on-connect / clear-on-disconnect pattern** -- S3K has this inline (lines 211-225). Roland has it in `useRolandLibraryData` (lines 106-116). Same pattern: useEffect watching `root`, load on connect, clear on disconnect.

### Not Duplicated (Good Extractions)

- `useLibraryOperations` -- fully shared, both editors wire it identically
- `PluginLibraryBrowser` -- fully shared component
- `useLibraryConnection` + `LibraryConnectionUI` -- fully shared
- `useEditorDialogsCore` -- S3K wraps it in `useEditorDialogs`; Roland uses `useRolandEditorDialogs` (not audited but follows same pattern)

---

## S3K LibraryPage: Un-extracted Code Analysis

The S3K `LibraryPage.tsx` is 605 lines vs Roland's 431. The difference (174 lines) comes from:

### Inline code that Roland extracted to hooks

1. **`useLibraryTreeData` function** (lines 110-134, 25 lines) -- Defined inline in the same file. Roland extracted equivalent logic to `useRolandLibraryData.ts` (143 lines, a separate file). This should be extracted to its own file.

2. **Device selection handlers** (lines 236-266, 30 lines) -- `handleDeviceSelectProgram` and `handleDeviceSelectSample` are defined inline. Roland extracted this to `useRolandSelectionMapping.ts`. S3K could extract to `useS3kSelectionMapping.ts`.

3. **Dialog state types and constants** (lines 76-104, 29 lines) -- `SendDialogState`, `ReceiveDialogState`, `DiskToLibraryDialogState` and their closed-state constants are defined inline. These are S3K-specific and could be extracted to a types file or a dialog state hook.

4. **`libraryStrategy` definition** (lines 184-194, 11 lines) -- Defined inline. Roland extracted to `useRolandLibraryStrategy.ts`. Could be extracted to `useS3kLibraryStrategy.ts`.

5. **Transfer dialog callbacks** (lines 272-339, 67 lines) -- `handleSendSampleToDevice`, `handleSaveDeviceSampleToLibrary`, `handleSaveDeviceProgramToLibrary`, `handleSendProgramToDevice`, `handleImportInstrument`, `handleDeleteDeviceProgram`, `handleDeleteDeviceSample`, `handleExportComplete`, `handleImportComplete`. These are S3K-specific but bloat the page component. Could be extracted to `useS3kTransferCallbacks.ts`.

### S3K-specific code (not duplication)

- `DiskBrowserPanel` integration (lines 463-470) -- S3K has a fourth column for SCSI disk browsing that Roland does not have.
- `DiskToLibraryDialog` (lines 539-549) -- S3K-specific.
- `DrumKitEditorDialog` (lines 593-602) -- S3K-specific.
- Device program/sample deletion handlers -- S3K deletes from hardware via SysEx; Roland does not have equivalent device-side deletion.

---

## Patterns Where One Editor Is More Sophisticated

### Roland is more sophisticated

1. **Selection mapping layer** -- Roland's `useRolandSelectionMapping` provides a clean translation between editor-core's generic `ItemSelection` and the page's domain-specific `ItemSelection`. S3K builds `ItemSelection` objects ad-hoc in multiple callbacks. Roland's approach is cleaner and more testable.

2. **Library data hook** -- Roland's `useRolandLibraryData` is a standalone hook with a clear result interface. S3K's `useLibraryTreeData` is a function defined inside the page file.

3. **Strategy extraction** -- Roland's `useRolandLibraryStrategy` is a proper hook with typed options and result interfaces. S3K defines `libraryStrategy` inline with `useMemo`.

### S3K is more sophisticated

1. **Editor dialogs** -- S3K's `useEditorDialogs` hook properly wraps `useEditorDialogsCore` from editor-core with device-specific strategy injection. This is the cleanest example of the composition pattern in the audit scope.

2. **Direct use of editor-core's ItemSelection** -- S3K uses editor-core's `ItemSelection` type directly rather than maintaining a parallel type. This avoids the mapping complexity Roland has. (However, it means S3K's preview state callbacks need to reverse-engineer intent from `node.type` and `categoryId`.)

---

## Guideline Violations

### S3K LibraryPage exceeds 500-line limit

- **Where:** `modules/akai-s3k-editor/src/pages/LibraryPage.tsx` (605 lines)
- **Guideline:** "Code files should be no larger than 300-500 lines long"
- **Remediation:** Extract `useLibraryTreeData`, device selection handlers, library strategy, and transfer callbacks to separate hook files. Target: page file under 350 lines.
- **Effort:** M

### Duplicated `getNodePath` helper

- **Where:** `modules/roland-sxx0-editor/src/hooks/useRolandLibraryStrategy.ts` lines 32-39 duplicates `modules/editor-core/src/hooks/useLibraryOperations.ts` lines 62-70
- **Guideline:** DRY / "common logic is shared via composition"
- **Remediation:** Export `getNodePath` and `getNodeName` from editor-core. Import in both places.
- **Effort:** S

### Duplicated `onEditorAction` callback

- **Where:** Roland `LibraryPage.tsx` lines 140-144, S3K `LibraryPage.tsx` lines 201-205
- **Guideline:** DRY
- **Remediation:** Add a `createEditorActionHandler(editorDialogs)` factory to editor-core, or make `useLibraryOperations` accept an `editorDialogs` object directly and handle the dispatch internally.
- **Effort:** S

### Roland maintains parallel `ItemSelection` type

- **Where:** `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx` lines 51-58
- **Guideline:** "Interface-first design -- define contracts across organizational boundaries"
- **Impact:** The parallel type requires a translation layer (`useRolandSelectionMapping`) and creates a coupling between the page and every hook that consumes selection state. If editor-core's `ItemSelection` changes, Roland's mapping must be updated manually.
- **Remediation:** Migrate Roland to use editor-core's `ItemSelection` directly, as S3K does. Roland-specific metadata goes in the `meta` field. Estimated effort is M because it touches multiple hooks.
- **Effort:** M

---

## Recommendations

### Priority 1 (Small effort, high value)

1. **Export `getNodePath` and `getNodeName` from editor-core.** Both are used in multiple places and are currently duplicated. Single function, single location.

2. **Extract `onEditorAction` dispatch to a shared factory.** The identical if/else-if block should be defined once. Either a standalone function or integrated into `useLibraryOperations`.

### Priority 2 (Medium effort, high value)

3. **Extract S3K inline code to hooks.** Create:
   - `useS3kLibraryData.ts` (from `useLibraryTreeData`)
   - `useS3kLibraryStrategy.ts` (from inline `libraryStrategy`)
   - `useS3kSelectionMapping.ts` (from inline device selection handlers)
   - `useS3kTransferCallbacks.ts` (from dialog callback cluster)

   This brings S3K LibraryPage under 350 lines and creates structural parity with Roland's hook organization.

4. **Extract shared editor dialog rendering.** The LoopEditorDialog, SampleChopperDialog, and SampleEditorDialog rendering blocks are nearly identical between editors. Consider a `<CommonEditorDialogs editorDialogs={...} libraryHandle={...} />` component in editor-core.

### Priority 3 (Medium effort, moderate value)

5. **Migrate Roland to editor-core's `ItemSelection`.** Eliminate the parallel type and the mapping hook. Move Roland-specific fields into `meta`. This reduces coupling and makes the two editors structurally identical at the selection layer.

### Not recommended

- Extracting `LibraryConnectionUI` slot construction -- too little duplication to justify a shared component.
- Unifying `libraryStrategy` implementations -- the device-specific logic is genuinely different and should stay in each editor.

---

## Resolution Status

| # | Duplication | Status | Reference |
|---|------------|--------|-----------|
| 1 | `onEditorAction` callback | **Fixed** — `createEditorActionHandler()` added to `useEditorDialogsCore` |
| 2 | `getNodePath`/`getNodeName` helpers | **Fixed** — exported from `useLibraryOperations`, removed from Roland strategy |
| 3 | Editor dialog rendering (~40 lines) | **Deferred** — can't extract to editor-core without adding package deps. Filed as [#175](https://github.com/audiocontrol-org/audiocontrol/issues/175) |
| 4 | S3K LibraryPage hook extraction (605 lines) | **Deferred** — filed as [#174](https://github.com/audiocontrol-org/audiocontrol/issues/174) |
| 5 | Roland parallel `ItemSelection` type | **Deferred** — medium effort, tracked in recommendations above |
