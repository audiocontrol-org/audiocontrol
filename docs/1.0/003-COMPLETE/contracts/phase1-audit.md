# Phase 1 Audit: Contract Violations

Comprehensive inventory of contract violations across editor-core, roland-sxx0-editor, and akai-s3k-editor.

---

## 1. Bare Callback Parameters (18 findings)

Optional function parameters on shared interfaces/hooks that should be typed capability interfaces.

### Critical: Large optional callback bags

| # | File | Lines | Interface | Optional Callbacks | Issue |
|---|------|-------|-----------|-------------------|-------|
| 1 | `editor-core/src/components/library/TreeSection.tsx` | 40-80 | `TreeSectionProps` | 15 | Archetypal "optional bag of callbacks" — consumers get no compiler help |
| 2 | `editor-core/src/components/library/TreeView.tsx` | 30-67 | `TreeViewProps` | 12 | Duplicates many TreeSection callbacks |
| 3 | `editor-core/src/components/library/TreeView.tsx` | 74-98 | `TreeNodeRowProps` | ~12 | Third copy of same callback signatures (DRY violation) |
| 4 | `editor-core/src/components/library/PluginLibraryBrowser.tsx` | 92-112 | `PluginLibraryBrowserProps` | 6 | Core library operations — omitting `onContextMenuAction` makes clicks silently no-op |
| 5 | `editor-core/src/components/library/PluginLibraryBrowser.tsx` | 208-210 | `MultiSelectPreview` (internal) | 3 | Optionality cascades inward from parent |

### High: Shared hook/interface callbacks

| # | File | Line(s) | Interface/Hook | Callback | Issue |
|---|------|---------|----------------|----------|-------|
| 6 | `editor-core/src/hooks/useLibraryOperations.ts` | 238 | `useLibraryOperations` | `onEditorAction?` | Stringly-typed action IDs, throws at runtime instead of compile error |
| 7 | `editor-core/src/components/library/LibraryBrowser.tsx` | 55-82 | `LibraryBrowserProps` | 6 optional callbacks | Older component, same pattern |
| 8 | `editor-core/src/components/library/LibraryPanel.tsx` | 27-41 | `LibraryPanelProps` | 3 optional callbacks | Controls button visibility |
| 9 | `editor-core/src/stores/createMidiStore.ts` | 16-17 | `MidiStoreConfig` | `createClient?`, `destroyClient?` | Omitting gives `null` client at runtime |
| 10 | `editor-core/src/hooks/useEditorDialogsCore.ts` | 97 | `EditorDialogStrategy` | `transformChopperProgram?` | Checked with `if` at runtime instead of compiler |

### Medium: Individual component callbacks

| # | File | Line(s) | Interface | Callback |
|---|------|---------|-----------|----------|
| 11 | `editor-core/src/components/library/SaveDialog.tsx` | 36 | `SaveDialogProps` | `onCreateFolder?` |
| 12 | `editor-core/src/components/library/SteppedProgressDrawer.tsx` | 58 | `SteppedProgressDrawerProps` | `onCancel?` |
| 13 | `editor-core/src/components/library/CacheMetricsModal.tsx` | 44 | `CacheMetricsModalProps` | `onReset?` |
| 14 | `editor-core/src/components/library/DrumKitPadList.tsx` | 33 | `DrumKitPadListProps` | `onLoadAudio?` |
| 15 | `editor-core/src/components/ParameterSlider.tsx` | 19, 23 | `ParameterSliderProps` | `onCommit?`, `formatValue?` |
| 16 | `editor-core/src/components/library/MoveDialog.tsx` | 25 | `MoveDialogProps` | `isValidTarget?` |

### Low: External interface declarations

| # | File | Line(s) | Interface | Callback |
|---|------|---------|-----------|----------|
| 17 | `editor-core/src/types/midi-core.d.ts` | 60, 66 | `SdsChannel` | `onProgress?` (upload/download) |
| 18 | `editor-core/src/transports/types.ts` | 34 | `MidiTransport` | `getNativeAccess?` |

