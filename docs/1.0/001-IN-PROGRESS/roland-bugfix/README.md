# Roland Bug-Fix Catchment + Scope-Discovery Validation

This branch has **two intentionally co-located purposes** (extended 2026-05-22):

1. **Post-merge bug-fix catchment** for the Roland S-330 / S-550 editor surface (s550-support PRs [#433](https://github.com/audiocontrol-org/audiocontrol/pull/433) + [#434](https://github.com/audiocontrol-org/audiocontrol/pull/434), merged 2026-05-20). Operator-surfaced bugs land in the Phase 1 triage table.
2. **Validation test subject** for `feature/scope-discovery-protocol`'s Phase 4 (PR [#441](https://github.com/audiocontrol-org/audiocontrol/pull/441), merged 2026-05-22). Roland-surface clone groups in `docs/scope-discovery/clones.yaml` are dispositioned here; refactor-marked groups become Phase 3 PRs; tooling feedback flows to the scope-discovery-protocol team via [`tooling-feedback.md`](./tooling-feedback.md).

The two purposes share the same code surface but stay in **separate commits and PRs** — Phase 1's "no sweep refactors" rule is incompatible with Phase 3's refactor-PR shape, so the streams don't co-commit even though they co-locate.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Rolling Bug-Fix Pass | In Progress | Open-ended; operator-declared completion |
| Phase 2: Disposition Roland-surface clones (scope-discovery validation) | ✅ Closed 2026-05-22 | 172 → 0 pending touching us. Validation test subject for `feature/scope-discovery-protocol`'s Phase 4 (PR #441). See workplan disposition log + closure summary. |
| Phase 3: Roland-surface refactor PRs (clone-group cleanup) | ✅ Closed 2026-05-22 | 9 refactor commits landed concurrently with Phase 2. |
| Phase 4: Anti-pattern registry backfill | ✅ Closed 2026-05-23 | 9 anti-pattern entries committed; `make check-anti-patterns` → 0 findings. Dogfooding surfaced 5 real API-mismatch deferrals filed as RGM-001 (#455, closed) and the schema-gap that became #451 (closed via PR #454). |
| Phase 5: Adopter manifest backfill | ✅ Closed 2026-05-23 | 9 adopter manifests committed; `make check-adopters` → 0 holdouts. Filed + got fixes for #452 (globToRegex alternation) and #453 (`tracked_holdouts:` schema field) via PR #454. SlideDrawer now 6/6 Roland adopters after V3-IMPORT. |
| Phase 6: Cross-editor symmetry sweep | ✅ Closed 2026-05-23 | 9 conventions × 7 editors matrix captured + every asymmetry dispositioned. 9 Akai library dialogs are tracked_holdouts under cross-editor `ROLAND-BUGFIX-V3-AKAI` (out of scope per PRD). |
| Phase 7: `/scope-inventory` re-run with regime-holdout-detector | ✅ Closed 2026-05-23 | Updated `scope-manifest.yaml` with populated `regime_holdouts:` section; surfaceable holdouts remediated inline (RGM-001 sub-tasks 1-4) and V3-IMPORT (#450) drained all 3 Roland Import dialog deferrals + the 2 dead-code orphans. |
| Phase 8: Filter editor enhancement — TVF curve + above-the-fold reorder | Scoped 2026-06-01 | Promote akai `FilterDisplay` to editor-core `AcFilterCurveEditor`; Akai migrates; Roland tones FILTER tab reorders so envelope + filter curve sit above-the-fold. New adopter-manifest + anti-pattern entries continue Phase 5/6 dogfooding. Awaiting operator confirmation before implementation. |

## Documentation

- [PRD](./prd.md) — problem statement, scope, success criteria
- [Workplan](./workplan.md) — technical approach, bug triage table, per-fix gates
- [Implementation Summary](./implementation-summary.md) — post-completion report (placeholder)

## GitHub Tracking

- **Parent issue:** TBD
- **Phase 2:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442) — Scope-Discovery Audit + Duplication Findings
- **Phase 4:** [#447](https://github.com/audiocontrol-org/audiocontrol/issues/447) — Anti-pattern registry backfill
- **Phase 5:** [#448](https://github.com/audiocontrol-org/audiocontrol/issues/448) — Adopter manifest backfill
- **Phase 6:** [#449](https://github.com/audiocontrol-org/audiocontrol/issues/449) — Cross-editor symmetry sweep
- **Phase 7:** [#450](https://github.com/audiocontrol-org/audiocontrol/issues/450) — /scope-inventory re-run with regime-holdout-detector

## Worktree

- **Path:** `~/work/audiocontrol-work/audiocontrol-roland-bugfix`
- **Branch:** `feature/roland-bugfix`
