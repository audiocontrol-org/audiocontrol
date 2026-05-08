---
title: "UX Audit — Phase 9 (s550-support)"
audience: editor team + /frontend-design plugin
generated: 2026-05-08
inputs:
  - DESIGN-SYSTEM.md (repo root)
  - editor-core/src/design/tokens.css
  - modules/roland-sxx0-editor/src/pages/*.tsx
  - modules/roland-sxx0-editor/src/components/library/*Dialog.tsx
  - https://audiocontrol.org (rendered)
  - https://github.com/oletizi/audiocontrol.org (source repo)
---

# UX Audit — Phase 9 (s550-support)

This audit is the input artifact for Phase 9 Task 2 (design exploration via the `/frontend-design` plugin). It enumerates **deviations** from two reference points:

1. **DESIGN-SYSTEM.md** (the editor's existing design system) — per-page and per-dialog findings.
2. **audiocontrol.org's redesigned visual identity** — what the editor should adopt to read as part of the same brand universe, while preserving the `s330-*` blue+white palette.

No fixes are proposed here. Per the Phase 9 constraint (every UI change goes through `/frontend-design`), remediation will land in Task 2's exploration and Tasks 3–7's plugin-driven refactors.

## Table of contents

1. [Part A — DESIGN-SYSTEM.md compliance](#part-a--design-systemmd-compliance) (per-page + per-dialog deviations)
2. [Part B — audiocontrol.org visual-identity alignment](#part-b--audiocontrolorg-visual-identity-alignment) (typography, layout, components, color)
3. [Part C — Cross-cutting themes](#part-c--cross-cutting-themes) (16 themes spanning pages and dialogs)
4. [Part D — Open questions](#part-d--open-questions) (decisions to surface before Task 2)
5. [Part E — Next step](#part-e--next-step)

---

## Part A — DESIGN-SYSTEM.md compliance

DESIGN-SYSTEM.md sections referenced below by short name: Typography, Layout Rules, Icon Sizes, Accessibility, Parameter Editors, Dialog Components, Progress and Feedback, Anti-Patterns, CRUD Affordances, Connection UI, Multi-Device Architecture.

### HomePage (`modules/roland-sxx0-editor/src/pages/HomePage.tsx`, 49 lines)

- `HomePage.tsx:38` — `h2 className="text-xl font-bold text-s330-text"`. DESIGN-SYSTEM Typography prescribes `text-lg font-semibold text-gray-200` for detail panel titles and the broader gray-200/400/500 scale for body content. Same heading style is reused on every page; this is the source of the inconsistency rather than HomePage in isolation.
- `HomePage.tsx:35-40` — page shell uses `ac-page ac-page-shell` with an `ac-page-sticky-header` wrapper but the wrapper exists only to host an `<h2>` (no actions, no progress, no nav). Heavy primitive for a page whose actual content is the embedded `MidiConnectionPage`, producing a header rhythm that does not match other pages with real header content.
- The page lets `MidiConnectionPage` (from editor-core) render the rest. Deviations inside `MidiConnectionPage` itself are out of scope for this audit.

### PatchesPage (`modules/roland-sxx0-editor/src/pages/PatchesPage.tsx`, 327 lines)

- `PatchesPage.tsx:194,211` — `text-xl font-bold text-s330-text` heading pattern; deviates from Typography rule.
- `PatchesPage.tsx:195,222,294,305` — body and helper text uses `text-s330-muted` (sometimes paired with `text-xs`) instead of `text-gray-400` / `text-gray-500`. The `s330-*` palette is for *color identity*; typography scale should still come from the gray scale per Typography rule.
- `PatchesPage.tsx:215-224` — inline progress bar is hand-rolled (`h-2 bg-s330-panel rounded-full`, inner `bg-s330-highlight`, `style={{ width: ${loadingProgress}% }}`). Progress and Feedback section requires every progress indicator to use a shared component with bytes / elapsed / ETA. This bar shows only a percent and a one-line message. Same shape recurs on Tones, Play, SaveSet — see cross-cutting themes.
- `PatchesPage.tsx:219` — magic numeric value via inline `style={{ width: '${loadingProgress}%' }}`. Layout Rules forbid magic numbers; should be a token-driven shared progress primitive.
- `PatchesPage.tsx:215` — `max-w-xs` Tailwind constraint on the progress bar. `20rem` works at one viewport but is not declared via `--ac-space-*` and is not part of the editor's token vocabulary.
- `PatchesPage.tsx:225-247` — bank reload buttons use bespoke `cn('ac-btn ac-btn-sm', loadedPatchBanks.includes(i) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')`. `ac-btn` variants don't have a documented "loaded vs not-loaded" state; toggling between primary and secondary on a stateful button overloads the primary affordance.
- `PatchesPage.tsx:227-247` — toolbar contains 6+ "P11-P18 / P21-P28 …" buttons plus an "All" button. Per CRUD Affordances "List-Level Actions": "A refresh icon on the list title header reloads the full list from the device. This replaces toolbar-level 'Refresh' and 'Load All' buttons." This page-level reload toolbar contradicts that rule.
- `PatchesPage.tsx:248-254` — "All" button is opaque text. Accessibility: "Buttons must clearly communicate what they do."
- `PatchesPage.tsx:294-296` — empty-state card "Select a patch to edit" inside the detail column. DESIGN-SYSTEM rule "Never show empty state when data exists or is loading" requires auto-selecting the first item.
- `PatchesPage.tsx:262-264, 304-309` — uses `card` and `ac-alert ac-alert-error`, `ac-text-error` (good — these are documented primitives) but mixes them with hand-rolled `text-s330-muted text-sm`.
- `PatchesPage.tsx:198,234` — link/button labelled "Go to Connection" links to `/`. Per Connection UI, connection is a `SlideDrawer` accessed from any page header — not a separate route. Pattern repeated on TonesPage:508, PlayPage:254, LibraryPage:234.

### TonesPage (`modules/roland-sxx0-editor/src/pages/TonesPage.tsx`, 691 lines)

**File-size violation flagged separately:** 691 lines vs. 500-line ceiling (workplan Task 3 already calls this out). All findings below are independent of decomposition.

- `TonesPage.tsx:522,504` — same `text-xl font-bold text-s330-text` heading pattern. Typography deviation.
- `TonesPage.tsx:523,537-540,505,624,634` — body/help text uses `text-s330-muted` rather than `text-gray-400` / `text-gray-500`.
- `TonesPage.tsx:529-541` — inline hand-rolled progress bar (identical shape to PatchesPage:215-224). Progress and Feedback rule violation; DRY violation.
- `TonesPage.tsx:534` — magic `style={{ width: '${loadingProgress}%' }}`.
- `TonesPage.tsx:530,540` — `max-w-xs` and `text-xs mt-0.5 truncate` repeats the ad-hoc dimensioning. The `mt-0.5` (2px) is a magic micro-spacing not derived from `--ac-space-*`.
- `TonesPage.tsx:543-565` — same per-bank load toolbar with `(Re)load:` prefix. Conflicts with CRUD Affordances rule.
- `TonesPage.tsx:543` — UI text `(Re)load:` is jargon.
- `TonesPage.tsx:558-564` — "All" button repeats opaque-label issue.
- `TonesPage.tsx:623-625` — `<div className="card text-center py-12 text-s330-muted">Select a tone to edit</div>`. Same auto-select rule deviation.
- `TonesPage.tsx:632-638` — empty-state card with hand-rolled `text-center py-12` instead of a documented "empty state" primitive. `py-12` is magic spacing.
- `TonesPage.tsx:521-526` — header has a mixed-rhythm row: `<h2>` next to `<span className="text-sm text-s330-muted">{loadedTones.length} of {totalTones} loaded</span>`. No documented header-status component pattern; cross-cutting consistency gap.
- TonesPage instantiates four separate dialogs in JSX (`ExportToneDialog`, `ImportSampleDialog`, `SampleChopperDialog`, plus the loop editor wired into `ToneEditor`). All four share the centred-modal anti-pattern.
- `TonesPage.tsx:73-93, 94-98` — sixteen `useState` calls in one page is a "god-component" smell. Decomposition required by workplan Task 3 should target these.

### PlayPage (`modules/roland-sxx0-editor/src/pages/PlayPage.tsx`, 465 lines)

- `PlayPage.tsx:250,266` — `text-xl font-bold text-s330-text` heading pattern. Typography deviation.
- `PlayPage.tsx:251,277,281,316` — body/label text uses `text-s330-muted`.
- `PlayPage.tsx:269-278` — third inline hand-rolled progress bar.
- `PlayPage.tsx:271` — `bg-s330-bg` for the progress track on PlayPage but `bg-s330-panel` on PatchesPage:216 and TonesPage:531 — inconsistent track color across pages for what should be the same primitive.
- `PlayPage.tsx:281-303` — page-level "(Re)load: P11-P18 / P21-P28" toolbar. Same CRUD Affordances violation. The two banks are also hardcoded literals — Multi-Device Architecture violation (S-330-only correct).
- `PlayPage.tsx:310-321` — `bg-s330-panel border border-s330-accent rounded-md` outer container is hand-styled; bespoke shell.
- `PlayPage.tsx:312` — `font-mono text-sm` applied at the parts-grid level. `text-sm` does not flow from `--ac-text-*` tokens.
- `PlayPage.tsx:314-321` — header row uses `grid-cols-12` with `col-span-1`/`col-span-4`. Labels `VAL`, `CH`, `Patch`, `Out`, `Level` — `VAL` is opaque; `CH`/`Out` are jargon.
- `PlayPage.tsx:336` — `{part.active ? '*' : ''}` uses literal asterisk for active state. Icon Consistency rule's spirit violated; should be a status dot/icon.
- `PlayPage.tsx:330-332` — `font-bold` applied via Tailwind rather than `--ac-font-weight-*` tokens.
- `PlayPage.tsx:341-409` — `<select>` elements use long Tailwind class chains repeated four times. No `ac-select` primitive; DRY violation.
- `PlayPage.tsx:414-440` — level slider uses 12 lines of `[&::-webkit-slider-thumb]` arbitrary CSS-in-Tailwind selectors. Hardcodes `w-3` / `h-3` thumbs without tokens. No `ac-range` primitive yet.
- `PlayPage.tsx:417-418` — `min={0} max={127}` inline. `127` is a MIDI magic number.
- `PlayPage.tsx:441-443` — `w-8 text-right text-xs text-s330-text font-mono` for value display. `w-8` (2rem) is a hardcoded width.
- `PlayPage.tsx:458-462` — secondary loading indicator implemented inline with hand-rolled tailwind classes. Per Progress and Feedback there should be one shared spinner component.
- **Missing affordance:** there is no "All Notes Off" / "PANIC" button on PlayPage in the current code. Workplan Task 4 ("PlayPage — performance UI hierarchy, panic/all-notes-off labelling") implies one is intended.

### WorkflowsPage (`modules/roland-sxx0-editor/src/pages/WorkflowsPage.tsx`, 140 lines)

- `WorkflowsPage.tsx:20,94` — uses `ac-page` (no `ac-page-shell`). Layout Rules table requires `ac-page-shell` on all pages. Both `WorkflowHub` and `LoopEditorWorkflow` violate this.
- `WorkflowsPage.tsx:21-23,95-97` — page header is `<div className="ac-page-header">` *without* the wrapping `ac-page-sticky-header`. Inconsistent header rhythm.
- `WorkflowsPage.tsx:22,97` — same `text-xl font-bold text-s330-text` heading.
- `WorkflowsPage.tsx:24-33` — workflow card grid uses `card` (good), but card headings are `<h3 className="font-medium text-s330-text">` and descriptions `<p className="text-sm text-s330-muted">`. Should be `text-gray-200` / `text-gray-400`.
- `WorkflowsPage.tsx:26-33` — only card has `hover:` affordance; **`:focus` style is missing** — keyboard users see no feedback. Accessibility violation.
- `WorkflowsPage.tsx:24` — `gap-4` (1rem) instead of `--ac-space-*` token.
- `WorkflowsPage.tsx:62-78` — WAV parsing skips a literal `44`-byte header. Magic number (outside visual scope but worth noting).
- `WorkflowsPage.tsx:96-108` — header layout doesn't match Patches/Tones/Play headers' flex-1 right-aligned cluster; uses flat `flex items-center gap-4`.
- WorkflowsPage does not render a "not connected" guard; asymmetric vs other pages.
- The page contains no progress UI, even though `useLoopDetection` exposes `progress` to `LoopEditor`.

### LibraryPage (`modules/roland-sxx0-editor/src/pages/LibraryPage.tsx`, 394 lines)

- `LibraryPage.tsx:232,245` — `text-xl font-bold text-s330-text` heading.
- `LibraryPage.tsx:233` — `text-s330-muted` body text.
- `LibraryPage.tsx:246` — `Experimental` pill: `text-xs px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30`. Hand-rolled badge with no DESIGN-SYSTEM equivalent. Yellow palette is outside both `s330-*` and `--ac-status-*` tokens — introduces a new color identity. `cursor-help` with a `title=` tooltip is the only affordance — no visible info icon.
- `LibraryPage.tsx:249-251` — three header buttons: `Refresh Device`, `Save to Library...`, `Load Selected Set`. "Refresh Device" toolbar button violates CRUD Affordances rule.
- `LibraryPage.tsx:258` — `<div className="h-[calc(100vh-12rem)]">`. `12rem` is a magic offset compensating for header height; brittle.
- `LibraryPage.tsx:230-237` — "Not Connected" card with `Go to Connection` linking to `/` — same Connection UI rule violation.
- `LibraryPage.tsx:243-247` — header has `<h2>` plus an experimental pill. Visual pattern unique to this page.
- `LibraryPage.tsx:281-292` — `headerSections` slot composes `SetsSection`. Without reading `SetsSection` itself it isn't possible to flag deviations there; interface boundary is clean.

### Dialogs (`modules/roland-sxx0-editor/src/components/library/*Dialog.tsx`)

#### Cross-cutting dialog issues

- **All dialogs are hand-rolled "centred modals," not the prescribed primitives.** Anti-Patterns table: "Custom centered modal dialogs → Do Instead: `SlideDrawer`" / "Custom modal for progress → Do Instead: `SteppedProgressDrawer`." Affected files: `ExportPatchDialog.tsx:91`, `ExportToneDialog.tsx:84`, `ImportLibraryToneDialog.tsx:242`, `ImportLibraryPatchDialog.tsx`, `ImportSampleDialog.tsx:157`, `ImportSamplesDialog.tsx:184`, `ImportToneDialog.tsx:66`, `LoadSetDialog.tsx:87`, `SaveSetDialog.tsx:54`, `CreateDirectoryDialog.tsx:75`, `RenameDirectoryDialog.tsx`. Exceptions (using correct primitives): `DeleteDirectoryDialog` wraps `ConfirmDialog`; `MoveItemDialog` uses `MoveDialog`.
- **Dialog title typography deviates.** Every dialog uses `text-lg font-bold text-s330-text mb-4` for `Dialog.Title`. Spec is `text-lg font-semibold text-gray-200`.
- **Helper-text color scheme is inconsistent.** Dialogs alternate between `text-s330-muted` (labels, descriptions) and `text-s330-text` (input/value text). Spec: `text-gray-400` / `text-gray-500`.
- **Form input chrome is hand-rolled and copy-pasted.** Long `cn('w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text', 'focus:outline-none focus:ring-2 focus:ring-s330-highlight', isOperating && 'opacity-50')` chain duplicated literally in: `ExportPatchDialog.tsx:124-128`, `ExportToneDialog.tsx:117-122`, `ImportLibraryToneDialog.tsx:325-329, 348-355, 391-394, 411-414`, `ImportSampleDialog.tsx:245-249, 266-270, 289-293, 309-313, 338-342`, `ImportSamplesDialog.tsx:271-275, 294-298, 331-335, 351-355, 425-430`, `LoadSetDialog.tsx:117-121`, `SaveSetDialog.tsx:83-90, 112-118`, `CreateDirectoryDialog.tsx:102-106`. Indicates DESIGN-SYSTEM is missing `ac-input` / `ac-select` primitives.
- **Progress bars in dialogs are hand-rolled in some places, abstracted via `OperationProgressBar` in others.** `OperationProgressBar` is the right shape; `SaveSetDialog.tsx:124-134` reverts to a hand-rolled bar plus its own status format.
- **Error/success banners inconsistent.** `OperationErrorBanner` and `OperationSuccessScreen` exist (used in most dialogs), but `SaveSetDialog.tsx:139-151` re-implements both inline (`p-3 bg-green-500/10 border border-green-500/30` for success, `p-3 bg-red-500/10 border border-red-500/30` for error). Same in `LoadSetDialog.tsx:154-160` for success.
- **No dialogs implement keyboard focus management beyond `autoFocus`.** Tab-trap testing missing; `ImportSampleDialog.tsx`'s file-picker pseudo-button does not visibly indicate focus state.
- **Dialog size scale is per-dialog, not per-content.** `LoadSetDialog`, `ImportLibraryToneDialog`, `ImportLibraryPatchDialog`, `ImportSamplesDialog` use `max-w-2xl`; `SaveSetDialog`, `ExportToneDialog`, `ExportPatchDialog`, `ImportSampleDialog`, `ImportToneDialog`, `CreateDirectoryDialog`, `RenameDirectoryDialog` use `max-w-md`. No documented size scale.
- **Header/body/footer rhythm inconsistent.** Title margin sometimes `mb-4`, sometimes implied larger. Footer button order is `Cancel | Action` (good) but Cancel variant differs across dialogs — `ac-btn-secondary` in `SaveSetDialog.tsx:167`; `ac-btn-ghost` in `ExportPatchDialog.tsx:181`, `ExportToneDialog.tsx:165`, `ImportSampleDialog.tsx:362`, `ImportSamplesDialog.tsx:509`, `ImportLibraryToneDialog.tsx:443`. "Done" button on success is sometimes inside `Dialog.Close asChild`, sometimes a direct `onClick={handleClose}`.

#### `DeleteDirectoryDialog.tsx`

- `:121-167` — uses inline `style={{ ... }}` for almost every element. Layout Rules forbid magic numbers. Examples: `style={{ margin: '0 0 0.5rem' }}` (line 121), `style={{ fontSize: '0.875rem', fontFamily: 'monospace', margin: '0 0 1rem' }}` (line 125), inline-built spinner with `animation: 'spin 1s linear infinite'` (line 132), `style={{ width: '0.75rem', height: '0.75rem' }}` on an SVG (line 148). Icon Sizes rule: "Always use CSS classes for icon sizing, never inline `style` attributes" + 1rem floor.
- `:146-152` — folder SVG drawn inline rather than using `FolderIcon` from shared `TreeIcons`.
- `:131-137` — inline spinner; no shared spinner primitive.

#### `ImportSampleDialog.tsx`

- `:158` — title hardcodes `T{toneIndex + 11}`. The `+11` adapts S-330 slot numbering; on S-550 the format differs. Multi-Device Architecture violation; should come from `memoryLayout.formatToneSlot`.
- `:188-204` — file-drop area is a styled `<button>` with `border-2 border-dashed`. Hand-rolled drop zone; `py-8` is magic spacing.
- `:315` — segment `<option>` upper bound hardcoded as `18 - segmentsNeeded + 1`. Literal `18` is the S-330 segment count; should come from `memoryLayout`.
- `:294-297` — "Bank A" / "Bank B" hardcoded; S-550 has banks A–D.
- `:323-325, 365-367, 425-427` — small print warnings: `<p className="text-xs text-s330-muted -mt-2">`. Negative margin is magic.

#### `ImportLibraryToneDialog.tsx`

- `:242` — `max-h-[90vh]` is an arbitrary Tailwind value; not in any documented token.
- `:357-368` — slot select `<option>` text builds slot labels via hand-rolled template. Parity issue with `ImportSamplesDialog.tsx:300-311` (different format string for the same purpose).
- `:371-377` — inline warning SVG (`<svg className="w-3 h-3">…</svg>`). `w-3` = 0.75rem, below the 1rem floor.

#### `ImportLibraryPatchDialog.tsx`

Same patterns as `ImportLibraryToneDialog.tsx`. Manages tone-import mappings in local state with hand-rolled rows; structurally large enough to be a decomposition target.

#### `ImportSamplesDialog.tsx`

- `:184` — `max-w-2xl p-6 max-h-[90vh] overflow-y-auto` — same `max-h-[90vh]` magic.
- `:382-383, 399-400` — checkbox styling (`w-4 h-4 rounded bg-s330-bg border-s330-accent/50 text-s330-highlight focus:ring-s330-highlight`) hand-rolled per checkbox. No `ac-checkbox` primitive.
- `:391` — outer container for monolithic-mode toggle: `border border-s330-accent/30 rounded p-3 bg-s330-bg/50`. Hand-rolled "panel within a dialog" pattern.
- `:464-496` — "Allocation Preview" uses `bg-s330-bg rounded p-3` plus `text-xs uppercase tracking-wide`. The uppercase/tracking pattern recurs across dialogs (`ImportLibraryToneDialog.tsx:265`, `ImportSamplesDialog.tsx:214,465`, `LoadSetDialog.tsx:101`) — missing `ac-section-eyebrow` primitive.

#### `SaveSetDialog.tsx`

Biggest single offender for re-implementing primitives that already exist (`OperationProgressBar`, `OperationSuccessScreen`, `OperationErrorBanner`). Detailed in cross-cutting findings above.

#### `LoadSetDialog.tsx`

- `:140-145` — inline yellow-warning banner: `p-3 bg-yellow-500/10 border border-yellow-500/30 rounded`. Same yellow palette as the LibraryPage `Experimental` pill.
- `:100-105` — "Loading Set" eyebrow uses `text-xs text-s330-muted uppercase tracking-wide` — same eyebrow pattern.
- `:130-137` — `MemoryMapPanel` invocation; panel is out of scope for this audit. Workplan Task 5 calls out verifying `bg-s330-accent/20`, `bg-emerald-600/60`, `bg-s330-highlight/40`, `bg-red-500/40` in the polished context.

#### `CreateDirectoryDialog.tsx` and `RenameDirectoryDialog.tsx`

- `CreateDirectoryDialog.tsx:74-75` — `bg-black/60 backdrop-blur-sm` overlay. Other dialogs use `bg-black/50` (no blur). Inconsistent overlay treatment.
- `:88` — preview text uses `text-s330-highlight` for in-progress folder name. Inline; no documented `ac-text-highlight` token.
- Both dialogs use `card p-6` inside `Dialog.Content` rather than the standard dialog chrome — different shell from import/export dialogs.

#### `MoveItemDialog.tsx`

Uses the shared `MoveDialog` from `editor-core` — good. No direct violations.

#### `ImportToneDialog.tsx`

- `:38` — `totalSlots = 32` default parameter. Magic number defaulting to S-330's tone count (which is also wrong if interpreted as total — S-330 has 32 tones, S-550 has 64). Multi-Device Architecture violation: a default value embedded in a UI component must come from a factory/config, not a hardcoded literal.

---

## Part B — audiocontrol.org visual-identity alignment

### Source-of-truth for the public site

- **Stack:** [Astro](https://astro.build) v5 (static, deployed on Netlify). Two Astro configs in the repo (`astro.audiocontrol.config.mjs`, `astro.editorialcontrol.config.mjs`) — audiocontrol.org and editorialcontrol.org are sibling sites in the same monorepo, sharing `src/shared/` and a brand contract (`src/shared/brand.ts`).
- **CSS approach:** plain CSS with CSS custom properties (HSL tokens) and component-scoped `<style>` blocks in Astro components. **No Tailwind**, no PostCSS framework, no CSS-in-JS. Tokens live in a single design-tokens stylesheet plus a typed `brand.ts` mirror.
- **Type-safe brand contract:** `src/shared/brand.ts` defines `BrandColors`, `BrandTypography`, and `Brand` interfaces. Each site (`audiocontrol`, `editorialcontrol`) ships its own `brand.ts` that conforms — values are HSL fragments (e.g. `"30 12% 7%"`) so they can compose with alpha via `hsl(var(--primary) / 0.5)`.
- **Self-hosted fonts** (`/fonts/*.woff2`) — no Google Fonts CDN at runtime.

Relevant files in `oletizi/audiocontrol.org`:

- [`src/shared/brand.ts`](https://github.com/oletizi/audiocontrol.org/blob/main/src/shared/brand.ts) — interface
- [`src/sites/audiocontrol/brand.ts`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/brand.ts) — values
- [`src/sites/audiocontrol/styles/design-tokens.css`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/styles/design-tokens.css) — CSS custom properties + utility classes
- [`src/sites/audiocontrol/styles/prose.css`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/styles/prose.css) — long-form typography scale
- [`src/sites/audiocontrol/layouts/Layout.astro`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/layouts/Layout.astro) — heading defaults + atmospheric body classes
- [`src/sites/audiocontrol/components/Header.astro`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/components/Header.astro) — sticky scroll-compress header
- [`src/sites/audiocontrol/components/DeviceCard.astro`](https://github.com/oletizi/audiocontrol.org/blob/main/src/sites/audiocontrol/components/DeviceCard.astro) — primary card pattern

The site's stated aesthetic, in its own words (comment at top of `design-tokens.css`):

> Aesthetic direction: service-manual / flight-instrumentation. Warm-ink background, warm cream foreground, phosphor amber primary, Roland-blue accent. Display typography rides on Departure Mono (Apollo-era pixel mono) for the identity voice; body reads on IBM Plex Sans; JetBrains Mono continues to carry code and tabular meta.

### Typography

- **Three font families, three roles:**
  - `--font-display` = `"Departure Mono", ui-monospace, …` — h1, h2, eyebrow labels, ticker text, figure captions, table headers. The "identity voice."
  - `--font-body` = `"IBM Plex Sans", system-ui, …` — body, h3, h4, UI. Weights 400 / 500 / 600 / 700.
  - `--font-mono` = `"JetBrains Mono", ui-monospace, …` — code, tabular meta, ordered-list markers.
  - `--font-heading` aliases `--font-display`.
- **Base size:** `font-size: 16px` on `html`. Body `line-height: 1.72` inside `.prose`.
- **Heading scale:**
  - h1: `clamp(1.75rem, 3.4vw, 2.35rem)`, weight 400, line-height 1.18, **Departure Mono**
  - h2: `1.45rem`, weight 400, line-height 1.2, Departure Mono — has a **2.25rem × 2px amber underline pseudo-element** (`::before`, `box-shadow: 0 0 8px hsl(var(--primary) / 0.35)`)
  - h3: `1.15rem`, weight 600, **IBM Plex Sans**
  - h4: `1rem`, weight 600, IBM Plex Sans
  - h5/h6: `0.78rem`, Departure Mono, **uppercase, letter-spacing 0.12em**, color = muted-foreground (eyebrow labels, not real headings)
- **Letter-spacing:** display headings use `0.01em`; small-caps eyebrow labels use `0.12em`–`0.14em`. Body keeps `0`.
- **Weight philosophy:** display headings are always 400 (reads as the identity voice on a pixel mono); subheads use weight 600 in IBM Plex Sans.

### Layout rhythm

- **Container:** `--container-max-width: 1400px`, `--container-padding: 2rem`. Reusable as `.site-container`.
- **Reading measures:** `--measure-reading: 36rem` (long-form prose), `--measure-narrow: 28rem` (essays / pull quotes). `.prose--wide` opts out.
- **Section spacing:** prose paragraphs `1.25rem` bottom margin; h2 `2.75rem` top / `1rem` bottom; h3 `2rem` top / `0.65rem` bottom.
- **Page header:** sticky bar with backdrop-blur + saturation, **scroll-compress** (vertical padding shrinks `1.25rem` → `0.75rem` past 10px scroll, tagline fades, border-bottom transitions to full opacity). Hamburger collapses nav at `<720px`.
- **Z-index stack:** content at `z-index: 3`; atmosphere overlays (grain `9998`, scanlines `9999`) above content but `pointer-events: none`.
- **Three rule weights formalized as tokens:** `--rule-hairline: 1px`, `--rule-medium: 2px`, `--rule-heavy: 3px`. Six rule utilities (`.rule-hairline`, `.rule-double`, `.rule-accent`, `.rule-ticked`, plus `.dimension-bracket`).

### Component vocabulary

- **`.panel-label` / `.panel-label--accent`** — eyebrow text. Departure Mono, `0.75rem`, uppercase, tracking `0.14em`. Accent variant uses phosphor-amber + glow shadow.
- **`.dimension-bracket`** — section opener with corner hairlines (top-left and top-right L-shapes drawn via `::before` / `::after`, 18×18px, 2px stroke, amber at 60% alpha).
- **`.signal-led`** — 8px round amber dot with phosphor-glow shadow, pulses on a 2.4s cycle. Status lamp.
- **`.phosphor`** — primary-amber color + `--phosphor-glow` text-shadow.
- **`.card-glow` / `.card-glow-hover`** — boxed shadow tokens. Default: `0 0 0 1px hsl(var(--border)), 0 10px 36px -12px hsl(0 0% 0% / 0.65)`. Hover: amber-tinted ring + amber-tinted drop shadow at 18%.
- **DeviceCard** (the dominant content card) — anchor element; `1rem 1.25rem` body padding; optional 21:10 image at top; name `1.1rem` bold; description `0.9rem` muted with `1.5` line-height. Hover: border becomes accent.
- **Atmosphere layers** (global via `<body>` classes): `.atmosphere-vignette` (radial gradient, warm amber-cast top), `.atmosphere-grain` (3×3px dot pattern, `opacity: 0.035`, `mix-blend-mode: overlay`), `.atmosphere-scanlines` (2px transparent + 1px black-at-6%, `mix-blend-mode: multiply`).
- **`.ticker`** — masthead/footer marquee. Departure Mono, `0.75rem`, uppercase, tracking `0.12em`, 80s linear infinite scroll.
- **Links (global):** `color: hsl(var(--primary))`, no underline by default; hover adds underline. In `.prose`, link gets a `1px` amber underline at 35% alpha by default that goes solid on hover (`border-bottom`, not `text-decoration`).
- **Selection color:** `hsl(var(--primary) / 0.35)` — amber-tinted highlight.
- **Reduced-motion guards** on `.signal-led`, `.animate-pulse-glow`, `.ticker-track`.

### Color (informational — editor keeps `s330-*` palette)

All colors stored as HSL fragments (no `hsl()` wrapper) so they compose with alpha. The site is **dark-only** (`color-scheme: dark`).

| Token | HSL value | Role |
|---|---|---|
| `--background` | `30 12% 7%` | Warm near-black, faint amber cast |
| `--card` | `30 14% 11%` | Card surface |
| `--card-hover` | `30 14% 14%` | Card hover |
| `--foreground` | `35 18% 88%` | Warm cream off-white |
| `--muted-foreground` | `30 10% 55%` | Secondary text |
| `--primary` | `35 95% 62%` | Phosphor amber — VFD / flight-instrument signature |
| `--accent` | `215 55% 55%` | **Roland-blue** — used sparingly |
| `--border` | `30 10% 18%` | Hairline default |
| `--border-hover` | `30 10% 28%` | Hairline emphasis |
| `--badge-available` | `152 55% 55%` | Available status |
| `--badge-available-bg` | `152 40% 13%` | Available badge fill |
| `--badge-coming` | `35 80% 55%` | "In development" status |
| `--badge-coming-bg` | `30 14% 14%` | "In development" badge fill |

**Important:** the parent site already designates `--accent: 215 55% 55%` (Roland blue) and uses it sparingly. The S-330/S-550 editors' blue+white identity is therefore *not* alien to the brand — it's the same accent semantic the parent site nods to, just promoted from accent-of-restraint to dominant-color in the editor context.

### What the editors should adopt

These are recommendations only — implementation belongs to a downstream `/frontend-design` task. Each item traces to a concrete public-site characteristic.

- [ ] **Three-font role split** — Departure Mono for display/eyebrows, IBM Plex Sans for body/forms/UI labels, JetBrains Mono for code and numeric/tabular values (parameter readouts, hex, byte counts). Self-host the woff2 files.
- [ ] **Heading family + weight convention** — h1/h2 in Departure Mono at weight 400, h3/h4 in IBM Plex Sans at weight 600, h5/h6 as uppercase tracked eyebrow labels at `0.78rem` Departure Mono. Gives the editor headings the same voice as audiocontrol.org.
- [ ] **Eyebrow-label idiom (`panel-label`)** — Departure Mono, `0.75rem`, uppercase, letter-spacing `0.14em`. The editor already uses uppercase small labels on `ParamKnob`; aligning typography makes them readable as the same component family. Replaces the audit's "missing `ac-section-eyebrow` primitive" finding.
- [ ] **Heading-rule motif on h2** — short blue 2px underline pseudo-element with subtle box-shadow glow (`hsl(var(--ac-color-accent) / 0.35)`). Same pattern as audiocontrol.org's amber rule, recolored.
- [ ] **Rule-weight token system** — `--rule-hairline / --rule-medium / --rule-heavy` (1/2/3px). Editor has many dividers; formalizing three weights matches the parent-site rhythm.
- [ ] **Dimension-bracket section opener** as an *option* for top-of-page section titles. L-bracket motif works as well in blue as amber.
- [ ] **Container token** — `--ac-container-max-width: 1400px`, `--ac-container-padding: 2rem`. Full-bleed grids stay full-bleed; landing/empty states and modal content respect the measure.
- [ ] **Reading-measure tokens** — `--measure-reading: 36rem`, `--measure-narrow: 28rem`. Useful for docs panels, About page, error-state copy.
- [ ] **HSL-fragment + alpha-composition** — store color tokens as `H S% L%` fragments, then use `hsl(var(--ac-color-accent) / 0.35)` for tinted variants. Unlocks parent-site-style alpha-blending for hover states, glows, selections.
- [ ] **`card-glow` shadow vocabulary** — two-stop shadow (1px hairline ring + soft drop shadow); hover variant swaps the ring color to accent at ~35% alpha. Editor's list items + parameter cards benefit.
- [ ] **Link convention from `.prose`** — accent-colored text with subtle `1px` border-bottom at ~35% alpha that goes solid on hover. Reads better than `text-decoration: underline` in dense UIs.
- [ ] **Selection-color token** — selection highlight = `hsl(var(--ac-color-accent) / 0.35)` (blue at 35%, not amber).
- [ ] **Reduced-motion guard** — every animated element wrapped in `@media (prefers-reduced-motion: reduce)`.
- [ ] **Optional: backdrop-blur scroll-compress sticky header.** DESIGN-SYSTEM.md §10 (progressive disclosure at narrow viewports) is a sibling idea; could fold into the same compression model.

### What the editors should keep different

- [x] **`s330-*` Tailwind color palette (blue + white)** — non-negotiable, per workplan.
- [x] **No phosphor amber as dominant accent** — every place audiocontrol.org uses amber (headings, links, signal LEDs, h2 rules, glows) the editor uses its `s330` blue.
- [x] **Light scheme remains permissible.** Parent site is dark-only; the editor is currently white-background. Alignment is via tokens + typography, not via dark-mode-everywhere.
- [x] **Tailwind in the editor stays.** Token names and type scale numbers should correspond; Tailwind tokens can point at the same CSS custom properties.
- [x] **No atmosphere layers** (vignette / grain / scanlines) in the editor — they would interfere with signal/control density.
- [x] **`--ac-` token namespace stays** — don't rename to match parent's unprefixed tokens; have `--ac-*` reference the same numeric values where alignment matters (font families, spacing scale, container measures).

---

## Part C — Cross-cutting themes

Sixteen themes spanning pages and dialogs, each ones the `/frontend-design` exploration in Task 2 should address as a single decision rather than per-component.

1. **Wrong color tokens for typography.** Codebase uses `text-s330-text` / `text-s330-muted` / `text-s330-highlight` for *all* text including body and helper text. Typography rule prescribes the gray scale; `s330-*` is for color identity. Every page and dialog needs migration to the gray scale.
2. **`text-xl font-bold` page headers vs `text-lg font-semibold` documented.** Every page uses the same wrong heading. Single fix at the design-token / shared header primitive level.
3. **Hand-rolled progress bars** duplicated three times across PatchesPage, TonesPage, PlayPage, plus inside SaveSetDialog. None include bytes/elapsed/ETA/current-item per Progress and Feedback rule. Need one shared progress primitive.
4. **`Go to Connection` link to `/`** in every "not connected" empty state. Connection UI rule says connection is a `SlideDrawer`, not a route. PatchesPage, TonesPage, PlayPage, LibraryPage.
5. **Page-level `(Re)load` button toolbars** on PatchesPage, TonesPage, PlayPage. Conflicts with CRUD Affordances "List-Level Actions" rule — refresh belongs on the list title.
6. **Hand-rolled centred-modal dialogs** instead of `SlideDrawer`. Affects every import/export/save/load/create/rename dialog.
7. **Form input/select chrome copy-pasted** across all dialogs; no `ac-input` / `ac-select` primitive. Need primitives in `editor-core/src/design/library.css` and migration of all dialogs.
8. **Magic spacing values:** `max-w-xs`, `max-w-2xl`, `max-h-[90vh]`, `h-[calc(100vh-12rem)]`, `mt-0.5`, `-mt-2`, `py-8`, `py-12`, `gap-4`. Layout Rules require `--ac-space-*` tokens.
9. **Yellow warning palette** introduced by LibraryPage's "Experimental" pill and LoadSetDialog's overwrite warning. Outside both `s330-*` and `--ac-status-*` token sets. Per workplan: new tokens land in `tokens.css` and are documented in DESIGN-SYSTEM.md before use.
10. **Inline SVG icons drawn at sub-1rem sizes** (`w-3 h-3` = 0.75rem in `ImportLibraryToneDialog`, `DeleteDirectoryDialog`). Icon Sizes rule sets a 1rem floor and forbids inline `style` for sizing.
11. **Device-specific literals embedded in UI:** `P11-P18 / P21-P28` in PlayPage; `T{toneIndex+11}` in ImportSampleDialog; "Bank A / Bank B" hardcoded; segment count `18` hardcoded; `totalSlots = 32` default. Multi-Device Architecture rule: everything must come from `memoryLayout`/`config`.
12. **Eyebrow / section-label pattern (`text-xs uppercase tracking-wide`) repeated** in many dialogs without a shared primitive. audiocontrol.org's `.panel-label` is the canonical answer.
13. **Empty-state cards** ("Select a patch to edit", "Select a tone to edit") shown when items are available — violates "Never show empty state when data exists or is loading." Should auto-select first item.
14. **Multiple inline spinners** (PlayPage, DeleteDirectoryDialog, OperationLoadingSpinner). No single shared spinner primitive.
15. **Inconsistent Cancel-button variant** (`ac-btn-secondary` in some dialogs, `ac-btn-ghost` in others). Same role, different affordance.
16. **`TonesPage.tsx` is 691 lines** (workplan Task 3 — confirmed; needs decomposition under 500).

---

## Part D — Open questions

These need operator decisions before Task 2's `/frontend-design` exploration can land cleanly.

1. **Is the editor dark, light, or both?** DESIGN-SYSTEM.md §10 mentions `text-gray-200` (which on a white background would be near-invisible), implying parts of the editor are dark-themed already. Parent site is dark-only. Decision affects every typography rule we adopt.
2. **Self-hosting fonts vs Google Fonts:** parent site self-hosts woff2 in `/fonts/`. Should the editors do the same? Self-hosting is faster and avoids CDN dependence but adds repo bytes. Recommend matching the parent site (self-host).
3. **Do the editors need their own `brand.ts` mirror?** If the editor lives under `audiocontrol.org/roland/s330/editor`, defining a third `Brand` (e.g. `editor-roland`) that shares typography with the parent and overrides only `colors.primary` (to `s330` blue) would express "same family, different accent" cleanly. More architectural than visual.
4. **Two h2 idioms compatible?** Parent's h2 uses Departure Mono + amber rule pseudo-element. If the editor adopts both the font and the rule (in blue), confirm this doesn't conflict with the existing `s3k-section` heading pattern referenced in DESIGN-SYSTEM.md § Parameter Editors.
5. **Editor header treatment vs parent's.** The parent's sticky scroll-compress + hamburger could either replace the editor's header or stay parent-only. Need a comparison to decide.
6. **Reading measure for in-editor docs/help panels.** Editor likely has "About" / "Help" / error-state copy — should it use `--measure-reading: 36rem`? Probably yes; worth confirming the editor has surfaces that would benefit.
7. **Promote `panel-label` (`text-xs uppercase tracking-wide`) to a shared primitive?** Cross-cutting theme #12 + audiocontrol.org's `.panel-label` converge on the same answer; confirm naming (`ac-panel-label`? `ac-section-eyebrow`?).
8. **`SlideDrawer` migration scope.** Anti-Patterns rule requires SlideDrawer for centred modals. Eleven dialogs would migrate. Is the SlideDrawer primitive ready for all of them (file pickers, multi-row import forms, progress drawers), or do we need to extend it first?

---

## Part E — Next step

Phase 9 Task 2 — invoke the `frontend-design:frontend-design` skill with this audit as input, plus screenshots of the current pages and the audiocontrol.org public site, to produce candidate mockups for the redesigned Home / Patches / Tones / Play / Workflows / Library pages and the dialog family. Stash explorations under `docs/1.0/001-IN-PROGRESS/s550-support/explorations/`. Operator reviews and selects a direction; the chosen direction's notes get committed back into this file as a new "Direction" section before Task 3 (TonesPage decomposition) begins.

Per workplan Phase 9 constraints: every UI change in this phase is produced through `/frontend-design`. This audit is the only hand-authored deliverable in Phase 9; everything downstream comes from the plugin.