### Positive Pattern

`ErrorReporter` (`editor-core/src/hooks/useErrorReporter.ts`) is the correct approach: a required typed interface that guarantees both console logging and UI notification. Currently used in `useLibraryOperations`, `useEditorDialogsCore`, and both editors' library pages. **Should be extended to all hooks that can fail.**

---

## 2. Boolean Return Values in LibraryOperationsStrategy (6 findings)

`Promise<boolean>` conflates "not applicable" with "failed silently."

| # | File | Line | Method | Return Type |
|---|------|------|--------|-------------|
| 1 | `editor-core/src/hooks/useLibraryOperations.ts` | 164 | `createFolder` | `Promise<boolean>` |
| 2 | `editor-core/src/hooks/useLibraryOperations.ts` | 166 | `deleteItem` | `Promise<boolean>` |
| 3 | `editor-core/src/hooks/useLibraryOperations.ts` | 168 | `renameItem` | `Promise<boolean>` |
| 4 | `editor-core/src/hooks/useLibraryOperations.ts` | 170 | `handleContextMenuAction` | `boolean` (sync) |
| 5 | `roland-sxx0-editor/src/hooks/useRolandLibraryStrategy.ts` | 75-111 | All methods | Return `false` for "not my category" |
| 6 | `akai-s3k-editor/src/hooks/useS3kLibraryStrategy.ts` | 44-56 | All methods | Return `false` for "not applicable" |

**Should return:** `{ handled: true } | { handled: false }` or discriminated union with error context.

---

## 3. Browser Dialog API Usage (13 findings)

### window.confirm() — 5 calls

