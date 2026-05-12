# Design System

Living documentation of the audiocontrol design system. Updated as contracts and patterns are established. This is the single source of truth -- CLAUDE.md directs agents here.

### 8. Restore user context across navigation

When the user navigates or reloads, they should land back where they were, not at a blank "Select something" prompt.

- **Selection state** persists in `sessionStorage` — survives reload, clears on tab close
- **Device memory cache** persists in `sessionStorage` — avoids re-fetch on page navigation
- **MIDI port selection** persists in `localStorage` — survives browser restart
- **Large data** (program headers) stays in-memory — re-fetched on demand

When a page loads with a restored selection but no cached data, show a loading state while fetching — not a "select something" prompt.

### 9. Never show empty state when data exists or is loading

If data is loading, show a loading indicator (skeleton placeholders preferred, "Loading..." acceptable). If a list has items, auto-select the first one — don't show "Select an item to edit" when items are available.

**Example — programs page:** After names load, auto-select program 0. The user sees the editor immediately, not a prompt.

**Example — skeleton placeholders:** Pages render skeleton placeholders that mirror the loaded layout structure (matching grid/section structure, subtle pulse animation, design system colors) instead of blank screens. Sections replace individually as data arrives — not all-or-nothing.

### 10. Progressive disclosure at narrow viewports

At narrow widths, hide supplementary text and keep essential icons. Controls never wrap.

**Example — header:** Port names truncate at 1600px, hide at 1400px. "All Notes Off" text hides but icon remains. "Connected" label hides but status dot remains. Use `ac-hide-narrow` for viewport-dependent visibility.

---

## Typed Capability Contracts

Shared hooks and components accept typed capability interfaces, not bare callbacks. The compiler enforces that consumers provide the required capabilities.

### ErrorReporter

**File:** `editor-core/src/hooks/useErrorReporter.ts`

Every error is logged to console AND displayed in the UI. Individual call sites cannot opt out of logging.

```typescript
import { useErrorReporter, type ErrorReporter } from '@audiocontrol/editor-core';

interface ErrorReporter {
  report(message: string): void;
}

// Usage: pass the ErrorReporter to any hook that can fail
const errorReporter = useErrorReporter(setError);
```

**Rule:** Every shared hook that can fail must accept `ErrorReporter` as a required parameter. No bare `onError?: (msg: string) => void` callbacks.

### RefreshNotifier

**File:** `editor-core/src/hooks/useRefreshNotifier.ts`

Typed capability for triggering data refresh after mutations.

```typescript
import { useRefreshNotifier, type RefreshNotifier } from '@audiocontrol/editor-core';

interface RefreshNotifier {
  notifyRefresh(): void;
}

const refreshNotifier = useRefreshNotifier(handleRefresh);
```

### ProgressReporter

**File:** `editor-core/src/hooks/useProgressReporter.ts`

Structured progress data flows through a single contract. Uses `OperationProgress` for byte-weighted progress tracking.

```typescript
import { useProgressReporter, type ProgressReporter } from '@audiocontrol/editor-core';
import type { OperationProgress } from '@audiocontrol/editor-core';

interface ProgressReporter {
  report(progress: OperationProgress): void;
}

const progressReporter = useProgressReporter(setProgress);
```

### StrategyResult

**File:** `editor-core/src/hooks/useLibraryOperations.ts`

Discriminated union replacing boolean returns. Distinguishes "I handled it" from "not my responsibility" without ambiguity.

```typescript
import type { StrategyResult } from '@audiocontrol/editor-core';

type StrategyResult = { handled: true } | { handled: false };

// In a LibraryOperationsStrategy implementation:
async deleteItem(categoryId: string, node: TreeNode): Promise<StrategyResult> {
  if (categoryId !== 'my-category') return { handled: false };
  await doDelete(node);
  return { handled: true };
}
```

**Rule:** Never use `boolean` as a strategy dispatch return. `true`/`false` conflates "not applicable" with "failed silently."

---

## Dialog Components

All dialogs live in `editor-core/src/components/library/`.

| Component | When to Use |
|-----------|-------------|
| **ConfirmDialog** | Destructive actions: delete, overwrite, discard changes |
| **SlideDrawer** | Complex forms, connection settings, single-step operations |
| **SteppedProgressDrawer** | Multi-step operations: device transfers, batch imports/exports |
| **SaveDialog** | Save-to-library with directory picker and name input |
| **MoveDialog** | Relocate items within the library tree |

### ConfirmDialog Behavior

- Must stay open during the async operation with progress indication (e.g., "Deleting..." label on confirm button)
- Cancel must remain available throughout the operation
- Dialog closes only when the operation completes or fails
- Never fire-and-forget

### SteppedProgressDrawer Behavior

- Shows a live step log: pending, active (with optional progress bar), complete, failed
- Stays open on completion with a Done button
- Cancel available during operation

### SlideDrawer Behavior

- Slides in from the right edge; content behind stays visible and interactive
- Use for operations needing more UI than a confirm but aren't multi-step

### Inline Editing

- **Use for:** Rename operations on list items
- **Gesture:** Double-click on the item name (matching TreeView convention)
- Name becomes an editable input in place. Enter to confirm, Escape to cancel, blur to confirm.
- Input shows saving state (read-only, dimmed) while the device write is in progress
- Input stays visible until the operation completes -- no fire-and-forget

### Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `window.confirm()` | `ConfirmDialog` |
| `window.alert()` | Toast notification via `useNotifications` or `ErrorBanner` |
| `window.prompt()` | Inline editing or `SlideDrawer` |
| Custom centered modal dialogs | `SlideDrawer` |
| Custom modal for progress | `SteppedProgressDrawer` |

---

## Optimistic Updates

All CRUD operations on device data follow this pattern:

1. **Update local state immediately** -- the UI reflects the change before the device confirms
2. **Send to device** in the background
3. **On success:** invalidate the device-side cache (so next explicit refresh fetches fresh data), but do NOT reload the full list
4. **On failure:** revert local state by reloading from device, show error via ErrorBanner

This avoids the flash-blank-reload cycle where the entire list disappears and repopulates after every operation.

### What NOT to do after a mutation

