---
title: Akai S3000XL — design-language harmonization spec
phase: 1
status: draft
created: 2026-05-23
canonical-side-of-dialect: roland
---

# Akai S3000XL — Design-Language Harmonization Spec

This document captures the design-language contract between the post-v3 Roland S-330/S-550 editor and the Akai S3000XL editor. It is the operator-readable proof-of-design for every `canonical_side` declaration the Phase 2 implementation will land.

**One sentence framing:** the akai surface is a **dialect** of the roland surface — same structural primitives, same interaction shapes, same chrome, with only color tokens and font stack differing.

## 0. Working files

- [`_discovery-roland.md`](./_discovery-roland.md) (planned, not yet written) — agent-produced raw audit of the roland editor's CSS / JSX. The two discovery agent dispatches on 2026-05-23 returned summaries to the controller but failed to persist them to disk; the substantive findings landed directly in this spec instead.
- [`_discovery-akai.md`](./_discovery-akai.md) (planned, not yet written) — same shape for the akai editor.
- [`mockups/`](./mockups/) — HTML mockups of every akai page styled in the dialect. Each is self-contained and openable in a browser; the shared [`akai-dialect.css`](./mockups/akai-dialect.css) supplies the tokens + primitive styles common to all mockups.

## 1. The dialect contract

A **dialect** is the EXACTLY-RECOVERABLE difference between two editor surfaces. If the difference between Akai and Roland reduces to:

- different values for color tokens (`--ac-color-accent`, surface colors, accent variants),
- different font stack references (`--ac-font-display`, `--ac-font-body`, `--ac-font-mono`),
- different label silkscreen on the virtual front panel,
- different button layout / count on the virtual front panel (driven by the actual hardware),

…then the editors are dialects. If the difference requires a `if (device === 'akai') { ... }` branch in JSX or a hook, it is not a dialect — it is a structural divergence and the `harmonization-spec.md` entry must say so explicitly and propose either (a) elevating the variance into a token / theme attribute, or (b) extracting the divergent shape into a per-editor strategy injected via dependency injection.

The standing CLAUDE.md guideline applies verbatim:

> Never use conditionals in UI components to switch behavior based on device configuration. Instead, use context-specific factory methods that return implementations of interfaces with device-dependent behavior composed in at creation time. The UI calls interface methods without knowing which device is active.

The theme-token infrastructure ALREADY EXISTS at the design-system level. `tokens.css` scopes the per-editor color palette via `:root[data-editor='s3000xl']`, alongside `s330`, `s550`, `d110`, and `jv1080`. The akai dialect work in Phase 2 will:

1. Deepen the `[data-editor='s3000xl']` scope to override the typography tokens + the rec-LED tokens + the virtual-front-panel chassis tokens (currently global; not akai-appropriate).
2. Migrate akai pages to consume the canonical `editor-core` primitives (PageTitleRow, AcRadioTabs, AcChevron, useExportDialogLifecycle, the front-panel component, the envelope/range-bar primitives) where they currently inline equivalents.
3. Migrate akai's local `.s3k-*` parameter primitives to the canonical `.ac-*` primitives where the shape matches (slider, select, toggle, envelope) — promoting akai's local primitives to canonical where they hold the better shape.

## 2. Roland DNA inherited (the canonical side)

These are the load-bearing patterns the akai dialect adopts WITHOUT modification beyond palette/font.

### 2.1 Page shell — fixed-viewport flex column

Canonical declaration: [`modules/editor-core/src/design/layout-primitives.css`](../../../../modules/editor-core/src/design/layout-primitives.css):84-119 (`.ac-page-shell--fixed-viewport`).

> Height math: `100dvh` minus the site header minus the `<main class="ac-site-main">` vertical padding. The shell fills the available space between the site chrome rows; switching to a flex column lets the page header / progress / error banners stay intrinsic while the list-detail body claims `flex: 1` of the remainder.

Used by every list-detail editor page (TonesPage, PatchesPage, LibraryPage in roland). The akai pages CURRENTLY use `.ac-page-shell` without the `--fixed-viewport` modifier — the akai pages scroll as a single tall document while the roland pages contain their column scroll internally. **Disposition: `adopt-roland-pattern`** on all four akai pages.

### 2.2 Lean page header (PageTitleRow)

Canonical component: `modules/editor-core/src/components/common/PageTitleRow.tsx` (consumed by [`modules/roland-sxx0-editor/src/pages/TonesPage.tsx`](../../../../modules/roland-sxx0-editor/src/pages/TonesPage.tsx):241-254).

```tsx
<PageTitleRow
  headingId="tones-heading"
  headingText="Tones"
  metric={<><strong>{loadedToneCount}</strong> of <strong>{totalTones}</strong> loaded</>}
  loadingMessage={loadingMessage}
  isLoading={isLoading}
  onRefresh={refreshAll}
  refreshLabel="Refresh all tones from device"
  loadingProgress={loadingProgress}
/>
```

Shape: `h2` + accent-rule + status metric (mono, muted) + optional inline progress + single icon-button on the right.

Current akai pages: a hand-rolled `.ac-page-sticky-header` + `.ac-page-header` flex pair with `<h2>`, `<CacheAge>` chip, and a status string. **Disposition: `adopt-roland-pattern`** — migrate every akai page header to `PageTitleRow`. The `CacheAge` chip can pass through the `metric` slot.

### 2.3 Tabbed detail pane (AcRadioTabs)

