# Phase 17: Drag-to-Move and Multi-Select

## Context

The library browser has no way to move items into folders via drag-and-drop, and no multi-select for batch operations. The "Move to..." context menu action exists but is a dead end — the action fires, reaches `useLibraryOperations`, and silently returns. The `MoveDialog` component exists in editor-core but is never rendered by `PluginLibraryBrowser`. All operations are single-item only.

## Problems

1. **Move to... is broken** — context menu action does nothing. `useLibraryOperations.ts` line 360 has a bare `return` for `actionId === 'move'`. `MoveDialog` exists but isn't wired in.
2. **No drag-to-folder** — tree directories accept drops (visual feedback exists) but only for external drops. Library-to-library drags within the same category are ignored.
3. **No multi-select** — `TreeView` accepts `selectedId?: string` (singular). No Ctrl/Shift click handling. No batch delete, move, or export.

## Design Decisions

- **Drag-to-move:** Same category only. Cross-category moves are invalid.
- **Multi-select UX:** Cmd/Ctrl+click (toggle), Shift+click (range). On touch: long-press enters selection mode, taps toggle.
- **Batch operations:** Delete and Move support batching. Export to device deferred (needs queue system).
- **Move validation:** Cannot move into self/descendants. Cannot cross categories.

## Contract Enforcement

All new interfaces must follow the contract enforcement directive: the compiler must catch violations; no optional callback bags; no silent failures.

**Required batch operations:** `PluginLibraryBrowser` currently accepts individual callbacks (`onDelete`, `onMove`, `onRename`, etc.) as separate optional props. This is an existing contract weakness — editors can silently omit any of them. For the batch operations:

- `useLibraryOperations` returns a single `LibraryOperationsResult` object. Editors already pass individual fields from this object to `PluginLibraryBrowser`. Instead, `PluginLibraryBrowser` should accept the entire `LibraryOperationsResult` as a single required prop (when a library is connected). This eliminates cherry-picking and ensures all operations are available.
- Batch context menu actions use the same `TransferActionId` capability declaration. "Send 3 samples to device" only appears if the editor declared `send-sample-to-device` support. The multi-select menu is filtered by the same `supportedActions` set that filters single-item menus.

**No new optional callback bags:** `onBatchDelete` and `onBatchMove` are not separate optional props. They are derived from the existing `onDelete`/`onMove` operations inside `useLibraryOperations` — if the single-item operation exists, the batch operation exists. No additional wiring needed per editor.

**Compiler enforcement:** Adding `selectedIds` to `TreeView` is additive (backward compatible). But the batch context menu rendering is controlled by `PluginLibraryBrowser` — if an action appears in the batch menu, the handler must exist. Since handlers come from `useLibraryOperations` (which is required), this is guaranteed. Transfer actions in batch mode go through the same `strategy.handleContextMenuAction` that the contract enforcement refactor already made required.

## Implementation Steps

### Step 1: Wire "Move to..." context menu action

`PluginLibraryBrowser` intercepts `actionId === 'move'`, opens `MoveDialog` with the category's directory tree, calls `onMove` on confirm.

**Files:**
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — add moveDialog state, render MoveDialog, handle 'move' action
- `modules/editor-core/src/hooks/useLibraryOperations.ts` — remove the silent `return` for 'move', let it reach the component

**Tests:** 'move' action opens dialog; confirming calls onMove with correct path

### Step 2: Drag-to-folder within same category

Detect `LIBRARY_ITEM_MIME` in tree drop handlers. Parse `LibraryDragPayload`, verify same categoryId, call `onMove`.

**Files:**
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — wire `onTreeDragOver`/`onTreeDrop` for library items (not just external drops)
- Add `sourcePath: string[]` to `LibraryDragPayload` so drop handler can call `onMove` without searching the tree

**Tests:** drop library item on folder → moves; drop on different category → rejected

**Checkpoint:** `make` passes. Move to... and drag-to-folder both work.

### Step 3: Multi-select state

Add `selectedIds?: Set<string>` to `TreeView` props alongside existing `selectedId`. `TreeNodeRow` highlights if in either.

**Files:**
- `modules/editor-core/src/components/library/TreeView.tsx` — add `selectedIds` prop, highlight logic
- `modules/editor-core/src/components/library/TreeSection.tsx` — pass through
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — manage multi-select state

**Checkpoint:** `make` passes. No behavioral change yet.

### Step 4: Multi-select interaction (keyboard)

Cmd/Ctrl+click toggles item in selection. Shift+click selects range. Plain click clears multi-selection.

**Files:**
- `modules/editor-core/src/components/library/TreeView.tsx` — modify click handler to check `ctrlKey`/`metaKey`/`shiftKey`
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — `onMultiSelect` callback

**Tests:** Ctrl+click two items → both selected; Shift+click → range; plain click → single

### Step 5: Touch multi-select (long-press)

Long-press (300ms) enters selection mode. Taps toggle. Floating toolbar shows count + actions.

**Files:**
- `modules/editor-core/src/components/library/TreeView.tsx` — long-press handler via touchstart/touchend timer
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — selection mode state, toolbar rendering

**Checkpoint:** `make` passes. iPad: long-press → selection mode → tap items → toolbar.

### Step 6: Batch operations

Batch delete and batch move are derived from existing single-item operations inside `useLibraryOperations` — no new per-editor wiring. `onBatchDelete(nodes)` loops `onDelete` for each. `onBatchMove(nodes, targetPath)` loops `onMove` for each. Both are returned from `useLibraryOperations` as part of `LibraryOperationsResult`.

Context menu in batch mode: shows intersection of actions available for all selected types, filtered by `supportedActions` (same capability declaration as single-item menus).

**Files:**
- `modules/editor-core/src/hooks/useLibraryOperations.ts` — add `onBatchDelete`, `onBatchMove` to result (derived from existing ops, not new editor contracts)
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — batch context menu, batch confirm dialog

**Tests:** select 3 → right-click → "Delete 3 items" → confirm → all deleted

**Checkpoint:** `make` passes. All tests pass.

### Step 7: Wire multi-select drag

Drag with multi-selection drags all selected items. Drop on folder moves all.

**Files:**
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — multi-drag payload, batch move on drop

## Verification

**Unit tests (vitest):**
- MoveDialog opens from context menu, validates targets, calls onMove
- Drag-to-folder calls onMove for same-category, rejects cross-category
- selectedIds highlights multiple nodes
- Ctrl+click toggles, Shift+click ranges, plain click clears
- Batch delete/move call operations for each node
- Context menu shows batch actions for multi-selection

**Build:** `make` after steps 2, 3, 5, 6

## Critical Files

- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- `modules/editor-core/src/components/library/TreeView.tsx`
- `modules/editor-core/src/components/library/MoveDialog.tsx`
- `modules/editor-core/src/hooks/useLibraryOperations.ts`
- `modules/editor-core/src/components/library/plugins/types.ts`