- Don't call `invalidateCache()` (which clears the store to empty) followed by a full reload. This nukes the UI.
- Don't refetch data you already know. If you renamed index 3 to "NEW NAME", just update index 3 in the store.

---

## CRUD Affordances on List Items

CRUD operations belong on the items they affect, not in a global toolbar.

### Hover Actions
- Non-destructive actions (refresh, clone) appear as icon buttons on hover, right-aligned within the list item
- Destructive actions (delete) appear last with danger styling (red on hover)
- Icons use the shared icon library from `editor-core/TreeIcons`
- Actions are hidden when the item is in edit mode (inline rename)

### Gestures
- **Single click:** Select the item
- **Double-click:** Initiate inline rename (if rename is supported)

### List-Level Actions
- A refresh icon on the list title header reloads the full list from the device
- This replaces toolbar-level "Refresh" and "Load All" buttons

---

## Notifications

**File:** `editor-core/src/hooks/useNotifications.ts`

```typescript
import { useNotifications } from '@audiocontrol/editor-core';

const { notify, dismiss, clearAll, notifications } = useNotifications();

notify({ level: 'info', message: 'Sample uploaded' });    // auto-dismiss 5s
notify({ level: 'error', message: 'Transfer failed' });   // persists until dismissed
```

Render with `NotificationArea` component (`editor-core/src/components/NotificationArea.tsx`).

---

## Progress and Feedback

Every user-initiated operation must have visible feedback:

| Duration | Feedback |
|----------|----------|
| Instant (< 100ms) | Optimistic UI update is sufficient |
| Short (100ms - 2s) | Saving/loading state on the control that initiated it (dimmed input, spinner, "Deleting..." label) |
| Long (> 2s) | `SteppedProgressDrawer` with step-by-step progress |

**Never fire-and-forget.** The user must always be able to tell that something is happening and when it's done.

### OperationProgress

**File:** `editor-core/src/types/operation-progress.ts`

```typescript
interface OperationProgress {
  currentStep: number;          // 1-based
  totalSteps: number;
  stepLabel: string;            // e.g., "Uploading KICK1"
  bytesSent: number;            // current step
  bytesTotal: number;           // current step
  bytesSentAllSteps: number;    // all prior steps
  bytesTotalAllSteps: number;   // entire operation
}
```

Helpers: `getOverallPercent(progress)`, `isOperationComplete(state)`, `formatBytes(bytes)`.

**Rule:** Byte-based progress is the primary measure. Item counts are secondary context.

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

Never use text characters or emoji for actions when an icon exists in the shared library.

---

## Connection UI

The MIDI connection interface is a `SlideDrawer`, not a standalone page. Accessible from any page via the MIDI status indicator in the header.

- The connection drawer opens over the current page content
- Not-connected states on all pages show a button that opens the connection drawer (not a link to a separate page)
- After connection, the user stays on whatever page they were on

---

## Layout Conventions

### CSS Design Tokens

All tokens use the `--ac-` prefix. Defined in `editor-core/src/design/tokens.css`.

- **Colors:** `--ac-color-surface-canvas`, `--ac-color-accent`, `--ac-color-danger`, `--ac-status-*`
- **Spacing:** `--ac-space-{1-8}`
- **Typography:** `--ac-text-{xs-lg}`, `--ac-font-weight-*`
- **Motion:** `--ac-duration-{fast-slow}`, `--ac-easing-default`

#### Phase 9 polish tokens

The v3 mockup direction (operator-approved 2026-05-08) introduces a small typographic vocabulary on top of the existing tokens. Use these instead of inlining font stacks or magic letter-spacing values.

- **`--ac-font-display`** — Departure Mono first, JetBrains Mono fallback, then `ui-monospace`. Used for headings, panel-label eyebrows, slot labels, and any "instrument-face" copy. Inter is forbidden by the design language; do NOT list it in fallback chains.
- **`--ac-font-body`** — IBM Plex Sans first, system-ui fallback. Used for prose, list item names, and buttons that aren't displaying instrument-face copy.
- **`--ac-tracking-eyebrow`** — `0.14em`. Applied to uppercase rows: panel labels (§ Patch parameters), bank headers, status metrics.
- **`--ac-tracking-display`** — `0.01em`. Applied to display headings.
- **`--ac-text-eyebrow`** — `0.78rem`. The size for panel-label eyebrows; sits between `--ac-text-xs` and `--ac-text-sm`.
- **`--ac-rule-hairline`** / **`--ac-rule-medium`** — `1px` / `2px`. Tokenized so per-page polish stays consistent (page-title underline, range-bar fills, layer accents).
- **`--ac-color-rec`** / **`--ac-color-rec-glow`** — REC-LED accent. A nod to the S-550 front panel's red PLAY LED + REC LEVEL knob. Use ONLY as a rare device-active / signal-on-air indicator (live-edit footer, page-title underline). NOT for danger (use `--ac-status-danger`), NOT for the Roland-blue identity (use `--ac-color-accent`).

#### Phase 9 shared page primitives

Promoted from page-scoped `.patches__*` classes during Phase 9 Task 4 page 2 (the duplication-audit gate). The classes live in `modules/roland-sxx0-editor/src/styles/_shared.css` and express the LEAN-HEADER + DETAIL-HEAD + LIVE-FOOTER recipe that every editor page in this module follows. Truly page-specific composition (list-row grid templates, envelope chrome, parameter-row primitives) stays page-scoped.

- **`.ac-page-title-row`** + **`.ac-page-title-block`** + **`.ac-page-title-heading`** + **`.ac-page-title-rule`** + **`.ac-page-title-metric`** + **`.ac-page-title-led`** — the lean page-title rhythm: h2 + rec-LED rule + "<n> of <N> loaded" metric. Every list-detail editor page uses this; the rule (red REC-LED accent) is used sparingly per the token guidance above.
- **`.ac-icon-btn`** + **`.ac-icon-btn--spinning`** — square icon-only control sized to the title-row baseline; spins via the `--spinning` modifier. Used for "refresh from device" and similar lone actions. Reuses the `ac-icon-spin` keyframes.
- **`.ac-detail-eyebrow-row`** + **`.ac-detail-eyebrow-sep`** + **`.ac-detail-eyebrow-accent`** — the small uppercase row above the selected-object title ("PATCH · EDITING · SOURCE · DEVICE" / "TONE · EDITING · SOURCE · DEVICE"). Lives in detail headers.
- **`.ac-detail-empty`** — centered uppercase prompt rendered when no object is selected ("Select a patch to edit" / "Select a tone to edit").
- **`.ac-detail-live`** + **`.ac-detail-live-led`** + **`.ac-detail-live-touch`** — the live-edit footer with pulsing rec-LED. Replaces save / cancel / undo per project memory `feedback_live_editing_no_save`; reuses `ac-detail-live-pulse` keyframes.

