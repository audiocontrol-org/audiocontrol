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

### 8. Stepped Progress Drawer — Standard for All Multi-Step Operations

Replace the multi-phase dialog pattern (confirm → transfer → second confirm → import → success) with a single continuous flow in a SlideDrawer. All sub-operations are presaged as a step list, progress updates in-place, and completed steps stay visible.

This is the standard pattern for ANY operation with multiple steps — not just device transfers. Batch operations, disk-to-library saves, program promotion, and any future multi-step workflow should use this component.

**Pattern:**
```
Import "ARP M" to Device

✓ Loaded program metadata (3 zones, 2 samples)
✓ Sent sample "ARP C1" (11 KB)
● Sending sample "ARP C2" (11 KB)... 45%
○ Create program with 3 keygroups
○ Verify program on device
```

Step states: pending `○`, active `●` (with progress), complete `✓`, failed `✗`

**Design:**
- Create a shared `SteppedProgressDrawer` component in editor-core that accepts a list of steps with status/progress
- Each transfer dialog (ImportInstrument, ImportProgram, ExportProgram, SendSample, ReceiveSample) defines its step list upfront
- No intermediate approval dialogs — the initial confirm starts the entire flow
- On error, the failed step shows the error message inline; preceding steps stay ✓; subsequent steps stay ○
- Drawer stays open on completion showing all ✓ with a Done button

**Applies to all multi-step operations:**
- `ImportInstrumentDialog` — loading → confirm → sending-samples → importing → success (currently has second approval before program creation)
- `ImportProgramDialog` — similar multi-phase with intermediate confirm
- `ExportProgramDialog` — fetching → saving → receiving-samples → success
- `SendSampleDialog` — load WAV → send via SDS → rename on device
- `ReceiveSampleDialog` — receive via SDS → build WAV → save to library
- `DiskToLibraryDialog` — save program + samples with per-sample progress
- Batch delete — delete item 1 → delete item 2 → ... → refresh
- Batch move — move item 1 → move item 2 → ... → refresh
- Program promotion — load S3K program → convert to zones → copy samples → save program.yaml

**Files:**
- `modules/editor-core/src/components/library/SteppedProgressDrawer.tsx` (new)
- All S3K transfer dialog files (refactor to use stepped pattern)

## Implementation Order

| Step | Description | Checkpoint |
|------|-------------|-----------|
| 1 | Preview panel background + border | DONE |
| 2 | Panel header class + apply to all columns | DONE |
| 3 | Connection bar into header | DONE |
| 4 | Preview panel layout tightening | DONE (action groups from earlier) |
| 5 | SlideDrawer component + CSS | DONE |
| 6 | Migrate MoveDialog/CreateFolder to drawer | DONE |
| 7 | Migrate ImportInstrumentDialog to drawer | DONE |
| 8 | SteppedProgressDrawer component | Pending |
| 9 | Refactor ImportInstrumentDialog to stepped flow | Pending |
| 10 | Refactor remaining transfer dialogs to stepped flow | Pending |
| 11 | Refresh button consistency | Pending |

## Verification

- `make` after each step — all editors build
- Test Import Instrument after step 9 — single continuous flow, no second confirm
- Test Send/Receive sample after step 10 — stepped progress in drawer
- Visual check on iPad for all drawer flows

## Critical Files

- `modules/editor-core/src/design/library.css`
- `modules/editor-core/src/design/primitives.css`
- `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`
- `modules/editor-core/src/components/library/SlideDrawer.tsx`
- `modules/editor-core/src/components/library/SteppedProgressDrawer.tsx` (new)
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
- `modules/akai-s3k-editor/src/components/library/ImportInstrumentDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/DiskToLibraryDialog.tsx`
