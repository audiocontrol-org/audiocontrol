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

- (Pending — Task 2 of Phase 2 will run `/scope-inventory roland-bugfix` and capture the experience here.)

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