### Layout Rules

| Do | Don't |
|----|-------|
| Flex ratios (`flex: 1`, `flex: 2`) | Hardcoded pixel widths (`width: 300px`) |
| Grid fractions (`1fr 2fr`) | Fixed column widths |
| `rem` for minimum constraints | `px` for layout dimensions |
| CSS custom properties | Magic numbers |
| `--ac-space-*` tokens for spacing | Arbitrary pixel padding |
| `ac-page-shell` on all pages | Custom page wrappers |
| `ac-list-detail-grid` for list + editor splits | Ad-hoc split layouts |

### Component CSS

All components use `.ac-` prefixed class names. Defined in `editor-core/src/design/`:
- `tokens.css` -- design tokens
- `primitives.css` -- page layouts, sticky headers, grid patterns
- `library.css` -- tree view, modals, drawers, forms, buttons

### Typography

- `text-gray-200` for primary content
- `text-gray-400` for labels
- `text-gray-500` for secondary/muted
- `text-lg font-semibold text-gray-200` for detail panel titles (consistent across all panels)

#### Audiocontrol.org-aligned font stack (v3)

The editor reads as part of the public audiocontrol.org universe via type, spacing, and component shape — NOT via color (the `s330-*` blue+white palette is preserved; see "Color Palette Preservation" below).

Three roles, three faces. Every token below is defined in `editor-core/src/design/tokens.css`; never inline a font stack in component CSS.

| Role | Token | Intended face | Used by |
|------|-------|---------------|---------|
| Display / instrument-face | `--ac-font-display` | **Departure Mono** | Headings, panel-label eyebrows, slot labels, page titles, `.ac-field-label`, `.ac-checkbox__label` (no — uses body), envelope labels |
| UI / body | `--ac-font-body` | **IBM Plex Sans** | Prose, list-item names (`.ac-list-name`), buttons, checkbox labels (`.ac-checkbox__label`), dialog body |
| Data / numeric | `--ac-font-mono` | **JetBrains Mono** | Numeric readouts (`.ac-number-input`), ticks (`.ac-range-bar__tick`), slot identifiers, build-info, log entries |

**Fonts not yet bundled.** As of Phase 9, the editor does NOT ship Departure Mono / IBM Plex Sans / JetBrains Mono as web fonts. The CSS custom properties list each face FIRST with system-fallback chains behind them, so the editor renders correctly with system fonts until the bundled webfonts land. Do NOT inline alternate fallbacks per-component; if a face is missing on a user's system, the token's fallback chain handles it.

**Inter is forbidden by the design language.** Do NOT list `Inter` in any new fallback chain.

#### Tracking + sizing tokens (v3)

- `--ac-tracking-eyebrow` (`0.14em`) — uppercase rows: panel labels, bank headers, status metrics.
- `--ac-tracking-display` (`0.01em`) — display headings.
- `--ac-text-eyebrow` (`0.78rem`) — the size for panel-label eyebrows; sits between `--ac-text-xs` and `--ac-text-sm`.

Anti-pattern: hardcoding letter-spacing (e.g., `letter-spacing: 0.1em`) inside a page-scoped CSS class. Every uppercase eyebrow uses `--ac-tracking-eyebrow`.

#### Color Palette Preservation

The editor's `s330-*` blue+white identity (Roland heritage) is canonical and **not** subject to alignment with audiocontrol.org. Cross-product visual alignment with the public site happens through **type, spacing, and component shape** — not recoloring.

- The accent token `--ac-color-accent` (resolved to `--ac-roland-primary`, `#6bc3ea`) stays. Do not introduce a parallel "audiocontrol-blue" or rename the existing token.
- Per-device `:root[data-editor='...']` overrides in `tokens.css` (s330 / d110 / s3000xl / jv1080) keep each editor's surface palette. Add new editors by extending this block, not by branching component CSS.
- New visual conventions inherited from the public site (Departure Mono headings, IBM Plex Sans body, range-bar parameter row, 8-segment VFD-glow envelope) are realized via the existing color tokens. If a redesign appears to need a new color, default to alpha-composing an existing token via `color-mix(...)` before introducing a new one (e.g., the focus glow uses `color-mix(in srgb, var(--ac-color-accent) 25%, transparent)` rather than a separate `--ac-color-accent-glow` token).

Anti-pattern: introducing `--ac-color-warning-soft` / `--ac-color-accent-tint` / `--ac-color-rec-bg` parallel to the existing color tokens. Use `color-mix(...)` with an alpha against the base color instead. The one acknowledged exception is `--ac-color-rec-glow`, a pre-computed `rgba(...)` because it is consumed inside multiple `box-shadow` chains where re-doing the `color-mix` per call site would obscure intent — single derived value, documented at the token's definition site.

---

## Page Shell Pattern (fixed viewport, 3 column)

Every list-detail editor page renders inside a fixed-viewport flex column with internal column scrolls. The page itself does not scroll; the list pane, the detail pane, and (where present) the live-status footer each scroll independently. Source: project memory `feedback_sticky_app_shell` + `feedback_flex_main_width_gotcha`.

**When to use:** any editor page with a list + detail layout (PatchesPage, TonesPage, PlayPage, LibraryPage). Single-detail pages (HomePage, WorkflowsPage) use the standard `.ac-page-shell` grid instead.

**Recipe:**

1. The outermost editor `<main>` is `display: flex; flex-direction: column;` with a fixed-viewport height. Set `width: 100%` explicitly — without it, the cross-axis sizes to descendants' `max-content`, which varies silently per page.
2. Use a 3-column grid (`grid-template-columns: <list> 1fr <detail>`) or a flex row inside the fixed viewport; each column carries `overflow: auto` for internal scrolling.
3. Do NOT use `position: sticky` on the page header or column headers. Sticky positioning fails silently inside `overflow: hidden` ancestors and is fragile under the column-direction flex chrome.
4. Page chrome lives outside the scrolling columns: the lean page header sits above the columns, the live-status footer sits below.

