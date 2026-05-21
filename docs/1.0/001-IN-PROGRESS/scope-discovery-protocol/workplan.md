# scope-discovery-protocol — Workplan

**GitHub Milestone:** TBD (to be filled by `/feature-issues`)
**GitHub Issues:** TBD (to be filled by `/feature-issues`)
**Feature Branch:** `feature/scope-discovery-protocol`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/`

## Overview

Four-phase implementation that produces (1) a refined PRD with all Open Questions answered, (2) the core inventory tooling and upfront-inventory skill, (3) the complaint-widening rule and sub-agent prompt updates, (4) paper-test + live-test validation evidence.

The agent-discipline rule applies in full: every task has an observable completion gate; "tests pass" / "make clean" are not gates — the gate names the specific artifact (file path, screenshot, fixture, test output line) that proves the task achieved its purpose.

## Technical Approach

### Modules Affected

- `.claude/skills/` — new skill(s) for upfront inventory + multi-instance audit (project-local; promote to plugin later if a second project adopts)
- `.claude/rules/` — new rule file codifying the complaint-widening default
- `.claude/CLAUDE.md` — short pointer to the new rule (memory anchor near the existing rule index)
- `.claude/agents/` (or `~/.claude/agents/`, TBD in Phase 3) — updated prompts for `ui-engineer`, `frontend-design`, `code-simplifier`, etc.
- `tools/scope-discovery/` — supporting TypeScript: manifest schema, inventory capture script (Playwright + DOM token snapshot for UI; AST/grep matrix for code), diff script
- `Makefile` — add `make scope-inventory FEATURE=<slug>` target
- `.gitignore` — add `.scope-inventory/` exclusion
- `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/` — this feature's docs; promotes to `003-COMPLETE/` at close

### Strategy

Four sequential phases. Each phase produces a load-bearing artifact that gates the next:

1. **Refinement** answers Open Questions and produces the contract Phase 2 builds against.
2. **Core skill + manifest schema** is dry-run-validated against the historical s550-support feature before any rule or sub-agent prompt change. The skill must work end-to-end before the rules layer references it.
3. **Rules + sub-agent prompt updates** depend on the skill existing — the complaint-widening rule references the inventory artifact location, and the sub-agent dispatch updates point at the manifest schema.
4. **Validation** is paper-test first (cheap, historical) then live-test (load-bearing). Gaps from the live-test become follow-up issues, never silent deferrals.

### Dependencies

- **Playwright** — already in use for UI testing in the repo. Inventory script reuses the existing setup.
- **Dev server in headless inventory mode** — verify the existing dev-server setup supports this; otherwise the `make scope-inventory` target boots a temporary server.
- **No external services.** `.scope-inventory/` is plaintext, gitignored, ephemeral.
- **No new package dependencies expected.** YAML parsing and AST traversal use existing project dependencies; confirm in Phase 2 Task 1.

## Implementation Phases

### Phase 1: Refinement

**Deliverable:** a refined PRD + workplan with all five Open Questions answered concretely, the six countermeasures from the analysis report pruned/sequenced, and GitHub issues filed.

**Tasks:**

- [ ] **T1.1** — Re-read [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md) end-to-end. Pull the s550 evidence into the PRD as the motivating case study.
  - **Proven complete when:** PRD's Motivation/Evidence section quotes at least three specific operator-coaching lines from the analysis report and cites the ~230-turns-over-60-hours figure with the route × device × scenario decomposition.
- [ ] **T1.2** — Decide manifest format (YAML schema) and which `kind` values v1 supports. Initial proposal: `ui` confirmed; `code` recommended; `hybrid` decision pending.
  - **Proven complete when:** PRD Open Question 2 is replaced with a definitive decision; a draft JSON Schema lives in `tools/scope-discovery/schema/scope-manifest.schema.json` (placeholder OK at this phase — full schema lands in Phase 2 T2.1).
- [ ] **T1.3** — Decide skill split: one skill or two (upfront inventory vs mid-session widening).
  - **Proven complete when:** PRD Open Question 1 is replaced with a definitive decision and named skill(s) (e.g., `/scope-inventory` and `/scope-widen`, or a single `/scope-discovery`). The workplan's Phase 2 task list reflects the chosen split.
- [ ] **T1.4** — Decide plugin-vs-project-local placement for the skill(s).
  - **Proven complete when:** PRD Open Question 4 is replaced with a definitive decision. Default expected: project-local in `.claude/skills/` for v1.
- [ ] **T1.5** — Draft the complaint-widening escape-valve wording (the recoverable signal for *"the agent considered widening and decided against it"*).
  - **Proven complete when:** PRD Open Question 5 is replaced with a verbatim draft of the rule's escape-valve clause; the clause names what the agent must say in chat *before* fixing a single instance when the search returns >1 match.
- [ ] **T1.6** — Prune/sequence the six countermeasures from analysis report §5.
  - **Proven complete when:** the workplan explicitly maps each of 5.1–5.6 to a Phase 2/3/4 task, a follow-up issue, or an explicit "Out of Scope" entry in the PRD with rationale. Countermeasure 5.4 (visual-regression pre-commit gate) must remain Out of Scope per PRD unless the live-test in Phase 4 reveals the protocol fails to prevent the iteration pattern.
- [ ] **T1.7** — Create GitHub feature issue + per-phase issues via `/feature-issues`.
  - **Proven complete when:** the GitHub Tracking table below is populated with issue numbers, all phase issues reference the parent feature issue, the workplan's Phase 2–4 task lists each cite their owning GitHub issue, and `gh issue list` shows the issues attached to the active weekly milestone.

**Phase 1 acceptance gate:** All five Open Questions in the PRD are replaced with definitive answers; the workplan's Phase 2/3/4 task lists are concrete (no `TBD` task descriptions); GitHub issues exist and link back to the PRD and workplan.

### Phase 2: Core Skill + Manifest Schema

**Deliverable:** the inventory skill works end-to-end on the audiocontrol repo against a hand-authored `scope-manifest.yaml` for the (already complete) s550-support feature, producing a `.scope-inventory/s550-support/` directory whose surfaces match the enumeration in the analysis report.

**Tasks:**

- [ ] **T2.1** — Define `scope-manifest.yaml` JSON Schema; commit it under `tools/scope-discovery/schema/scope-manifest.schema.json`.
  - **Proven complete when:** the schema file exists at the named path; a hand-authored `scope-manifest.yaml` for s550-support validates against it via `ajv validate` (or equivalent); the schema's required fields are at minimum `kind`, `routes` (for `ui`), `modules` (for `code`), `scenarios`, `reference_docs`.
- [ ] **T2.2** — Build `tools/scope-discovery/inventory.ts` — reads the manifest, drives Playwright for UI surfaces (routes × devices × scenarios), runs AST/grep for code surfaces, writes per-surface artifacts to `.scope-inventory/<feature-slug>/`.
  - **Proven complete when:** running the script against the hand-authored s550-support manifest produces `.scope-inventory/s550-support/` containing one screenshot + DOM-token JSON per (route, device, scenario) tuple; file count matches the manifest's surface tuple count exactly; file under 500 lines.
- [ ] **T2.3** — Build `tools/scope-discovery/diff.ts` — pair-wise diff across surfaces and against reference docs, emitting `.scope-inventory/<feature-slug>/inventory.md` divergence matrix.
  - **Proven complete when:** `.scope-inventory/s550-support/inventory.md` exists and contains a markdown table with one row per detected divergence; each row cites the source surface(s) and the specific primitive/class/property that diverges; file under 500 lines.
- [ ] **T2.4** — Add `make scope-inventory FEATURE=<slug>` target.
  - **Proven complete when:** `make scope-inventory FEATURE=s550-support` from a clean worktree (no `.scope-inventory/` present) reproduces the same `inventory.md` byte-for-byte as T2.3's output (modulo file timestamps in DOM-token JSON).
- [ ] **T2.5** — Write the upfront-inventory skill (name decided in T1.3). The skill: detects the active feature, reads the manifest, runs inventory + diff, presents the matrix to the operator, asks for confirmation/pruning, writes the confirmed inventory into the workplan as the surfaces-in-scope table.
  - **Proven complete when:** the skill's `SKILL.md` exists at the path decided in T1.4; invoking the skill in a fresh session against the s550-support manifest produces the `.scope-inventory/s550-support/` directory AND posts the divergence matrix to chat AND writes a `Surfaces in scope` markdown table into the workplan file.
- [ ] **T2.6** — Add `.scope-inventory/` to `.gitignore` with an exception for the per-feature subdirectory when the feature closes (the operator can opt-in commit at close time).
  - **Proven complete when:** `git status` after running inventory shows no `.scope-inventory/` files as untracked; `git check-ignore -v .scope-inventory/foo` returns the line from `.gitignore`.
- [ ] **T2.7** — Dry-run against s550-support — does the output match the 32 surfaces in the analysis report?
  - **Proven complete when:** `.scope-inventory/s550-support/inventory.md` contains rows that map to ≥80% of the 32 surfaces tallied in [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md) §2; the dry-run report is committed at `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/dry-run-s550.md` and explicitly enumerates which surfaces matched, which were missed, and why each miss occurred.

**Phase 2 acceptance gate:** All Phase 2 tasks complete; `make scope-inventory FEATURE=s550-support` is idempotent (re-running on the same manifest replays into the same `.scope-inventory/` dir without duplication); skill respects existing project conventions (no `/tmp/`, no global state); dry-run coverage ≥80% with all gaps documented.

### Phase 3: Rules + Sub-Agent Prompt Updates

**Deliverable:** the complaint-widening default is enforced via a tracked rule, and the relevant sub-agents (`ui-engineer`, `frontend-design`, `code-simplifier`) refuse to propose single-instance fixes for cross-cutting concerns.

**Tasks:**

- [ ] **T3.1** — Write `.claude/rules/complaint-widening.md` codifying the default response shape (classify → grep → audit → diff → fix). Include the *"search returns one match"* exit condition and the escape-valve clause drafted in T1.5.
  - **Proven complete when:** the rule file exists; its content includes verbatim the five numbered steps (classify, grep, visit, diff, fix); the escape-valve clause from T1.5 is included with no edits weakening it; file under 500 lines.
- [ ] **T3.2** — Add a pointer to the rule from `.claude/CLAUDE.md` near the existing rule index.
  - **Proven complete when:** `.claude/CLAUDE.md` contains a one-line reference to `.claude/rules/complaint-widening.md` in the rule index; `grep complaint-widening .claude/CLAUDE.md` returns a non-empty match.
- [ ] **T3.3** — Confirm the canonical sub-agent prompt location (`.claude/agents/` vs `~/.claude/agents/`) — this resolves the *"TBD which surface"* note in the feature definition.
  - **Proven complete when:** a one-paragraph note is committed inline in the workplan documenting which path the sub-agents actually read at dispatch time, with the evidence (e.g., a session log line or a `dwd` skill reference) that confirms it.
- [ ] **T3.4** — Update `ui-engineer`, `frontend-design`, `code-simplifier` prompts at the location confirmed in T3.3 — add the mandatory prelude: sub-agent must report sibling surfaces before proposing fix.
  - **Proven complete when:** each agent's prompt file contains the prelude; the diff is committed; a smoke-test dispatch (e.g., `ui-engineer` asked to fix `.ac-page-title-row` on Patches) returns a recommendation naming Tones, Library, Connect, and Play as siblings before proposing any code change. Smoke-test output captured at `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/sub-agent-smoke-test.md`.
- [ ] **T3.5** — Update the orchestrator's sub-agent dispatch template — orchestrator dispatch prompts for visual/code fix work must include *"report siblings before proposing fix"* instruction.
  - **Proven complete when:** the dispatch template diff is committed; a fresh session dispatching one of the updated sub-agents shows the prelude in the dispatched prompt (verified by reading the session transcript or the dispatch tool input).
- [ ] **T3.6** — Add a section to `.claude/skills/feature-define/SKILL.md` (the `dwd` skill) so it asks *"is this a system-wide change?"* and seeds a strawman `scope-manifest.yaml` when the answer is yes.
  - **Proven complete when:** the diff is committed; invoking `dwd` against a synthetic test feature flagged as system-wide produces a `scope-manifest.yaml` strawman in the feature directory with at least one entry per declared route/module.

**Phase 3 acceptance gate:** The complaint-widening rule loads at session-start (verified by reading a fresh session's CLAUDE.md-derived context window for the rule pointer); the sub-agent smoke-test from T3.4 returns multi-route recommendations; the `dwd` change in T3.6 produces a strawman manifest on demand.

### Phase 4: Validation

**Deliverable:** evidence that the protocol works in practice — both on the historical case (paper-test) and on a live system-wide change.

**Tasks:**

- [ ] **T4.1** — Paper-test: walk the protocol step-by-step against the s550 redesign timeline.
  - **Proven complete when:** `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/paper-test-s550.md` exists and contains a row per the 32 documented surfaces in the analysis report §2, with columns marking which would have been caught by upfront inventory, which by complaint-widening, and which would still have required operator iteration. Combined coverage ≥85%; gaps are explicitly characterized (not glossed).
- [ ] **T4.2** — Live-test: pick one fresh system-wide change from the roadmap. Candidates include applying the v3 design language to `akai-s3000xl-editor`, consolidating error-handling patterns across modules, or converting remaining `as Type` casts. Decide candidate at start of Phase 4 by consulting `docs/1.0/ROADMAP.md`.
  - **Proven complete when:** the chosen feature has a committed `scope-manifest.yaml`, a `.scope-inventory/<slug>/` artifact set captured before the first fix, and an operator-turn count log captured from session start through feature completion. The log file is `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/live-test-<slug>.md`.
- [ ] **T4.3** — Compare live-test operator-turn count vs. the s550 baseline (~230 turns over the redesign tail).
  - **Proven complete when:** `live-test-<slug>.md` includes a normalized turn-count comparison: turns-per-surface-fixed, turns-per-day-of-work, and total turns. The comparison cites both the live-test absolute numbers and the s550 baseline rows from the analysis report.
- [ ] **T4.4** — Write up the validation results in `docs/1.0/003-COMPLETE/scope-discovery-protocol/validation.md` (the feature will move from `001-IN-PROGRESS/` to `003-COMPLETE/` at this point per the project's roadmap-queue workflow).
  - **Proven complete when:** the validation document exists at the named path; it summarizes paper-test and live-test results, names the protocol gaps surfaced by the live-test, and links to follow-up GitHub issues for each gap (not deferred silently).
- [ ] **T4.5** — Update `DEVELOPMENT-NOTES.md` with the protocol's first-use journal entry.
  - **Proven complete when:** a dated entry in `DEVELOPMENT-NOTES.md` describes what worked, what didn't, what the operator corrected, and the quantitative session metrics per the project's journal template.

**Phase 4 acceptance gate:** Paper-test report exists and meets the ≥85% target with reasons for every miss; live-test produces a measurably lower turn count than the s550 baseline; every protocol gap surfaced by the live-test has a filed GitHub follow-up issue; feature directory has moved to `003-COMPLETE/`; `implementation-summary.md` is filled in (no `TO BE FILLED AT COMPLETION` placeholders remain).

## GitHub Tracking

To be filled by `/feature-issues` after Phase 1 completes.

| Issue | Title | Phase | Status |
|-------|-------|-------|--------|
| #TBD  | [process] scope-discovery-protocol (parent) | All | Planning |
| #TBD  | Phase 1: Refinement | 1 | Planning |
| #TBD  | Phase 2: Core skill + manifest schema | 2 | Planning |
| #TBD  | Phase 3: Rules + sub-agent prompt updates | 3 | Planning |
| #TBD  | Phase 4: Validation | 4 | Planning |

Labels: `process`, `tooling`, `priority:high`, `infra`.

## Appendix — Links

- PRD: [`prd.md`](prd.md)
- Feature README: [`README.md`](README.md)
- Source analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)
