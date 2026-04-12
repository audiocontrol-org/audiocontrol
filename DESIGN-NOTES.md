# Design Notes

Design decisions and UI patterns for the audiocontrol editor suite. Working scratchpad -- captured as we discover them.

---

## The Cardinal Rule

**If a visual value appears in a component, it's wrong.**

Every visual property -- color, size, spacing, font, transition -- must come from the design system (`primitives.css`, `library.css`). Components should contain only class names and variable references, never literal values.

If the design system doesn't have what you need:
1. Add the class or variable to the design system first
2. Use it in your component
3. Grep for every existing instance of the hardcoded pattern and replace all of them

A design system variable that isn't universally used is just documentation -- it doesn't enforce consistency.

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

### Action Icon Colors on List Items

Action icons on list items must be visible on both default (dark) and selected (blue) backgrounds. Use design system variables, not hardcoded Tailwind grays:

| Variable | Purpose | Value |
|----------|---------|-------|
| `--ac-action-color` | Default state, unselected item | `rgba(255,255,255,0.4)` |
| `--ac-action-hover` | Hover state, unselected item | `rgba(255,255,255,0.85)` |
| `--ac-action-danger-hover` | Destructive hover, unselected | `#f87171` |
| `--ac-action-selected-color` | Default state, selected item | `rgba(255,255,255,0.6)` |
| `--ac-action-selected-hover` | Hover state, selected item | `#fff` |
| `--ac-action-selected-danger-hover` | Destructive hover, selected | `#fca5a5` |

Action buttons must receive a `selected` prop and switch to the selected color set when the parent item is highlighted. Never use `text-gray-500` for action icons -- it's invisible on blue backgrounds.

### Action Button CSS Class

Use `ac-list-action-btn` from the design system for all list item action buttons. Modifiers:
- `ac-list-action-btn--selected` — high-contrast colors for selected (blue) backgrounds
- `ac-list-action-btn--danger` — red hover for destructive actions

The class handles color transitions via CSS variables. Never use inline `style` or JS `onMouseEnter`/`onMouseLeave` for hover colors.

### Icon Color Inheritance

`ac-tree-icon` sets `color: var(--ac-color-text-muted)` by default for tree node icons (folders, files). When icons are inside action buttons, they must inherit color from the button so the button's state (default/hover/selected) controls the icon color. This is handled by:

```css
.ac-list-action-btn .ac-tree-icon,
.ac-tree-delete-btn .ac-tree-icon {
  color: inherit;
}
```

Never set icon color directly in a component when the icon is inside an action button. The button owns the color; the icon inherits.

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
| Tree view / list item hover actions | `ac-tree-icon` | `1.125rem` | Slightly smaller than inline, always accompanied by text |

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

---

## Parameter Editor Design

### Dense Grid Layout

Parameter editors use a multi-column grid (`s3k-section` / `s3k-section-grid`) instead of one-parameter-per-row forms. Parameters show:
- Label (uppercase, small)
- Visual value bar showing position in range (accent color fill)
- Numeric value (click to edit precisely)
- Bipolar parameters fill from center for center-zero values (pan, tuning)

Components: `ParamKnob`, `ParamSelect`, `ParamToggle` in `@/components/ui/ParamKnob.tsx`.

### Section Pairing

Related sections sit side by side in two-column grids:
- MIDI + Output
- Filter + Filter Envelope
- Amp Envelope + Pitch & Crossfade

### Envelope Visualizations

Envelope displays are interactive — drag points to edit values. Follow the Roland `EnvelopeEditor` pattern:
- **Fixed horizontal scale**: each segment gets a budget of max time units. Dragging one point does not shift other points.
- **Rate from segment width**: `rate = maxRate - (segmentWidth / drawWidth) * totalBudget`
- **Invisible hit areas** (r=14) around visible dots (r=4) for easier grabbing
- **Separate `onDrag` / `onCommit`**: continuous UI updates during drag, device write only on mouse up
- **Values always clamped**: impossible to produce out-of-range values

Shared `EnvelopeEditor` renders any polyline envelope. `AdsrDisplay` and `MultiPointEnvelopeDisplay` are thin wrappers that compute points from their parameter formats.

### List Column Width

S3K program names are max 12 characters. The list column should be sized for its content (`18rem`), not a proportion of the page (`1fr`). Don't give a narrow list 33% of the viewport.

---

## State Persistence

### Selection State

The selected program and keygroup indices persist in `sessionStorage` so page reloads restore the user's position. The `editorStore` reads from sessionStorage on init and writes on every selection change.

When a page loads with a restored selection but no cached data, it must fetch the data from the device — not show a "select something" prompt. Show a loading state while fetching.

### What to Persist

| State | Storage | Rationale |
|-------|---------|-----------|
| Selected program/keygroup index | `sessionStorage` | Survives reload, clears on tab close |
| Device memory cache (names) | `sessionStorage` | Avoids re-fetch on page navigation |
| Program headers | In-memory (Zustand) | Re-fetched on demand, too large for sessionStorage |
| MIDI port selection | `localStorage` | Survives browser restart |

---

## Loading States

### Skeleton Placeholders (planned — see #246)

Pages should render skeleton placeholders that mirror the loaded layout structure, not blank screens with "Loading..." text. Skeletons:
- Match the grid/section structure of the loaded state
- Use subtle pulse animation
- Use design system colors
- Replace individual sections as their data arrives (not all-or-nothing)

### Current Minimum

Until skeletons are implemented, pages with a restored selection must show "Loading..." (not "Select a program"). The "select something" prompt is only for when there is genuinely no selection.

---

## Responsive Header

Header controls collapse at narrow viewports using `ac-hide-narrow` (hidden below 1400px):
- Port names: truncate at 1600px, hide at 1400px
- "All Notes Off" text label hides, icon remains
- "Connected" / "Disconnected" text hides, status dot remains
- Buttons never wrap (`white-space: nowrap`)

---

## Auto-Selection

When a list loads, auto-select the first item. Don't show "Select an item to edit" when there are items available. This applies to:
- Programs page: select program 0 after names load
- Keygroups page: select keygroup 0 after keygroups load