**Anti-patterns:**

- Sticky positioning on page chrome — produces a working layout on one page and a broken layout on another, with no compile-time signal.
- Hardcoded pixel widths on columns (e.g., `width: 320px`). Use flex ratios or grid fractions.
- Omitting `width: 100%` on a flex `<main>` in a column-direction parent. Visual chrome appears to render until you switch pages and notice the cross-axis varies.

**Example:**

```html
<main class="page-shell">
  <header class="ac-page-title-row">…</header>
  <div class="page-columns">
    <aside class="ac-list ac-list-scroll">…</aside>
    <section class="detail-pane">…</section>
  </div>
  <footer class="ac-detail-live">…</footer>
</main>
```

```css
.page-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.page-columns {
  display: grid;
  grid-template-columns: 18rem 1fr;
  flex: 1;
  min-height: 0; /* allow children to overflow within the flex track */
}
```

---

## Page Header Pattern (lean, one row)

Editor page headers are one row: `h2` heading + red REC-LED rule + status metric + icon-only action buttons. No eyebrow row above the heading. No preamble paragraph below it. No announcement banner. Source: project memory `feedback_lean_page_header`.

**When to use:** every editor page header. The lean rhythm is canonical; deviations (per-page hero cards, banner callouts) erode cross-page trust.

**Composition:** the `.ac-page-title-*` shared primitives in `modules/roland-sxx0-editor/src/styles/_shared.css` express this rhythm:
- `.ac-page-title-row` — outer flex container.
- `.ac-page-title-block` — the h2 + rule + metric block.
- `.ac-page-title-heading` — display-font h2.
- `.ac-page-title-rule` — short red underline (uses `--ac-color-rec`; see "Rec-LED Red Accent" below).
- `.ac-page-title-metric` — uppercase mono captions, e.g. "8 of 32 loaded".
- `.ac-page-title-led` — small pulsing dot when the page is connected.

Icon-only actions (refresh, panic) use `.ac-icon-btn` (also in `_shared.css`).

**Anti-patterns:**

- Eyebrow row above the h2 (e.g., `<span>EDITOR · PATCHES</span>` rendered above the heading). The h2 itself communicates the page.
- Preamble paragraph immediately under the h2 ("This page lets you…"). Each page is recognizable from its layout; an instructional paragraph is not part of the design language.
- Announcement banner ("New! Save sets to library"). Use the notification system for ephemeral messages; the page header is not a marketing surface.
- Wrapping the title row over two visual rows. The lean header is one row at every viewport; narrow viewports hide non-essential icons, not stack rows.

---

## Live-Status Footer Pattern

S-330 and S-550 parameter edits stream live to the device — there is no save / cancel / undo. The detail pane's footer is a live-status strip with a pulsing LED indicating that the device is the source of truth and that recent edits are landed. Source: project memory `feedback_live_editing_no_save`.

**When to use:** every editor page whose parameter edits write to the device on change (PatchesPage, TonesPage, PlayPage). The library pages (LibraryPage) ARE save-oriented — they edit local OPFS state and explicitly commit on a button press; they don't use this pattern.

**Composition (in `_shared.css`):**
- `.ac-detail-live` — fixed-height bottom strip.
- `.ac-detail-live-led` — pulsing rec-LED dot (uses `--ac-color-rec` and the `ac-detail-live-pulse` keyframes).
- `.ac-detail-live-touch` — uppercase mono caption like "LIVE EDIT · DEVICE WRITES ENABLED".

**Anti-patterns:**

- Save / Cancel / Undo buttons under a parameter editor. The device is the source of truth and writes are streaming; presenting save/cancel implies queueing semantics that don't exist.
- Toasts on every parameter write. The live-status footer is the persistent acknowledgement; per-edit toasts would never stop firing.
- "Discard changes" prompts on page leave. There are no pending changes to discard.

---

## Tabbed Detail Pane

Parameter editors with four or more logical sections use radio-driven tabs inside the detail pane. Strongly-interacting controls (filter parameters next to the filter envelope, amp parameters next to the amp envelope) live in the same tab. Source: project memory `feedback_tabbed_detail_pane`.

**When to use:** any detail pane whose parameter count exceeds what fits comfortably in a single viewport (Tones has 5 tabs: Wave / Pitch / Filter / Amp / LFO).

**Recipe:**
- Tabs are rendered as a single horizontal row inside the detail pane, above the parameter grid.
- Use `<input type="radio">` + matching labels for the tab control (no scripted button-list). The tab name carries display font + `--ac-tracking-eyebrow` styling.
- Strongly-interacting controls **stay together** in the same tab. Splitting `filter cutoff` from `filter envelope` across tabs would force the user to context-switch to hear a single change — the wrong default.
- An "active" indicator (accent underline or accent fill) marks the current tab; cursor is `pointer`.

**Anti-patterns:**

- Three-tab modules made tabbed for the sake of tabs. Below the four-section threshold, dense grid sections (see "Parameter Editors § Dense Grid Layout") read more clearly.
- Separating an envelope from its parameters across tabs. The envelope graph is the visualization of those parameters; place them together.
- Tab labels that aren't recognizable instrument-section names ("Tab 1 / Tab 2"). Names are domain terms: Wave, Pitch, Filter, Amp, LFO.

---

## Virtual Front Panel Under the CRT

Every editor page that mounts the CRT also mounts a virtual front panel mirroring the physical S-330 / S-550 buttons. The canonical mount is the drawer-embedded `<VideoCapture>` slot per `decisions-2026-05-11.md` Decision 1. Source: project memory `feedback_virtual_front_panel`.

**When to use:** every CRT-bearing editor page. It is not optional and is not a per-page decision; the front panel is part of the editor's identity surface.

**Composition:** the front panel mounts inside the `<VideoCapture>` slide-over drawer along with the CRT itself. Front-panel button presses become DT1 SysEx emits via the `useFrontPanel` capability (D-XX-02 / D-XX-03 / D-XX-04 in the capability inventory).

