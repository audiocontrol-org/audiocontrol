# editor-ux-refinement

Long-running track for cross-editor UI/UX refinements and shared visual-primitive promotions. Co-locates work that:

- Promotes per-editor visual primitives into `editor-core` (e.g., FilterDisplay → AcFilterCurveEditor, future envelope or LFO viz consolidations).
- Reorders editor-page chrome for above-the-fold legibility (envelope + filter curve visible without scroll at default viewport).
- Tightens cross-editor visual consistency where the audit surfaces drift the design-system primitives haven't caught yet.

This is a parking lot for editor-page UX work that doesn't belong on a device-scoped branch (roland-bugfix, akai-ux-improvement) or a library-scoped branch (library-ux). The branch lives for the long run; phases close as they ship; new phases get appended as new refinement scope is identified.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Filter editor — TVF curve + above-the-fold reorder | Implementation complete; pending operator review | T8.1–T8.5 done (AcFilterCurveEditor promoted). T8.9–T8.13 done: `AcDisclosure` primitive (supersedes `CollapsibleSection`; D-110 migrated), Roland FILTER tab compacted (sliders/modes + per-segment table under TWEAK disclosures; `AcEnvelope.showTable` opt-out), above-the-fold verified at 1280×900 (curve bottom ≈887px, was ≈1010). T8.6/T8.7 tests done (AcDisclosure + AcFilterCurveEditor contract tests; tone-filter-layout wiring specs). All scope/CSS/chevron gates clean; full build green. See [workplan.md](./workplan.md) §Phase 1 |
| Phase 2: Device-free render & capture engine | In progress | P2.1–P2.5 done — `make promo-shots` produces deterministic device-free PNGs (verified). P2.6 (filter-tab above-the-fold shot) blocked on Phase 1 |
| Phase 3: Per-editor design-language specification | In progress | P3.1–P3.3 specs done; P3.4 living gallery blocked on Phase 2 engine |
| Phase 4: Lo-fi sketch mockup kit + wireframe-only gate | Done | Sketch kit + check-mockup-lofi gate (validator-paired, pre-commit) + grandfather + brief convention |

## Links

- [Workplan](./workplan.md) — phase breakdown, tasks, acceptance criteria.
- [PRD](./prd.md) — problem statement, scope boundaries, success criteria.
- Seed conversation: roland-bugfix Phase 8 migrated 2026-06-01; original location `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md` (now stub-redirected).

## Branch and worktree

- Branch: `feature/editor-ux-refinement`
- Worktree: `~/work/audiocontrol-work/audiocontrol-editor-ux-refinement/`

## Scope boundaries

**In scope**

- Cross-editor shared-primitive promotions (visual components in `editor-core`).
- Editor-page tab/panel reorders that affect above-the-fold legibility.
- Design-system additions that arise out of a specific refinement and would otherwise duplicate.

**Out of scope**

- Library browser UX → `library-ux`.
- Akai-specific workflow restructuring → `akai-ux-improvement` (which is complete; new Akai-only work would need its own follow-up).
- Roland device-protocol bug fixes → `roland-bugfix`.
- Foundational workflow-architecture decisions → `edit-workflow-architecture`.