Pattern: parameter editors with 4+ logical sections use radio-driven tabs. Strongly-interacting controls live in the same tab (filter + filter envelope, amp + amp envelope). Roland TonesPage uses 5 tabs: Wave · Pitch · Filter · Amp · LFO.

Current akai `KeygroupEditor`: dense single-pane parameter grid. Current akai `ProgramEditor` + `SampleEditor`: same. **Disposition: `adopt-roland-pattern`** — group akai parameters into tabs:

| Editor | Proposed tabs |
|---|---|
| ProgramEditor | Common · MIDI · Effects · Output |
| KeygroupEditor | Zones · Pitch · Filter · Amp · LFO |
| SampleEditor | Wave · Loop · Trim · Misc |

(See per-page mockups for layout.)

### 2.4 Virtual front panel beneath the CRT

Canonical: [`modules/roland-sxx0-editor/src/components/front-panel/`](../../../../modules/roland-sxx0-editor/src/components/front-panel/) + [`front-panel.css`](../../../../modules/roland-sxx0-editor/src/components/front-panel/front-panel.css). Memory `feedback_virtual_front_panel`: "every editor page with the CRT also mounts a virtual front panel mirroring the [device's] physical buttons; it's not optional."

The roland panel is 7-column × 2-row, 11 buttons (chunky molded plastic, three-stop vertical gradient, hairline bezel, ~80 ms transition mirroring real mechanical travel).