**Anti-patterns:**

- Per-page conditional mounting ("PatchesPage doesn't need it"). Every CRT page mounts it; consistency is critical for trust.
- Reinventing the front panel as page-scoped chrome. There is one virtual front panel; it lives in the drawer; it is shared across editors.
- Inserting the front panel inline above the parameter grid. The drawer location IS the mount per Decision 1; the inline-above variant is the rejected option.

---

## Rec-LED Red Accent (sparingly)

The red `--ac-color-rec` (`#f6533c`) is a homage to the S-550 front panel's PLAY LED + REC LEVEL knob. It is the editor's ONLY use of red, and it signals **device-active / signal-on-air** — never danger. Source: project memory `feedback_rec_led_accent`.

**When to use:**
- `.ac-page-title-rule` — the short red underline beneath the page h2. Communicates "this page is live; the device is connected and writes are streaming."
- `.ac-detail-live-led` — the pulsing dot in the live-status footer.
- Front-panel mode LED on the virtual front panel.

**Anti-patterns:**

- Using `--ac-color-rec` for an error state. Use `--ac-color-danger` (`#fca5a5`, the soft-pink danger token). Conflating the rec-LED red with error red breaks the "red means device active" affordance.
- Using `--ac-color-rec` for any "primary" identity (call-to-action button, brand mark). The Roland blue (`--ac-color-accent`) is the brand; the rec-LED is the front-panel homage.
- Painting large surfaces with `--ac-color-rec`. The rule, dot, and LED uses are intentionally small. A red panel background would read as a sustained error.

---

## Accessibility

### Icon Sizes

Always use CSS classes for icon sizing, never inline `style` attributes. Sizes are in `rem` so they scale with user font preferences.

| Context | Class | Size | Notes |
|---------|-------|------|-------|
| Inline with text (buttons, labels) | `ac-icon` | `1.25rem` | Default. Includes `inline-block`, `vertical-align: middle`, `flex-shrink: 0` |
| Standalone icon button (header, toolbar) | `ac-icon-lg` | `1.5rem` | Same layout properties as `ac-icon` |
| Tree view / list item hover actions | `ac-tree-icon` | `1rem` | Compact context, always accompanied by text |

Never use icons smaller than `1rem`. For clickable areas, the button padding provides the touch target, not the icon itself.

### Interactive Elements

- All clickable elements must have visible hover/focus states
- Buttons that look like plain text must have a visual cue (icon, underline, cursor change)
- `title` attributes on icon-only buttons for tooltip context
- `aria-label` on buttons with no visible text label
- `role="switch"` and `aria-checked` on toggle controls
- Keyboard-navigable: all interactive elements reachable via Tab, activatable via Enter/Space

### Labels and Affordances

- Buttons must clearly communicate what they do. "PANIC" is jargon; "All Notes Off" is descriptive.
- Status indicators that are also controls must have a visual affordance (e.g., gear icon)
- Cryptic triggers (git hashes, abbreviated codes) should use recognizable icons instead

---

## Parameter Editors

### Dense Grid Layout

Parameter editors use a multi-column grid (`s3k-section` / `s3k-section-grid`) instead of one-parameter-per-row forms. Each parameter shows:
- Label (uppercase, small)
- Visual value bar showing position in range (accent color fill)
- Numeric value (click to edit precisely)
- Bipolar parameters fill from center for center-zero values (pan, tuning)

Components: `ParamKnob`, `ParamSelect`, `ParamToggle`.

### Section Pairing

Related sections sit side by side in two-column grids. Size list columns for their content (e.g., `18rem` for 12-character program names), not a proportion of the page.

### Envelope Visualizations

Envelope displays are interactive — drag points to edit values:
- **Fixed horizontal scale** — each segment gets a budget of max time units; dragging one point does not shift others
- **Invisible hit areas** (r=14) around visible dots (r=4) for easier grabbing
- **Separate `onDrag` / `onCommit`** — continuous UI updates during drag, device write only on mouse up
- **Values always clamped** — impossible to produce out-of-range values

Shared `EnvelopeEditor` renders any polyline envelope. Device-specific wrappers compute points from their parameter formats.

---

## v3 Atomic Control Primitives

Landed in Phase 9 Task 4.0 from the validated `/frontend-design` mockups under `docs/1.0/001-IN-PROGRESS/s550-support/explorations/` (`01-design-language.html` and `04-tones.html`). These primitives express the design-language vocabulary that the per-page polish dispatches consume.

Each primitive lives in a stylesheet under `modules/editor-core/src/design/` and (where composition demands) ships an `<Ac…>` React component under `modules/editor-core/src/components/`. The CSS classes can also be applied to raw HTML; the components compose them.

### .ac-field-label

Uppercase eyebrow label rendered above parameter rows, form fields, and section heads. Distinct from `.ac-label` (which uses sentence-case body type).

**When to use:** any label that introduces a parameter, a select, an input, or a section. Pair with `--ac-text-eyebrow` / `--ac-tracking-eyebrow` already set by the class.

**Mockup citation:**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:497-503` (CSS — the prototype `.ac-field__label` block that this primitive descends from)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:1408-1438` (HTML — `<label class="ac-field__label">` paired with `.ac-input` and `.ac-select` demos)

**Example:**

```html
<label>
  <span class="ac-field-label">Wave Bank</span>
  <select class="ac-select">…</select>
</label>
```

**Related tokens:** `--ac-font-display`, `--ac-text-eyebrow`, `--ac-tracking-eyebrow`, `--ac-color-text-muted`.

**Accessibility:** purely visual; pair with `<label htmlFor>` or `aria-labelledby` when introducing an input.

### .ac-select (enhanced)

Pre-existing class, polished in Phase 9 Task 4.0 with the v3 mockup direction. Adds:
- Custom chevron via inline SVG data URI (accent-stroked).
- Hairline border using `--ac-rule-hairline`.
- Accent focus ring (3px `color-mix` glow at 25% accent alpha).
- Hover-row border emphasis using `color-mix` of border + muted text.

**When to use:** any native `<select>` in the editor. The class can be applied directly to native `<select>` — no JSX wrapper required.

