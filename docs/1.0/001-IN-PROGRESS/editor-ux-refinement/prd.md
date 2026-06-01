# PRD — editor-ux-refinement

## Problem

The audiocontrol editors share infrastructure via `editor-core` but accumulate per-editor visual primitives that drift over time. Examples surfaced by recent work:

- The Akai keygroup editor renders an LPF biquad filter-response curve in `FilterDisplay` that the Roland TVF tab could reuse but doesn't, so adoption stays single-editor.
- The Roland tones FILTER tab buries its envelope graphic and (today, absent) filter curve below several rows of sliders; on a default viewport the visualizations are below the fold, which makes the screen feel like a parameter dump rather than a sound-design surface.
- Cross-editor visual drift gets caught reactively (by audits, by the operator's eye), not proactively, because there is no parking lot for "refine the look" work that isn't a device bug or a library feature.

Without a long-running home for this work, every cross-editor refinement either rides on a device-scoped branch (and tangles bug-fix discipline with enhancement scope) or never lands at all.

## Goals

- A single branch + workplan that absorbs cross-editor UX refinements as they're identified, with phase-by-phase shipping discipline.
- Every promotion to `editor-core` registers an adopter manifest + anti-pattern entry so the gates prevent re-inlining downstream.
- Editor-tab reorders are validated by Playwright `getBoundingClientRect()` assertions, not eyeball checks, so above-the-fold claims are observable.

## Non-goals

- Library UX (browser, drag-drop, storage-zone work) — that's `library-ux`.
- Device-protocol bug fixes — those stay on the relevant device-scoped branch.
- Foundational non-modal workflow architecture decisions — that's `edit-workflow-architecture`.

## Success criteria

Per phase:

- The promotion landed atomically across all adopters (no "Akai-only for now" splits).
- `make check-adopters` + `make check-anti-patterns` + `make check-clone-duplication` + `make check-css-duplication` are all clean after the phase commit.
- The phase's UI specs cover every manually verified interaction; above-the-fold claims have `getBoundingClientRect()` assertions.
- Before/after screenshots are attached for operator review.

For the branch overall:

- Phases ship as PRs against `main`; the branch stays alive between phases, rebased onto `main` as needed.
- New phases get appended as scope is identified, not pre-defined years in advance.

## Implementation Phases

Phases ship as PRs against `main`; the branch stays alive between phases. Full task breakdowns live in [workplan.md](./workplan.md).

- **Phase 1 — Filter editor (TVF curve + above-the-fold reorder).** Promote Akai `FilterDisplay` → editor-core `AcFilterCurveEditor`; both editors adopt at one commit; Roland FILTER tab reorders above-the-fold. *(In progress; seeded from roland-bugfix Phase 8.)*
- **Phase 2 — Device-free render & capture engine.** One engine that renders a real editor route with no hardware (real-device-captured fixtures) and captures deterministic PNGs — for promo material, in-loop visual review, and the Phase 3 living gallery. *(Added 2026-06-01 per [design-mockup-pipeline.md](./design-mockup-pipeline.md).)*
- **Phase 3 — Per-editor design-language specification.** Backfill the visual-design leg cleaved out of mockups: a per-editor markdown spec + a living styleguide gallery rendered from real components. *(Depends on Phase 2 for the gallery.)*
- **Phase 4 — Lo-fi sketch mockup kit + wireframe-only gate.** Replace hi-fi mockups with hand-drawn sketches that carry only UX; an inverted-teeth gate forces exploration HTML to use only the sketch kit. *(Independent of the engine.)*

## Open questions

- Should this track absorb the `frontend-design` skill outputs (creative redesigns) or stay narrowly defined to "refinements of shipped surfaces"? Default: refinements only; bigger redesigns get their own feature definition.
- Are cross-editor design-token additions in scope (e.g., a new `--ac-curve-accent` variable used by AcFilterCurveEditor)? Default: yes, when the token arises from a phase's promotion work.
