# Roland Bug-Fix Catchment + Scope-Discovery Validation — Product Requirements Document

**Created:** 2026-05-20
**Extended:** 2026-05-22 (scope-discovery validation added; see Problem Statement § 2)
**Status:** Draft (dual-purpose; see Problem Statement)
**Owner:** operator

## Problem Statement

This branch serves **two intentionally co-located purposes**:

**1. Post-merge bug-fix catchment for the Roland S-330 / S-550 editors.** The s550-support feature shipped a large redesign of those editors (PRs [#433](https://github.com/audiocontrol-org/audiocontrol/pull/433) + [#434](https://github.com/audiocontrol-org/audiocontrol/pull/434), merged 2026-05-20). Operator-driven use surfaces regressions, layout drift, and small bugs that warrant fixes against the just-merged surface. This branch is the catchment for that work. See Phase 1 in [`workplan.md`](./workplan.md).

**2. Validation test subject for `feature/scope-discovery-protocol` Phase 4.** When PR [#441](https://github.com/audiocontrol-org/audiocontrol/pull/441) merged 2026-05-22, this branch took on the role of dispositioning the Roland-surface clone groups in `docs/scope-discovery/clones.yaml` (172 of 495 pending touch our surface) and capturing tooling feedback. Each disposition + each refactor PR is evidence the scope-discovery tooling lands real value; we get a dispositioned baseline + a pre-commit gate that prevents future regression. See Phase 2 + Phase 3 in [`workplan.md`](./workplan.md).

The two purposes are intentionally co-located because they target the same code surface (`modules/roland-sxx0-editor` + `modules/editor-core`) and benefit from operating against the same dev-server / hardware setup. Phase 1 captures operator-surfaced bugs; Phase 2 + 3 capture agent-discoverable clone-duplication findings via the new tooling. **All three phases run concurrently**, not sequentially.

Implementers working on this branch must read the workplan's Phase headers to know which discipline applies — Phase 1's "no sweep refactors / no while-I-was-in-here" rule is incompatible with Phase 3's refactor-PR shape, so the two streams stay in separate commits and separate PRs even though they share the branch.

## User Stories

- As the operator, I want a dedicated branch where post-merge Roland bugs land as discrete commits so that fixes do not entangle with new-feature work
- As the operator, I want each fix verified against my own reproduction (visual + functional) before it is checked off, so that "green tests" never substitutes for "actually fixed"
- As a maintainer, I want a single bug-triage table per fix-pass round so that the diff between "shipped" and "still open" is always inspectable in one place

## Success Criteria

**Open-ended for Phase 1 — operator declares completion. Phase 2 + Phase 3 have explicit gates.**

Phase 1: There is no fixed checklist of bugs to fix. Bugs are added to [`workplan.md`](./workplan.md)'s triage table as they are found by the operator; fixes land as individual commits; the branch ships (or stays open for another round) when the operator says so.

Phase 2 (added 2026-05-21, re-scoped 2026-05-22 to consume PR #441 tooling): Disposition every clone group in `docs/scope-discovery/clones.yaml` that touches the Roland surface (172 of 495 pending at extension time). We are the validation test subject for `feature/scope-discovery-protocol`'s Phase 4. Closure gate is zero pending entries for groups touching `modules/roland-sxx0-editor` or `modules/editor-core`, plus a `tooling-feedback.md` handed back to that team.

Phase 3 (added 2026-05-21, re-scoped 2026-05-22): One PR per `refactor`-marked Phase 2 disposition, with operator confirmation. Runs CONCURRENTLY with Phase 2 — not sequential. Per-PR gates: detector confirms removal, build green, test gate green, real abstraction confirmed.

The per-fix gates (which are fixed) are recorded in [`workplan.md`](./workplan.md) under each phase's acceptance criteria.

## Implementation Phases

1. **Phase 1: Rolling Bug-Fix Pass** — In Progress. Open-ended; operator-surfaced bugs land in the triage table.
2. **Phase 2: Disposition Roland-surface clones (scope-discovery validation)** — ✅ Closed 2026-05-22. 172 → 0 pending touching us; validation test subject for PR #441's Phase 4.
3. **Phase 3: Roland-surface refactor PRs (clone-group cleanup)** — ✅ Closed 2026-05-22. 9 refactor commits landed concurrently with Phase 2.
4. **Phase 4: Anti-pattern registry backfill** — Pending (extension 2026-05-22). Exercise PR #446 T6.1 against the 9 Phase 2 refactor extractions; lock the regime so the same anti-patterns can't silently re-emerge.
5. **Phase 5: Adopter manifest backfill** — Pending (extension 2026-05-22). Exercise PR #446 T6.2 against the 9 new primitives + upstream SlideDrawer. The Import dialog holdouts surface here pending ROLAND-BUGFIX-V3-IMPORT.
6. **Phase 6: Cross-editor symmetry sweep** — Pending (extension 2026-05-22). Exercise PR #446 T6.3 against roland + akai + d110 + jv1080 + editor-core. Disposition every asymmetry.
7. **Phase 7: `/scope-inventory` re-run with regime-holdout-detector** — Pending (extension 2026-05-22). Re-invoke the now-5-agent fleet (T6.5 added the 5th); curate the new `regime_holdouts:` section of the manifest; remediate inline or file as follow-ups.

## Scope

### In Scope

- Bugs and polish in `modules/roland-sxx0-editor` (primary surface)
- Bugs in `modules/editor-core` shared primitives that the Roland editors consume, when a Roland-surface bug traces into them
- Protocol bugs in `modules/sampler-devices` / `modules/sampler-midi`, only if a real hardware repro surfaces one
- Diagnostic additions in `modules/e2e-infra`, only if a hardware-touching bug needs one

### Out of Scope

- Anything that isn't a bug or polish in the Roland editor surface — new features get their own branch
- Refactors larger than what is needed to fix a specific bug
- Tone/patch data-model changes that would require a new PRD
- [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) (D-SYS page) — missing-affordance enhancement, not a bug
- [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) (Copy/Derive) — missing-affordance enhancement, not a bug

If the operator decides to scope #407 or #409 in, that is an explicit call recorded in the workplan, not a default.

## Dependencies

None. s550-support is merged; the Roland editor surface is stable.

## Open Questions

None at definition time. Bugs come in via operator triage and are recorded in [`workplan.md`](./workplan.md)'s bug triage table as they are surfaced.

## References

Documents the discovery agents + downstream phase work should treat as authoritative:

- [`workplan.md`](./workplan.md) — task breakdown, phase acceptance gates, dual-purpose discipline.
- [`docs/scope-discovery/LAYOUT.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/LAYOUT.md) — on-disk contract for scope-inventory artifacts.
- [`docs/scope-discovery/clones.yaml`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/clones.yaml) — binding scope for the clone-disposition pass (172 of 495 groups touch our surface).
- [`docs/analysis/s550-redesign-scope-discovery.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/analysis/s550-redesign-scope-discovery.md) — motivation for the Phase 2 + 3 scope-discovery validation work.
- [`DESIGN-SYSTEM.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/DESIGN-SYSTEM.md) — typed capability contracts, dialog primitives, tree primitives the Roland editors consume.
- [`s550-support/explorations/*.html`](../../003-COMPLETE/s550-support/explorations/) — approved v3 design-language mockups for the five Roland routes.
- [`AUDITOR-IMPLEMENTER-PROTOCOL.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/AUDITOR-IMPLEMENTER-PROTOCOL.md) — audit-log finding lifecycle + disposition vocabulary.

## Appendix

### Predecessor Feature

This branch is the bug-fix catchment for the just-merged s550-support feature. See its post-completion report for what was shipped and the known caveats at merge time:

- [s550-support implementation summary](../../003-COMPLETE/s550-support/implementation-summary.md)
- [s550-support README](../../003-COMPLETE/s550-support/README.md)