**Mockup citation:**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:505-549` (CSS — base `.ac-input, .ac-select` styling + `.ac-select` chevron variant)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:1422-1438` (HTML — `<select class="ac-select">` demo, including the disabled state)

**Example:**

```html
<select class="ac-select">
  <option value="a">Bank A</option>
  <option value="b">Bank B</option>
</select>
```

**Related tokens:** `--ac-color-border-subtle`, `--ac-color-accent`, `--ac-color-surface-canvas`, `--ac-radius-md`.

**Accessibility:** native `<select>` keyboard + screen-reader behaviour preserved. Focus state visible via `focus-visible` (no outline; box-shadow ring instead).

#### --compact modifier (Phase 9 Task 4 PlayPage amend)

Both `.ac-select` and `.ac-input` accept a `--compact` modifier (`.ac-select.ac-select--compact`, `.ac-input.ac-input--compact`). Tightens the padding and font-size for inline-grid use cases — e.g., PlayPage's 12-column part-status grid where the channel/patch/output `<select>`s live inside narrow row cells alongside text columns.

**When to use:** ONLY inside dense grid rows (PlayPage parts, future similar multi-row consoles). Default (non-compact) styling is the right choice for parameter editors, dialogs, and standalone form rows — the compact size reads as cramped outside its inline-grid context.

**Tokens used:** `--ac-space-1` (vertical padding), `--ac-space-2` (horizontal padding), `--ac-text-sm` (font-size). No hardcoded pixel values.

**Mockup citation:** N/A — this modifier was added during Phase 9 Task 4 PlayPage amend (commit `2e857bc6`) for the inline part-row grid; the v3 mockups did not anticipate this layout context.

**Example:**

```html
<select class="ac-select ac-select--compact" data-testid="part-0-channel">
  <option value="0">1</option>
</select>
```

#### --warning modifier (Phase 9 Task 5 dialog polish)

Both `.ac-select` and `.ac-input` accept a `--warning` modifier (`.ac-select.ac-input--warning`, `.ac-input.ac-input--warning` — note: the warning class uses `ac-input--warning` for BOTH inputs and selects, matching the pre-existing `ac-input--error` precedent on the shared selector). Renders the field with a `--ac-color-warning` border and matching focus ring.

**When to use:** non-fatal warnings on a field — distinct from `--error`, which signals a validation failure that blocks submit. Canonical use: import dialogs flagging that a target slot will overwrite an existing tone / patch (operator can still proceed).

**Anti-pattern:** using `--error` for an overwrite alert. `--error` means "you cannot submit"; `--warning` means "you can submit but here's something to know."

**Mockup citation:** N/A — added during Phase 9 Task 5 dialog polish (commit `8e179806`) for ImportSampleDialog / ImportLibraryToneDialog / ImportLibraryPatchDialog overwrite alerts.

**Example:**

```html
<select class="ac-select ac-input--warning" data-testid="target-tone">
  <option value="0">T01 (will overwrite)</option>
</select>
```

### .ac-checkbox (v3)

Two-element pattern shipped as `<AcCheckbox>`. The label wraps the checkbox input and a span label; the input is `appearance: none` so it can be styled to the design language (hairline-rule rounded square, accent fill when checked, accent focus glow).

