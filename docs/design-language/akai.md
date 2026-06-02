# Design language — Akai S3000XL editor

> The durable home for the Akai editor's visual identity. This is **intent
> and rationale**; the **canonical pixels** live in the living styleguide
> gallery (Phase 3 task P3.4 — see "Canonical pixels" at the bottom).
>
> Every token / class cited below was grep-verified to exist at author time.
> Where the Akai editor's realized identity diverges from the Roland editor's
> richer vocabulary, this spec describes only what the Akai surface actually
> uses — it does not borrow Roland signature elements the Akai editor has not
> adopted.

Editor surface: `https://audiocontrol.org/akai/s3000xl/editor`. The module is
`modules/akai-s3k-editor/`. `main.tsx` sets
`document.documentElement.dataset.editor = 's3000xl'`, which selects the
`:root[data-editor='s3000xl']` palette block in
`modules/editor-core/src/design/tokens.css`. The Akai-specific component
vocabulary is the `.s3k-*` class family in
`modules/akai-s3k-editor/src/index.css`.

---

## Palette

The Akai identity is **amber / gold on warm-neutral charcoal** — distinct from
the Roland blue-on-slate. All surface + accent tokens are the `--ac-*`
properties in the `:root[data-editor='s3000xl']` block of
`modules/editor-core/src/design/tokens.css`.

| Role | Token | Value | Notes |
|------|-------|-------|-------|
| Brand / accent | `--ac-color-accent` | `#d4a843` | Akai amber/gold — the editor's identity color. Distinct from the Roland blue. |
| Selected | `--ac-color-selected` | `#d4a843` | Matches the accent. |
| Canvas surface | `--ac-color-surface-canvas` | `#111214` | Warm-neutral charcoal page background. |
| Panel surface | `--ac-color-surface-panel` | `#1a1c20` | Lifted card surface. |
| Subtle border | `--ac-color-border-subtle` | `#2e3138` | Hairline panel borders. |
| Primary text | `--ac-color-text-primary` | `#e8e6e3` | Warm off-white (vs the Roland cool `#f1f5f9`). |
| Muted text | `--ac-color-text-muted` | `#8a8d93` | Labels, eyebrows. |
| Success | `--ac-color-success` | `#4ade80` | |
| Warning | `--ac-color-warning` | `#e0b24f` | |
| Danger | `--ac-color-danger` | `#fb7185` | Error states. |

