# scope-discovery-protocol

**Status:** In Progress
**Feature Branch:** `feature/scope-discovery-protocol`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/`

A protocol that makes the agent's first move on a system-wide change an *upfront inventory pass* rather than a *reactive single-fix loop*, and that enforces sibling-enumeration on every code-writing sub-agent dispatch via a programmatic wrapper. Motivated by the Roland S-330/S-550 editor v3 redesign, which spent ~230 operator turns over 60 hours doing brute-force discovery the agent should have done in 10–15 minutes at session start.

The design treats agent-side enforcement as code, not directives — passive rules in CLAUDE.md and agent prompts are systematically ignored for persistent pathologies. Two skills (`/scope-inventory`, `/scope-widen`) handle discovery; a dispatch wrapper and a general clone detector handle enforcement; the existing audiocontrol duplication backlog IS the validation case.

## Phase Status Table

| Phase | Status | GitHub Issue | Notes |
|-------|--------|--------------|-------|
| Phase 1 — Refinement | In Progress | [#436](https://github.com/audiocontrol-org/audiocontrol/issues/436) | Open Questions resolved (T1.1–T1.6 complete); T1.7 complete (issues created — this row reflects them). |
| Phase 2 — Foundation Tooling | Planning | [#437](https://github.com/audiocontrol-org/audiocontrol/issues/437) | Build `tools/scope-discovery/`: manifest schema, clone detector + pre-commit gate, dispatch wrapper + return-grammar parser, adversarial validator harnesses for both gates. |
| Phase 3 — Skills + session-start preamble | Planning | [#438](https://github.com/audiocontrol-org/audiocontrol/issues/438) | Build `/scope-inventory` and `/scope-widen` skills implementing the multi-agent discovery model; update `.dw-lifecycle/config.json` session.start.preamble to remind the operator to invoke `/scope-inventory` for system-wide features (no `dw-lifecycle` plugin modification). Smoke-test against complete s550-support feature. |
| Phase 4 — Validation by Drain | Planning | [#439](https://github.com/audiocontrol-org/audiocontrol/issues/439) | Run the tooling against `modules/*/src/`; disposition every clone group; refactor every `refactor`-marked entry; paper-test against s550 redesign timeline (≥85% coverage). Feature is not done until `clones.yaml` has zero un-dispositioned entries. |

## Resolved Questions

The five Open Questions from the feature definition are now answered. Full text in [`prd.md`](prd.md) §"Resolved Questions"; one-line summaries:

1. **Two skills** — `/scope-inventory` for upfront discovery, `/scope-widen` for mid-implementation course-correction. Dispatch wrapper underneath both enforces sibling-enumeration programmatically.
2. **Universal** — `kind: ui | code | hybrid` all implemented in v1.
3. **Multi-agent discovery generates the strawman manifest** — operator curates, doesn't author from scratch.
4. **Project-local first** (`.claude/skills/`); promote to `dw-lifecycle` plugin after audiocontrol adoption surfaces what works.
5. **Wrapper-enforced return grammar** — sub-agent returns must include `Searched: / Included: / Excluded: <reason>` block; wrapper rejects malformed returns; adversarial validator harness fails CI if wrapper logic is gutted.

Plus the meta-resolution: **the existing audiocontrol duplication backlog IS the validation case** — this feature ships the tooling AND drains the backlog to zero un-dispositioned entries. No separate follow-up feature.

## Links

- PRD: [`prd.md`](prd.md)
- Workplan: [`workplan.md`](workplan.md)
- Implementation Summary (scaffold): [`implementation-summary.md`](implementation-summary.md)
- Source analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)

## How to Pick This Up Mid-Session

1. Read the PRD's "Resolved Questions" section — all five questions are answered with binding resolutions.
2. Read the workplan's Phase 1 task list — all of T1.1–T1.7 are checked; Phase 1 is complete. Next phase is Phase 2 (foundation tooling).
3. Check `gh issue list --label process,scope-discovery-protocol` for the current owning issue once T1.7 has run.
4. Read the latest `DEVELOPMENT-NOTES.md` entry tagged `[scope-discovery-protocol]` for context the workplan does not capture.
5. The workplan's `Proven complete when:` gates are the contract — a task is not done until its named artifact (file path, screenshot, test output line, committed disposition) is on disk.