The akai panel must mirror the **S3000XL's actual front panel**: a wider LCD-centric layout with:
- 8 soft-function keys below the LCD (F1–F8 — actual S3000XL only had F1–F4 explicitly labelled, but it's the right metaphor for the dialect)
- `MAIN` / `EDIT` / `DISK` / `MIDI` mode keys on the left cluster
- `INC` / `DEC` value rocker on the right
- Numeric keypad (1–9, 0, +/–) inset right of the LCD
- `ENTER` / `EXIT` / `MARK` / `JUMP` navigation keys

**Disposition: `genuinely-dialect`** — same chunky-button chrome (token-shifted to akai palette), different grid layout reflecting the actual hardware. The `VirtualFrontPanel` component takes a `layout` prop or is replaced by a per-device factory that returns the correct grid; the underlying `FrontPanelButton` primitive is shared.

### 2.5 Live-editing footer (no save/cancel/undo)

Memory `feedback_live_editing_no_save`: "S-330/S-550 parameter edits stream live to device; replace save/cancel with a live-status footer."

The akai editor's `handleParameterChange` already does this (writes to device on every change — [`KeygroupsPage.tsx`](../../../../modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx):109-124). It just doesn't surface the live-status footer. **Disposition: `adopt-roland-pattern`** — add the rec-LED-tinted footer ("LIVE · writing to S3000XL · last edit 0.4 s ago") below the detail column.

### 2.6 AcChevron — one component, one CSS rule

Pre-commit gate in this repo (`tools/check-chevron-sizing.sh`) forbids any CSS class containing the substring `chevron` outside the canonical `modules/editor-core/src/design/chevron-primitives.css`. The roland editor already migrated to `<AcChevron expanded={...} />` (memory `feedback_chevron_size`).

The akai editor currently uses neither — its tree views and disclosure controls are inline JSX. **Disposition: `adopt-roland-pattern`** wherever a disclosure chevron is needed (the keygroup zones list, the library tree, the program clone progress drawer).

### 2.7 Zone-strip + range-bar visualization

**Amended 2026-05-24** (operator-approved scope correction; see
akai-harmonization Phase 2 task 2.2 dispatch Commits 1-5):

The original spec text said "extract `editor-core/AcRangeBar` from
roland's range-bar styles + akai's `ZoneOverview` shape." That conflated
two unrelated primitives:

- `AcRangeBar` (memory `feedback_range_bar_pattern`) is a 1D
  linear/bipolar/enum bar already consumed by parameter rows
  (S3kParamRow, ParameterSlider). It is NOT a fit for multi-zone
  segmented bars with per-segment drag handles.
- The roland editor's `ToneZoneEditor` introduces a separate
  `.ac-zone-bar` family for segmented zone strips with per-segment
  drag handles and per-zone hue derivation via `--ac-zone-hue`. This
  is the genuine extractable primitive.

The akai surfaces that match the segmented-strip shape are
`VelocityRangeBar` (4 velocity zones above the tab strip) and
`KeyRangeEditor` (1 zone with low/high handles). **Disposition for
the segmented strip: `adopt-roland-pattern`** — extract
`editor-core/AcZoneStrip` from the roland `.ac-zone-*` family and
migrate both akai surfaces to consume it. Closed: Commits 1-3 of the
AcZoneStrip primitive-extraction sequence.

The akai `ZoneOverview` (2D note×velocity canvas with pinch-zoom,
drag-create, octave grid, wheel-zoom, keyboard-pan) is **NOT** a
segmented strip — it is a domain visualization with zero non-akai
consumers and load-bearing 2D semantics. **Disposition for
ZoneOverview: `domain-component`** — stays in `modules/akai-s3k-editor`.
The per-zone hue palette in `ZoneOverviewZone` IS dialect-leaky
(inline HSL math); tokenized via `--ac-zone-hue` + `--ac-zone-alpha`
in Commit 4 of the AcZoneStrip extraction sequence (the saturation /
lightness stops now live in editor-core's `.ac-keygroup-zone-rect`
rule alongside the canonical `.ac-zone-segment` math).

The mockup at `mockups/keygroups.html` does not currently render the
2D canvas as a full-width band; per the operator-approved scope
amendment, this is mockup oversight (the canvas should regain the
band). Updating the mockup is a separate concern, NOT part of this
dispatch.

### 2.8 8-segment VFD-glow envelope

Pattern (memory `feedback_envelope_pattern` + [`envelope-primitives.css`](../../../../modules/editor-core/src/design/envelope-primitives.css)): full-width VFD-glow graphic on top, per-segment numeric table below. The roland tone envelopes are 8-segment (NOT ADSR). The akai keygroup envelopes ARE ADSR (4-segment) — `s3k-envelope-display`, `s3k-adsr-*` in [`index.css`](../../../../modules/akai-s3k-editor/src/index.css):318-368.

**Disposition: `genuinely-dialect`** — same VFD-glow graphic primitive (canvas, color stops, radial gradient, scanline overlay), parameterized by segment count. The roland mounts it with 8 segments; the akai mounts it with 4. The per-segment numeric table renders rows for however many segments exist.

The current akai ADSR display has the right CONTENT but the wrong CHROME — it's a flat inline SVG, no VFD glow, no per-segment table beneath. Migrate to `AcEnvelope` with `segmentCount={4}`.

### 2.9 Rec-LED accent

Pattern (memory `feedback_rec_led_accent`): a nod to the S-550 PLAY LED. Used as device-active / signal-on-air indicator only; NEVER for danger.

Current global token `--ac-color-rec: #f6533c` (deep red) is the S-550 specific value. The akai dialect overrides this to an akai-appropriate amber-red. See § 3.2 below.

### 2.10 Panel header lives INSIDE the border

Pattern (memory `feedback_panel_header_pattern`): labeled bordered panels use `.ac-detail-head` shape (eyebrow + title + hairline, all inside the panel border), never an external label above an unrelated section.

The akai `KeygroupEditor`'s parameter sections currently use `.s3k-section-title` (a section title rendered as the first row INSIDE the border — the right shape). **Disposition: `adopt-akai-pattern`** for the in-panel-header rule (akai already does this correctly); the `.ac-detail-head` and `.s3k-section-title` should merge into one shared primitive in `editor-core`.

### 2.11 Lean page header — no eyebrow rows

Pattern (memory `feedback_lean_page_header`): "editor headers are one row: h2 + red rule + status + icon-buttons; no eyebrow rows, no preambles, no announcement banners."

The current akai page header is already this lean. **Disposition: `genuinely-dialect`** at the level of the per-page eyebrow rows, but the H2 + accent rule + status metric pattern is `adopt-roland-pattern` so it goes through `PageTitleRow`.

## 3. The akai dialect — palette + fonts + REC-LED + front panel

**Important: this section was rewritten on 2026-05-23 after operator-provided reference photos corrected two wrong assumptions in the original draft (warm-black chassis instead of cream; amber LCD instead of blue-backlit STN; Major Mono Display instead of a readable typeface).** The corrected dialect makes the akai surface a LIGHT theme — because the actual S3000XL chassis is cream. This is a genuine departure from the roland dialect's dark theme, but the dialect contract still holds: every difference reduces to a CSS-token value swap.

### 3.1 Palette tokens (extends `[data-editor='s3000xl']` in `tokens.css`)

The current `[data-editor='s3000xl']` scope (already in [tokens.css:211-222](../../../../modules/editor-core/src/design/tokens.css)) is correct in shape but shallow — 8 tokens, and the values it carries (`#111214` canvas + `#d4a843` accent) describe a dark-theme akai that doesn't match the device. Phase 2 task 2.1 will replace those values with the cream-chassis dialect:

| Token | Current `[data-editor='s3000xl']` | Proposed akai dialect value | Why |
|---|---|---|---|
| `--ac-color-surface-canvas` | `#111214` (near-black) | `#DAD2B9` (warm cream — chassis) | Matches the actual S3000XL front-panel color |
| `--ac-color-surface-panel` | `#1a1c20` | `#C8C0A4` (slightly darker putty — inset panels) | Distinguishes lifted card surfaces from the chassis |
| `--ac-color-surface-recessed` | (not present) | `#B8AF90` (deeper warm putty — recessed clusters) | New token for list-head / detail-head / live-footer bands |
| `--ac-color-border-subtle` | `#2e3138` | `#8C8460` (warm putty border) | Reads as a hairline on cream, not a stroke |
| `--ac-color-border-strong` | (not present) | `#4A4630` (deep warm-brown) | Used for chassis edges, primary buttons |
| `--ac-color-text-primary` | `#e8e6e3` (off-white) | `#1A1812` (near-black with warm undertone) | Black silkscreen on cream is the chassis-print convention |
| `--ac-color-text-muted` | `#8a8d93` | `#524C3A` (deep warm gray) | High-contrast muted that reads on cream |
| `--ac-color-accent` | `#d4a843` (gold) | `#D8262C` (AKAI red — the brand) | The red used for the "S3000XL" model badge + the REC GAIN ring on the actual panel |
| `--ac-color-selected` | `#d4a843` | `#D8262C` | Same as accent (canonical pattern) |
| `--ac-color-warning` | `#e0b24f` | `#B46E00` (deep amber-brown) | Reads on cream; distinct from accent |
| `--ac-color-success` | `#4ade80` | `#2F7836` (deeper forest green) | Reads on cream; distinct from LCD turquoise |
| `--ac-color-danger` | `#fb7185` | `#A01E1E` (slightly darker than accent) | Distinguishes destructive from highlight |
| `--ac-color-rec` | global `#f6533c` | `#FF3838` (saturated red — active glow) | Brighter than the brand red; reads as "actively lit" |
| `--ac-color-rec-glow` | global `rgba(246,83,60,0.55)` | `rgba(255,56,56,0.6)` | Halo for the live-edit LED |

The roland-primary token (`--ac-roland-primary: #6bc3ea`) is NOT overridden — it remains the brand color for roland-tagged surfaces. The akai dialect introduces `--ac-akai-red: #D8262C` as the parallel akai brand color, and the `--ac-color-accent` alias points to it inside the `[data-editor='s3000xl']` scope.

**Why a light theme is honest:** the dialect contract holds because every structural rule consumes its colors through CSS custom properties. `.ac-page-title-row`, `.ac-list-row`, `.ac-detail` etc. don't care whether `--ac-color-surface-canvas` is `#0f172a` (roland's dark slate) or `#DAD2B9` (akai's cream). The structure is dialect-agnostic; the color hierarchy flips wholesale. The pages render identically in shape with inverse luminance.

### 3.2 LCD rendering — turquoise backlight with dark navy text

The actual S3000XL LCD is a blue-backlit STN display: bright turquoise-cyan field with dark navy dot-matrix text. This is distinct from the older S2000 (green-on-dark) and distinct from the amber VFD on roland's S-550. The akai dialect introduces two new tokens for any LCD-style surface:

```css
:root[data-editor='s3000xl'] {
  --ac-lcd-bg: #6FB4C5;        /* turquoise-cyan backlight */
  --ac-lcd-bg-edge: #4F8C9C;   /* slightly darker bottom edge — gives the LCD body depth */
  --ac-lcd-text: #0A1E3E;      /* dark navy dot-matrix pixels */
  --ac-lcd-text-dim: #1A3460;  /* secondary line (free memory, etc.) */
  --ac-lcd-bezel: #2C2A22;     /* warm dark bezel around the LCD */
}
```

LCD-bearing surfaces in the akai dialect: (a) the virtual front panel LCD readout, (b) the envelope graph background (the VFD-glow primitive renders into the LCD blue), (c) any waveform preview in the sample editor. The roland editor leaves these tokens at their global defaults (amber VFD-glow), so the envelope graph and waveform preview render in the roland's existing amber on dark.

This requires a small extension to the canonical [envelope-primitives.css](../../../../modules/editor-core/src/design/envelope-primitives.css): the current `.ac-envelope-graph` hardcodes a radial-gradient via `var(--ac-color-surface-canvas)` and the line color via `var(--ac-color-accent)`. Phase 2 task 2.1 will introduce `--ac-lcd-bg` / `--ac-lcd-text` and re-point the envelope/waveform primitives to consume them — so the akai dialect's LCD blue and the roland dialect's VFD amber both flow through the same primitive.

### 3.3 Typography — readability first, distinctiveness second

The first draft of this spec proposed `Major Mono Display + Sora + Share Tech Mono`, on the theory that distinctive monospace would evoke industrial-LCD typography. Operator review (2026-05-23) found Major Mono Display unreadable at parameter-value sizes — its ambiguous H/L/C glyphs caused "HAT_CL_SOFT" to read as "NAT_CL_SOFT". The corrected stack prioritizes readability:

| Token | Roland stack | Akai dialect stack | Why |
|---|---|---|---|
| `--ac-font-display` | `"Departure Mono", "JetBrains Mono", ...` | `"Big Shoulders Display", "Archivo Narrow", "Roboto Condensed", system-ui, sans-serif` | Big Shoulders Display is a heavy condensed sans that evokes the silkscreen labels on the actual chassis (the "SINGLE / MULTI / SAMPLE / EFFECTS" button printing). Highly legible at any size. Distinctive without being illegible. |
| `--ac-font-body` | `"IBM Plex Sans", system-ui, ...` | `"DM Sans", "Familjen Grotesk", system-ui, ...` | DM Sans is a clean modern body sans with character. Distinct from Inter (forbidden by the design language) and from IBM Plex Sans (roland's body). Reads cleanly at all sizes. |
| `--ac-font-mono` | `"JetBrains Mono", "IBM Plex Mono", ...` | `"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, monospace` | Same as roland — JetBrains Mono is highly readable, the right choice for parameter values regardless of dialect. Choosing a "more distinctive" mono failed; reusing the canonical mono is the right call. |
| `--ac-font-lcd` (NEW) | (not present) | `"VT323", "JetBrains Mono", monospace` | VT323 is a dot-matrix character cell that evokes the actual LCD's pixel rendering. Used ONLY inside `.ac-fp__lcd` and similar LCD-styled surfaces. Highly legible because the dot-matrix grid forces minimum glyph contrast. |

All four fonts are Google Fonts (Open Font License). The `--ac-font-lcd` is a new token added in Phase 2; the rest replace the current akai stack.

**Why this typography is more disciplined than the first draft:** display fonts that compete with mono fonts for the parameter-value slot are a category error. Display fonts belong on labels and headings; mono fonts belong on numeric values and identifiers. The first draft put a display mono (Major Mono Display) on values, which broke legibility. Big Shoulders Display sits on labels only; JetBrains Mono sits on values only; VT323 sits on the LCD only. Three roles, three fonts, no overlap.

### 3.4 Virtual front panel — cream chassis with lighter cream button faces

The roland chassis tokens (`--ac-fp-chassis-top`, etc.) describe a neutral matte-black plastic with darker button faces. The akai S3000XL has the inverse contrast: a cream chassis with LIGHTER cream button faces and warm dark bezels around each button cluster. New tokens for the akai dialect:

| Token | Roland (global) | Akai dialect |
|---|---|---|
| `--ac-fp-chassis-top` | `hsl(220 5% 7%)` (matte black) | `#E3DCC4` (light cream) |
| `--ac-fp-chassis-mid` | (not present) | `#D8D0B6` (slight gradient — gives the chassis subtle depth) |
| `--ac-fp-chassis-bot` | `hsl(220 6% 3%)` | `#CCC4A8` |
| `--ac-fp-chassis-edge` | `hsl(220 6% 3%)` | `#8C8460` (warm putty rim) |
| `--ac-fp-btn-top` | `hsl(220 4% 14%)` (darker than chassis) | `#F0EAD7` (LIGHTER than chassis — button face) |
| `--ac-fp-btn-mid` | `hsl(220 5% 9%)` | `#E1DAC3` |
| `--ac-fp-btn-bot` | `hsl(220 6% 5%)` | `#C8C0A4` |
| `--ac-fp-btn-bezel` | `hsl(220 8% 2%)` | `#5E5840` (warm dark putty — surrounds each button) |
| `--ac-fp-btn-label` | `hsl(210 12% 86%)` (cream label on dark) | `#1A1812` (black silkscreen on cream) |
| `--ac-fp-btn-pressed-top` | `hsl(215 30% 18%)` (cool blue tint when pressed) | `#B6C4A8` (subtle desaturated push) |
| `--ac-fp-btn-pressed-mid` | `hsl(215 28% 11%)` | `#99A890` |
| `--ac-fp-btn-pressed-bot` | `hsl(215 32% 6%)` | `#82907A` |
| `--ac-fp-btn-pressed-label` | `hsl(210 96% 86%)` (bright blue) | `#0A0D08` (deeper black on pressed) |

Mode-button active state is an exception: instead of darkening the button, it fills with the AKAI red brand color (`#D8262C`) with white text — exactly mirroring the way an active mode lights up the LED above the button on the real hardware.

### 3.5 Front panel layout — S3000XL 3-cluster strip

The roland virtual front panel is a 7×2 button grid (5:1.5 aspect ratio). The S3000XL is a 19" rackmount with a horizontal 3-cluster layout: mode buttons on the left (2 cols × 4 rows), LCD + soft-function keys in the center, numeric keypad + cursor cluster on the right. The mockup CSS captures this as a 3-column grid (`.ac-fp--akai` → `grid-template-columns: 0.7fr 1.6fr 1fr`).

Per CLAUDE.md "Multi-Device Architecture": the `VirtualFrontPanel` component takes a `layout` prop (or is replaced by a per-device factory) so each editor mounts its own grid. The underlying `FrontPanelButton` primitive is shared; only the grid shape varies. This is the one place where the dialect needs structural (not just token-level) variance, and the variance is honest — the hardware genuinely differs.

The actual S3000XL mode buttons (top-to-bottom in 2 columns):
- SINGLE / MULTI / SAMPLE / EFFECTS (top 2 rows)
- EDIT / GLOBAL / SAVE / LOAD (bottom 2 rows)

Soft-function keys F1–F8 below the LCD, with letter-alt labels for the naming-entry mode (F1/A, F2/B, … F8/H).

Numeric keypad with letter alts on the right (1/T, 2/U, … 9/Z), plus MARK / JUMP / NAME / cursor diamond.

The chassis carries the "AKAI professional · MIDI STEREO DIGITAL SAMPLER" silkscreen on the top-left and the red "S3000XL" model badge on the top-right — both rendered as absolute-positioned spans inside the chassis container.

## 4. Per-page disposition + mockup index

Each akai page gets one mockup in [`mockups/`](./mockups/). Every mockup loads [`mockups/akai-dialect.css`](./mockups/akai-dialect.css) for the shared tokens + primitive styles.

### 4.1 ProgramsPage — [`mockups/programs.html`](./mockups/programs.html)

Current shape ([`modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`](../../../../modules/akai-s3k-editor/src/pages/ProgramsPage.tsx)): list-detail (program list left, program editor right) + clone progress drawer + delete confirm dialog.

Mockup chrome:
- PageTitleRow: h2 "Programs" + amber rule + metric ("128 of 128 slots") + refresh icon
- 2-column app shell: ProgramList (left, 18rem) + ProgramEditor (right)
- ProgramEditor uses AcRadioTabs with 4 tabs (Common · MIDI · Effects · Output)
- KeygroupSummary inside the Common tab (read-only listing of the program's keygroups, click-to-jump)
- Live-edit footer beneath the detail column
- Virtual front panel beneath the page body (akai layout)

Primitives consumed: PageTitleRow, AcRadioTabs, AcRangeBar (for the keyboard range), AcChevron (in KeygroupSummary), AcButton (Clone / Delete), VirtualFrontPanel (akai layout).

### 4.2 KeygroupsPage — [`mockups/keygroups.html`](./mockups/keygroups.html)

Current shape ([`KeygroupsPage.tsx`](../../../../modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx)): zone-overview band on top + list-detail (keygroup list left, keygroup editor right).

Mockup chrome:
- PageTitleRow: h2 "Keygroups — {program name}" + amber rule + program-jump button + refresh icon
- ZoneOverview band (full-width, the keyboard range visualization with all keygroups laid out) — `domain-component` per § 2.7 amendment; 2D pinch-zoom canvas stays akai-local; per-zone palette tokenized via `--ac-zone-hue` (Commit edab3add)
- 2-column app shell: KeygroupList (left) + KeygroupEditor (right)
- KeygroupEditor uses AcRadioTabs with 5 tabs (Zones · Pitch · Filter · Amp · LFO)
- Amp tab contains the AcEnvelope (4-segment ADSR) primitive
- Filter tab contains AcEnvelope + filter cutoff slider (interacting controls in same tab)
- Live-edit footer beneath the detail column
- Virtual front panel beneath

Primitives consumed: PageTitleRow, AcRadioTabs, AcZoneStrip (per-zone velocity + key-range, § 2.7 amended), ZoneOverview (akai-local domain-component for the 2D canvas band, § 2.7 amended), AcEnvelope (segmentCount=4), AcSlider, AcSelect, AcCheckbox, VirtualFrontPanel.

### 4.3 SamplesPage — [`mockups/samples.html`](./mockups/samples.html)

Current shape ([`SamplesPage.tsx`](../../../../modules/akai-s3k-editor/src/pages/SamplesPage.tsx)): list-detail (sample list left, sample editor right) + launch-editor row above the editor (Loop · Sample · Chopper buttons) + clone progress drawer + delete confirm.

Mockup chrome:
- PageTitleRow: h2 "Samples" + amber rule + metric ("N of N loaded") + refresh icon
- 2-column app shell: SampleList (left) + SampleEditor (right)
- SampleEditor uses AcRadioTabs with 4 tabs (Wave · Loop · Trim · Misc)
- Wave tab includes a waveform preview (mono-rendered LCD-style)
- Loop tab includes the AcRangeBar for loop in/out markers
- Launch-editor row (Loop · Sample · Chopper) sits inside the Wave tab as a primary action cluster — promoted to `.ac-page-actions-inline` (a new shared primitive name) since it appears in only one place currently
- Live-edit footer
- Virtual front panel beneath

Primitives consumed: PageTitleRow, AcRadioTabs, AcRangeBar, AcButton (launch-editor row, clone, delete), AcChevron (sample-list collapsible folders if present), VirtualFrontPanel.

### 4.4 LibraryPage — [`mockups/library.html`](./mockups/library.html)

Current shape ([`LibraryPage.tsx`](../../../../modules/akai-s3k-editor/src/pages/LibraryPage.tsx)): PluginLibraryBrowser (3-column device memory + tree + preview) + 6 transfer dialogs + 4 editor dialogs. Already device-agnostic at the chrome level (editor-core provides PluginLibraryBrowser).

Mockup chrome:
- PageTitleRow: h2 "Library" + amber rule + storage indicator ("48 MB used · 16 MB free")
- 3-column PluginLibraryBrowser:
  - Left: DeviceMemoryPanel (akai-specific BankHeader subclasses — programs + samples — using shared BankHeader primitive)
  - Center: tree (TreeView with TreeSelectionCapability + TreeDragCapability + TreeContextMenuCapability)
  - Right: LibraryPreviewPanel (selected node's metadata + actions)
- Drawer transitions for transfer dialogs (uses shared SlideDrawer)
- Live-edit footer is NOT present on this page (no parameter editing)
- Virtual front panel beneath

Primitives consumed: PageTitleRow, PluginLibraryBrowser, TreeView, DeviceMemoryPanel, BankHeader, LibraryPreviewPanel, SlideDrawer, AcChevron (tree disclosure), VirtualFrontPanel.

## 5. Disposition table (every primitive on every page)

The matrix below is the proof-of-design Phase 2 implementers cite for each `canonical_side` decision.

### 5.1 Page-level primitives

| Primitive | Current akai surface | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| Fixed-viewport page shell | absent (`.ac-page-shell` without modifier) | `adopt-roland-pattern` | roland | 2.2 |
| PageTitleRow | absent (hand-rolled `.ac-page-sticky-header`) | `adopt-roland-pattern` | roland | 2.2 |
| AcRadioTabs detail pane | ~~absent (single-pane parameter grid)~~ → AcRadioTabs (controlled mode) from editor-core | DONE 2026-05-24 (`a444acd5` + `b5d30089` + `3b93fa91`) | roland (promoted to editor-core) | 2.2 |
| Live-editing footer | absent | `adopt-roland-pattern` | roland | 2.2 |
| Virtual front panel — chassis chrome | absent | `genuinely-dialect` (tokens differ) | roland (component shape) | 2.1 + 2.2 |
| Virtual front panel — button grid layout | absent | structural divergence — needs factory | shared `FrontPanelButton`, per-device layout | 2.2 |
| Theme/dialect tokens | partial (`[data-editor='s3000xl']` 8 tokens) | extend | new (deepen akai scope) | 2.1 |

### 5.2 Atomic control primitives

| Primitive | Current akai equivalent | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| AcInput | ~~inline native input + `.s3k-param-input`~~ → AcNumberInput via S3kParamRow | DONE 2026-05-24 (`20e56322` + `74505449` + `f25b10a1`) | roland | 2.2 |
| AcSelect | ~~`.s3k-param-select`~~ → `<select class="ac-select">` via S3kParamSelectRow | DONE 2026-05-24 (`20e56322` + `74505449` + `f25b10a1`) | roland | 2.2 |
| AcSlider | ~~`.s3k-param-track` + `.s3k-param-fill`~~ → AcSlider via S3kParamRow | DONE 2026-05-24 (`20e56322` + `74505449` + `f25b10a1`) | roland (shared `AcSlider`) | 2.2 |
| AcCheckbox | ~~`.s3k-param-toggle`~~ → AcToggle via S3kParamToggleRow | DONE 2026-05-24 (`20e56322` + `74505449` + `f25b10a1`) | roland | 2.2 |
| ~~AcRangeBar~~ ⟶ AcZoneStrip (segmented 1D zone bar) | VelocityRangeBar.tsx + KeyRangeEditor.tsx (inline tailwind + drag tracking) | `adopt-roland-pattern` (extract from `.ac-zone-*` family) | roland (promoted to editor-core) | 2.2 — DONE 2026-05-24 (Commits 03f36ce3 + 544d41f3 + e23de8b3) |
| ZoneOverview 2D canvas | ZoneOverview.tsx + ZoneOverviewZone.tsx | `domain-component` (tokenize palette only) | n/a — akai-local | 2.2 — palette tokens DONE 2026-05-24 (Commit edab3add); structural canvas stays akai-local per § 2.7 amendment |
| AcEnvelope | `.s3k-envelope-display` (ADSR-only) | `genuinely-dialect` (parameterize segment count) | extend roland's 8-segment primitive | 2.2 |
| AcChevron | absent | `adopt-roland-pattern` | roland | 2.2 |
| AcButton | mix of `.s3k-*` and tailwind | `adopt-roland-pattern` | roland | 2.2 |

Notes on the DONE rows:
  - The `S3k*Row` wrappers add the akai dialect's affordances (integer-round on emitted values, select-all on readout focus) over the canonical AcSlider + AcNumberInput + AcToggle substrate. They live at `modules/akai-s3k-editor/src/components/ui/`.
  - The bipolar center-tick visual (preserves the legacy `.s3k-param-center` divider's affordance) is implemented as a `:root[data-editor='s3000xl']` pseudo-element on `.ac-range-bar--bipolar` in `modules/editor-core/src/design/control-primitives.css`. Roland-scoped bipolars stay unmarked.
  - The legacy `.s3k-param*` CSS block was deleted in `f25b10a1`; the new anti-pattern entries `s3k-param-input-inline` / `s3k-param-select-inline` / `s3k-param-toggle-inline` prevent reintroduction via the pre-commit gate.
  - S3kParamRow's `tooltip:` prop currently throws when supplied (the akai Tooltip primitive hasn't landed yet); the throw forces awareness rather than silently dropping the text. Wiring is a separate dispatch once Tooltip ships.

### 5.3 Layout primitives

| Primitive | Current akai usage | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| `.ac-list-detail-grid` | already shared with editor-core (defined per-akai in `index.css` with 18rem column) | `adopt-roland-pattern` | roland (tokenize the column width) | 2.2 |
| `.ac-list` | shared | already canonical | n/a | n/a |
| `.ac-detail-head` (eyebrow + title + hairline inside border) | `s3k-section-title` (similar shape) | merge / promote akai's | shared (one primitive in editor-core) | 2.2 |
| `.ac-app-shell` | absent | `adopt-roland-pattern` | roland | 2.2 |
| `.ac-page-actions-inline` | inline tailwind cluster above SampleEditor | `genuinely-dialect` (extract) | new (shared) | 2.2 |

### 5.4 Overlay surfaces

| Primitive | Current akai usage | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| SlideDrawer | absent (uses Radix.Dialog in places) | `adopt-roland-pattern` | roland (V3-IMPORT chrome) | 2.2 |
| ConfirmDialog | shared via editor-core | already canonical | n/a | n/a |
| SteppedProgressDrawer | shared via editor-core | already canonical | n/a | n/a |
| useExportDialogLifecycle hook | absent (akai has no export dialogs in scope yet) | `adopt-roland-pattern` when akai gains export | roland | future |

### 5.5 Library surfaces

| Primitive | Current akai usage | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| PluginLibraryBrowser | already shared via editor-core | already canonical | n/a | n/a |
| TreeView + capabilities | already shared | already canonical | n/a | n/a |
| BankHeader | shared (used by both editors) | already canonical | n/a | n/a |
| DeviceMemoryPanel | akai-specific (`AkaiDeviceMemoryPanel` if it exists, otherwise inline) | check via grep; if duplicating roland's `DeviceMemoryPanel`, `adopt-roland-pattern` | roland | 2.2 |
| LibraryPreviewPanel | akai-specific | check; likely `adopt-roland-pattern` | roland | 2.2 |

## 6. Anti-patterns identified for Phase 2 task 2.5 registry backfill

Phase 1 inventory surfaced these akai-specific patterns that should NOT propagate to future editors (jv1080, d110, sample-editor):

1. ~~**Hand-rolled `.ac-page-sticky-header` / `.ac-page-header` instead of PageTitleRow.** Register as anti-pattern; the canonical replacement is the shared `PageTitleRow` component.~~ — DONE 2026-05-24 (`3b93fa91`) — `ac-page-sticky-header-inline` registered with paired adversarial scenarios in `tools/scope-discovery/anti-patterns.ac-page-header-scenarios.ts`. Active scan across all editors; 3 stale e2e test selectors fixed in passing; d110-editor TonesPage holdout listed as deferred exception pending d110 migration.
2. **Tailwind utility-class chrome in JSX (e.g., `text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300` for the launch-editor buttons in SamplesPage).** Register as anti-pattern; the canonical replacement is `.ac-btn` / `.ac-toolbar-btn`.
3. **Inline `<a href="/akai/s3000xl/editor/programs" className="text-blue-400 hover:underline">` for cross-page navigation prompts.** Register as anti-pattern; the canonical replacement is `.ac-link` (the design token `--ac-color-accent` carries through under the editor scope).
4. **`.s3k-param-input` / `.s3k-param-select` / `.s3k-param-toggle` parallel primitive family.** Register as anti-pattern; the canonical replacement is `.ac-input` / `.ac-select` / a new `.ac-toggle` primitive promoted from akai if the shape doesn't already exist on roland.
5. ~~**`s3k-zone-tabs` / `s3k-zone-tab` parallel primitive (instead of AcRadioTabs).** Register as anti-pattern; the canonical replacement is AcRadioTabs.~~ — DONE 2026-05-24 (`3b93fa91`) — `s3k-zone-tabs-inline` registered with paired adversarial scenarios in `tools/scope-discovery/anti-patterns.s3k-zone-tabs-scenarios.ts`. The `.s3k-zone-tab*` CSS family was deleted from `modules/akai-s3k-editor/src/index.css` in the same commit; VelocityZoneEditor migrated to AcRadioTabs controlled-mode (activeId + onActiveIdChange) so the VelocityRangeBar above the tabs can read the active zone index. Note: § 8 question 1 ("nested AcRadioTabs vs separate AcSecondaryTabs primitive") resolved as "reuse AcRadioTabs without a `variant=` prop" — the chrome unification was clean; no visual delta warranted a new variant.
6. **`.s3k-envelope-display` SVG-direct envelope graphic (instead of AcEnvelope).** Register as anti-pattern; the canonical replacement is AcEnvelope with `segmentCount` prop.

## 7. Scope-discovery-protocol tooling gaps surfaced

Phase 1 task 1.7 should file these against the scope-discovery-protocol feature for backfill during Phase 2:

1. **Editor-symmetry matrix participant model.** The current matrix at `docs/scope-discovery/editor-symmetry.md` is single-editor (roland-only). Phase 2 task 2.4 needs the matrix renderer to accept akai as a first-class participant. Filing as `SCOPE-DISCOVERY-AKAI-PARTICIPANT`.
2. **~~AcRangeBar adopter manifest~~ AcZoneStrip adopter manifest** (renamed per § 2.7 amendment 2026-05-24). The genuine extractable primitive turned out to be the segmented zone-strip (extracted as AcZoneStrip), not the 1D AcRangeBar (which already exists). Adopter manifest landed alongside the extraction (Commit 6 of the dispatch). ~~Filing as `SCOPE-DISCOVERY-AC-RANGE-BAR-MANIFEST`.~~ Closed: `ac-zone-strip` manifest in `docs/scope-discovery/adopter-manifests.yaml`.
3. **AcEnvelope segmentCount extension.** The current `AcEnvelope` is hard-coded to 8 segments. The akai dialect needs 4. Filing the parameterization as `EDITOR-CORE-AC-ENVELOPE-SEGMENTS`. (Not a scope-discovery-protocol gap proper, but in the same backfill batch.)

## 8. Open questions for operator review

1. **Should AcRadioTabs be the canonical for KeygroupsPage's zone tabs (currently `s3k-zone-tabs`)?** The roland editor uses AcRadioTabs only for top-level parameter sections. The akai zone tabs are nested (a tab strip inside the Zones tab). Either reuse AcRadioTabs as a nested instance, or introduce a separate `AcSecondaryTabs` primitive. Spec defaults to "reuse with `variant="secondary"` prop" pending operator decision.
2. **Should the launch-editor buttons (Loop · Sample · Chopper) on SamplesPage move into the AcRadioTabs Wave tab as primary actions, or stay as a separate row above the tabs?** Spec defaults to "inside Wave tab" (more cohesive); operator may prefer top-of-pane (more discoverable). Both layouts mocked in `samples.html` (the top-of-pane variant is commented out).
3. **Should the akai dialect introduce a parallel `--ac-akai-secondary` token (mirroring `--ac-roland-secondary` at the brand level)?** The roland secondary is `#e0b24f` (gold) — already very close to the akai accent. Spec defaults to: no parallel secondary for akai; the dialect uses single-accent palettes (consistent with the actual S3000XL's monochrome-amber LCD aesthetic). Operator may want a secondary for distinct affordances.
4. **Live-editing footer copy.** Roland says e.g. "LIVE · writing to S-550 · last edit 0.4 s ago". Akai equivalent — spec defaults to "LIVE · writing to S3000XL · last edit 0.4 s ago". Operator may prefer different phrasing (e.g., per-device terminology).

## 9. References

- [Workplan § Phase 1](./workplan.md#phase-1-design-language-audit)
- [PRD § Problem Statement](./prd.md#problem-statement)
- [tokens.css](../../../../modules/editor-core/src/design/tokens.css) — design tokens including `[data-editor='s3000xl']` scope
- [layout-primitives.css](../../../../modules/editor-core/src/design/layout-primitives.css) — `.ac-page-shell--fixed-viewport`
- [envelope-primitives.css](../../../../modules/editor-core/src/design/envelope-primitives.css) — VFD-glow envelope graphic
- [front-panel.css](../../../../modules/roland-sxx0-editor/src/components/front-panel/front-panel.css) — chunky-button molded-plastic chrome
- [TonesPage.tsx](../../../../modules/roland-sxx0-editor/src/pages/TonesPage.tsx) — canonical roland page shape
- [KeygroupsPage.tsx](../../../../modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx) — current akai canonical (will migrate)
- Memory references: `feedback_virtual_front_panel`, `feedback_live_editing_no_save`, `feedback_tabbed_detail_pane`, `feedback_lean_page_header`, `feedback_panel_header_pattern`, `feedback_chevron_size`, `feedback_envelope_pattern`, `feedback_range_bar_pattern`, `feedback_rec_led_accent`, `feedback_sticky_app_shell`
