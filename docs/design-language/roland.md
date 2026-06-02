# Design language — Roland S-330 / S-550 editor

> The durable home for the Roland editor's visual identity. This is **intent
> and rationale**. The **canonical pixels** live in the living styleguide
> gallery rendered from real components (Phase 3 task P3.4 — see "Canonical
> pixels" at the bottom).
>
> Every token / class cited below was grep-verified to exist at author time.
> Files are cited by path so a reader can open the source of truth.

Editor surface: `https://audiocontrol.org/roland/s330/editor` and
`/roland/s550/editor`. The two devices share one editor module
(`modules/roland-sxx0-editor/`) and one surface palette: `main.tsx` sets
`document.documentElement.dataset.editor = config.deviceType` (`'s330'` or
`'s550'`), and `:root[data-editor='s330']` + `:root[data-editor='s550']` in
`modules/editor-core/src/design/tokens.css` resolve to identical surface
values (same Roland chassis lineage, same v3 visual target).

---

## Palette

All color tokens are `--ac-*` custom properties defined in
`modules/editor-core/src/design/tokens.css`. The Roland identity is **blue +
white on deep slate**, with one rare red accent (see Signature components).

| Role | Token | Value | Notes |
|------|-------|-------|-------|
| Brand / accent | `--ac-color-accent` → `--ac-roland-primary` | `#6bc3ea` | Roland blue. The editor's primary identity color. |
| Secondary | `--ac-roland-secondary` | `#e0b24f` | Warm gold; drives `--ac-color-warning`. |
| Canvas surface | `--ac-color-surface-canvas` | `#0f172a` (s330/s550) | Deep slate page background. |
| Panel surface | `--ac-color-surface-panel` | `#1e293b` (s330/s550) | Lifted card surface. The s550 block exists specifically so its panels read as lifted, not flat (documented at the token's declaration site). |
| Subtle border | `--ac-color-border-subtle` | `#334155` | Hairline panel borders. |
| Primary text | `--ac-color-text-primary` | `#f1f5f9` (s330/s550) | |
| Muted text | `--ac-color-text-muted` | `#94a3b8` (s330/s550) | Labels, eyebrows. |
| Success | `--ac-color-success` | `#22c55e` (s330/s550) | |
| Danger | `--ac-color-danger` | `#fb7185` (s330/s550) | Error states only — NOT the rec-LED red. |
| Rec-LED accent | `--ac-color-rec` | `#f6533c` | See Signature components → Rec-LED red. |
| Rec-LED glow | `--ac-color-rec-glow` | `rgba(246, 83, 60, 0.55)` | Pre-computed alpha for `box-shadow` chains (documented exception at the token site). |

**Status tokens** alias the palette so status meaning stays consistent:
`--ac-status-connected` → `--ac-color-accent`, `--ac-status-warning`,
`--ac-status-danger`, `--ac-status-selected` (all in `tokens.css`).

**Palette rule (from DESIGN-SYSTEM.md § Color Palette Preservation):** the
`s330-*` blue+white identity is canonical and is NOT recolored to match
audiocontrol.org. Cross-product alignment happens via type, spacing, and
component shape — never recoloring. When a redesign appears to need a new
color, alpha-compose an existing token via `color-mix(...)` (e.g.
`color-mix(in srgb, var(--ac-color-accent) 25%, transparent)`) before
introducing one.

---

## Typography

Three roles, three faces. Every token is defined in
`modules/editor-core/src/design/tokens.css`; never inline a font stack in
component CSS.

| Role | Token | Intended face | Used by |
|------|-------|---------------|---------|
| Display / instrument-face | `--ac-font-display` | Departure Mono (JetBrains Mono fallback) | Page titles, panel-label eyebrows, slot labels, `.ac-field-label`, envelope labels |
| UI / body | `--ac-font-body` | IBM Plex Sans | Prose, list-item names (`.ac-list-name`), buttons, checkbox labels |
| Data / numeric | `--ac-font-mono` | JetBrains Mono | Numeric readouts (`.ac-number-input`), ticks (`.ac-range-bar__tick`), slot identifiers, log entries |

The bundled webfonts are not yet shipped; each token lists the intended face
FIRST with a system-fallback chain behind it (documented at the token site),
so the editor renders correctly on system fonts until the webfonts land.

**Tracking + sizing tokens** (all in `tokens.css`):
`--ac-tracking-eyebrow` (`0.14em`, uppercase rows), `--ac-tracking-display`
(`0.01em`, headings), `--ac-text-eyebrow` (`0.78rem`, panel-label eyebrows).

**Inter is forbidden** by the design language — do not add it to any fallback
chain (enforced by the token comments in `tokens.css`).

---

## Signature / branded components

Each entry: what it is, the real class/component that renders it, and WHY it
exists (the rationale / homage).

### Rec-LED red accent — `--ac-color-rec`

**What:** a single red accent (`#f6533c`) used as a short underline beneath
page headings, a pulsing dot in the live-edit footer, and the front-panel
mode LED.

**Where:** `--ac-color-rec` / `--ac-color-rec-glow` in `tokens.css`;
consumed by `.ac-page-title-rule` and `.ac-detail-live-led` in
`modules/roland-sxx0-editor/src/styles/_shared.css`.

**Why:** homage to the S-550 front panel's red PLAY LED + REC LEVEL knob. It
is the editor's ONLY use of red and signals **device-active / signal-on-air**
— never danger. Danger is the separate soft-pink `--ac-color-danger`.
Conflating the two breaks the "red means device active" affordance.
Documented at the token site and in DESIGN-SYSTEM.md § Rec-LED Red Accent.

### Live-status footer — `.ac-detail-live`

**What:** a fixed-height bottom strip with a pulsing rec-LED dot and an
uppercase mono caption (e.g. "LIVE EDIT · DEVICE WRITES ENABLED"), replacing
save / cancel / undo.

**Where:** `.ac-detail-live`, `.ac-detail-live-led`, `.ac-detail-live-touch`
in `modules/roland-sxx0-editor/src/styles/_shared.css`; reuses the
`ac-detail-live-pulse` keyframes there.

**Why:** S-330 / S-550 parameter edits stream live to the device — there is
no save/cancel/undo. The footer makes the device-is-source-of-truth model
visible. Source: DESIGN-SYSTEM.md § Live-Status Footer Pattern.

### VFD glow — `VfdGlowDefs` + `--ac-vfd-glow-*`

**What:** a multi-layer SVG blur filter (outer diffuse bloom + inner bright
halo + sharp source on top) giving envelope paths and points an authentic
phosphor glow.

**Where:** `modules/editor-core/src/components/svg/VfdGlowDefs.tsx` emits the
`#vfd-glow` / `#vfd-glow-subtle` / `#vfd-glow-intense` filters; the companion
`VfdGlowPath.tsx` / `VfdGlowCircle.tsx` apply them. The
`--ac-vfd-glow-color` / `--ac-vfd-glow-inner-radius` /
`--ac-vfd-glow-outer-radius` tokens in `tokens.css` parameterize it (default
color `var(--ac-highlight)` → the Roland blue).

**Why:** the S-330 / S-550 read out parameter data on a phosphor display; the
glow ties the editor's envelope/curve graphics to that hardware look.

### VFD status display — `.ac-vfd`

**What:** a phosphor-blue, CRT-evoking readout surface on the Connect page —
near-black background, scanline texture, status LED, key/value detail rows,
dashed-underline inline actions.

**Where:** `.ac-vfd`, `.ac-vfd-screen`, `.ac-vfd-status-line`, `.ac-vfd-led`
(+ `--scanning` / `--success` variants), `.ac-vfd-status-label`,
`.ac-vfd-detail`, `.ac-vfd-action` in
`modules/roland-sxx0-editor/src/styles/_shared.css`. The scanline texture is
a `repeating-linear-gradient` tinted with `color-mix(... var(--ac-color-accent)
18% ...)`; the text glow is a `text-shadow` in `--ac-color-accent`.

**Why:** ported from the accepted exploration
`explorations/ACCEPTED/2026-05-18-connect-vfd-status`; anchors the Connect
page in the same phosphor-blue chrome family as the envelope graph and the
page-title LED. The status LED itself uses `--ac-color-rec`.

### CRT video surface — `.ac-video-frame`

**What:** a 4:3 framed surface that hosts either the live `<video>` capture of
the device's CRT or a paused-state skeleton with faint CRT scanlines.

**Where:** `.ac-video-frame` (with `aspect-ratio: 4 / 3`),
`.ac-video-frame-skeleton`, `.ac-video-frame-skeleton-label`,
`.ac-video-frame-overlay` in
`modules/roland-sxx0-editor/src/styles/_shared.css`; the React host is
`modules/roland-sxx0-editor/src/components/video/VideoCapture.tsx`.

**Why:** the S-330 / S-550 drive an external 4:3 CRT monitor; the editor
mirrors the actual display. The `4 / 3` ratio is deliberate (the CRT is 4:3
inside a 16:9 capture-device output — documented at the rule site).

### Virtual front panel — `.ac-fp` family + `--ac-fp-*`

**What:** a chunky matte-black control surface mirroring the physical S-330 /
S-550 buttons, mounted inside the `<VideoCapture>` drawer alongside the CRT.

**Where:** `VirtualFrontPanel.tsx` + `FrontPanelButton.tsx` in
`modules/roland-sxx0-editor/src/components/front-panel/`, styled by
`front-panel.css` there via `.ac-fp`, `.ac-fp__grid`, `.ac-fp__btn`
(+ `--arrow` / `--stack` / `--value` modifiers), `.ac-fp__blank`. The chassis
+ button gradients + silkscreen colors come from the 16 `--ac-fp-*` tokens in
`tokens.css` (chassis-top/bot/edge, btn-top/mid/bot/bezel, pressed-top/mid/bot,
label-fn/pressed, and four `--ac-fp-shadow-*` stops).

**Why:** every CRT-bearing page mounts the front panel as part of the
editor's identity surface — it is not optional and not a per-page decision.
The arrow silkscreen + pressed-state LED reuse `--ac-color-rec` /
`--ac-color-rec-glow`; the pressed accent reuses `--ac-color-accent` via
`color-mix`. No parallel `--ac-fp-red` / `--ac-fp-blue` tokens exist — that is
the documented anti-pattern. Source: DESIGN-SYSTEM.md § Virtual Front Panel
Under the CRT.

### 8-segment VFD-glow envelope — `.ac-envelope` / `<AcEnvelope>`

**What:** a full-width "monitor" graphic (phosphor scanlines, accent fill,
bright stroke line, point markers, axis + y-axis guides, sustain marker) over
a per-segment numeric table, plus a sustain/end pip meta strip.

**Where:** `<AcEnvelope>` in `modules/editor-core/src/components/AcEnvelope.tsx`,
composed from `AcEnvelopeGraph` / `AcEnvelopeMeta` / `AcEnvelopeTable`; styled
by `modules/editor-core/src/design/envelope-primitives.css`. The Roland tone
envelope wrapper is
`modules/roland-sxx0-editor/src/components/ui/ToneEnvelopeEditor.tsx`.

**Why:** S-550 envelopes are 8-segment (NOT ADSR); the monitor-over-table
shape matches that data model and the VFD readout look. Source:
DESIGN-SYSTEM.md § `.ac-envelope`.

### Range-bar parameter row — `.ac-slider` + `.ac-range-bar`

**What:** a three-column parameter row (label | bar | mono readout) whose bar
visualizes the value's position in range. Variants: `linear` (left-anchored
fill), `bipolar` (center-anchored), `enum` (N-cell pip track).

**Where:** `<AcSlider>` / `<AcRangeBar>` /
`<AcNumberInput>` in `modules/editor-core/src/components/`; CSS at
`modules/editor-core/src/design/control-primitives.css` (`.ac-slider`,
`.ac-range-bar`, `.ac-range-bar__fill`, `.ac-range-bar__tick` with
`--start` / `--mid` / `--end` modifiers).

**Why:** a compact, scannable parameter readout aligned with the
audiocontrol.org visual universe (mono endpoint ticks + accent-tinted fill).
Source: DESIGN-SYSTEM.md § `.ac-slider + .ac-range-bar` and project memory
`feedback_range_bar_pattern`.

### Disclosure chevron — `<AcChevron>` / `.ac-chevron`

**What:** the single disclosure / expand-collapse chevron used everywhere.

**Where:** `modules/editor-core/src/components/AcChevron.tsx` emits the lone
`.ac-chevron` rule in `modules/editor-core/src/design/chevron-primitives.css`
(1.1rem square, accent color, transition).

**Why:** one component, one CSS rule, one source of truth. A pre-commit gate
(`tools/check-chevron-sizing.sh`) fails the build if any other CSS file
declares a class containing "chevron", after four+ historical size-drift
violations. The 1.1rem target clears WCAG AA target-size floors. Source:
`.claude/rules/chevron-sizing.md`.

---

## Layout conventions

All layout uses flex ratios, grid fractions, and `--ac-space-*` tokens — no
hardcoded pixel widths (DESIGN-SYSTEM.md § Layout Rules).

- **Page shell:** every page wears `.ac-page` + `.ac-page-shell`
  (`modules/editor-core/src/design/layout-primitives.css`). List-detail pages
  (Patches, Tones, Play, Library) add `.ac-page-shell--fixed-viewport` — a
  height-bounded flex column where the page never scrolls and each column
  scrolls internally. The per-page grid (`.<page>__app-shell`) carries the
  `grid-template-columns` + `flex: 1; min-height: 0; overflow: hidden`
  contract. Source: DESIGN-SYSTEM.md § Page Shell Pattern.
- **Lean page header:** one row — `.ac-page-title-row` →
  `.ac-page-title-block` (`.ac-page-title-heading` + `.ac-page-title-rule` +
  `.ac-page-title-metric` + `.ac-page-title-led`) + `.ac-icon-btn` actions, in
  `_shared.css`. No eyebrow row, no preamble paragraph, no announcement
  banner. Source: DESIGN-SYSTEM.md § Page Header Pattern.
- **Detail header inside the panel:** `.ac-detail-eyebrow-row` /
  `.ac-detail-eyebrow-sep` / `.ac-detail-eyebrow-accent` and
  `.ac-detail-empty` (in `_shared.css`) — the eyebrow + title live INSIDE the
  panel border.
- **List pane:** `.ac-list` family in
  `modules/editor-core/src/design/list-primitives.css` (`.ac-list`,
  `.ac-list-scroll`, `.ac-list-bank-header`, `.ac-list-slot`, `.ac-list-info`,
  `.ac-list-name` + `--placeholder` / `--empty`, `.ac-list-eyebrow`,
  `.ac-list-action`). The per-page row grid sets only the slot-column width.
- **Tabbed detail pane:** Tones uses radio-driven tabs (Wave / Pitch / Filter
  / Amp / LFO); strongly-interacting controls (filter params + filter
  envelope) stay in the same tab. Source: DESIGN-SYSTEM.md § Tabbed Detail
  Pane.

---

## Do's and Don'ts

**Do**

- Use `--ac-color-accent` (Roland blue) as the brand/identity color.
- Reserve `--ac-color-rec` for device-active / signal-on-air affordances only,
  and keep those uses small (rule, dot, LED).
- Render disclosure chevrons via `<AcChevron>`; render the 8-segment envelope
  via `<AcEnvelope>`; render parameter rows via `<AcSlider>` / `<AcRangeBar>`.
- Drive headings + eyebrows with `--ac-font-display` + `--ac-tracking-eyebrow`.
- Mount the virtual front panel on every CRT-bearing page (it is not optional).
- Compose new tints via `color-mix(...)` over an existing token.

**Don't**

- Don't use `--ac-color-rec` for error states (use `--ac-color-danger`) or as
  a primary/CTA identity (use `--ac-color-accent`). No large red surfaces.
- Don't add a parallel "audiocontrol-blue", `--ac-color-accent-tint`,
  `--ac-fp-red`, or `--ac-fp-blue` token — `color-mix` over the existing
  tokens instead.
- Don't list `Inter` in any font fallback chain.
- Don't author a chevron CSS class outside `chevron-primitives.css` (the
  pre-commit gate fails the build).