**Why a different surface palette:** the per-device
`:root[data-editor='...']` override block is the sanctioned mechanism for
per-editor surface identity (DESIGN-SYSTEM.md § Color Palette Preservation —
"Per-device overrides keep each editor's surface palette. Add new editors by
extending this block, not by branching component CSS."). The S3000XL's warm
amber-on-charcoal reads as the Akai counterpart to the Roland blue-on-slate;
the warm text color (`#e8e6e3`) and warm border (`#2e3138`) reinforce it.

The `.s3k-*` component CSS references the accent with a literal fallback —
e.g. `var(--ac-color-accent, #d4a843)` and
`var(--ac-color-text-primary, #e5e7eb)` throughout
`modules/akai-s3k-editor/src/index.css`. The token is the source of truth; the
inline literal is the legacy fallback only.

---

## Typography

The Akai editor uses two of the shared roles and one **local** mono stack:

| Role | Source | Used by |
|------|--------|---------|
| UI / body | `--ac-font-body` (set on `body` in `modules/akai-s3k-editor/src/index.css`) | Prose, body copy. |
| Labels (uppercase) | `.s3k-param-label` / `.s3k-section-title` in `index.css` | Parameter + section labels: uppercase, `letter-spacing: 0.05em`, muted color. |
| Data / numeric | local `ui-monospace, 'Cascadia Code', 'Fira Code', monospace` | Editable numeric values (`.s3k-param-value`, `.s3k-param-input`) and tab labels. |

**Honest divergence — flagged, not fabricated:** the Akai editor does **not**
yet consume the editor-core v3 display/mono tokens (`--ac-font-display`,
`--ac-font-mono`) for its numeric readouts; `.s3k-param-value` declares a
local `ui-monospace, 'Cascadia Code'…` stack in
`modules/akai-s3k-editor/src/index.css`, and `.s3k-param-label` uses a
hardcoded `0.05em` letter-spacing rather than `--ac-tracking-eyebrow`. This is
described as the as-built reality, not endorsed as the target. A future
typographic-alignment pass would migrate these to the shared tokens; until
then, the local stack is what the Akai surface renders.

---

## Signature / branded components

Each entry: what it is, the real class that renders it, and WHY it exists.

### Dense parameter grid — `.s3k-section` / `.s3k-section-grid`

**What:** a multi-column parameter grid (not one-parameter-per-row forms),
with section titles and an optional `--wide` variant.

**Where:** `.s3k-section`, `.s3k-section-grid` (+ `--wide`),
`.s3k-section-title`, `.s3k-section-header-content` in
`modules/akai-s3k-editor/src/index.css`.

**Why:** the S3000XL exposes many per-keygroup parameters; a dense grid packs
them legibly. Source: DESIGN-SYSTEM.md § Parameter Editors → Dense Grid
Layout.

### Parameter row — `.s3k-param`

**What:** a parameter control showing an uppercase label, a value track with
an accent fill (and a center marker for bipolar params), and a click-to-edit
numeric value.

**Where:** `.s3k-param`, `.s3k-param-label`, `.s3k-param-track`
(+ `--interactive`), `.s3k-param-fill`, `.s3k-param-center`,
`.s3k-param-value`, `.s3k-param-input` in
`modules/akai-s3k-editor/src/index.css`. The fill + track stroke use
`var(--ac-color-accent, #d4a843)`; the bipolar `.s3k-param-center` anchors a
center marker for pan/tuning. Rendered by `ParamKnob` / `ParamSelect` /
`ParamToggle` in `modules/akai-s3k-editor/src/components/ui/ParamKnob.tsx`.

**Why:** the value bar shows position-in-range at a glance; bipolar fill from
center reads correctly for center-zero params. Source: DESIGN-SYSTEM.md §
Parameter Editors.

### ADSR envelope display — `.s3k-envelope-display` / `.s3k-adsr-*`

**What:** an interactive SVG envelope: background, accent fill, stroke line,
draggable dots with invisible hit areas.

**Where:** `.s3k-envelope-display`, `.s3k-adsr-bg`, `.s3k-adsr-fill`,
`.s3k-adsr-line`, `.s3k-adsr-hit` (+ `--dragging`), `.s3k-adsr-dot`
(+ `--draggable`), `.s3k-adsr-label` in
`modules/akai-s3k-editor/src/index.css`. The `.s3k-adsr-line` strokes in
`var(--ac-color-accent, #d4a843)` at `stroke-width: 2`. Rendered by the
keygroup editor's `FilterDisplay` /
`modules/akai-s3k-editor/src/components/keygroups/`.

**Why:** envelope editing is direct-manipulation — drag a dot to set a value;
hit areas larger than the visible dots make grabbing easy. Source:
DESIGN-SYSTEM.md § Envelope Visualizations.

> Note: Phase 1 of this branch promotes the Akai filter-response curve into a
> shared editor-core primitive (`AcFilterCurveEditor`, renaming the
> `.s3k-adsr-*` classes to `.ac-filter-curve-*`). That promotion has **not**
> landed yet, so this spec cites the `.s3k-adsr-*` classes that exist today.
> Update this section when Phase 1 merges.

### Zone editor — `.s3k-zone-editor` / `.s3k-zone-tabs`

**What:** the velocity-zone editor with a tab strip (`.s3k-zone-tab`,
active variant `.s3k-zone-tab--active`), a params column, and a sample panel.

**Where:** `.s3k-zone-editor`, `.s3k-zone-params`, `.s3k-zone-sample-panel`,
`.s3k-zone-tabs`, `.s3k-zone-tab` (+ `--active`), `.s3k-zone-tab-sample` in
`modules/akai-s3k-editor/src/index.css`. The active tab is marked with an
accent underline (`border-bottom: 2px solid var(--ac-color-accent, #d4a843)`).

**Why:** S3000XL keygroups carry up to four velocity zones; the tab strip
keeps each zone's params + sample together. Mirrors the shared "tabbed detail
pane" idea with the Akai's own `.s3k-*` vocabulary.

### Sample list — `.s3k-sample-list`

**What:** the selectable sample list with a selected-row marker.

**Where:** `.s3k-sample-list`, `.s3k-sample-list-item`
(+ `--selected`) in `modules/akai-s3k-editor/src/index.css`.

**Why:** sample assignment is a core keygroup task; the list is the picker.

---

## Shared editor-core chrome the Akai editor DOES use

The Akai module imports `@audiocontrol/editor-core` and uses its shared
infrastructure (verified by grep across `modules/akai-s3k-editor/src`):
notifications, dialogs/drawers (`ConnectionDrawer`, `Dialog`), the library
tree, SDS transfer progress, and the typed capability hooks. So the
dialog/drawer/notification/library chrome is the same shared `.ac-*` surface
as the Roland editor; only the **device-specific parameter vocabulary**
(`.s3k-*`) and the **amber surface palette** are Akai-specific.

---

## Signature elements the Akai editor does NOT have (honesty section)

These Roland signature elements were checked for and are **absent** from the
Akai editor — they are Roland-specific hardware homages and are not borrowed:

- **Rec-LED red accent** (`--ac-color-rec`) — a Roland S-550 PLAY-LED homage;
  not used on the Akai surface.
- **VFD glow / VFD status display** (`VfdGlowDefs`, `.ac-vfd`) — Roland
  phosphor-display homage; the Akai surface uses its own `.s3k-*` chrome.
- **CRT video surface** (`.ac-video-frame`) and the **virtual front panel**
  (`.ac-fp` / `--ac-fp-*`) — both mirror the Roland S-330 / S-550 hardware and
  are not part of the Akai editor's identity.
- **8-segment VFD-glow envelope** (`.ac-envelope`) and the **range-bar
  parameter row** (`.ac-slider` / `.ac-range-bar`) — the Akai editor uses its
  own `.s3k-adsr-*` envelope and `.s3k-param` rows instead.

Documenting these as absent (rather than inventing an Akai version) keeps this
spec honest about the editor's realized identity.

---

## Layout conventions

- The Akai pages use the shared editor-core page chrome (`.ac-page-shell`,
  dialogs, drawers, library tree) plus the `.s3k-*` parameter vocabulary for
  the device-specific editors.
- All `.s3k-*` layout uses flex/grid + relative units; the `--ac-space-*`
  tokens and `--ac-color-*` tokens flow through from editor-core.
- Two-column section pairing for related parameter groups (DESIGN-SYSTEM.md §
  Section Pairing): size list columns for their content, not a page
  proportion.

---

## Do's and Don'ts

**Do**

- Use `--ac-color-accent` (`#d4a843`, Akai amber) as the brand/identity color
  on the S3000XL surface.
- Keep the device-specific parameter chrome in the `.s3k-*` family; reuse the
  shared editor-core dialogs/drawers/library/notification chrome rather than
  re-implementing it.
- Reference colors through the `--ac-color-*` tokens (the inline `#d4a843`
  literals in `index.css` are legacy fallbacks, not the source of truth).

**Don't**

- Don't recolor the Akai surface to the Roland blue, and don't recolor the
  Roland surface to amber — each editor's surface palette is set by its
  `:root[data-editor='...']` block.
- Don't borrow the Roland rec-LED / VFD / CRT / front-panel homages into the
  Akai editor; they are S-330 / S-550 hardware references.
- Don't add new per-device color tokens parallel to the existing ones; extend
  the `:root[data-editor='s3000xl']` block and `color-mix` over the accent.
- Don't deepen the local `ui-monospace, 'Cascadia Code'…` divergence by adding
  more inline font stacks; new numeric readouts should move toward the shared
  `--ac-font-mono` token (flagged divergence above).

---

## Retiring the old design-language mockup (P3.5)

The historical hi-fi mockup
`docs/1.0/003-COMPLETE/s550-support/explorations/01-design-language.html` is a
Roland-side artifact; it is grandfathered / historical and is not the
design-language source of truth for any editor. This spec plus the living
styleguide gallery are canonical for the Akai editor. There is one canonical
design-language source per editor.

---

## Canonical pixels

This document captures **intent and rationale**. The **canonical pixel
reference** is the living styleguide gallery — a device-free route that
catalogues the real `.s3k-*` signature components, rendered from the actual
Akai components (so it cannot drift from as-built) and shot by the Phase 2
device-free capture engine.

The gallery route + its `promo-shots` scenes are **not yet built** (Phase 3
task P3.4, which depends on the Phase 2 engine). When it lands, link its shots
here as the canonical-pixels reference. Until then, the real components in
`modules/akai-s3k-editor/src/` are the as-built truth; this spec points at the
classes/tokens that render them.
