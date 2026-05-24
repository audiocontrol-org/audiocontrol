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

### 2.7 Range-bar visualization

Pattern (memory `feedback_range_bar_pattern`): mono endpoint ticks + accent-tinted center zone. Used for: tone pitch range, patch-level keyboard range, velocity ranges in keygroups.

The akai keygroup zones overview is structurally the same thing — a horizontal note range with low/high markers per keygroup. Currently rendered with a custom SVG canvas (`ZoneOverview.tsx`). **Disposition: `adopt-roland-pattern`** — extract `editor-core/AcRangeBar` primitive from the existing roland range-bar styles + the akai `ZoneOverview` shape and consume both surfaces from it.

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

### 3.1 Palette tokens (extends the existing `[data-editor='s3000xl']` block in `tokens.css`)

The current `[data-editor='s3000xl']` scope (already in [tokens.css:211-222](../../../../modules/editor-core/src/design/tokens.css)) is correct in shape but shallow — 8 tokens. Phase 2 task 2.1 will extend it to override:

| Token | Current global / s3000xl value | Proposed akai dialect value | Why |
|---|---|---|---|
| `--ac-color-surface-canvas` | `#111214` | `#1A1612` (HSL 28 8% 8%) | Warmer black, matches the matte plastic of the actual S3000XL chassis |
| `--ac-color-surface-panel` | `#1a1c20` | `#221E1A` (HSL 28 8% 12%) | Same warm undertone, slightly lifted |
| `--ac-color-border-subtle` | `#2e3138` | `#3A3530` (HSL 28 6% 22%) | |
| `--ac-color-text-primary` | `#e8e6e3` | `#E8DDC5` (HSL 38 25% 88%) | Cream silkscreen, not pure off-white |
| `--ac-color-text-muted` | `#8a8d93` | `#A89C8C` (HSL 30 12% 60%) | Warm gray |
| `--ac-color-accent` | `#d4a843` (gold) | `#F39200` (HSL 34 100% 50%) | The amber of the actual S3000XL LCD glow — bolder than the current gold, distinctive from roland's blue (#6bc3ea) |
| `--ac-color-selected` | `#d4a843` | `#F39200` | Same as accent (canonical pattern) |
| `--ac-color-warning` | `#e0b24f` | `#E5B22E` (HSL 45 80% 55%) | Saturated gold |
| `--ac-color-success` | `#4ade80` | `#5BBF7B` (HSL 140 40% 56%) | Slightly desaturated to live next to amber without competing |
| `--ac-color-danger` | `#fb7185` | `#DD5B5B` (HSL 0 60% 60%) | Warmer red |

The roland-primary token (`--ac-roland-primary: #6bc3ea`) is NOT overridden — that's a brand color for roland-tagged elements (e.g., the export-dialog accent on roland surfaces). The akai dialect introduces a parallel `--ac-akai-primary: #F39200` for any akai-tagged element; the `--ac-color-accent` alias points to it inside the `[data-editor='s3000xl']` scope.

### 3.2 REC-LED override

Current global (in `:root`): `--ac-color-rec: #f6533c` (S-550 hardware-referenced red).

Akai dialect override (inside `[data-editor='s3000xl']`):
```css
--ac-color-rec: #F47A00;       /* HSL 28 100% 48% — deep amber, matches the LCD "active" feel */
--ac-color-rec-glow: rgba(244, 122, 0, 0.55);
```

This carries forward to: the page-title underline (`.ac-page-title-row` accent rule), the live-edit footer dot, the virtual-front-panel pressed-LED, the FrontPanelButton arrow color. None of these need component-level changes.

### 3.3 Typography

The roland editor uses `Departure Mono → JetBrains Mono → IBM Plex Mono` for display, `IBM Plex Sans` for body, `JetBrains Mono` for mono. The akai dialect picks a distinctive sister stack:

| Token | Roland stack | Akai dialect stack | Why |
|---|---|---|---|
| `--ac-font-display` | `"Departure Mono", "JetBrains Mono", ...` | `"Major Mono Display", "Departure Mono", "JetBrains Mono", ...` | Major Mono Display is geometric monospace with distinctly different glyph shapes — distinctive without being slop, and fallbacks back to the roland stack so existing infrastructure works during incremental migration |
| `--ac-font-body` | `"IBM Plex Sans", system-ui, ...` | `"Sora", "IBM Plex Sans", system-ui, ...` | Sora is a humanist sans with character; distinct from Inter (forbidden by the design language) and from IBM Plex Sans |
| `--ac-font-mono` | `"JetBrains Mono", "IBM Plex Mono", ...` | `"Share Tech Mono", "JetBrains Mono", "IBM Plex Mono", ...` | Share Tech Mono evokes LCD readouts; reads as a font you'd see on an actual sampler's panel printout |

All three are Google Fonts (Open Font License) — no licensing friction.

The akai dialect override lives inside `[data-editor='s3000xl']`. Pages OUTSIDE the akai scope (the roland editor, anything on `/connect`, etc.) continue using the roland stack.

### 3.4 Virtual front panel — akai chassis tokens

The roland chassis tokens (`--ac-fp-chassis-top`, etc.) describe a neutral matte-black plastic. The akai dialect needs warmer values (the S3000XL plastic has a brown undertone in operator photos):

| Token | Roland (global) | Akai dialect |
|---|---|---|
| `--ac-fp-chassis-top` | `hsl(220 5% 7%)` | `hsl(28 6% 9%)` |
| `--ac-fp-chassis-bot` | `hsl(220 6% 3%)` | `hsl(28 8% 4%)` |
| `--ac-fp-chassis-edge` | `hsl(220 6% 3%)` | `hsl(28 8% 4%)` |
| `--ac-fp-btn-top` | `hsl(220 4% 14%)` | `hsl(28 4% 16%)` |
| `--ac-fp-btn-mid` | `hsl(220 5% 9%)` | `hsl(28 5% 11%)` |
| `--ac-fp-btn-bot` | `hsl(220 6% 5%)` | `hsl(28 6% 6%)` |
| `--ac-fp-btn-bezel` | `hsl(220 8% 2%)` | `hsl(28 10% 3%)` |
| `--ac-fp-btn-pressed-top` | `hsl(215 30% 18%)` (cool blue tint) | `hsl(34 60% 22%)` (warm amber tint) |
| `--ac-fp-btn-pressed-mid` | `hsl(215 28% 11%)` | `hsl(34 55% 14%)` |
| `--ac-fp-btn-pressed-bot` | `hsl(215 32% 6%)` | `hsl(34 60% 8%)` |
| `--ac-fp-label-fn` | `hsl(210 12% 86%)` | `hsl(38 20% 86%)` (cream) |
| `--ac-fp-label-pressed` | `hsl(210 96% 86%)` (bright blue) | `hsl(34 96% 86%)` (bright amber) |

Same chrome (chunky-button molded-plastic 3D extrusion, hairline bezel, ~80 ms mechanical-travel transition, pressed-LED dot), warmer palette. Phase 2 task 2.1 lifts these into the `[data-editor='s3000xl']` scope.

### 3.5 Front panel layout

The roland virtual front panel is a 7-column × 2-row 11-button grid (5x1.5 aspect ratio). The S3000XL front panel is structurally different — wider, with a 2-line LCD centerpiece, soft-function keys below the LCD, and mode/numeric clusters flanking. See § 4.4 for the proposed akai layout. **The `VirtualFrontPanel` component must accept a `layout` prop** (or be replaced by a per-device factory) so the akai dialect can mount its own grid without forking the chunky-button primitive.

This is the one place where the dialect needs structural (not just token-level) variance. The variance is honest — the hardware differs — and the prescribed pattern (per CLAUDE.md "Multi-Device Architecture") is a factory method returning an interface implementation, not a JSX conditional.

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
- ZoneOverview band (full-width, the keyboard range visualization with all keygroups laid out) — uses AcRangeBar primitives
- 2-column app shell: KeygroupList (left) + KeygroupEditor (right)
- KeygroupEditor uses AcRadioTabs with 5 tabs (Zones · Pitch · Filter · Amp · LFO)
- Amp tab contains the AcEnvelope (4-segment ADSR) primitive
- Filter tab contains AcEnvelope + filter cutoff slider (interacting controls in same tab)
- Live-edit footer beneath the detail column
- Virtual front panel beneath

