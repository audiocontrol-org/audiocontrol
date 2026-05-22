# Tooling Feedback — scope-discovery-protocol (PR #441)

Feedback from `feature/roland-bugfix` exercising the scope-discovery tooling as the test subject for that feature's Phase 4. Updated as we exercise more surfaces. Bullets are tagged for readability:

- ✅ **Worked smoothly** — no friction worth flagging
- 🤔 **Surprised / unclear** — worked but the contract wasn't obvious
- ❌ **Blocked / had to work around** — needs a fix or a doc update

When a section has nothing observed yet, the bullet list is left empty.

## `make install-hooks`

- ✅ One-shot install; output line `hooks installed: core.hooksPath = .githooks` plus the two gates it wires (CSS-duplication, TS/TSX clone) was concise and correct.
- 🤔 No mention in the install output that the chevron-sizing gate (from PR #440) is also wired in pre-commit. Not a PR-#441 concern, but a developer running install-hooks fresh might want a "what's now active" summary line that enumerates ALL hook gates, not just the two that PR #441 added. Cheap doc fix.

## `make check-clone-duplication`

- (Not yet exercised end-to-end on this branch — the gate at HEAD currently has nothing to fail against because the merged baseline matches HEAD exactly. Will report findings the first time the gate fires on a new clone we accidentally introduce or the first time we refresh the baseline.)

## `make check-css-duplication` (pre-existing; runs alongside the new gate)

- ✅ Continues to pass; baseline empty since 2026-05-19. Mentioned here only because the pre-commit hook now runs both `check-css-duplication` AND `check-clone-duplication` in declaration order, and a developer touching both `.css` and `.tsx` files in one commit pays both costs.

## `make scope-inventory FEATURE=<slug>` and `/scope-inventory`

Exercised 2026-05-22 via `/scope-inventory roland-bugfix`. Two runs total — the first failed pre-synthesis, the second succeeded after a dep install.

- ❌ **First run failed with `ERR_MODULE_NOT_FOUND: yaml` in `clone-detector-reader`.** Root cause: PR #441 added `yaml@^2.8.0` (plus `ajv`, `ajv-formats`) to `package.json` but `pnpm install` had not run in this worktree since the merge. The agent's stderr surfaced the missing package — accurate — but did NOT tell the operator the resolution (`pnpm install`). Fix recommendation: either `make scope-inventory` should `make install` (i.e., run `pnpm install` if `pnpm-lock.yaml` is newer than the install stamp — the Makefile already does this for build targets) as a pre-step, OR `find-feature.ts` should `require.resolve()` the agent-tree's runtime deps and refuse with an actionable message ("run `pnpm install`") if a top-level dep is missing. The skill's error-handling printed the raw stderr but a fresh operator wouldn't necessarily know what to do with `ERR_MODULE_NOT_FOUND`. **Severity:** medium — anyone who pulls main and immediately runs `/scope-inventory` without `pnpm install` will hit this.
- ✅ **Failed-run preservation worked as designed.** Per SKILL.md, the failed run dir survives as audit evidence; my `meta.json` for the successful run includes a `priorRun` field pointing at the failure. The journal entry for the failed run is honest about what went wrong. No clean-up required.
- ✅ **Successful run total time ≈ 30s** for 4 agents in parallel + synthesis. Fast enough that re-running mid-feature is cheap.
- ✅ **`make scope-inventory FEATURE=<slug>` output** is informational (tells the operator where artifacts will land + links to LAYOUT.md). Exactly the right shape — orienting without doing the work itself.
- 🤔 **Strawman manifest over-enumerates by ~2x.** 10 modules in `modules:` but only ~4 are genuinely in `roland-bugfix` scope per the PRD (`roland-sxx0-editor`, `editor-core`, plus conditional `sampler-devices`/`e2e-infra`). The other 6 are workspace neighbors with discovery hits but not in scope. Not a defect — the SKILL.md explicitly calls this out as expected ("strawman" + "operator curates the strawman") — but the curation step is non-trivial and the synthesizer could probably reject modules with zero PRD-themed-pattern-hunter hits as a default filter, leaving the operator to ADD modules rather than DROP them.
- 🤔 **Routes missed `/connect`.** The Roland editor has five canonical routes (`/connect`, `/play`, `/patches`, `/tones`, `/library`); the enumerator returned 6 of them plus two `/_harness/*` test surfaces. `/connect`'s file shape is probably slightly different from the others (different `Route` element wrapping, different routing-config consumption). Not a blocker — operator curation adds it — but the enumerator's miss is silent: there's no "I scanned these route-declaring files and found these N route nodes" diagnostic in the agent's output. A `notes:` field in the agent's JSON listing scanned files (and any files that matched route-declaration heuristics but produced no route entries) would make misses visible.
- 🤔 **`discovery_themes:` includes URL noise.** Tokens like `https`, `audiocontrol-org`, `audiocontrol` come from PRD GitHub links. They're low-cost to drop during curation but they crowd the top-10 list. The `prd-themed-pattern-hunter` could strip URL components before tokenization.
- 🤔 **Synthesizer warning about missing `## References` section** in the PRD is correct and actionable, but it lands as a single stderr line and not as a row in the manifest's notes or in the run's `synthesis.md`. Operators reading the manifest later won't see the warning. Recommendation: surface the warning in `synthesis.md` under "Reference docs" — would have caught my attention when I read the synthesis output rather than buried in the synthesis log.

## `/scope-widen "<complaint>"`

- (Pending — Phase 2 Task 5 will exercise this against every Phase 1 bug fix going forward; first report comes with the first invocation.)

## `make refresh-clones-baseline`

- (Pending — first exercise comes after the first refactor PR merges and we re-snapshot.)

## `docs/scope-discovery/clones.yaml` shape

- ✅ The shape is easy to grep + parse; ad-hoc bucketing by module-pair took ~30 lines of TS (see `.tmp/bucket-clones.ts` in this worktree; not committed because it's a one-off exploration script).
- 🤔 No machine-readable index of `pending` count by module-pair. The detector emits the file; consumers (like us) re-derive the bucketing from scratch every time. A `make clones-summary` or a `tools/scope-discovery/summarize-clones.ts` that emits the per-module-pair counts (and per-disposition counts) would save every consumer from re-implementing the parse. Low-priority — easy to live without — but it'd be a 50-line addition.
- ✅ The `disposition` vocabulary (`pending` / `refactor` / `keep-with-reason` / `ignore-with-justification`) is well-chosen — distinguishes "should fix" from "intentionally keeping" from "false positive" cleanly. The required `reason:` field on the non-`refactor` dispositions enforces the right discipline.

## `docs/scope-discovery/LAYOUT.md`

- ✅ Detailed and load-bearing. The "What is NOT under `docs/`" section + the git-ignore-policy invariant are exactly the kind of contract that prevents future drift.
- 🤔 The "Pre-commit gate vs. validator suite" section is critical for orchestrators (controllers re-run the validator suite as the CI gate). A one-line cross-reference in `.claude/rules/agent-discipline.md` "When CI is absent, the controller is the gate" pointing at `pnpm test:scope-discovery` would close the loop — currently the rule names the discipline but doesn't enumerate the per-feature validator-suite commands.

## Pre-commit hook (`.githooks/pre-commit`)

- ✅ Fail-fast in declaration order (CSS first, then TS/TSX). The comment explaining the choice ("two-cycle case is rare in practice; tighten to collect-and-report both failures together if that pattern starts costing time") is exactly the right kind of in-situ design-decision documentation.
- 🤔 No skip when running `git commit --no-verify` warning. If a developer ever uses `--no-verify` to bypass an intentional block, no record of the bypass exists. Not a PR-#441 concern — and the project's global rule forbids `--no-verify` — but a hook that LOGS bypasses (even just to stderr) would catch the discipline violation.

## Cross-feature interaction with PR #440 (chevron + multi-select work)

- ✅ The merge of main into `feature/roland-bugfix` was a clean fast-forward-then-merge (no conflicts). PR #441's surface area (large) didn't touch any of PR #440's changed files.
- ✅ PR #441's pre-commit additions are additive to PR #440's existing `check-chevron-sizing` hook — both fire under the CSS branch of the conditional, no ordering issue.
