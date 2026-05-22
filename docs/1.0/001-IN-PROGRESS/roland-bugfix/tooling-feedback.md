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

Exercised 2026-05-22 in pre-commit during the test-first commit `c1dd0208` (D-PATCH-LIST-09 + D-TONE-LIST-08) and in the refactor commit for clones.yaml group `80299d9fda8d` (SlotInfo extraction).

- ✅ **Pre-commit invocation is fast** (~2-3s including the jscpd parse). Acceptable for every TS/TSX commit.
- ✅ **Baseline diff output is clear.** `Detected N clone group(s) (>= 6 lines).` followed by `Baseline diff: X NEW, Y DROPPED.` is the right shape — operator can tell at a glance whether the commit moved the needle.
- ✅ **The test commit (no source change) reported `0 NEW, 0 DROPPED`.** Correctly tracked that we didn't introduce or remove clones.
- ❌ **Group IDs are hashed from LINE NUMBERS, not content.** The SlotInfo refactor reduced the inline span block from ~14 lines to ~7 lines, shifting subsequent code up by ~7 lines. Result: the actual target clone group `80299d9fda8d` correctly dropped (no replacement) — but 6 OTHER PatchList/ToneList sibling groups in the same files got new ids (e.g. `e2f41456da80` → `fee451a9eea8`, `93118bb09088` → `588be1297b2e`) because their line ranges shifted by 1. In this case all 6 were `pending` so no disposition info was lost, but in a future refactor a `keep-with-reason` or `ignore-with-justification` disposition on a sibling group would be silently orphaned (the old ID disappears, the new ID lacks the reason). **Recommendation:** hash group IDs from member-file-paths + jscpd-token-stream content, not from line numbers. Then dispositions survive line-shift churn from neighboring refactors. **Severity: medium.** Workaround for now is to re-disposition every renumbered sibling after each refactor — labor-intensive at scale (we'll touch ~93 intra-roland groups in Phase 2/3 alone).
- 🤔 **No `--diff` flag to see ONLY the changed groups.** The refresh-baseline output prints every NEW + DROPPED group inline, but for a per-commit verification "did THIS refactor drop the ID I claimed it would?" I had to grep the file directly. A `make check-clone-duplication ARGS='--target <id>'` mode that succeeds iff the named group is absent would tighten the dispositioning loop. Low-priority — `grep -c <id> docs/scope-discovery/clones.yaml` works fine.

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

## Per-surface pending count (no upstream tooling — operator-built one-liner)

The auditor caught two stale-count findings (AUDIT-20260521-07 + -08) where the workplan's "currently pending" numbers drifted from the on-disk truth between commits. Root cause: every disposition changes the count; the workplan re-records the count by hand each time; off-by-one and stale-state slip in.

- ❌ **No checked-in `make clone-summary` (or equivalent) target.** Every operator that wants to know "how many groups touching my surface are still pending" writes their own ad-hoc tsx one-liner. Three of us would write three slightly-different filters. **Recommendation:** ship a `make clone-summary` target (or `tsx tools/scope-discovery/summary.ts --surface <glob>`) that prints `total / pending-touching / pending-intra / dispositioned-touching` for any surface glob the operator names. Severity: low (workaround is a 5-line tsx snippet) but high frequency — Phase 2 will reference these numbers in every dispositioning commit.
- 🤔 **The workplan's "currently pending" numbers should ideally be auto-generated**, not hand-edited. A pre-commit hook that runs the summary script + injects the current count into the workplan via a fenced marker (e.g., `<!-- BEGIN: clone-summary -->...<!-- END -->`) would make staleness impossible. Heavier lift than the make target; do the target first.

## Batch-dispose workflow (no upstream tooling — operator-built)

Operator-built `.tmp/batch-dispose.ts` script applies the same disposition + reason to N clone groups in one pass, with a verify-after-write step that re-reads `clones.yaml` and confirms each row landed before reporting success. Exercised 2026-05-22 to dispose 24 probe-script clones as `keep-with-reason`.

- ✅ **Verify-after-write caught nothing this run, but it's the right discipline.** Lesson from the `c4067caecfdd` single-walkthrough: a failed Edit can vanish silently in batched output, and the workplan disposition log can claim work that isn't on disk. The script re-reads and confirms each APPLIED row.
- ❌ **There's no upstream `tools/scope-discovery/batch-dispose.ts`.** Every operator dispositioning at scale will write their own script (or this one). Strong candidate for promotion into the scope-discovery toolchain proper. Severity: medium (we'll touch ~170 more groups in Phase 2/3; without a shared script every consumer reinvents the verify-after-write loop, which is exactly where the silent-failure mode lives).
- 🤔 **Skipped rows would be useful to report.** My script reports `SKIPPED` for groups already non-pending; in practice this means "someone else already dispositioned this — review whether your reason agrees with the existing one." A `--show-existing` flag that prints the existing disposition + reason for skipped rows would tighten that loop. Currently you have to grep `clones.yaml` manually.
- 🤔 **YAML round-trip preserves structure but reorders keys per the YAML library's defaults.** Diff readability of the resulting commit is the same as my earlier curation pass — workable but not pristine. A schema-aware serializer that emits keys in a stable order would help future code-review.

