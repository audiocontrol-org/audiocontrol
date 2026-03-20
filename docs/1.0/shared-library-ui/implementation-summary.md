# Shared Library UI Components - Implementation Summary

**Status:** In Progress
**Last Updated:** 2026-03-19

## Progress Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Notification System | Completed | `useNotifications` hook + `NotificationArea` component; loop-editor migrated |
| Phase 2: TreeView Component | Completed | Generic `TreeView` with expand/collapse, drag-drop, context menu; `TreeIcons` set |
| Phase 3: LibraryPanel + ContextMenu | Completed | `LibraryPanel` shell + `ContextMenu` with viewport-aware positioning; `library.css` exported |
| Phase 4: Dialog Components | Completed | `ConfirmDialog`, `SaveDialog`, `MoveDialog` |
| Phase 5: Consumer Migrations | Partially Complete | See notes below |

## Implementation Notes

### Phase 1: Notification System

- Added `useNotifications()` hook in `modules/editor-core/src/hooks/useNotifications.ts`
- Added `<NotificationArea />` in `modules/editor-core/src/components/NotificationArea.tsx`
- CSS notification area styles added to `primitives.css` (`.ac-notification-area`, `.ac-notification-text`, `.ac-notification-actions`)
- Migrated loop-editor dev harness: replaced ~25 lines of hand-rolled notification code with shared hook + component

### Phase 2: TreeView Component

- Added `<TreeView />` in `modules/editor-core/src/components/library/TreeView.tsx`
  - Supports controlled and uncontrolled expand state
  - Configurable indentation, drag-drop zones, context menu trigger, custom icon/trailing renderers
- Added `TreeIcons` in `modules/editor-core/src/components/library/TreeIcons.tsx`
  - FolderIcon, ChevronIcon, AudioFileIcon, FileIcon, DeleteIcon, NewFolderIcon, RenameIcon, MoveIcon

### Phase 3: LibraryPanel + ContextMenu

- Added `<LibraryPanel />` in `modules/editor-core/src/components/library/LibraryPanel.tsx`
  - Connection status slot, tab bar, loading/error/empty states, refresh button, header actions
- Added `<ContextMenu />` in `modules/editor-core/src/components/library/ContextMenu.tsx`
  - Viewport-aware positioning, separator support, danger/disabled styling, Escape + click-outside dismiss
- Added `library.css` at `modules/editor-core/src/design/library.css`, exported as `@audiocontrol/editor-core/library.css`

### Phase 4: Dialog Components

- Added `<ConfirmDialog />` — simple confirm/cancel modal with danger variant
- Added `<SaveDialog />` — directory picker + name input + inline folder creation
- Added `<MoveDialog />` — directory tree picker for relocating items with validation
- All dialogs use existing `ac-modal` primitives from editor-core

### Phase 5: Consumer Migrations

**loop-editor** (Completed):
- Replaced hand-rolled notifications with `useNotifications()` + `<NotificationArea />`
- Removed ~25 lines of local notification state/rendering code

**sample-chopper** (Partially Complete):
- Replaced local `SaveDialog.tsx` with shared `SaveDialog` from editor-core
- Lifted directory loading and folder creation into the consumer (previously internal to the local dialog)
- Deleted local `SaveDialog.tsx` (226 lines removed)
- `LibraryBrowser` remains local — too tightly coupled to device-specific data (CHOPPER_DRAG_MIME, device badges, confirm-delete UX, three tab-specific data sources)

**sampler-editor** (Partially Complete):
- Replaced local `LibraryContextMenu.tsx` with shared `ContextMenu` from editor-core
- Updated `LibraryTreePanel.tsx` to import/render shared `ContextMenu`
- Updated `useLibraryTreeActions.tsx` to import `ContextMenuAction` type and icon components from editor-core
- Deleted local `LibraryContextMenu.tsx` (189 lines removed)
- Cleaned up duplicated icons in `LibraryTreeNode.tsx` — now imports from `LibraryTreeIcons.tsx` instead of defining its own copies (~95 lines removed)
- `DeleteDirectoryDialog` remains local — has async content preview loading tied to library-service
- `MoveItemDialog` remains local — deeply integrated with library store and directory operations hooks

## Code Metrics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Notification implementations | 3 (each unique) | 1 shared | loop-editor migrated; others remain |
| Context menu implementations | 2 (sampler-editor + sample-chopper) | 1 shared | sampler-editor migrated |
| SaveDialog implementations | 1 local (sample-chopper) | 1 shared | sample-chopper migrated |
| Lines removed (local code) | — | ~535 lines | LibraryContextMenu (189) + SaveDialog (226) + icon duplication (95) + notification code (25) |
| New shared lines (editor-core) | — | ~1,230 lines | Components, tests, CSS |
| New test count | 58 (pre-existing) | 110 | +52 new tests |

## Deviations from Plan

- **sample-chopper LibraryBrowser not migrated**: The workplan called for replacing the full `LibraryBrowser` with `<LibraryPanel />` + `<TreeView />`. The `LibraryBrowser` has too much device-specific behavior (custom MIME types, device badges, confirm-delete UX, tab-specific async data loading) to replace without a larger refactor. The shared components provide the structural foundation for a future migration.
- **sampler-editor MoveItemDialog not migrated**: The local dialog is deeply coupled to the library store's directory operations hooks. The shared `MoveDialog` is available for new consumers.
- **sampler-editor DeleteDirectoryDialog not migrated**: Has async content preview loading from the library service that the generic `ConfirmDialog` doesn't support.

## Validation

### Automated Tests

- [x] `pnpm --filter @audiocontrol/editor-core test` passes (110 tests, 52 new)
- [x] `pnpm --filter @audiocontrol/loop-editor build` passes
- [x] `pnpm --filter @audiocontrol/sample-chopper build` passes
- [x] `pnpm --filter @audiocontrol/sampler-editor build` passes
- [x] Full `make clean && make` succeeds

### Manual Verification

- [ ] loop-editor notifications work (info auto-dismiss, error persist)
- [ ] sample-chopper save dialog works (directory picker, folder creation, save)
- [ ] sampler-editor context menu works (right-click, actions, dismiss)

## References

- [PRD](./prd.md)
- [Workplan](./workplan.md)
