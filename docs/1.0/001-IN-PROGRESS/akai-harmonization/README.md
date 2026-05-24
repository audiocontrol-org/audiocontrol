# Akai Harmonization

**Status:** Active
**Branch:** `feature/akai-harmonization`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-akai-harmonization`

The audiocontrol editor surfaces for `roland-sxx0-editor` and `akai-s3k-editor` were built at different times against different design conventions and are visibly drifting into one-off prototype aesthetics. As more editors land (jv1080, d110, and beyond), the drift compounds. This feature establishes a shared design-language contract (captured in `harmonization-spec.md` via a `/frontend-design` audit), migrates the akai and roland surfaces to conform to canonical primitives in `editor-core`, then applies the scope-discovery tooling — `clones.yaml` dispositions, adopter-manifests, anti-patterns, and the editor-symmetry matrix — to the harmonized akai surface. Phase ordering is load-bearing: harmonization first (Phase 1 → Phase 2), scope-discovery second (Phase 3). A cross-cutting Phase 0 catches bugs surfaced during any of the streams and fixes them in scope, one commit at a time.

## Status

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 0: Rolling Bug-Fix Pass (cross-cutting) | Pending | — | — | Open-ended; operator-declared completion. Bug rows accumulate in `workplan.md` as the audit / harmonization / scope-discovery passes surface them. |
| Phase 1: Design-language audit (`/frontend-design`-gated) | Pending | — | — | Produces `harmonization-spec.md`. No code change; audit output only. Operator approval required before Phase 2 begins. |
| Phase 2: Harmonization implementation | Pending | — | — | Per-primitive migration commits. Each declares `canonical_side` in the commit message per the scope-discovery-protocol contract. Operator approval of the post-harmonization screenshot sweep required before Phase 3 begins. |
| Phase 3: Scope-discovery on the harmonized akai surface | Pending | — | — | Refresh akai clone baseline; disposition every akai-touching entry; close `refactor`-marked groups with full Step 0 disposition shape; backfill adopter-manifests + anti-patterns; update editor-symmetry matrix. |

## Documentation

- [PRD](./prd.md) — problem statement, scope, success criteria, dependencies, open questions
- [Workplan](./workplan.md) — phase breakdown, bug triage table, per-phase acceptance gates, per-phase gate matrix
- [Implementation Summary](./implementation-summary.md) — post-completion report (placeholder; filled in as phases complete)

## GitHub Tracking

- **Parent issue:** [#457](https://github.com/audiocontrol-org/audiocontrol/issues/457) — `[akai-harmonization] feature lifecycle parent`
- **Phase 0:** [#458](https://github.com/audiocontrol-org/audiocontrol/issues/458) — Rolling Bug-Fix Pass
- **Phase 1:** [#459](https://github.com/audiocontrol-org/audiocontrol/issues/459) — Design-language audit
- **Phase 2:** [#460](https://github.com/audiocontrol-org/audiocontrol/issues/460) — Harmonization implementation (blocked on #459)
- **Phase 3:** [#461](https://github.com/audiocontrol-org/audiocontrol/issues/461) — Scope-discovery on harmonized akai surface (blocked on #460)
