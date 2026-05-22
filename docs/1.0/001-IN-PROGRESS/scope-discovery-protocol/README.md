# scope-discovery-protocol

**Status:** In Progress
**Feature Branch:** `feature/scope-discovery-protocol`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/`

A protocol that makes the agent's first move on a system-wide change an *upfront inventory pass* rather than a *reactive single-fix loop*, and that enforces sibling-enumeration on every code-writing sub-agent dispatch via a programmatic wrapper. Motivated by the Roland S-330/S-550 editor v3 redesign, which spent ~230 operator turns over 60 hours doing brute-force discovery the agent should have done in 10–15 minutes at session start.

The design treats agent-side enforcement as code, not directives — passive rules in CLAUDE.md and agent prompts are systematically ignored for persistent pathologies. Two skills (`/scope-inventory`, `/scope-widen`) handle discovery; a dispatch wrapper and a general clone detector handle enforcement; the existing audiocontrol duplication backlog IS the validation case.

## Phase Status Table

| Phase | Status | GitHub Issue | Notes |
|-------|--------|--------------|-------|
| Phase 1 — Refinement | Complete | [#436](https://github.com/audiocontrol-org/audiocontrol/issues/436) | Open Questions resolved into binding answers + GitHub issues filed. |
| Phase 2 — Foundation Tooling | Complete | [#437](https://github.com/audiocontrol-org/audiocontrol/issues/437) | Manifest schema + clone detector + pre-commit gate + dispatch wrapper + return-grammar parser + both adversarial validators + discovery-evidence layout + `pnpm test:scope-discovery` all merged in PR #441. |
| Phase 3 — Skills + session-start preamble | Complete | [#438](https://github.com/audiocontrol-org/audiocontrol/issues/438) | `/scope-inventory` + `/scope-widen` skills + 4 discovery agents + synthesis pass + session.start.preamble nudge. Smoke-test 81.3% coverage + paper-test 87.5% combined against s550 redesign's 32 surfaces (≥85% gate PASS). |
| Phase 4 — Validation by Drain | In Progress | [#439](https://github.com/audiocontrol-org/audiocontrol/issues/439) | T4.1 / T4.4 / T4.5 shipped via PR #441. T4.2 / T4.3 / T4.6 deferred to the active post-s550 bugfix branch (per the reframe in workplan §"Branch reframe"); feature flips to `003-COMPLETE/` when that branch's burndown finishes. |
| Phase 5 — Refactor Preconditions (CRITICAL) | Complete | [#443](https://github.com/audiocontrol-org/audiocontrol/issues/443) | `clones.yaml` discriminated union: refactor entries carry `canonical_side: <file>\|"all"\|"new"` + `tests` + `tests_proof.sha`. Commit-msg hook gates `Closes clones.yaml <id>` markers via runtime validator (canonical-side file existence + sha resolves in git + named test commands' exit codes). Per-branch verification language in code-reviewer + codebase-auditor agent prompts; dispatch wrapper carries conditional refactor-context prelude. Adversarial validator covers 8 rejection paths + gutted-stub self-check. |
| Phase 6 — Regime-Holdout Discovery | Complete | [#444](https://github.com/audiocontrol-org/audiocontrol/issues/444) | Anti-pattern registry + adopter manifests + cross-editor symmetry checker + deprecation-driven scan + new `regime-holdout-detector` agent joining `/scope-inventory`'s fleet. Four pre-commit gates (anti-patterns blocks; adopter-manifests blocks; editor-symmetry read-only; deprecation informational). `regime_holdouts:` top-level section in `scope-manifest.yaml`. Docs in `docs/scope-discovery/README.md` §"Regime-holdout discovery" + `LAYOUT.md` §"Phase 6 regime-holdout artifacts". |
| Phase 7 — Tooling Hardening + Operator QoL | Complete | [#445](https://github.com/audiocontrol-org/audiocontrol/issues/445) | Content-hashed clone-group IDs (no more line-shift orphaning), self-installing `make scope-inventory`, `make clone-summary`, upstreamed `batch-dispose.ts`, polish bundle (clone-detector `--diff` + `--refresh-baseline` summary line; URL-stripping tokenizer; `## Synthesizer notes` plumbing via `--notes-out`; `pnpm test:scope-discovery` cross-reference; `make install-hooks` gate enumeration; post-commit + pre-push pair catching `--no-verify` bypass). `pnpm test:scope-discovery` reports 170 scenarios passing. |

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
