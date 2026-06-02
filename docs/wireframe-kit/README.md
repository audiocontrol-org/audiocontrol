# Wireframe kit — lo-fi, hand-drawn UX sketches

This kit is how we author **exploration mockups** in this repo. The mockups are
deliberately **lo-fi and hand-drawn** so that a sketch is physically incapable of
being mistaken for shippable UI. A sketch therefore carries **only UX** — layout,
flow, information hierarchy — and **never visual style**.

Visual truth lives in the real components (reviewed via the device-free
screenshot engine and the per-editor design-language spec), never in a static
artifact that can rot. See `docs/1.0/001-IN-PROGRESS/editor-ux-refinement/design-mockup-pipeline.md`
(Item 1 / Phase 4) for the full rationale.

## The rule

**Exploration HTML imports ONLY `sketch-kit.css`.**

- No design-system stylesheets.
- No `--ac-*` CSS variables.
- No `.ac-*` classes.
- No brand colors / product tokens.

A future pre-commit gate (`check-mockup-lofi`, workplan task P4.2) enforces this
mechanically: a mockup that links the real design system, or references `.ac-*` /
`--ac-*` / brand-color literals, **fails the build**. The point is inverted teeth
— instead of checking that a mockup *matches* the product, the gate checks that a
mockup is *deliberately unlike* it, so it can never impersonate the product.

## How to author a sketch

1. Create your exploration HTML under `docs/**/explorations/`.
2. Link only this kit:

   ```html
   <link rel="stylesheet" href="../../../wireframe-kit/sketch-kit.css" />
   ```

   (adjust the relative path to reach `docs/wireframe-kit/sketch-kit.css`).
3. Put the page content inside `<body class="sk-page">`.
4. Drop in the banner so every screenshot is self-labeling:

   ```html
   <div class="sk-banner"><span>WIREFRAME — not final visual · UX sketch only</span></div>
   ```
5. Compose the layout from the `.sk-*` vocabulary below.

`example-wireframe.html` in this directory is a worked example (a sketch of a
filter-tab layout). Open it in a browser to see the aesthetic.

## The `.sk-*` vocabulary

Tiny and composable. Every class is prefixed `.sk-` so it can never collide with
the product's `.ac-*` classes.

| Class | Role |
|---|---|
| `.sk-page` | The off-white "paper" surface with a faint ruled-notebook grid. Put it on `<body>`. |
| `.sk-banner` | The persistent, fixed "WIREFRAME — not final visual" warning ribbon. Wrap the label text in a `<span>`. |
| `.sk-box` | A generic wobbly-bordered box (a sketched region / placeholder). |
| `.sk-panel` | A labeled region; its first `.sk-label` child becomes an inside-the-border header. |
| `.sk-label` | Sketched text. Modifiers: `.sk-label--title` (large, wavy underline), `.sk-label--muted` (lighter pencil). |
| `.sk-btn` | A hand-drawn pill button. Modifier: `.sk-btn--primary` (highlighter fill). |
| `.sk-field` | An input placeholder box, with a scribbled-in "value" line. |
| `.sk-note` | A highlighter margin-note / annotation callout (prefixed with a ✎ pencil glyph). |
| `.sk-row` | Horizontal flex container. |
| `.sk-col` | Vertical flex container (use `flex` inline styles to weight columns). |

Tokens are `--sk-*` (`--sk-ink`, `--sk-paper`, `--sk-highlight`, `--sk-banner`,
`--sk-font`, …). They are intentionally **not** `--ac-*` — this kit shares nothing
with the product's design system.

## Constraints (why this kit looks the way it does)

- **Pure CSS + static HTML.** No build step, no JS framework, no network fetch at
  render time. Works offline and renders deterministically.
- **Wobbly borders** come from asymmetric `border-radius` plus a hair of per-box
  rotation jitter — no SVG filter, no rough.js (deferred per the design doc).
- **Self-contained.** The kit shares nothing with the real design system, so a
  sketch is visually unlike the product by construction.

## Hand-drawn font — follow-up note

The kit currently uses a **system hand-drawn font stack** that exists on macOS,
where these wireframes are authored and screenshotted:

```
"Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Marker Felt", "Noteworthy", cursive
```

No CDN / no `@import` from Google Fonts — that would break offline + deterministic
rendering and is forbidden by the brief.

**Follow-up (out of scope for the kit's initial authoring):** bundle an OFL
hand-drawn webfont locally (e.g. Architects Daughter or Caveat as a `.woff2` next
to `sketch-kit.css`, referenced by a relative `@font-face src`) so the aesthetic is
identical on Linux / CI runners that lack the macOS system fonts. The `@font-face`
wiring is trivial once the `.woff2` is present; only the binary font fetch is
deferred. Tracked in workplan task P4.1.