## `make refresh-clones-baseline`

Exercised 2026-05-22 after the SlotInfo extraction (clones.yaml group `80299d9fda8d` refactor).

- ✅ **Did the right thing.** Re-ran jscpd, rewrote `docs/scope-discovery/clones.yaml`, listed NEW + DROPPED groups in console. Total count went 495 → 494 (net -1 for the dropped target group).
- ✅ **Honest about what changed.** Console output enumerated 6 NEW + 7 DROPPED groups; the asymmetry was instructive (the line-shift id-churn issue noted under `check-clone-duplication` above).
- 🤔 **No summary line at the bottom of the output.** After listing ~13 groups changed it just exits; a final line like `summary: 7 dropped, 6 new (net -1)` would be a useful TL;DR. Low-priority.
- 🤔 **Doesn't preserve disposition annotations across renumbered groups.** Same root cause as the id-churn finding under `check-clone-duplication`. Would be nice if `refresh-clones-baseline` could detect "same members, new line range" pairs and carry forward the prior disposition + reason. Tricky to implement perfectly (a refactor might genuinely re-shape a group, not just shift it), but a "best-effort with confidence score" heuristic would still help.

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

## Regime holdouts — detecting incomplete migrations directly (not via clone shadow)

Captured 2026-05-22 after the Phase 2 closure walk dispositioned 172 → 0 pending clones touching `modules/roland-sxx0-editor/` + `modules/editor-core/`. Three of the most consequential dispositions were not clone problems per se — they were regime-holdout problems that the clone detector caught as a downstream symptom. This section names the gap explicitly and proposes how to close it.

### What the operator wants

A failure mode the operator is trying to eradicate: **less-than-complete application of a new regime**. When a new design language, architectural pattern, or shared primitive is introduced, the canonical implementation gets the new shape but a long tail of holdouts stays on the old shape. The holdouts accumulate as silent debt. Each subsequent session "discovers" them all over again because there is no durable record of "this is the canonical, and these other places haven't migrated yet." The operator wants the scope-discovery protocol to surface those holdouts directly — not as a hint that has to be re-derived from clone-detector output every time, but as a first-class finding type.

Concretely the holdouts come in several shapes:

- **Chrome / UX regime gaps:** a new dialog chrome (v3 SlideDrawer) replaces an old one (Radix Dialog); the Export side migrates; the Import side stays on the old chrome.
- **Lifecycle / state-management primitive gaps:** a new hook (`useExportDialogLifecycle`) absorbs a state-management pattern; the call sites that drove its extraction adopt it; other dialogs with the same lifecycle pattern keep their inline copies.
- **Convention adoption gaps across editors:** akai adopts `$INFRA_DIR/scripts/watchdog.ts`; roland keeps a byte-identical local copy.
- **Deprecation queue gaps:** files marked `@deprecated` accumulate in the tree because no scan surfaces remaining importers + schedules deletion.
- **Primitive-wanting-to-exist gaps:** three pages inline the same title-row markup because no `<PageTitleRow>` primitive exists yet. The primitive's absence is the regime gap.
- **Cross-editor symmetry gaps:** one editor adopts a convention (deletion of dead-code orphans, use of a shared editor-core primitive, a particular ESLint pattern); siblings don't.

### What the current tooling offers

