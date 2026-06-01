# Design — Editor UX pipeline: design language, lo-fi mockups, device-free capture

*Brainstorm date: 2026-06-01. Feeds workplan Phases 2–4 (appended via `/dw-lifecycle:extend`).*

## Problem

Mockups in this repo (`docs/**/explorations/*.html`) were doing double duty: they
specified **UX** (layout, flow, information hierarchy) **and** **visual design**
(palette, typography, signature components) in a single hand-authored hi-fi HTML
artifact. Two failure modes follow from that conflation:

1. **Staleness mistaken for intent.** A hi-fi mockup that *looks* like the real
   product but carries stale or accidental detail (carried-over CSS, a forgotten
   control, a drifted color) gets implemented literally, as if those details were
   deliberate. The `docs/analysis/s550-redesign-scope-discovery.md` write-up
   already names this: implementation was "entirely reactive to operator
   screenshots," with no proactive audit of as-built against the mockups.
2. **No home for visual design.** Because visual design lived *inside* the mockup,
   there is no standalone, durable specification of each editor's visual identity
   (the rec-LED red, the VFD glow, the CRT, the virtual front panel). It is
   scattered across memories, inline CSS comments, and one-off `01-design-language.html`
   mockup pages that rot.

## The reframe — three explicit stages, each owning one concern

| Stage | Owns | Artifact | Anti-staleness mechanism |
|---|---|---|---|
| **1. Design language** (per editor) | *What it looks like* — palette, type, signature components | Markdown spec **+ living styleguide gallery rendered from real components** | Gallery is generated from real components → cannot drift from as-built |
| **2. UX sketch** (per change) | *How it's organized & flows* | Lo-fi hand-drawn mockup | Deliberately un-styled → cannot be mistaken for visual direction |
| **3. Implementation + review** (per change) | *The realized thing* | Real components, shot device-free | Screenshot is of the actual product |

The unifying principle: **visual truth is anchored in real components, never in a
static artifact that can rot.** Markdown captures *intent and rationale*; the
living gallery and device-free screenshots capture *current pixels*. The old
mockup's "double duty" is split across Stages 1 and 2, with Stage 3 as the
realized truth.

## Decisions

### Item 1 — mockup fidelity → **lo-fi hand-drawn sketches** (not a hi-fi drift gate)

- **Rejected:** high-fidelity mockups policed by a heavy drift gate that compares
  mockup to as-built and dispositions every divergence. That machinery exists only
  to police a resemblance that shouldn't exist.
- **Chosen:** deliberately lo-fi, **hand-drawn (Sharpie-illustrator) sketches**.
  A hand-drawn sketch is physically incapable of being mistaken for shippable UI,
  so it carries *only* UX (layout/flow/hierarchy). Visual fidelity moves entirely
  to real components, reviewed via the device-free screenshot engine.
- **Inverted teeth:** instead of a gate that checks a mockup *matches* the product,
  a gate that checks a mockup is *deliberately unlike* it — exploration HTML may
  import **only** the shared sketch kit, never design-system tokens / `.ac-*`
  classes / brand colors. A mockup becomes structurally unable to impersonate the
  product. Cheap to enforce; ships validator-paired per `agent-discipline.md`.

### Item 2 — device-free render & capture engine (the load-bearing tool)

- **One engine, one job:** launch a real editor route with no hardware, feed it
  captured device data, capture a deterministic PNG. Serves promo material *and*
  in-loop visual review *and* the Stage-1 living gallery.
- **Data source:** reuse the **real-device-captured NDJSON** the simulated-MIDI
  fixtures already replay (`?midi=simulated&scenario=…` via the existing Vite
  middleware). Authentic over synthetic; curate by *selecting* which captures to
  shoot. A scene with no good capture → capture-from-hardware sub-task, never
  fabricate. Keeps content inside the blessed test/dev-fixture category.
- **Reliability = determinism:** captured data (no live device) + explicit ready
  hook + `document.fonts.ready` (no sleeps, per `feedback_no_delays`) + pinned
  viewport + device-scale-factor.
- **DRY:** generalize the existing `run-test-harness-e2e.sh` launch pattern; home
  in `modules/e2e-infra/`.

### Item 3 — per-editor design-language specification (the backfilled leg)

- **Per-editor markdown spec** at `docs/design-language/<editor>.md`: palette,
  typography, signature/branded components and their *rationale*, do's/don'ts —
  pointing at the `DESIGN-SYSTEM.md` tokens / `.ac-*` primitives that implement
  each, and at the living gallery for canonical pixels. Consolidates today's
  scattered identity into one formal home.
- **Living styleguide gallery:** a device-free route per editor cataloguing the
  real signature components; shot by the Item-2 engine. Its teeth: generated from
  real components, so structurally incapable of lying about as-built.

## Redline defaults (accepted)

- **Engine home:** `modules/e2e-infra/` (vs a new `modules/promo-studio/`).
- **Engine output:** generated to gitignored `out/promo/`; operator promotes chosen
  shots into a committed `docs/promo/` gallery.
- **Engine viewport:** 1280×800 logical @2x (2560×1600), full app-shell, no browser
  chrome. Framed / social presets (OG 1200×630) deferred as a follow-up.
- **Sketch tech:** pure-CSS sketch + bundled hand-drawn webfont (local, not CDN);
  rough.js only if genuinely wobbly strokes are wanted later.
- **Sketch kit home:** `docs/wireframe-kit/` (outside product modules — obviously
  not shippable code).
- **Existing hi-fi mockups:** grandfathered (gate applies to new explorations only);
  converting historical/shipped explorations is pure cost.
- **Design-language scope:** full spec for the two editors with a realized visual
  identity — Roland (S-330/S-550) and Akai (S3000XL). JV-1080 / D-110 get a
  one-line "design language TBD when this editor gets visual work" pointer;
  defining their language now would be fabrication.
- **Backfill ordering:** markdown specs can be written as soon as Item 3 starts;
  the living gallery is added once the Item-2 engine lands.

## Maps to workplan

- **Phase 2 — Device-free render & capture engine** (foundation; enables the living
  gallery + promo + review).
- **Phase 3 — Per-editor design-language specification** (markdown spec + living
  gallery; gallery depends on Phase 2).
- **Phase 4 — Lo-fi sketch mockup kit + wireframe-only gate** (independent of the
  engine; references the design-language spec by name).

Dependency: Phase 2 → Phase 3 (gallery). Phase 4 is independent. The existing
Phase 1 (filter editor) is unaffected; its T8.8 above-the-fold screenshot becomes a
natural first consumer of the Phase 2 engine.

## Deferred / follow-ups (explicit, per agent-discipline.md — no silent IOUs)

- Framed / social-media-preset screenshot variants (OG 1200×630, etc.).
- rough.js wobbly-stroke upgrade for the sketch kit, if pure-CSS feels too clean.
- Design-language specs for JV-1080 / D-110, when those editors get visual work.
