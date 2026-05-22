# Roland Bug-Fix Catchment + Scope-Discovery Validation

This branch has **two intentionally co-located purposes** (extended 2026-05-22):

1. **Post-merge bug-fix catchment** for the Roland S-330 / S-550 editor surface (s550-support PRs [#433](https://github.com/audiocontrol-org/audiocontrol/pull/433) + [#434](https://github.com/audiocontrol-org/audiocontrol/pull/434), merged 2026-05-20). Operator-surfaced bugs land in the Phase 1 triage table.
2. **Validation test subject** for `feature/scope-discovery-protocol`'s Phase 4 (PR [#441](https://github.com/audiocontrol-org/audiocontrol/pull/441), merged 2026-05-22). Roland-surface clone groups in `docs/scope-discovery/clones.yaml` are dispositioned here; refactor-marked groups become Phase 3 PRs; tooling feedback flows to the scope-discovery-protocol team via [`tooling-feedback.md`](./tooling-feedback.md).

The two purposes share the same code surface but stay in **separate commits and PRs** — Phase 1's "no sweep refactors" rule is incompatible with Phase 3's refactor-PR shape, so the streams don't co-commit even though they co-locate.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Rolling Bug-Fix Pass | In Progress | Open-ended; operator-declared completion |
| Phase 2: Disposition Roland-surface clones (scope-discovery validation) | Pending | 172 of 495 clone groups in `docs/scope-discovery/clones.yaml` touch our surface; disposition each + capture tooling feedback. We are the validation test subject for `feature/scope-discovery-protocol`'s Phase 4 (PR #441). |
| Phase 3: Roland-surface refactor PRs (clone-group cleanup) | Concurrent with Phase 2 | One PR per `refactor`-marked group; not sequential with Phase 2 |

## Documentation

- [PRD](./prd.md) — problem statement, scope, success criteria
- [Workplan](./workplan.md) — technical approach, bug triage table, per-fix gates
- [Implementation Summary](./implementation-summary.md) — post-completion report (placeholder)

## GitHub Tracking

- **Parent issue:** TBD
- **Phase 2:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442) — Scope-Discovery Audit + Duplication Findings

## Worktree

- **Path:** `~/work/audiocontrol-work/audiocontrol-roland-bugfix`
- **Branch:** `feature/roland-bugfix`