| # | File | Line | Context | Replacement |
|---|------|------|---------|-------------|
| 1 | `editor-core/src/components/library/PluginLibraryBrowser.tsx` | 523 | Batch delete confirmation | ConfirmDialog |
| 2 | `roland-sxx0-editor/src/hooks/useDirectoryOperations.ts` | 220 | Delete set | ConfirmDialog |
| 3 | `roland-sxx0-editor/src/hooks/useDirectoryOperations.ts` | 232 | Delete tone | ConfirmDialog |
| 4 | `roland-sxx0-editor/src/hooks/useDirectoryOperations.ts` | 246 | Delete patch | ConfirmDialog |
| 5 | `roland-sxx0-editor/src/hooks/useRolandLibraryStrategy.ts` | 64 | Delete set (**duplicate of #2**) | ConfirmDialog |

### window.alert() — 6 calls

| # | File | Line | Context | Replacement |
|---|------|------|---------|-------------|
| 6 | `roland-sxx0-editor/src/hooks/useLibraryImportDialogs.ts` | 99 | Library/device not connected | Toast notification |
| 7 | `roland-sxx0-editor/src/hooks/useLibraryImportDialogs.ts` | 100 | Wrong drag type on tone slot | Toast notification |
| 8 | `roland-sxx0-editor/src/hooks/useLibraryImportDialogs.ts` | 107 | Library/device not connected | Toast notification |
| 9 | `roland-sxx0-editor/src/hooks/useLibraryImportDialogs.ts` | 108 | Wrong drag type on patch slot | Toast notification |
| 10 | `roland-sxx0-editor/src/hooks/useLibraryExport.ts` | 115 | Tone not loaded | Toast notification |
| 11 | `roland-sxx0-editor/src/hooks/useLibraryExport.ts` | 133 | Patch not loaded | Toast notification |

### window.prompt() — 2 calls

| # | File | Line | Context | Replacement |
|---|------|------|---------|-------------|
| 12 | `akai-s3k-editor/src/hooks/useS3kTransferCallbacks.ts` | 111 | Rename sample | Inline editing / RenameDialog |
| 13 | `akai-s3k-editor/src/hooks/useS3kTransferCallbacks.ts` | 126 | Rename program | Inline editing / RenameDialog |

### DRY violation

`handleDeleteSet` with `window.confirm()` appears in both `useDirectoryOperations.ts` (line 220) and `useRolandLibraryStrategy.ts` (line 64) with nearly identical logic.

---

## 4. Hardcoded Pixel Widths (2 findings)

The codebase is largely clean — most layout uses flex ratios, percentages, and rem units.

| # | File | Line | Property | Severity | Fix |
|---|------|------|----------|----------|-----|
| 1 | `editor-core/src/design/library.css` | 447 | `min-width: 560px` on `.ac-library-browser--split` | Low | Convert to `min-width: 35rem` |
| 2 | `roland-sxx0-editor/src/components/ui/EnvelopeEditor.tsx` | 338-364 | Default 300x120, magic numbers 32/60/30/15/400/200 | Low-Medium | Extract named constants, use ResizeObserver for collapsed state |

---

## 5. Duplicated Type Definitions (16 findings)

### High severity

| # | Type | Locations | Issue |
|---|------|-----------|-------|
| 1 | `WavFileInfo` | roland `library-tones.ts:46`, s3k `wav-reader.ts:1` | Same name, different field names (`channels` vs `numChannels`) |
| 2 | `TreeSectionProps` | editor-core `TreeSection.tsx:20`, roland `LibraryTreeNode.tsx:359` | Diverged copies with different TreeNode types |
| 4 | `OperationProgress` | editor-core `operation-progress.ts:16`, sampler-library `samples.ts:31` | Identical, acknowledged but not enforced |
| 9 | `EditorStore` pattern | roland `editorStore.ts`, s3k `editorStore.ts` | Shared core fields duplicated |
| 10 | `LibraryDragPayload` / `LibraryDragData` | editor-core `PluginLibraryBrowser.tsx:27`, roland `DeviceMemoryPanel.tsx:36` | Parallel types, same purpose |

### Medium severity

| # | Type | Locations | Issue |
|---|------|-----------|-------|
| 5 | `S330KitConfig` / `S3kKitConfig` | roland, s3k kit output components | S3K is subset of S330 |
| 6 | `*KitOutputConfigProps` | roland, s3k kit output components | Structurally identical — should be generic |
| 7 | `cn()` utility | 6 modules | Identical `twMerge(clsx(inputs))` everywhere |
| 8 | MIDI note parsing | roland `utils.ts`, s3k `midi-note-parser.ts`, sampler-library | Three implementations |
| 11 | `SdsTransferProgress` | midi-core `sds-types.ts:99`, editor-core `midi-core.d.ts:37` | Ambient re-declaration can silently diverge |
| 13 | `DrumKitImportProgress` / `InstrumentImportProgress` | s3k (2 files) | Both redefine OperationProgress fields |
| 14 | `SaveProgress` | s3k `DiskToLibraryDialog.tsx:55` | Renamed OperationProgress fields |
| 15 | `Dialog` / `ConfirmDialog` | editor-core, s3k | Parallel modal implementations |

### Low severity

| # | Type | Locations | Issue |
|---|------|-----------|-------|
| 3 | `VfdGlowVariant` | editor-core (2 files) | Identical type, extract to shared file |
| 12 | `BackupProgress` | sampler-backup (2 files) | Exact duplicate, should import |
| 16 | `useS330Store` alias | roland `editorStore.ts:141` | Backward compat shim — remove |

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Bare optional callbacks | 18 | High — silent no-ops, no compiler enforcement |
| Boolean return values | 6 | High — "not applicable" vs "failed" ambiguity |
| Browser dialogs | 13 | Medium — UX consistency |
| Pixel widths | 2 | Low — codebase is clean |
| Duplicated types | 16 | Mixed — 5 high, 8 medium, 3 low |
| **Total** | **55** | |

## Key Insight: ErrorReporter as Model

`ErrorReporter` (editor-core/src/hooks/useErrorReporter.ts) already implements the correct pattern: a required typed interface that guarantees both console logging and UI notification, with no way to opt out of logging. It's used in 5 files but the audit found 18 bare callbacks that bypass it. **Extending ErrorReporter to be a required dependency everywhere is the highest-value Phase 2 task** — it makes the most critical contract (errors always get logged) compiler-enforced.
