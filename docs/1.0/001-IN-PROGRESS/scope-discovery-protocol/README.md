# scope-discovery-protocol

**Status:** In Progress
**Feature Branch:** `feature/scope-discovery-protocol`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/`

A protocol that makes the agent's first move on a system-wide change an *upfront inventory pass* rather than a *reactive single-fix loop*. Forces complaint-widening as the default response to mid-session inconsistency reports. Motivated by the Roland S-330/S-550 editor v3 redesign, which spent ~230 operator turns over 60 hours doing brute-force discovery the agent should have done in 10–15 minutes at session start.

## Phase Status Table

| Phase | Status | GitHub Issue | Notes |
|-------|--------|--------------|-------|
| Phase 1 — Refinement | In Progress | TBD | Answer the five Open Questions in the PRD; sequence the six countermeasures from the analysis report; file GitHub issues. |
| Phase 2 — Core Skill + Manifest Schema | Planning | TBD | Build `tools/scope-discovery/` (manifest schema, inventory.ts, diff.ts), the upfront-inventory skill, and `make scope-inventory`. Dry-run against the historical s550-support feature. |
| Phase 3 — Rules + Sub-Agent Prompt Updates | Planning | TBD | Land the complaint-widening rule, point at it from `.claude/CLAUDE.md`, update `ui-engineer` / `frontend-design` / `code-simplifier` prompts, extend `dwd` to seed a strawman manifest. |
| Phase 4 — Validation | Planning | TBD | Paper-test against the s550 redesign timeline (≥85% coverage target); live-test against one fresh system-wide change; measure operator-turn delta vs. baseline. |

## Links

- PRD: [`prd.md`](prd.md)
- Workplan: [`workplan.md`](workplan.md)
- Implementation Summary (scaffold): [`implementation-summary.md`](implementation-summary.md)
- Source analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)

## How to Pick This Up Mid-Session

1. Read the PRD's Open Questions section — if any are still open, Phase 1 is in flight.
2. Check `gh issue list --label process,scope-discovery-protocol` for the current owning issue.
3. Read the latest `DEVELOPMENT-NOTES.md` entry tagged `[scope-discovery-protocol]` for context the workplan does not capture.
4. The workplan's `Proven complete when:` gates are the contract — a task is not done until its named artifact (file path, screenshot, test output line) is on disk.