The current scope-discovery protocol (PR #441) gives one mechanism that catches regime holdouts indirectly: **token-level clone detection via jscpd**. The shadow logic is:

> A regime holdout often contains duplication that the new regime's primitives would have absorbed. Therefore: finding the duplication finds the holdout (transitively).

Three Phase 2 examples where this shadow logic worked:

1. **v3 SlideDrawer + `useExportDialogLifecycle` holdout** — Export dialogs adopted the new chrome + lifecycle hook during Phase 9 Task 4. Import dialogs (5 files) stayed on Radix Dialog + inline state. The detector flagged 15 clone groups across the Import family, covering ~232 lines of duplicated state-management + render-shape patterns. Those clones are precisely what `useExportDialogLifecycle` would absorb. The cone of duplication pointed at the regime gap.

2. **`$INFRA_DIR/scripts/watchdog.ts` convention holdout** — akai-s3k-editor + e2e-infra runner scripts already invoked the shared watchdog through `$INFRA_DIR`. roland-sxx0-editor had a 151-line byte-identical local copy of `watchdog.ts` that its 4 e2e shell scripts referenced directly via `tsx scripts/watchdog.ts`. The detector reported one 151-line cross-module clone (`a975f1067ff4`); fixing it required updating 4 shell scripts and deleting the local copy.

3. **`PageTitleRow` + `AcReloadIcon` primitives wanting to exist** — PatchesPage, TonesPage, and PlayPage each inlined the same `.ac-page-title-row` markup + the same 4-path reload SVG. No primitive existed yet to absorb them. Three clone groups (33L + 16L + 10L) surfaced the gap; extracting two new shared components (`PageTitleRow` + `AcReloadIcon`) closed every group and gave future pages a 1-line affordance.

In each case the duplication was the SHADOW of a regime gap; the detector caught the shadow, and the operator (me, this session) had to recognize the underlying regime to identify the canonical, choose the migration direction, and execute it without erasing the new regime in the process.

### Gaps in the current tooling

The shadow-based discovery works but has six concrete gaps:

1. **No notion of canonical.** Clones are reported symmetrically — the detector says "A and B match." It doesn't know A is the new regime and B is the holdout, or vice versa. (See **MUST FIX** below — this is the most dangerous gap because it can ERADICATE the new regime by mistake during automated remediation.)

2. **Implicit detection only — regimes without active duplication are invisible.** Several regime-holdout shapes don't show up as clones:
   - Missing primitive adoption that hasn't yet generated duplication (the holdout uses a different shape, not a copy of the canonical).
   - Semantic anti-patterns like BUG-002's empty `catch { /* error via prop */ }` blocks — every Import dialog has its own variant, structurally similar but not token-identical.
   - Single-instance holdouts (only one place still uses the legacy chrome) that don't trigger jscpd's 6-line minimum.

3. **No regime registry.** There is no checked-in record that "v3 SlideDrawer is the canonical dialog chrome" or "`useExportDialogLifecycle` is the canonical lifecycle hook for export-style operations" or "`PageTitleRow` is the canonical title-row primitive." Each refactor extraction creates a new primitive but doesn't declare its expected adopter set anywhere a tool can read it. Detecting holdouts requires per-primitive ad-hoc judgment by the next operator, who may not know the primitive exists.

4. **No deprecation-driven scan.** `@deprecated` JSDoc tags mark files as legacy but nothing surfaces their remaining importer count, schedules them for deletion, or alerts when the importer set drops to zero. This session deleted six dead-code orphans (`EnvelopeDisplay.tsx`, `EnvelopeEditor.tsx`, `CreateDirectoryDialog.tsx`, `RenameDirectoryDialog.tsx`, `useDirectoryOperations.ts`, `roland-sxx0-editor/scripts/watchdog.ts`) totalling 1,666 lines. All six carried explicit deprecation markers, comments, or known-unused status that predated this session by weeks or months. The operator's "audit-and-delete dispatch" intent never had a queue.

5. **No cross-editor symmetry checker.** Conventions that span editors (editor-core primitives, shared `$INFRA_DIR/scripts/*` paths, `make` target naming, test-directory structure) have no inventory matrix. The roland watchdog case would have surfaced instantly as "akai: ✓, roland: ✗" if such a matrix existed — without needing a clone to exist at all.

6. **Refactor commits are write-only metadata.** When I extracted `PageTitleRow`, the commit message recorded which clone groups closed and which file became canonical. But nothing in the codebase carries that information forward in machine-readable form. A future agent grepping for `<header class="ac-page-title-row">` outside `PageTitleRow.tsx` would have no automatic signal that they should be consuming the primitive. The regime declaration lives in commit messages, which are read by humans, not tools.

### Recommendations — close the gaps

Each recommendation can land independently. Listed in suggested implementation order (cheapest leverage first).

#### MUST FIX — asymmetric clone reporting (regime-erasure prevention)

**The clone detector treats both sides of a clone symmetrically. The operator-facing pathology: during refactor remediation, an agent can accidentally extract a shared helper from the WRONG side — the legacy side — and silently DOWNGRADE the new-regime call site to legacy semantics, undoing the migration.**

A concrete failure scenario this protocol must prevent:

> ExportToneDialog (v3, uses `SlideDrawer` + `useExportDialogLifecycle` + proper `localError` capture for BUG-001) and ImportToneDialog (legacy, uses Radix `Dialog.Root` + empty `catch { /* error via prop */ }` for BUG-002) share enough surface to flag as a clone. A naïve refactor "extract shared lifecycle helper" could base the extracted hook on ImportToneDialog's shape (empty catch, inline `useState/useEffect`, etc.) and then update BOTH dialogs to consume it. The Export side gets DOWNGRADED — it loses its `localError` capture, BUG-001 returns, and the v3 migration is partially undone. The clone count drops (the protocol reports progress), the test suite passes (BUG-001 isn't actively asserted by a regression test on every dialog), and the regression hides in the diff.