- Don't use save / cancel / undo under a parameter editor — edits stream live;
  use the `.ac-detail-live` footer.
- Don't hardcode pixel widths or letter-spacing values; use flex/grid +
  `--ac-space-*` + `--ac-tracking-*`.
- Don't mount the front panel inline above the parameter grid — its mount is
  the `<VideoCapture>` drawer.

---

## Retiring the old design-language mockup (P3.5)

The historical hi-fi mockup
`docs/1.0/003-COMPLETE/s550-support/explorations/01-design-language.html` is
**grandfathered / historical**. It is no longer the design-language source of
truth. This spec plus the living styleguide gallery are now canonical. There
is one canonical design-language source per editor; the old mockup does not
compete with it.

---

## Canonical pixels

This document captures **intent and rationale**. The **canonical pixel
reference** is the living styleguide gallery — a device-free route that
catalogues the real signature components above, rendered from the actual
components (so it cannot drift from as-built) and shot by the Phase 2
device-free capture engine.

The gallery route + its `promo-shots` scenes are **not yet built** (Phase 3
task P3.4, which depends on the Phase 2 engine). When it lands, link its shots
here as the canonical-pixels reference. Until then, the real components in
`modules/roland-sxx0-editor/src/` and `modules/editor-core/src/` are the
as-built truth; this spec points at the classes/tokens that render them.
