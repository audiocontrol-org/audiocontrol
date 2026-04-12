# Design Notes

Design decisions and UI patterns for the audiocontrol editor suite. These are established conventions -- follow them for consistency across editors.

---

## Dialog Standards

### ConfirmDialog
- **Use for:** Destructive action confirmation only (delete, overwrite)
- **Must stay open** during the async operation with a progress indication (e.g., "Deleting..." label on the confirm button, message text change). The dialog closes only when the operation completes or fails.
- **Cancel must remain available** throughout the operation so the user can dismiss if it gets stuck.
- Never fire-and-forget: the user must see the operation complete before the dialog disappears.

### SteppedProgressDrawer
- **Use for:** Multi-step device operations (clone program, send sample, export/import, batch transfers)
- Shows a live step log: pending, active (with optional progress bar), complete, failed
- Stays open on completion with a Done button
- Cancel available during operation

### SlideDrawer
- **Use for:** Operations that need more UI than a confirm but aren't multi-step (connection settings, single-step forms)
- Slides in from the right edge; library tree stays visible and interactive behind it

### Inline Editing
- **Use for:** Rename operations on list items
- **Gesture:** Double-click on the item name (matching the TreeView convention in editor-core)
- Name becomes an editable input in place. Enter to confirm, Escape to cancel, blur to confirm.
- Input shows saving state (read-only, dimmed, ellipsis suffix) while the device write is in progress.
- Input stays visible until the operation completes -- no fire-and-forget.

### Never Use
- `window.prompt()` -- always use an in-app UI component
- `window.confirm()` -- use ConfirmDialog
- `window.alert()` -- use ErrorBanner or toast notification
- Custom centered modal dialogs -- use SlideDrawer instead

---

## Optimistic Updates

All CRUD operations on device data follow the same pattern:

1. **Update local state immediately** -- the UI reflects the change before the device confirms
2. **Send to device** in the background
3. **On success:** invalidate the device-side cache (so next explicit refresh fetches fresh data), but do NOT reload the full list
4. **On failure:** revert local state by reloading from device, show error via ErrorBanner

This avoids the flash-blank-reload cycle where the entire list disappears and repopulates after every operation.

### What NOT to do after a mutation

- Don't call `invalidateCache()` (which clears the store to empty) followed by `loadProgramNames()`. This nukes the UI.
- Don't refetch data you already know. If you renamed index 3 to "NEW NAME", just update index 3 in the store.

---

## CRUD Affordances on List Items

CRUD operations belong on the items they affect, not in a global toolbar.

### Hover Actions
- Non-destructive actions (refresh, clone) appear as icon buttons on hover, right-aligned within the list item
- Destructive actions (delete) appear last with danger styling (red on hover)
- Icons use the shared icon library from `editor-core/TreeIcons` (DeleteIcon, CloneIcon, RefreshIcon, etc.)
- Actions are hidden when the item is in edit mode (inline rename)

### Gestures
- **Single click:** Select the item
- **Double-click:** Initiate inline rename (if rename is supported)

### List-Level Actions
- A refresh icon on the list title header reloads the full list from the device
- This replaces toolbar-level "Refresh" and "Load All" buttons

---

## Icon Consistency

All editors use the shared icon library at `editor-core/src/components/library/TreeIcons.tsx`:

| Icon | Component | Usage |
|------|-----------|-------|
| Trash can | `DeleteIcon` | Delete / remove |
| Pencil | `RenameIcon` | Rename / edit name |
| Two overlapping squares | `CloneIcon` | Clone / duplicate |
| Circular arrows | `RefreshIcon` | Reload from device |
| Folder | `FolderIcon` | Directory / container |
| Music note | `AudioFileIcon` | Audio sample file |
| Arrow up from tray | `ImportIcon` | Import / upload |
| Bidirectional arrows | `MoveIcon` | Move / reorganize |
| Folder with plus | `NewFolderIcon` | Create folder |

Never use text characters (✕, ✓, ↻) or emoji for actions when an icon exists in the shared library.

---

## Connection UI

The MIDI connection interface is a SlideDrawer, not a standalone page. It is accessible from any page by clicking the MIDI status indicator in the header. This ensures users can change MIDI settings without losing their current editing context.

- The connection drawer opens over the current page content
- Not-connected states on all pages show a button that opens the connection drawer (not a link to a separate page)
- After connection, the user stays on whatever page they were on

---

## Progress and Feedback

Every user-initiated operation must have visible feedback:

- **Instant operations** (< 100ms): optimistic UI update is sufficient
- **Short operations** (100ms - 2s): show a saving/loading state on the control that initiated it (dimmed input, spinner, "Deleting..." label)
- **Long operations** (> 2s): use SteppedProgressDrawer with step-by-step progress
- **Never fire-and-forget:** the user must always be able to tell that something is happening and when it's done

---

## Layout Principles

- **Proportional flex layouts** -- no hardcoded pixel widths for layout structure
- **`ac-page-shell`** on all pages for consistent spacing
- **`ac-list-detail-grid`** for list + editor split views (1fr / 2fr responsive grid)
- **`space-y-4`** between parameter sections (not `space-y-1` which is too cramped)
- **Dark theme** with `text-gray-200` for primary content, `text-gray-400` for labels, `text-gray-500` for secondary/muted
- **`text-lg font-semibold text-gray-200`** for detail panel titles (consistent across all panels)

---

## Accessibility

### Icon Sizes

Always use CSS classes for icon sizing, never inline `style` attributes. Sizes are in `rem` so they scale with user font preferences.

| Context | Class | Size | Notes |
|---------|-------|------|-------|
| Inline with text (buttons, labels) | `ac-icon` | `1.25rem` | Default. Includes `inline-block`, `vertical-align: middle`, `flex-shrink: 0` |
| Standalone icon button (header, toolbar) | `ac-icon-lg` | `1.5rem` | Same layout properties as `ac-icon` |
| Tree view / list item hover actions | `ac-tree-icon` | `1rem` | Compact context, always accompanied by text |

The icon classes handle alignment (`inline-block`, `vertical-align: middle`, `flex-shrink: 0`). Never override these with inline styles -- if an icon doesn't align, the fix belongs in the class, not on the element.

Never use icons smaller than `1rem`. The WCAG 2.1 minimum touch target is 44x44px for mobile; for desktop applications, `2rem` square is the practical minimum for clickable areas (the button padding provides the touch target, not the icon itself).

### Interactive Elements

- All clickable elements must have visible hover/focus states
- Buttons that look like plain text or indicators must have a visual cue that they're interactive (icon, underline, cursor change)
- `title` attributes on icon-only buttons for tooltip context
- `aria-label` on buttons that have no visible text label
- `role="switch"` and `aria-checked` on toggle controls
- Keyboard-navigable: all interactive elements reachable via Tab, activatable via Enter/Space

### Labels and Affordances

- Buttons must clearly communicate what they do. "PANIC" is jargon; "All Notes Off" is descriptive.
- Status indicators that are also controls must have a visual affordance (e.g., gear icon) showing they're interactive
- Cryptic triggers (git hashes, abbreviated codes) should use recognizable icons instead