This is the worst possible failure mode the protocol can enable: progress as measured by the detector AND active erasure of prior migration work in the same commit. It can happen without any single decision looking wrong in isolation — each step (find clone, extract shared helper, update call sites) is the obvious refactoring move.

**The fix requires the protocol to know which side is canonical before any extraction.** Two parts:

1. **Per-clone-group "canonical pointer" field** in `clones.yaml`. Refactor agents MUST populate this before extracting:
   ```yaml
   - id: <group-id>
     members:
       - modules/.../ExportToneDialog.tsx:62:83
       - modules/.../ImportToneDialog.tsx:48:69
     disposition: refactor
     canonical: modules/.../ExportToneDialog.tsx
     canonical_reason: |
       v3 SlideDrawer-chrome migration applied here in Phase 9 Task 4.
       BUG-001 fix (localError capture) lives in this implementation.
       Import side is the holdout; extraction must follow Export's shape.
     reason: Extract useExportDialogLifecycle hook from ExportToneDialog
       and propagate to ImportToneDialog as part of v3 chrome migration.
   ```

2. **Refactor protocol guardrail.** The "Refactoring protocol: test before extract" section in the workplan adds a step 0: "**Identify the canonical side.** Either (a) one side has a documented regime (cite primitive, ADR, deprecation marker) — that side is canonical; or (b) neither side is canonical, in which case the extraction designs a NEW canonical shape from scratch (do NOT pick one of the existing shapes to copy). If you cannot decide which side is canonical, the disposition is `keep-with-reason` pending a regime decision — not `refactor`."

3. **Pre-commit gate.** A refactor commit (commit message contains `Closes clones.yaml <id>` or similar) is rejected if the target group's `canonical:` field is empty. Forces the decision to happen at disposition time, not at extraction time.

4. **Auditor framing.** Code reviewers (humans + auditor agents) check refactor commits against the canonical declaration: does the extracted helper match the canonical side's shape, or did it inherit shape from the holdout? Any divergence is a finding.

**Severity: critical.** This is the kind of defect that scales with adoption — every refactor walk that happens before the fix lands is a chance to silently undo prior migrations. The longer the protocol runs in production, the more concentrated the canonical knowledge becomes in the (correctly migrated) primitives, and the more catastrophic an accidental erasure becomes. Fix BEFORE scaling clone-driven refactor work to other branches.

#### 1. Anti-pattern registry tied to extraction commits

Every refactor commit that extracts a primitive appends to `docs/scope-discovery/anti-patterns.yaml` a structural fingerprint of the shape the primitive replaces:

```yaml
- id: export-dialog-lifecycle-inline
  added_in: dce8fc72
  primitive: useExportDialogLifecycle
  from: '@/hooks/useExportDialogLifecycle'
  shape: |
    const [localError, setLocalError] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    useEffect(() => {
      if (open) {
        setLocalError(null);
        setHasStarted(false);
      }
    }, [open]);
  message: |
    This pattern was extracted to `useExportDialogLifecycle`.
    Replace the inline state + effect with the hook.
```

A pre-commit step + a scope-inventory pass runs `ast-grep` against the registry. Any holdout matching a registered shape gets flagged with the suggested replacement. The Import dialog family would have lit up the instant the hook landed.

**Why this matters for regime detection:** anti-patterns can be added the same day the canonical primitive lands. The protocol gains a memory; future sessions can't lose track of the regime because the canonical's signature is checked-in.

#### 2. Adopter manifest per primitive

When a refactor commit introduces a shared primitive, it declares the expected adopter set:

```yaml
# docs/scope-discovery/adopter-manifests.yaml
- primitive: PageTitleRow
  from: '@/components/common/PageTitleRow'
  introduced_in: b996aa01
  expected_adopters_glob: 'modules/*/src/pages/*Page.tsx'
  exceptions:
    - path: 'modules/roland-sxx0-editor/src/pages/ConnectPage.tsx'
      reason: 'Entry route; no LED-metric / refresh affordance.'

- primitive: SlideDrawer
  from: '@audiocontrol/editor-core'
  expected_adopters_glob: 'modules/*/src/components/library/*Dialog.tsx'
  exceptions:
    - path: 'modules/roland-sxx0-editor/src/components/library/SaveSetDialog.tsx'
      reason: 'Uses Radix Dialog intentionally — operator confirmed v3 SlideDrawer migration deferred to ROLAND-BUGFIX-V3-SETSAVE follow-up.'
```

A `make check-adopters` target enumerates each glob, greps each file for the canonical import, reports holdouts (expected − actual − exceptions). The Import dialogs would surface immediately as "expected SlideDrawer; using Radix Dialog." The detector doesn't need to find a clone for this to work — the holdout shows up because the file is in the adopter glob and isn't importing the canonical.

**Combines with item 1:** anti-patterns catch semantic holdouts (matching the legacy shape); adopter manifests catch structural holdouts (file is in the adopter set but doesn't import the primitive).

#### 3. Cross-editor symmetry checker

A `make check-editor-symmetry` target builds a matrix:

|                      | akai-s3k-editor | roland-sxx0-editor | d110-editor | jv1080-editor |
|----------------------|-----------------|--------------------|-------------|---------------|
| `$INFRA_DIR/watchdog`| ✓               | ✓                  | ✓           | ✓             |
| `editor-core/AcChevron` | ✓            | ✓                  | ✗           | ✗             |
| `editor-core/SlideDrawer` | ✓          | ✓ (Export only)    | ✗           | ✗             |

Each row is a convention — declared in the same manifest format as item 2. Each column is an editor. Cells are computed by greping the editor for the canonical import (or convention pattern). Holdouts highlighted as `✗`. The roland watchdog case would have flashed red the instant akai adopted the shared path — the regime gap would have been a single line of output.

**Why cross-editor matters:** the operator runs five editors in parallel. The "we did it in akai but not roland" failure mode is the most common shape of regime drift in this codebase. A matrix view makes it impossible to lose track of.

#### 4. Deprecation-driven scans

Every `@deprecated` JSDoc tag becomes a tracked finding. A `make check-deprecations` target:

1. Greps the source tree for `@deprecated` markers.
2. For each marker, counts remaining importers (excluding the file's own re-export and doc-comment references).
3. Emits a status report:
   - **importers > 0:** "deprecated but still consumed — N importers; deletion blocked." Lists importers.
   - **importers = 0:** "deprecated and unreferenced — safe to delete." Adds to the queue.
4. The queue can be reviewed manually (operator-approved deletion run) or wired into a follow-up generator.

This session would have surfaced all six dead-code deletions weeks before I rediscovered them via clones. The `EnvelopeDisplay` header literally said "kept for the audit-and-delete dispatch after the rest of Phase 9 Task 4 lands." The dispatch never had a tool to schedule it.

#### 5. Regime-holdout discovery agent in the inventory fleet

Add a new agent under `tools/scope-discovery/discovery-agents/regime-holdout-detector.ts` to the parallel-fanout fleet that `/scope-inventory` already runs. It reads the anti-pattern registry + adopter manifests + the deprecation index, runs the scans, and feeds its findings into `synthesis.ts` the same way the other agents do. The synthesized `scope-manifest.yaml` gains a top-level `regime_holdouts:` section alongside `routes:`, `modules:`, `themes:`. Each holdout entry names the primitive it should adopt, the path, and the suggested fix.

For the roland-bugfix feature this would have surfaced:
- 5 holdouts for `SlideDrawer` (the Import dialog family)
- 5 holdouts for `useExportDialogLifecycle` (same files)
- 1 holdout for `$INFRA_DIR/scripts/watchdog.ts` (roland scripts)
- 6 deprecation-deletion candidates (the orphans)
- 3 adopters of `PageTitleRow` (post-extraction, all ✓)

The single section would have driven Phase 2 directly, instead of requiring me to derive the same conclusions from the clone catalog by visual inspection.

### Why these five recommendations matter together

The current protocol catches duplication as a signal. The proposed additions catch *direction*: which side is canonical, which is the holdout, which primitive should absorb the holdout, what other call sites are in the same situation. Without that direction, every refactor walk is at risk of the **MUST FIX** failure mode above — eroding the new regime by accidentally cloning the old. With that direction, the protocol becomes an enforcement layer for the migrations that have already been decided, rather than a discovery layer that re-derives them every time. **The cost is checked-in declarations at primitive-extraction time; the payoff is automated regime convergence + a structural guard against accidental regression.**