Distinct from the pre-existing single-class `.ac-checkbox-label` (used by `BuildInfo`'s logs filter). Both coexist; new code uses `<AcCheckbox>`.

**When to use:** any boolean toggle in the editor (parameter on/off, dialog options, log filters that aren't yet on `<AcCheckbox>`).

**Mockup citation:**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:551-603` (CSS — `.ac-checkbox`, `.ac-checkbox__input`, the `:checked::after` check glyph, and `.ac-checkbox__label`)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:1440-1456` (HTML — three demo checkboxes: checked, unchecked, disabled)

**JSX:**

```tsx
import { AcCheckbox } from '@audiocontrol/editor-core';

<AcCheckbox checked={enabled} onChange={setEnabled}>
  Restore wave data after upload
</AcCheckbox>
```

**Raw HTML (when not in React):**

```html
<label class="ac-checkbox">
  <input class="ac-checkbox__input" type="checkbox" checked />
  <span class="ac-checkbox__label">Restore wave data</span>
</label>
```

**Related tokens:** `--ac-color-accent`, `--ac-color-border-subtle`, `--ac-rule-hairline`, `--ac-rule-medium` (used for the check glyph stroke).

**Accessibility:** native `<input type="checkbox">` semantics; `aria-label` prop is forwarded for icon-only contexts; disabled state dims label color via descendant selector.

### .ac-slider + .ac-range-bar

Two paired primitives that together implement the v3 range-bar parameter row (per project memory `feedback_range_bar_pattern`). `.ac-slider` is the FULL row (three-column grid: label | bar | mono readout); `.ac-range-bar` is the VISUALIZATION inside the bar column. The bar can be used standalone (e.g., inside the envelope table's mini cells).

**Important:** these are NOT a replacement for `ParameterSlider` (the Radix-based drag-handle slider used by the Roland editor today). `ParameterSlider` stays in place; per-page polish dispatches decide their own consumer migration.

**Variants of `.ac-range-bar` / `<AcRangeBar>`:**
- **linear** (default) — single accent fill anchored at the left edge; width = `value` as a percentage of `[min, max]`.
- **bipolar** — fill anchored at `center` (default 0), growing left or right. CSS variables `--ac-range-bar-l` and `--ac-range-bar-w` are emitted by the component.
- **enum** — N-cell pip track, the cell at `activeIndex` lit accent. Use for discrete categorical params (loop mode, wave bank, etc.).

**JSX:**

```tsx
import { AcSlider } from '@audiocontrol/editor-core';

<AcSlider
  label="Cutoff"
  bar={{ variant: 'linear', value: tone.cutoff, min: 0, max: 127 }}
  readout={tone.cutoff}
/>

<AcSlider
  label="Fine Tune"
  bar={{ variant: 'bipolar', value: tone.fineTune, min: -50, max: 50 }}
  readout={tone.fineTune}
/>

<AcSlider
  label="Loop Mode"
  bar={{ variant: 'enum', count: 4, activeIndex: tone.loopMode }}
  readout="Forward"
/>
```

**Related tokens:** `--ac-color-accent`, `--ac-color-surface-canvas`, `--ac-color-border-subtle`, `--ac-color-text-muted`, `--ac-rule-hairline`, `--ac-rule-medium`, `--ac-font-display` (label), `--ac-font-mono` (readout + ticks), `--ac-tracking-eyebrow`.

**Accessibility:** the bar carries `role="img"` and an `aria-label` describing the value-of-range. For read-write rows, place a focusable affordance (e.g., the readout becomes an `<AcNumberInput editable>` or a parent button) — the bar itself is a visualization, not a focus target.

**Mockup citation (slider — full row primitive `.tones__param`):**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1465-1547` (CSS — `.tones__param` 3-column grid, `.tones__param-label`, `.tones__param-bar`, `.tones__param-fill`, ticks, and `.tones__param-readout`)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2398-2449` (HTML — linear + enum demos under the "Wave" section)

**Mockup citation (range-bar variants — bar visualization):**
- linear / ticks: `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1486-1531` (CSS — bar shell, fill, start/mid/end ticks)
- bipolar: `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1508-1517` (CSS — `.tones__param--bipolar .tones__param-fill`)
- enum: `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1548-1568` (CSS — `.tones__param--enum .tones__param-enum-track` + pip variants)

### .ac-number-input

Display-font numeric readout. Two shapes:
- **read-only** (default) — `<span class="ac-number-input">` with the value in display font and an optional dim unit.
- **editable** (`editable={true}`) — `<input type="number">` with the same display styling and spin-buttons hidden.

**JSX:**

```tsx
import { AcNumberInput } from '@audiocontrol/editor-core';

<AcNumberInput value={32} unit="kHz" />

<AcNumberInput
  editable={true}
  value={tone.cutoff}
  onChange={(v) => setTone({ ...tone, cutoff: v })}
  min={0}
  max={127}
/>
```

**Related tokens:** `--ac-color-accent`, `--ac-color-text-muted`, `--ac-font-display`, `--ac-font-mono`, `--ac-text-sm`, `--ac-text-xs`.

**Accessibility:** native `<input type="number">` keyboard behaviour preserved in editable mode; spin buttons hidden visually but `min` / `max` / `step` are forwarded to the input. `aria-label` prop is forwarded.

**Mockup citation:**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1532-1547` (CSS — `.tones__param-readout`, `.tones__param-readout strong` accent emphasis, `.tones__param-readout-unit`)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2408-2448` (HTML — `<span class="tones__param-readout">` with and without unit, e.g. `<strong>30</strong> <span class="tones__param-readout-unit">kHz</span>`)

### .ac-envelope (8-segment VFD-glow editor)

Per project memory `feedback_envelope_pattern`: stacks a full-width "monitor" graphic with phosphor scanlines on top of a per-segment numeric table, plus a meta strip with sustain-segment and end-segment radio rows.

Shipped as `<AcEnvelope>`, composed from three sub-components also exported individually for advanced layouts:
- `<AcEnvelopeGraph>` — the monitor (grid lines, accent fill, bright stroke line, point markers, axis ticks, y-axis level guides, sustain marker).
- `<AcEnvelopeMeta>` — sustain + end segment pip rows.
- `<AcEnvelopeTable>` — per-segment numeric table with mini range-bars.

**Drag interaction is OUT of scope for the Task 4.0 dispatch.** Points are rendered visually with `cursor: grab`; drag handlers arrive with the page-amendment dispatch. The component exposes callbacks (`onPointSelect`, `onSustainChange`, `onEndChange`, `onExpand`) where the consuming page chooses to respond.

**JSX:**

```tsx
import { AcEnvelope } from '@audiocontrol/editor-core';

<AcEnvelope
  label="TVF · 8-SEGMENT"
  segments={[
    { time: 15, level: 127 },
    { time: 22, level: 96 },
    /* …six more segments… */
  ]}
  sustainSegment={5}
  endSegment={8}
  activeSegment={2}
  onPointSelect={(seg) => setActive(seg)}
  onSustainChange={(seg) => writeToDevice({ sustain: seg })}
  onEndChange={(seg) => writeToDevice({ end: seg })}
  onExpand={openPrecisionEditor}
  helpText="Drag points to adjust · Click expand for precision editing"
/>
```

**Related tokens:** `--ac-color-accent`, `--ac-color-surface-canvas`, `--ac-color-border-subtle`, `--ac-color-text-primary`, `--ac-color-text-muted`, `--ac-rule-hairline`, `--ac-rule-medium`, `--ac-font-display`, `--ac-font-mono`, `--ac-tracking-eyebrow`. Component-internal: scanline overlay is a `repeating-linear-gradient` with hard-coded 0.18 alpha black (intentional — it's the printed-glass effect, not a colored surface).

**Accessibility:**
- The graph carries `role="region"` with an `aria-label` describing segment count and active segment.
- **Graph points** are native `<button type="button">` elements (selectable segments 1..n) so click + keyboard activation (Space / Enter) both fire `onPointSelect` via native semantics. Each button carries `aria-label="Select segment N"` and `aria-pressed` reflecting the active state. The segment-0 anchor renders as a non-interactive `<span aria-hidden="true">`.
- **Sustain and end pip rows** are `role="radiogroup"` / `role="radio"` with `aria-checked`. Each row uses **roving tabindex** (exactly one pip per group is in the tab order — the active pip if it is enabled, otherwise the first enabled pip). Space / Enter activates the focused pip; ArrowRight / ArrowDown / ArrowLeft / ArrowUp navigate between enabled pips with wrap-around; Home / End jump to the first / last enabled pip. Disabled pips carry `aria-disabled="true"` and `data-disabled="true"` and are skipped during arrow navigation.
- **Per-segment table** rows use `role="row"` (non-interactive per ARIA). The segment-number cell is a native `<button type="button">` carrying `aria-label="Select segment N"` and `aria-pressed`, so row activation has a single focus + keyboard target instead of a row-wide click handler with no keyboard equivalent.

**Mockup citation (envelope graph — `<AcEnvelopeGraph>`):**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1576-1783` (CSS — `.tones__envelope`, `.tones__envelope-graph`, label, expand button, canvas, grid lines, segment dividers, active guide, fill / line, points, axis ticks, y-axis)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2640-2705` (HTML — graph demo with label, expand button, SVG fill / line, point markers, and axis ticks)

**Mockup citation (envelope meta — `<AcEnvelopeMeta>`):**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1882-1945` (CSS — `.tones__envelope-meta`, `.tones__envelope-meta-control`, `.tones__envelope-meta-label`, `.tones__envelope-meta-pips`, `.tones__envelope-meta-pip`, active + disabled variants)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2707-2735` (HTML — sustain + end radio rows, with `role="radiogroup"` and `role="radio"` markup)

**Mockup citation (envelope table — `<AcEnvelopeTable>`):**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1786-1862` (CSS — table shell, row + header grid, active + sustain row markers, head + seg typography, cell layout, mini range-bar + readout)
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2737-2832` (HTML — 8-segment table demo with active row 2 and sustain row 5)

**Mockup citation (sustain label):**
- `docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:2054-2066` (CSS — `.tones__envelope-sustain-label` floating marker above the sustain point)

### .ac-list-* family (list pane primitives)

Promoted from `.patches__list-*` / `.tones__list-*` during Phase 9 Task 4 PatchesPage amend (commits `7299ca6a` + `33e7e6b8`). The list-row outer grid (`grid-template-columns`) stays page-scoped because the slot-column width differs per device list (patches use `3rem`, tones use `2.5rem`); every other list primitive is byte-identical across `PatchList` / `ToneList` and lives in `modules/editor-core/src/design/list-primitives.css`.

**When to use:** any list pane in a list-detail editor page (PatchesPage, TonesPage, the in-development library lists). The list-pane chrome is shared across both Roland editors — when you find yourself duplicating it for a new device list, extend this family rather than copying.

**Family inventory:**

| Class | Role |
|-------|------|
| `.ac-list` | Outer container: hairline border + panel surface + `overflow: hidden`. |
| `.ac-list-scroll` | Inner scroll region: `overflow-y: auto` with thin scrollbar. |
| `.ac-list-bank-header` | Sticky uppercase bank/category header that scrolls with the list. Display font + `--ac-tracking-eyebrow`. |
| `.ac-list-slot` | Mono slot identifier in the row's slot column (`P01`, `T17`). |
| `.ac-list-info` | Vertical stack of name + eyebrow inside a row. |
| `.ac-list-name` | The list item's primary name. Body font, weight-medium, truncating ellipsis. |
| `.ac-list-name--placeholder` | Italic muted variant for empty slot names. |
| `.ac-list-name--empty` | Italic + heavier muted variant for "unallocated" slots (per `slot-allocation.ts` semantics). |
| `.ac-list-eyebrow` | Tiny uppercase eyebrow inside a row (e.g., voice count, source bank). |
| `.ac-list-action` | Hover-revealed action button on a row (e.g., "Export"). Opacity 0 by default; transitions to 1 on parent `:hover` / `:focus-within` / `[data-selected="true"]`. |

**Naming convention:** The family follows BEM-ish dashes for hierarchy and `--` for modifiers — `.ac-list` (block) + `.ac-list-bank-header` / `.ac-list-name` (elements) + `.ac-list-name--placeholder` / `.ac-list-name--empty` (modifiers). The page-scoped row grid wires these primitives together via its own `.<page>__list-row` selector that defines `grid-template-columns` and the reveal rule for `.ac-list-action`.

**Example:**

```html
<aside class="ac-list">
  <div class="ac-list-scroll">
    <header class="ac-list-bank-header">
      <span>Bank A</span><strong>8 of 32</strong>
    </header>
    <button class="patches__list-row" data-selected="true">
      <span class="ac-list-slot">P01</span>
      <div class="ac-list-info">
        <span class="ac-list-name">Strings Pad</span>
        <span class="ac-list-eyebrow">4 layers</span>
      </div>
      <span class="ac-list-action">Export</span>
    </button>
  </div>
</aside>
```

**Anti-patterns:**

- Copying `.ac-list-name` / `.ac-list-slot` into a new page-scoped class (`.workflows__list-name`). The family is shared; new device lists extend it.
- Re-deriving the sticky bank header per page. The sticky positioning + backdrop blur lives in `.ac-list-bank-header`; reuse it.
- Setting `grid-template-columns` inside `.ac-list-bank-header` to match a per-page slot width. The bank header is a flex row with `justify-content: space-between`; the row's slot column is the page-scoped responsibility.

### CSS file organization (Phase 9 Task 4.0)

The original `primitives.css` exceeded 500 lines and was split during Task 4.0:

- `tokens.css` — design tokens
- `layout-primitives.css` — page shell, site chrome, list-detail grid, tabs, status indicator, scrollbar, icons
- `overlay-primitives.css` — modal + slide-over drawer
- `primitives.css` — buttons, inputs (with v3 polish), selects (with v3 chevron + focus glow), labels, fields, card, titles, text utilities, link, radio, list-action-btn, drawer-section
- `feedback-primitives.css` — alerts, notifications, logs panel, operation progress, spinner, build-info, info-list
- `control-primitives.css` — v3 atomic primitives (`ac-field-label`, `ac-checkbox`, `ac-slider`, `ac-range-bar`, `ac-number-input`)
- `envelope-primitives.css` — v3 8-segment VFD-glow envelope primitive
- `list-primitives.css` — v3 list-pane chrome (`.ac-list`, `.ac-list-bank-header`, `.ac-list-slot`, `.ac-list-name`, `.ac-list-action`, etc.) promoted during Phase 9 Task 4 PatchesPage amend
- `library.css` — library tree/dialog chrome (separate file due to size)

`styles.css` imports all of them in dependency order. All `.ac-*` classes are usable directly from any editor that already imports the editor-core stylesheet.

---

## Contract Enforcement Rules

1. **Every shared interface change must break consumers at compile time.** If you add a required field and no editor breaks, the type isn't actually shared.

2. **No optional bags of callbacks.** Group related callbacks into capability interfaces. If a UI element appears, its handler must be required.

3. **Types exist once.** If the same type is defined in two files, one must go. Move to the lowest common ancestor.

4. **Loud failure over silent no-ops.** An action that silently does nothing is a bug. Either the action should not appear, or it should throw.

5. **Build all editors before committing.** `make` verifies that shared contract changes compile everywhere.