Primitives consumed: PageTitleRow, AcRadioTabs, AcRangeBar (zone overview + per-zone range), AcEnvelope (segmentCount=4), AcSlider, AcSelect, AcCheckbox, VirtualFrontPanel.

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
| AcRadioTabs detail pane | absent (single-pane parameter grid) | `adopt-roland-pattern` | roland | 2.2 |
| Live-editing footer | absent | `adopt-roland-pattern` | roland | 2.2 |
| Virtual front panel — chassis chrome | absent | `genuinely-dialect` (tokens differ) | roland (component shape) | 2.1 + 2.2 |
| Virtual front panel — button grid layout | absent | structural divergence — needs factory | shared `FrontPanelButton`, per-device layout | 2.2 |
| Theme/dialect tokens | partial (`[data-editor='s3000xl']` 8 tokens) | extend | new (deepen akai scope) | 2.1 |

### 5.2 Atomic control primitives

| Primitive | Current akai equivalent | Disposition | Canonical side | Phase 2 task |
|---|---|---|---|---|
| AcInput | inline native input + `.s3k-param-input` | `adopt-roland-pattern` | roland | 2.2 |
| AcSelect | `.s3k-param-select` | `adopt-roland-pattern` | roland | 2.2 |
| AcSlider | `.s3k-param-track` + `.s3k-param-fill` | `adopt-roland-pattern` | roland (new shared `AcSlider`) | 2.2 |
| AcCheckbox | `.s3k-param-toggle` | `adopt-roland-pattern` | roland | 2.2 |
| AcRangeBar | inline SVG in `ZoneOverview` | `genuinely-dialect` (extract primitive) | new (shared) | 2.2 |
| AcEnvelope | `.s3k-envelope-display` (ADSR-only) | `genuinely-dialect` (parameterize segment count) | extend roland's 8-segment primitive | 2.2 |
| AcChevron | absent | `adopt-roland-pattern` | roland | 2.2 |
| AcButton | mix of `.s3k-*` and tailwind | `adopt-roland-pattern` | roland | 2.2 |

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

1. **Hand-rolled `.ac-page-sticky-header` / `.ac-page-header` instead of PageTitleRow.** Register as anti-pattern; the canonical replacement is the shared `PageTitleRow` component.
2. **Tailwind utility-class chrome in JSX (e.g., `text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300` for the launch-editor buttons in SamplesPage).** Register as anti-pattern; the canonical replacement is `.ac-btn` / `.ac-toolbar-btn`.
3. **Inline `<a href="/akai/s3000xl/editor/programs" className="text-blue-400 hover:underline">` for cross-page navigation prompts.** Register as anti-pattern; the canonical replacement is `.ac-link` (the design token `--ac-color-accent` carries through under the editor scope).
4. **`.s3k-param-input` / `.s3k-param-select` / `.s3k-param-toggle` parallel primitive family.** Register as anti-pattern; the canonical replacement is `.ac-input` / `.ac-select` / a new `.ac-toggle` primitive promoted from akai if the shape doesn't already exist on roland.
5. **`s3k-zone-tabs` / `s3k-zone-tab` parallel primitive (instead of AcRadioTabs).** Register as anti-pattern; the canonical replacement is AcRadioTabs.
6. **`.s3k-envelope-display` SVG-direct envelope graphic (instead of AcEnvelope).** Register as anti-pattern; the canonical replacement is AcEnvelope with `segmentCount` prop.

## 7. Scope-discovery-protocol tooling gaps surfaced

Phase 1 task 1.7 should file these against the scope-discovery-protocol feature for backfill during Phase 2:

1. **Editor-symmetry matrix participant model.** The current matrix at `docs/scope-discovery/editor-symmetry.md` is single-editor (roland-only). Phase 2 task 2.4 needs the matrix renderer to accept akai as a first-class participant. Filing as `SCOPE-DISCOVERY-AKAI-PARTICIPANT`.
2. **AcRangeBar adopter manifest.** No adopter manifest exists for AcRangeBar yet (the primitive itself doesn't exist — both roland and akai inline equivalents). Phase 2 task 2.2 will extract the primitive AND create the manifest. Filing as `SCOPE-DISCOVERY-AC-RANGE-BAR-MANIFEST`.
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
