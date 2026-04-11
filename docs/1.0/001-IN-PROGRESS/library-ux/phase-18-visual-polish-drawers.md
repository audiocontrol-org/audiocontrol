# Library Page Visual Polish + Slide-Over Drawer Migration

## Context

The library page has functional UX improvements (multi-select, drag-to-move, context menus) but the visual design needs polish. Panel columns blur together, headers are inconsistent, the preview panel feels empty, and modal dialogs are jarring and dated. The user wants modal operations replaced with slide-over drawers that overlay the preview panel, keeping the library tree visible and interactive.

## Changes

### 1. Column Visual Separation

The preview panel has no background or border — it disappears into the canvas. Add consistent panel styling.

**File:** `modules/editor-core/src/design/library.css`

- Add background + border to `ac-plugin-library-browser-preview` matching the other columns:
  ```css
  .ac-plugin-library-browser-preview {
    background: color-mix(in srgb, var(--ac-color-surface-panel) 88%, transparent);
    border: 1px solid var(--ac-color-border-subtle);
    border-radius: var(--ac-radius-lg);
  }
  ```

### 2. Consistent Panel Headers

DiskBrowser and DeviceMemory use Tailwind `text-lg font-semibold text-gray-100`. Library sections use `ac-tree-section-title` (0.75rem uppercase gray). Preview has no header — just the item name.

Create a shared panel header style and apply it to all four columns.

**File:** `modules/editor-core/src/design/library.css`
- Add `ac-panel-header` class: `font-size: var(--ac-text-sm); font-weight: var(--ac-font-weight-semibold); color: var(--ac-color-text-primary); padding: var(--ac-space-3); border-bottom: 1px solid var(--ac-color-border-subtle);`

**Files to update:**
- `modules/akai-s3k-editor/src/components/library/DiskBrowserPanel.tsx` — use `ac-panel-header`
- `modules/akai-s3k-editor/src/components/library/DeviceMemoryPanel.tsx` — use `ac-panel-header`
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — add panel header to library column ("Library") and preview column

### 3. Preview Panel Layout

The preview panel has too much dead space. Tighten the layout:
- Item name as a proper panel header (not inline h3)
- Metadata in a compact key-value layout
- Action groups with better spacing
- When no item is selected, show a helpful empty state with icon

**File:** `modules/akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx`

### 4. Connection Bar Integration

"Local Folder / Change" sits awkwardly at the top of the library column competing with the content. Integrate it into the panel header bar as a subtle status indicator.

**File:** `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx` — move connection slot into the panel header row

### 5. Slide-Over Drawer Component

Replace centered modal dialogs with a slide-over drawer that overlays the preview panel from the right edge. The library tree stays visible and interactive.

**File:** `modules/editor-core/src/components/library/SlideDrawer.tsx` (new)
- Position: `fixed inset-y-0 right-0` with slide animation
- Width: `24rem` (384px) 
- Dark semi-transparent backdrop (dimmer than modal, click-to-close)
- Same internal structure as `ac-modal`: header, scrollable content, footer
- CSS transition: `transform 200ms ease-out`
- Escape to close

**File:** `modules/editor-core/src/design/primitives.css`
- Add `ac-drawer`, `ac-drawer-overlay`, `ac-drawer-panel`, `ac-drawer-header`, `ac-drawer-content`, `ac-drawer-footer` classes

### 6. Migrate Dialogs to Drawers

Convert these dialogs to use SlideDrawer instead of modal:

**Quick wins (editor-core, shared):**
- `MoveDialog.tsx` → SlideDrawer
- `CreateFolderDialog.tsx` → SlideDrawer
- `SaveDialog.tsx` → SlideDrawer

**S3K editor:**
- `SendSampleDialog.tsx` → SlideDrawer (transfer progress stays visible)
- `ReceiveSampleDialog.tsx` → SlideDrawer
- `ExportProgramDialog.tsx` → SlideDrawer
- `ImportProgramDialog.tsx` → SlideDrawer
- `DiskToLibraryDialog.tsx` → SlideDrawer

Keep as modals (they need focused attention):
- `ConfirmDialog.tsx` — destructive confirmation should be modal (brief, blocking)
- `DrumKitEditorDialog.tsx` — complex editor, needs full focus

### 7. Refresh Button Consistency

Standardize the refresh/scan buttons across panels — same size, same icon, same hover behavior.

**File:** `modules/editor-core/src/design/library.css` — add `ac-panel-refresh-btn`

## Implementation Order

| Step | Description | Checkpoint |
|------|-------------|-----------|
| 1 | Preview panel background + border | `make` passes, visual check |
| 2 | Panel header class + apply to all columns | `make` passes, visual check |
| 3 | Connection bar into header | `make` passes |
| 4 | Preview panel layout tightening | `make` passes |
| 5 | SlideDrawer component + CSS | `make` passes |
| 6 | Migrate MoveDialog to drawer | `make` passes, test Move to... |
| 7 | Migrate remaining shared dialogs | `make` passes |
| 8 | Migrate S3K transfer dialogs | `make` passes, test transfers |
| 9 | Refresh button consistency | `make` passes |

## Verification

- `make` after each step — all editors build
- Visual check on iPad after steps 1-4 (layout polish)
- Test Move to... after step 6 (drawer works)
- Test Send/Receive sample after step 8 (transfer dialogs work in drawer)

## Critical Files

- `modules/editor-core/src/design/library.css`
- `modules/editor-core/src/design/primitives.css`
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- `modules/editor-core/src/components/library/SlideDrawer.tsx` (new)
- `modules/editor-core/src/components/library/MoveDialog.tsx`
- `modules/editor-core/src/components/library/CreateFolderDialog.tsx`
- `modules/editor-core/src/components/library/SaveDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/DiskBrowserPanel.tsx`
- `modules/akai-s3k-editor/src/components/library/DeviceMemoryPanel.tsx`
- `modules/akai-s3k-editor/src/components/library/S3kItemPreviewPanel.tsx`
- `modules/akai-s3k-editor/src/components/library/SendSampleDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/ReceiveSampleDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/ExportProgramDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/ImportProgramDialog.tsx`
