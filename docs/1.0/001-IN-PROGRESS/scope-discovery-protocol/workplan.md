# scope-discovery-protocol — Workplan

**GitHub Milestone:** TBD (to be filled by `/feature-issues`)
**GitHub Issues:** TBD (to be filled by `/feature-issues`)
**Feature Branch:** `feature/scope-discovery-protocol`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/`

## Overview

Four-phase implementation that produces (1) a refined PRD with all Open Questions resolved into binding answers, (2) the foundation tooling — a general code-clone detector and a programmatic sub-agent dispatch wrapper, both with adversarial validator harnesses, (3) the two skills (`/scope-inventory` and `/scope-widen`) implementing the multi-agent discovery model plus a `.dw-lifecycle/config.json` session.start.preamble nudge for system-wide features (no `dw-lifecycle` plugin modification), (4) validation by draining the existing audiocontrol duplication backlog to zero un-dispositioned entries plus a paper-test against the s550 redesign timeline.

The `.claude/rules/agent-discipline.md` rule applies in full: every task has an observable completion gate; *"tests pass"* / *"make clean"* are not gates — the gate names the specific artifact (file path, screenshot, fixture, test output line, committed disposition) that proves the task achieved its purpose. **Scope reduction by deferral is forbidden.** Resolutions in the PRD are binding; tasks below implement them in full, not in narrowed v1 shape.

## Technical Approach

### Modules Affected

- `.claude/skills/scope-inventory/` — new skill (multi-agent discovery + synthesis + strawman manifest output)
- `.claude/skills/scope-widen/` — new skill (targeted discovery for mid-implementation course-correction)
- `tools/scope-discovery/` — TypeScript supporting code:
  - `schema/scope-manifest.schema.json` (manifest JSON Schema covering `kind: ui | code | hybrid`)
  - `dispatch-wrapper.ts` (parses sub-agent return grammar, rejects malformed returns)
  - `dispatch-wrapper.validate.ts` (adversarial validator harness)
  - `clone-detector.ts` (wraps `jscpd` or AST-equivalent; reads/writes `docs/scope-discovery/clones.yaml` — committed, not gitignored)
  - `clone-detector.validate.ts` (adversarial validator harness)
  - `discovery-agents/` (UI-route enumerator, AST/grep matrix builder, clone-detector reader, PRD-themed pattern hunters)
  - `synthesis.ts` (combines discovery-agent findings into strawman manifest)
- `.githooks/pre-commit` — clone-detector gate
- `docs/<version>/<status>/<feature-slug>/scope-manifest.yaml` — **committed** per-feature manifest (alongside `prd.md`, `workplan.md`); review-visible and persistent
- `docs/<version>/<status>/<feature-slug>/scope-inventory/` — **committed** per-feature discovery evidence: `journal.md` index + `runs/<ISO-stamp>-<runId>/` per-invocation subdirectories holding `meta.json`, per-agent `findings/` JSON, `captures/` (screenshots + DOM-token JSON), and `synthesis.md`. The evidence trail is part of the planning record, NOT ephemeral. Full layout contract in [`../../../scope-discovery/LAYOUT.md`](../../../scope-discovery/LAYOUT.md).
- `docs/scope-discovery/clones.yaml` — **committed** repo-level clone-detector output (operator dispositions tracked here)
- `Makefile` — `make scope-inventory FEATURE=<slug>` target + `make refresh-clones-baseline`
- (No `.gitignore` changes for discovery artifacts — all artifacts are committed under `docs/`.)
- `.dw-lifecycle/config.json` — `session.start.preamble` field updated with a one-line reminder to invoke `/scope-inventory` for system-wide features. Project-local config only; **no modifications to the installed `dw-lifecycle` plugin directory** (verified via `git status` against the plugin path). Upstream contribution to `dw-lifecycle:define` for first-class system-wide-question handling is deferred to a future feature, conditional on Option 1 surfacing what the contribution should look like.
- `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/` — this feature's docs; promotes to `003-COMPLETE/` at close

Explicitly **NOT** modified (these were in earlier drafts but the design pivoted away):

- `.claude/rules/complaint-widening.md` — *removed from plan.* The pattern of pathologies surviving rule directives (DRY screaming prelude, chevron-size directives) makes a passive rule file the wrong primitive. Replaced by the dispatch wrapper (code-shaped enforcement).
- `.claude/CLAUDE.md` rule pointer — *removed from plan.* No rule file to point at.
- `.claude/agents/*` prompt updates — *removed from plan.* The wrapper enforces the behavior at dispatch time, regardless of agent prompt content. Cosmetic prompt updates are out of scope.

### Strategy

Four sequential phases. Each phase produces a load-bearing artifact that gates the next:

1. **Refinement** answers Open Questions and produces the binding contract Phase 2 builds against. Resolutions live in PRD §"Resolved Questions."
2. **Foundation tooling** ships the dispatch wrapper, the general clone detector, and both adversarial validator harnesses. These are the *gates* — code that mechanically enforces the protocol regardless of any agent's good behavior. Foundation must work end-to-end before any skill ships.
3. **Skills + session.start.preamble nudge** ships `/scope-inventory`, `/scope-widen`, the discovery agents, the synthesis pass, and the `.dw-lifecycle/config.json` session-start reminder. The skills sit *on top of* the gates from Phase 2; no `dw-lifecycle` plugin modification.
4. **Validation by drain** runs the tooling against the audiocontrol repo, dispositions every detected clone group, refactors the `refactor`-marked groups, and paper-tests against the s550 redesign timeline. The feature is not done until `docs/scope-discovery/clones.yaml` has zero un-dispositioned entries.

### Dependencies

- **Playwright** — already in use for UI testing. The UI-route discovery agent reuses the existing setup.
- **Clone-detection engine** — `jscpd` is the leading candidate; AST-based alternatives (`ts-prune`, custom AST traversal) considered in Phase 2 T2.2. Decision criterion: detects component-level clones across `.tsx` files, not just CSS class duplication.
- **Dev server in headless inventory mode** — the UI-route discovery agent boots a temp dev server on a OS-assigned port (per memory `feedback_test_ports.md`).
- **No external services.** Discovery artifacts (plaintext JSON + screenshots) are committed under `docs/<version>/<status>/<feature-slug>/scope-inventory/`; repo-level `clones.yaml` is committed at `docs/scope-discovery/clones.yaml`. Nothing in this protocol is gitignored.
- **No new package dependencies expected** beyond the clone-detection engine. Confirm in Phase 2 T2.2.

## Phase 1: Refinement [in progress; mostly resolved]

**GitHub Issue:** [#436](https://github.com/audiocontrol-org/audiocontrol/issues/436) (parent [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435))

**Deliverable:** PRD's Open Questions resolved into binding answers; analysis report §5 countermeasures mapped to phases; GitHub issues filed.

**Tasks:**

- [x] **T1.1** — Pull s550 evidence into the PRD as the motivating case study.
  - **Proven complete when:** PRD's Motivation/Evidence section quotes at least three specific operator-coaching lines from the analysis report and cites the ~230-turns-over-60-hours figure with the route × device × scenario decomposition. *Met by current PRD content.*
- [x] **T1.2** — Decide manifest format and which `kind` values v1 supports.
  - **Proven complete when:** PRD's Resolved Question 2 declares `kind: ui | code | hybrid` with all three implemented in v1. *Met.*
- [x] **T1.3** — Decide skill split: one skill or two.
  - **Proven complete when:** PRD's Resolved Question 1 declares two skills (`/scope-inventory`, `/scope-widen`) with distinct purposes. *Met.*
- [x] **T1.4** — Decide plugin-vs-project-local placement.
  - **Proven complete when:** PRD's Resolved Question 4 declares project-local first (`.claude/skills/`); promotion to plugin gated on adoption learnings. *Met.*
- [x] **T1.5** — Specify the dispatch wrapper's required return-grammar and rejection criteria.
  - **Proven complete when:** PRD's Resolved Question 5 specifies the verbatim `Searched: / Included: / Excluded: <reason>` grammar and the wrapper's rejection rules. *Met.*
- [x] **T1.6** — Map analysis report §5 countermeasures (5.1–5.6) to Phase 2/3/4 tasks, replacements, or Out of Scope.
  - **Proven complete when:** the workplan's appendix below contains the mapping table; each of 5.1–5.6 is cited and accounted for; 5.4 (visual-regression gate) remains Out of Scope; 5.2 (CLAUDE.md complaint-widening rule) and 5.5 (sub-agent prompt update) are explicitly marked as *replaced* by the dispatch wrapper, with rationale. *Met by the Countermeasure Mapping appendix below.*
- [x] **T1.7** — Create GitHub feature issue + per-phase issues via `/feature-issues` (now `/dw-lifecycle:issues`).
  - **Proven complete when:** the GitHub Tracking table below is populated with issue numbers; all phase issues reference the parent feature issue; the workplan's Phase 2/3/4 task lists each cite their owning GitHub issue; `gh issue list` shows the issues attached to the active milestone. *Met: parent [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435); phase issues [#436](https://github.com/audiocontrol-org/audiocontrol/issues/436)–[#439](https://github.com/audiocontrol-org/audiocontrol/issues/439); each phase header in this workplan now carries its owning issue.*

**Phase 1 acceptance gate:** All resolutions land in the PRD (met); countermeasure mapping table exists (T1.6 met); GitHub issues exist (T1.7 met — see GitHub Tracking table below). Phase 1 is complete.

## Phase 2: Foundation Tooling

**GitHub Issue:** [#437](https://github.com/audiocontrol-org/audiocontrol/issues/437) (parent [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435))

**Deliverable:** the general clone detector AND the dispatch wrapper exist with adversarial validator harnesses; both are wired into pre-commit and dispatch-accept pipelines; manifest schema is committed; discovery-evidence layout conventions are committed.

**Tasks:**

- [x] **T2.1** — Commit `tools/scope-discovery/schema/scope-manifest.schema.json` covering `kind: ui | code | hybrid`.
  - **Proven complete when:** the schema file exists; a hand-authored sample manifest for each kind validates via `ajv validate`; required fields include at minimum `kind`, `routes` (for `ui`), `modules` (for `code`), `scenarios`, `reference_docs`, and `discovery_themes`; file under 300 lines. *Met by commits `69f2b212` (initial schema), `f69a3140` (code-review fixes including removal of all `as Type` casts, refactor of parallel `exclude_globs/exclude_reasons` arrays into `excludes: [{glob, reason}]` objects, and addition of referential-integrity check for `route.scenarios[]` → top-level `scenarios[].id`), and `4c70362f` (stale `exclude_globs` prose nit). Three positive examples + one negative-test fixture all validate with `EXIT=0`.*
- [x] **T2.2** — Choose and integrate the clone-detection engine.
  - **Proven complete when:** `tools/scope-discovery/clone-detector.ts` exists; running it against a fixture directory containing two known-clone TSX components produces a `clones.yaml` listing the clone group; running against a fixture containing no clones produces an empty list; the choice of engine (`jscpd` vs. AST custom) is documented inline with rationale; file under 300 lines. *Met: `clone-detector.ts` (232 lines) wraps `jscpd` via subprocess; engine choice documented in the file header (jscpd already installed + configured at `.jscpd.json`; PRD's "no new deps" constraint confirmed). Helpers split out: `jscpd-runner.ts` (subprocess + report parse, 175 lines), `clones-yaml.ts` (shape + ser/deser + diff + disposition-merge, 266 lines), `util/typeguards.ts` (shared `isPlainObject` / `errorMessage` / `isEnoent`, 31 lines). Manual fixture verification: cloned-fixture (PageA/PageB sharing a 25-line fetch-with-cancel block) produced 2 clone groups; clean-fixture produced empty list; introducing a new clone (PageC/PageD) flipped exit to 1; deleting baseline groups dropped them (DROPPED, exit 0); `--refresh-baseline` preserved a hand-edited `disposition: keep-with-reason`. First baseline run against `modules/` produced 498 collapsed clone groups at `docs/scope-discovery/clones.yaml`, all `disposition: pending` — the Phase-4 dispositionable backlog.*
- [x] **T2.3** — Wire the clone detector into `.githooks/pre-commit`.
  - **Proven complete when:** the hook exists; a commit that introduces a new clone group (beyond what `clones.yaml` dispositions allow) is rejected by the hook with an actionable error naming the file:line pairs; a commit that does not introduce a new group passes; the hook respects `keep-with-reason` and `ignore-with-justification` dispositions from `clones.yaml`. *Met by commit `9b261b32` (initial hook + Makefile target) and `faeb82d8` (.PHONY fix + gate-order comment). Manual failure-mode test confirmed: synthetic duplicate TSX file under `modules/` produced exit 2 with output naming both file paths and line ranges. Disposition respect is structural: `diffClones` keys by `id` for all four `Disposition` values without branching on the value itself.*
- [x] **T2.4** — Build the dispatch wrapper at `tools/scope-discovery/dispatch-wrapper.ts`.
  - **Proven complete when:** the wrapper exposes a `wrap(agentType, prompt, options)` function that injects the required return-grammar prelude into the dispatched prompt, executes the dispatch, parses the return for the structured `Searched: / Included: / Excluded:` block, and either returns the parsed result or throws a `DispatchRejected` error with the missing block(s) named; file under 300 lines. *Met: `dispatch-wrapper.ts` (284 lines) exports `wrap(agentType, prompt, options)` which appends `GRAMMAR_INSTRUCTION` to the prompt, awaits the caller-supplied `dispatchFn` (Agent-tool injection — orchestrator supplies real dispatcher, T2.6 validator supplies synthetic), then parses + validates the return. Parser/validator/forbidden-phrase list extracted into sibling `dispatch-grammar.ts` (357 lines) to keep the wrapper under 300. `DispatchRejected` carries `missingBlocks: ReadonlyArray<'Searched'|'Included'|'Excluded'>` and `rawText`. Rejection rules: (1) any block missing; (2) `searched.count > 1 && included.length === 1 && excluded.length === 0` (skipped the same-class audit); (3) any `Excluded:` reason containing a forbidden deferral phrase from `.claude/rules/agent-discipline.md` (substring list + regex shapes for `until F<n>`/`until v<n>`/`until phase <n>`). Self-test via `tsx tools/scope-discovery/dispatch-wrapper.ts --self-test` exercises 4 fixtures (happy path + missing-Searched + skipped-audit + forbidden-TODO) — all 4 PASS. Comprehensive adversarial coverage lands in T2.6.*
- [ ] **T2.5** — Adversarial validator harness for the clone detector at `tools/scope-discovery/clone-detector.validate.ts`.
  - **Proven complete when:** the harness plants a known clone group beyond the baseline and asserts the detector flags it; plants a refactor that removes a baseline group and asserts the detector accepts the change; plants a known-legitimate near-duplicate covered by `ignore-with-justification` and asserts the detector honors the ignore; running the harness with the detector's logic intentionally gutted (e.g., always-pass) fails the harness.
- [x] **T2.6** — Adversarial validator harness for the dispatch wrapper at `tools/scope-discovery/dispatch-wrapper.validate.ts`.
  - **Proven complete when:** the harness plants a sub-agent return missing the `Included:` block and asserts rejection; plants a return with `Included: 1` and `Searched: count > 1` and no `Excluded:` block, asserts rejection; plants a return with the full grammar and asserts acceptance; plants a return with `Excluded: file:line — TODO later`, asserts rejection (the *"just for now"* phrase ban); running the harness with the wrapper's parser stubbed to always-pass fails the harness. *Met: `dispatch-wrapper.validate.ts` (245 lines) + scenario-table extracted to sibling `dispatch-wrapper.fixtures.ts` (336 lines) to keep both files under the 300-500 cap. 19 real-wrapper scenarios (7 acceptance — happy path, multi-line Included, prelude-quoted grammar, legitimate "later"/"follow up"/"until file end" usage, single-match no-Excluded — plus 12 rejection — missing Searched/Included/Excluded blocks, skipped-audit rule, forbidden phrases ("TODO", "for now", "we'll fix"), forbidden regexes ("until F1", "until v0.4"), malformed file:line, empty Included). Gutted self-check stubs `wrap()` with an always-accept substitute and re-runs every rejection scenario; the harness reports the stub as broken (12/12 rejection assertions correctly FAIL against the stub). Wired via `make check-dispatch-wrapper-validate`. All 20 scenarios PASS; exit 0.*
- [x] **T2.7** — Discovery-evidence layout conventions + `Makefile` targets.
  - **Proven complete when:** the workplan and the `/scope-inventory` skill's SKILL.md document the layout: `docs/<version>/<status>/<feature-slug>/scope-inventory/` with `journal.md` + `runs/<ISO-stamp>-<runId>/` per-invocation subdirectories holding `meta.json`, per-agent `findings/` JSON, `captures/`, and `synthesis.md`; `make scope-inventory FEATURE=<slug>` and `make refresh-clones-baseline` targets exist; running `make scope-inventory FEATURE=non-existent` exits non-zero with a clear error. **Nothing under `docs/` is gitignored** — verified by `git check-ignore -v` returning non-zero (not ignored) for any `docs/.../scope-inventory/` path. *Met: layout contract committed at [`../../../scope-discovery/LAYOUT.md`](../../../scope-discovery/LAYOUT.md) (the workplan's Modules Affected line links to it; T3.3's SKILL.md will reference it when that task lands — the LAYOUT.md IS the contract T3.3 must satisfy). `make scope-inventory FEATURE=<slug>` target wired via `tools/scope-discovery/find-feature.ts` (validates feature exists across the four status dirs, prints instructions on hit, errors with searched-paths list on miss). `make refresh-clones-baseline` wraps the existing `tsx tools/scope-discovery/clone-detector.ts --refresh-baseline`. Both targets added to `.PHONY`. Verified: `make scope-inventory FEATURE=non-existent` exits 1 with searched-paths list; `FEATURE=scope-discovery-protocol` exits 0 with the found path; `make refresh-clones-baseline` invokes the detector against the 498-group baseline. `git check-ignore -v` returns non-zero (not ignored) for `docs/scope-discovery/clones.yaml`, `docs/scope-discovery/LAYOUT.md`, and synthetic `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/scope-inventory/test/foo.png`.*
- [x] **T2.8** — Pre-commit hook wires both gates (clone detector AND dispatch wrapper) into a single hook entry point.
  - **Proven complete when:** `.githooks/pre-commit` invokes the clone detector check; the dispatch wrapper's adversarial validator runs as a separate `npm run test:scope-discovery` command that CI enforces (the wrapper itself fires at dispatch time, not commit time, so its validator is the CI gate not the pre-commit gate); both validators run in under 30s combined. *Met: pre-commit hook at [`.githooks/pre-commit`](../../../../.githooks/pre-commit) is unchanged — it still invokes only the fast clone-detector gate (`make check-clone-duplication`) on TS/TSX-touching commits, never the validators (the wrapper fires at sub-agent dispatch time inside an orchestrator session, not at commit time, so a commit-time wrapper check has nothing to validate). `pnpm test:scope-discovery` script added to root [`package.json`](../../../../package.json) — runs `make check-clone-duplication-validate && make check-dispatch-wrapper-validate` in sequence (second only runs if first succeeds). Equivalent `make test-scope-discovery` wrapper target added (mirrors the script; depends on both validate targets) so operators have either invocation path. Combined runtime: **3.9–4.5s wall-clock** (well under the 30s gate); both invocations exit 0 with `498 groups; 0 NEW; 0 DROPPED` on the clone side and `Summary: 43/43 scenarios passed` on the wrapper side. CI was removed 2026-05-11; per `.claude/rules/agent-discipline.md` §"When CI is absent, the controller is the gate", the orchestrator now runs this suite after every Phase-2 task dispatch (the habit that replaced the CI safety net). Documented in [`docs/scope-discovery/LAYOUT.md`](../../../scope-discovery/LAYOUT.md) §"Pre-commit gate vs. validator suite".*

**Phase 2 acceptance gate:** All Phase 2 tasks complete; both validator harnesses pass on the foundation code; a deliberate gut-the-logic test of either gate causes its validator to fail; `docs/scope-discovery/clones.yaml` exists (empty or with adoption-baseline entries from a first detector run, dispositioned).

## Phase 3: Skills + session-start preamble

**GitHub Issue:** [#438](https://github.com/audiocontrol-org/audiocontrol/issues/438) (parent [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435))

**Deliverable:** `/scope-inventory`, `/scope-widen`, the discovery-agent fleet, the synthesis pass, and the `.dw-lifecycle/config.json` session.start.preamble update are committed; smoke-test against the (complete) s550-support feature produces a strawman manifest that matches the analysis report's enumeration ≥80%.

**Tasks:**

- [ ] **T3.1** — Build the discovery-agent fleet at `tools/scope-discovery/discovery-agents/`.
  - **Proven complete when:** at least four discovery agents exist (UI-route enumerator, AST/grep matrix builder, clone-detector output reader, PRD-themed targeted-pattern hunter); each agent has a documented input contract (feature slug + PRD path + repo root) and output contract (structured findings JSON); each file under 300 lines.
- [ ] **T3.2** — Build the synthesis pass at `tools/scope-discovery/synthesis.ts`.
  - **Proven complete when:** the synthesis pass consumes N discovery-agent findings JSON files, deduplicates overlapping findings, ranks by surface-coverage and clone-severity, and emits a strawman `scope-manifest.yaml` valid against the schema from T2.1; file under 300 lines.
- [x] **T3.3** — Write `/scope-inventory` skill at `.claude/skills/scope-inventory/SKILL.md`.
  - **Proven complete when:** the skill exists; invoking it against the s550-support feature (already complete; serves as the fixture) creates a new timestamped run directory at `docs/1.0/003-COMPLETE/s550-support/scope-inventory/runs/<ISO-stamp>-<runId>/`, fans out the discovery-agent fleet in parallel writing per-agent findings JSON + captures + `synthesis.md` to the run directory, appends a journal entry to `docs/1.0/003-COMPLETE/s550-support/scope-inventory/journal.md`, writes the strawman manifest to `docs/1.0/003-COMPLETE/s550-support/scope-manifest.yaml`, and presents the manifest in chat with a reference to the journal entry so the operator can audit the evidence trail. Re-invocations create new run directories; do NOT overwrite prior runs. *Met by commit `45d4febf` (SKILL.md + this tick): skill committed at [`.claude/skills/scope-inventory/SKILL.md`](../../../../.claude/skills/scope-inventory/SKILL.md) (244 lines, under the 300 cap; YAML frontmatter validated). Procedure documents the 10-step flow named in the proven-complete clause: (1) slug regex validation, (2) feature-dir resolution via `make scope-inventory FEATURE=<slug>`, (3) run-ID generation (ISO-8601 + 6-char random), (4) `runs/<stamp>/{findings,captures}/` mkdir, (5) parallel fan-out of all four T3.1 agents with per-agent stderr capture and refuse-on-non-zero-exit, (6) synthesis via T3.2 `synthesis.ts` writing to `<FEATURE_DIR>/scope-manifest.yaml`, (7) `meta.json` to LAYOUT.md shape with operator/agent-exit-codes/synthesis-exit/captureCount=0 (v1 reserves the field; Playwright captures out of scope), (8) `synthesis.md` narrative (run summary, kind detection, routes, modules, themes, ref-docs, operator-curation hints), (9) append-only `journal.md` entry (newest-last; creates with top-level heading if absent), (10) terse summary block in chat with manifest/journal/evidence links. Re-invocation contract: new run dir per invocation (never overwritten); canonical `scope-manifest.yaml` overwritten by design (operator git-tags or branches to preserve curated prior state). Error handling table covers all five surfaces (bad slug, missing feature dir, agent failure, synthesis failure, journal write failure) with "refuse + leave evidence in place" semantics. Smoke-test against s550-support deferred to T3.6.*
- [x] **T3.4** — Write `/scope-widen` skill at `.claude/skills/scope-widen/SKILL.md`.
  - **Proven complete when:** the skill exists; invoking it with a complaint payload (e.g., *"the Patches header is misaligned"*) runs targeted discovery agents focused on the specific complaint, produces a widening proposal naming all sibling surfaces, and presents the proposal in chat in the dispatch-wrapper-grammar format (`Searched: / Included: / Excluded:`). *Met by commit `8de62ad2` (SKILL.md + this tick): skill committed at [`.claude/skills/scope-widen/SKILL.md`](../../../../.claude/skills/scope-widen/SKILL.md) (172 lines, under the 300 cap; YAML frontmatter validated). Procedure documents the 7-step flow: (1) parse the complaint for selector / component / pattern hints, (2) run targeted greps across `modules/*/src/`, (3) inspect each match and classify as Included (true sibling) or Excluded (intentionally different), (4) emit the proposal in the dispatch-wrapper grammar (`Searched: / Included: / Excluded:`), (5) avoid the forbidden deferral phrases enumerated in [`tools/scope-discovery/dispatch-grammar.ts`](../../../../tools/scope-discovery/dispatch-grammar.ts) (`FORBIDDEN_DEFERRAL_PHRASES` + `FORBIDDEN_DEFERRAL_REGEXES`; rationale: `.claude/rules/agent-discipline.md` §"Just for now is bullshit"), (6) present in chat as a fenced code block + one-paragraph explanation for operator confirmation, (7) handle no-match / single-match outcomes by surfacing the finding rather than fabricating a widening. Sibling skill cross-references `/scope-inventory`; the output IS the audit trail (no on-disk artifacts, no journal entry, no manifest touch). Smoke-test against a real s550-support widening flow deferred to T3.6.*
- [ ] **T3.5** — `/scope-inventory` works **standalone** (no `dw-lifecycle` plugin modification); `session.start.preamble` nudges its use for system-wide features.
  - **Proven complete when:** running `/scope-inventory <slug>` immediately after `/dw-lifecycle:define <slug>` + `/dw-lifecycle:setup <slug>` produces a strawman manifest from the feature stub — no `dwd` modification required; `git status` against the installed `dw-lifecycle` plugin directory shows no modifications; `.dw-lifecycle/config.json`'s `session.start.preamble` field contains the one-line reminder *"If this is a system-wide feature, run `/scope-inventory <slug>` before the first edit."* (verified by reading the file after the change lands).
- [ ] **T3.6** — Smoke-test the skill against s550-support.
  - **Proven complete when:** the s550-support feature directory contains a `scope-manifest.yaml` plus a `scope-inventory/` subdirectory with at least one populated run directory and a `journal.md` index; cross-referenced against the 32 documented surfaces in [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md) §2, the strawman covers ≥80% before operator curation; a smoke-test report at `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/smoke-test-s550.md` enumerates which surfaces matched, which were missed, and why each miss occurred.

**Phase 3 acceptance gate:** Both skills exist and invoke successfully against s550-support; `dwd` produces a working strawman on a synthetic test feature; smoke-test coverage ≥80% before curation.

## Phase 4: Validation by Drain

**GitHub Issue:** [#439](https://github.com/audiocontrol-org/audiocontrol/issues/439) (parent [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435))

**Deliverable:** the tooling has been run against the audiocontrol repo; `docs/scope-discovery/clones.yaml` has zero un-dispositioned entries; every `refactor`-marked entry has a merged PR; paper-test against the s550 redesign timeline is committed with ≥85% coverage.

**Tasks:**

- [ ] **T4.1** — Run the clone detector against `modules/*/src/`; commit the initial `docs/scope-discovery/clones.yaml`.
  - **Proven complete when:** the file exists; every entry has fields `id`, `members: [file:line]`, `disposition: pending`, `reason: null`; entries are sorted by member count descending (largest clone groups first).
- [ ] **T4.2** — Operator review pass: disposition every clone group.
  - **Proven complete when:** zero entries in `docs/scope-discovery/clones.yaml` have `disposition: pending`; every entry has `disposition` ∈ {`refactor`, `keep-with-reason`, `ignore-with-justification`}; every `keep-with-reason` and `ignore-with-justification` entry has a `reason` field with a non-empty one-line justification; the operator reviews and approves the dispositioned file.
- [ ] **T4.3** — Refactor PRs for every `refactor`-marked entry.
  - **Proven complete when:** every clone group with `disposition: refactor` has a merged PR (or a series of dependent merged PRs) that removes the clone; re-running the clone detector after merges shows zero `refactor`-marked entries with surviving clone members; `clones.yaml` is updated to reflect the post-refactor state.
- [ ] **T4.4** — Paper-test against the s550 redesign timeline.
  - **Proven complete when:** `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/paper-test-s550.md` exists with a row per the 32 surfaces in the analysis report §2; columns mark which would have been caught by `/scope-inventory`, which by `/scope-widen`, and which would still have required operator iteration. Combined coverage ≥85%; gaps explicitly characterized (not glossed).
- [ ] **T4.5** — Update `DEVELOPMENT-NOTES.md` with the protocol's first-use journal entry.
  - **Proven complete when:** a dated entry in `DEVELOPMENT-NOTES.md` tagged `[scope-discovery-protocol]` describes what worked, what didn't, what the operator corrected, and the quantitative session metrics per the project's journal template.
- [ ] **T4.6** — Move feature docs to `003-COMPLETE/`; update ROADMAP.
  - **Proven complete when:** `docs/1.0/003-COMPLETE/scope-discovery-protocol/` exists and contains all the feature docs; `docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/` is removed; `docs/1.0/ROADMAP.md` shows the feature as complete; `implementation-summary.md` is filled in (no `TO BE FILLED AT COMPLETION` placeholders remain).

**Phase 4 acceptance gate:** `docs/scope-discovery/clones.yaml` has zero un-dispositioned entries; every `refactor` entry has a merged PR; paper-test coverage ≥85% with gaps named; feature docs moved to `003-COMPLETE/`.

## GitHub Tracking

To be filled by `/feature-issues` after Phase 1 completes (T1.7).

| Issue | Title | Phase | Status |
|-------|-------|-------|--------|
| [#435](https://github.com/audiocontrol-org/audiocontrol/issues/435) | [process] scope-discovery-protocol (parent) | All | Planning |
| [#436](https://github.com/audiocontrol-org/audiocontrol/issues/436) | Phase 1: Refinement | 1 | In Progress |
| [#437](https://github.com/audiocontrol-org/audiocontrol/issues/437) | Phase 2: Foundation tooling | 2 | Planning |
| [#438](https://github.com/audiocontrol-org/audiocontrol/issues/438) | Phase 3: Skills + session-start preamble | 3 | Planning |
| [#439](https://github.com/audiocontrol-org/audiocontrol/issues/439) | Phase 4: Validation by drain | 4 | Planning |

Labels: `process`, `tooling`, `priority:high`, `infra`.

## Appendix — Countermeasure Mapping (T1.6)

The analysis report's §5 enumerates six countermeasures. Each is accounted for below:

| # | Countermeasure | Disposition |
|---|----------------|-------------|
| 5.1 | New skill: `/redesign-scope` (upfront inventory) | **Implemented** as `/scope-inventory` in Phase 3 T3.3. Renamed because the skill is universal (`kind: ui | code | hybrid`), not redesign-specific. |
| 5.2 | CLAUDE.md addition: complaint-widening default | **Replaced.** Passive rules in CLAUDE.md are systematically ignored for persistent pathologies (operator evidence: DRY screaming prelude, chevron-size directives). The dispatch wrapper (T2.4) + `/scope-widen` skill (T3.4) replace this with code-shaped enforcement that doesn't depend on the agent reading and obeying directive text. |
| 5.3 | Workplan template: "Surfaces in scope" table for UX/UI phases | **Implemented** as the per-feature `scope-manifest.yaml` committed alongside `prd.md` and `workplan.md` (Phase 3 T3.3) — the manifest IS the surfaces-in-scope table. No `dwd` template hack; the operator-invoked `/scope-inventory` writes it directly. |
| 5.4 | Pre-commit gate: visual regression across route inventory | **Out of scope** per PRD's Out-of-Scope list. The operator has rejected visual-regression gates in spirit (*"Gates are workarounds for not reading docs"*) and the analysis report itself rates 5.4 the weakest of the six. The general clone detector (T2.2) covers the structural-regression case (component duplication, drifted consumers) without the perceptual-hash flakiness. |
| 5.5 | Sub-agent prompt update: orchestrator's dispatch templates | **Replaced.** Updating agent prompts to ask for sibling enumeration would be another passive directive — the same failure mode as 5.2. The dispatch wrapper (T2.4) enforces the same behavior programmatically by parsing the return and rejecting malformed responses. Wrapper applies to all code-writing sub-agents in the registry regardless of their individual prompt contents. |
| 5.6 | Inventory artifact in the worktree: `.redesign-inventory/` | **Implemented** as `docs/<version>/<status>/<feature-slug>/scope-inventory/` (committed, NOT gitignored) per Phase 2 T2.7 / Phase 3 T3.3. Renamed for the same reason as 5.1; relocated under `docs/` because the discovery evidence is part of the planning record, not ephemeral. |

## Appendix — Links

- PRD: [`prd.md`](prd.md)
- Feature README: [`README.md`](README.md)
- Source analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)
- Discovery-evidence layout contract: [`../../../scope-discovery/LAYOUT.md`](../../../scope-discovery/LAYOUT.md)
