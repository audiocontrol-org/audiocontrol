# Shared Library UI Components - Workplan

**GitHub Milestone:** [Week of Mar 23-27](https://github.com/audiocontrol-org/audiocontrol/milestone/6)
**GitHub Issues:**

- [Parent: [editor-core] Shared library UI components (#76)](https://github.com/audiocontrol-org/audiocontrol/issues/76)
- [Add useNotifications hook and NotificationArea component (#77)](https://github.com/audiocontrol-org/audiocontrol/issues/77)
- [Add generic TreeView component and TreeIcons (#78)](https://github.com/audiocontrol-org/audiocontrol/issues/78)
- [Add LibraryPanel shell component (#79)](https://github.com/audiocontrol-org/audiocontrol/issues/79)
- [Add ContextMenu component (#80)](https://github.com/audiocontrol-org/audiocontrol/issues/80)
- [Add shared SaveDialog, MoveDialog, and ConfirmDialog (#81)](https://github.com/audiocontrol-org/audiocontrol/issues/81)
- [Add library.css stylesheet (#82)](https://github.com/audiocontrol-org/audiocontrol/issues/82)
- [Migrate loop-editor dev harness (#83)](https://github.com/audiocontrol-org/audiocontrol/issues/83)
- [Migrate sample-chopper dev harness (#84)](https://github.com/audiocontrol-org/audiocontrol/issues/84)
- [Migrate sampler-editor (#85)](https://github.com/audiocontrol-org/audiocontrol/issues/85)

## Technical Approach

Extract common library UI patterns from three independent implementations into `@audiocontrol/editor-core`. Use sampler-editor as the reference for tree/context-menu/dialog patterns and sample-chopper as the reference for the panel shell and save dialog. Notification system is a standalone concern that benefits all consumers.

**Reference implementations:**
- Notifications: `modules/loop-editor/dev/main.tsx` (lines 63-76)
- LibraryBrowser + SaveDialog: `modules/sample-chopper/dev/LibraryBrowser.tsx`, `modules/sample-chopper/dev/SaveDialog.tsx`
- LibraryTreePanel: `modules/sampler-editor/src/components/library/LibraryTreePanel.tsx`
- LibraryTreeNode: `modules/sampler-editor/src/components/library/LibraryTreeNode.tsx`
- LibraryContextMenu: `modules/sampler-editor/src/components/library/LibraryContextMenu.tsx`
- MoveItemDialog: `modules/sampler-editor/src/components/library/MoveItemDialog.tsx`
- DeleteDirectoryDialog: `modules/sampler-editor/src/components/library/DeleteDirectoryDialog.tsx`
- Library CSS: `modules/sample-chopper/dev/styles.css`

## Implementation Phases

### Phase 1: Notification System

Add a shared notification system to editor-core.

**Tasks:**
- Implement `useNotifications()` hook with add/dismiss/auto-dismiss lifecycle
- Implement `<NotificationArea />` component with info/error styling, copy and dismiss buttons
- Add unit tests for hook behavior (auto-dismiss timing, error persistence, dismiss)
- Add component tests for rendering and interaction
- Export from `@audiocontrol/editor-core`

**Success criteria:**
- Hook manages notification array with unique IDs
- Info notifications auto-dismiss after configurable timeout (default 5s)
- Error notifications persist until explicitly dismissed
- Copy button copies notification text to clipboard
- Tests cover add, auto-dismiss, manual dismiss, and error persistence

### Phase 2: TreeView Component

Extract a generic recursive tree view from sampler-editor's LibraryTreeNode.

**Tasks:**
- Define `TreeNode` interface (id, label, children, type, metadata)
- Implement `<TreeView />` with recursive rendering, expand/collapse, depth-based indentation
- Add selection state (single-select with callback)
- Add drag-drop zone support (drag-over styling, drop callback per node)
- Add context menu trigger (right-click callback with position)
- Add `TreeIcons` component set (folder open/closed, chevron, file, audio)
- Add unit tests for tree rendering, expand/collapse, selection
- Export from `@audiocontrol/editor-core`

**Success criteria:**
- Renders arbitrary tree data recursively with configurable depth indentation
- Expand/collapse works with controlled or uncontrolled state
- Drag-over and drop callbacks fire with correct node context
- Right-click triggers context menu callback with screen position
- Icons render correctly for folder/file/audio node types

### Phase 3: LibraryPanel Shell + ContextMenu

Extract the library panel chrome and context menu.

**Tasks:**
- Implement `<LibraryPanel />` with connection status slot, tab bar, content area, refresh button
- Support loading, error, and empty states
- Implement `<ContextMenu />` with positioned dropdown, separator support, danger styling, keyboard/click-outside dismiss
- Add viewport-aware positioning (prevent overflow)
- Add CSS in `library.css` using `ac-` prefix
- Add tests for panel states and context menu positioning
- Export from `@audiocontrol/editor-core` and `@audiocontrol/editor-core/library.css`

**Success criteria:**
- LibraryPanel renders tabs, content, and connection slot
- Loading spinner, error message, and empty state render correctly
- ContextMenu positions relative to trigger point, adjusts for viewport edges
- Escape key and click-outside dismiss context menu
- library.css loads independently without conflicts

### Phase 4: Dialog Components

Extract save, move, and confirm dialogs.

**Tasks:**
- Implement `<SaveDialog />` with directory picker, name input, inline folder creation
- Implement `<MoveDialog />` with tree-based directory picker and target validation
- Implement `<ConfirmDialog />` with title, message, confirm/cancel buttons, danger variant
- All dialogs use existing `ac-modal` primitives from editor-core
- Add tests for dialog interactions (save validation, move target selection, confirm/cancel)
- Export from `@audiocontrol/editor-core`

**Success criteria:**
- SaveDialog validates name input, shows selected directory path, supports new folder creation
- MoveDialog renders directory tree, prevents invalid targets (moving into self)
- ConfirmDialog renders message and fires confirm/cancel callbacks
- All dialogs are accessible (focus trap, escape to close)

### Phase 5: Consumer Migrations

Migrate all three consumers to shared components.

**Tasks:**
- **loop-editor:** Replace hand-rolled notifications with `useNotifications()` + `<NotificationArea />`; replace inline sample list with `<LibraryPanel />` + `<TreeView />`
- **sample-chopper:** Replace local `LibraryBrowser` with `<LibraryPanel />` + `<TreeView />`; replace local `SaveDialog` with shared `<SaveDialog />`
- **sampler-editor:** Replace `LibraryContextMenu` with shared `<ContextMenu />`; replace `MoveItemDialog` with shared `<MoveDialog />`; replace `DeleteDirectoryDialog` with shared `<ConfirmDialog />`; replace generic icons with shared `TreeIcons`
- Verify no regression in each consumer
- Remove dead local code after migration

**Success criteria:**
- loop-editor notifications use shared hook and component
- sample-chopper LibraryBrowser.tsx replaced or reduced to thin wrapper
- sampler-editor generic library UI components delegate to editor-core
- All builds pass: `make`
- All tests pass: `pnpm test`
- No functional regression in library browsing, drag-drop, or dialogs

## Issue Decomposition

Child issues created under parent [#76](https://github.com/audiocontrol-org/audiocontrol/issues/76):

1. [#77 Add useNotifications hook and NotificationArea component](https://github.com/audiocontrol-org/audiocontrol/issues/77)
2. [#78 Add generic TreeView component and TreeIcons](https://github.com/audiocontrol-org/audiocontrol/issues/78)
3. [#79 Add LibraryPanel shell component](https://github.com/audiocontrol-org/audiocontrol/issues/79)
4. [#80 Add ContextMenu component](https://github.com/audiocontrol-org/audiocontrol/issues/80)
5. [#81 Add shared SaveDialog, MoveDialog, and ConfirmDialog](https://github.com/audiocontrol-org/audiocontrol/issues/81)
6. [#82 Add library.css stylesheet](https://github.com/audiocontrol-org/audiocontrol/issues/82)
7. [#83 Migrate loop-editor dev harness](https://github.com/audiocontrol-org/audiocontrol/issues/83)
8. [#84 Migrate sample-chopper dev harness](https://github.com/audiocontrol-org/audiocontrol/issues/84)
9. [#85 Migrate sampler-editor](https://github.com/audiocontrol-org/audiocontrol/issues/85)

## Verification Checklist

- [ ] `pnpm --filter @audiocontrol/editor-core build`
- [ ] `pnpm --filter @audiocontrol/editor-core test`
- [ ] `pnpm --filter @audiocontrol/loop-editor build`
- [ ] `pnpm --filter @audiocontrol/sample-chopper build`
- [ ] `pnpm --filter @audiocontrol/sampler-editor build`
- [ ] `pnpm test` (all modules)
- [ ] Feature docs updated with implementation notes and issue links
