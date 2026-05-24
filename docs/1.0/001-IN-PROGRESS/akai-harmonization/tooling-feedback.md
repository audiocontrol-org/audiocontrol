# Tooling Feedback — akai-harmonization

Running log of friction, pathologies, and improvement opportunities in the scope-discovery + duplication tooling, captured during Phase 2 implementation. Mirrors the pattern from `docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md`.

Each entry: **Category · Severity · Friction**, then Repro, Workaround used in this session, and a Suggested-fix sketch.

Categories:
- **A** — anti-patterns registry
- **AM** — adopter-manifests registry
- **CL** — clones.yaml + clone-detector
- **GATE** — pre-commit / make-target gate ergonomics
- **DSC** — discovery agents / synthesis
- **MISC** — everything else (build, test, packaging, harness, ergonomics)

Severity: **high** (blocks work or hides bugs) · **medium** (slows work meaningfully) · **low** (papercut).

---

## TF-001 · AM · medium · Adopter-manifest `from:` is a literal string; doesn't survive primitive relocation

**Repro:** Phase 2 task 2.2 of akai-harmonization promoted `PageTitleRow` from `modules/roland-sxx0-editor/src/components/common/PageTitleRow.tsx` to `modules/editor-core/src/components/PageTitleRow.tsx`. The roland consumers' imports changed from `@/components/common/PageTitleRow` to `@audiocontrol/editor-core`. `make check-adopters` then reported 3 holdouts ("0 file(s) import @/components/common/PageTitleRow"), accurate per the literal `from:` string but misleading — the consumers DO import the same component, just via a different module path.

**Workaround used:** manually updated `docs/scope-discovery/adopter-manifests.yaml` `page-title-row` entry's `from:` to `@audiocontrol/editor-core` + expanded `expected_adopters_glob` to include the 4 akai pages + 2 additional roland pages that already adopt.

**Suggested fix:** allow `from:` to be a list (`from: ['@audiocontrol/editor-core', '@/components/common/PageTitleRow']`) so a primitive in transit is recognized by either path. Better: a re-export-aware import resolver that follows the editor-core barrel + roland's local re-export so the `from:` can name ONE canonical path and the resolver walks aliases.

---

## TF-002 · A · medium · Anti-pattern registry flags the canonical component itself when the primitive moves modules

**Repro:** Same PageTitleRow promotion as TF-001. `anti-patterns.yaml` had `page-title-row-inline` + `ac-reload-icon-inline` entries with `excludes_paths:` pinned at the OLD roland paths. After `git mv`, the canonical components (now in editor-core) matched the anti-pattern shape because the regexes match `<header class="ac-page-title-row">` and the inline reload SVG — which are inside the canonical component implementation itself, not just legacy consumers. `make check-anti-patterns` reported 2 findings on the moved files.

**Workaround used:** updated each entry's `excludes_paths:` to the new editor-core file paths + updated each entry's `from:` to `@audiocontrol/editor-core` so the message tells operators where to import from now.

**Suggested fix:** the registry should keep `excludes_paths:` relative to the primitive's canonical location, not a hardcoded path. Or: each entry could declare a `canonical_implementation_file:` field, and the matcher auto-excludes that file. Bonus: when a `canonical_implementation_file` moves (detected via git rename), the matcher could fail the build with a specific error ("primitive file `X` moved to `Y`; update `excludes_paths`") rather than silently flagging the new location.

---

## TF-003 · CL · low · clones.yaml additions are manual append-with-correct-format

**Repro:** Pre-commit clone-detector reported `NEW    a50e0d779738 (21 lines)` for two akai pages newly invoking the canonical `<PageTitleRow>` with the same wiring. The hook failed because the new group was undispositioned. To unblock, I had to: (a) find the right insertion point in clones.yaml (the file is 3229 lines), (b) hand-write a YAML entry with `id` + `lines` + `members` + `disposition` + `reason`, (c) re-run the gate to confirm.

**Workaround used:** appended the entry at the end of clones.yaml; verified gate goes green.

**Suggested fix:** `tsx tools/scope-discovery/batch-dispose.ts --ids a50e0d779738 --disposition keep-with-reason --reason "..."` already exists for bulk disposition. The pre-commit hook's error output could explicitly cite that command with the NEW id pre-filled and a placeholder reason, so the operator can paste-and-edit. Example:

    NEW    a50e0d779738 (21 lines)
      Run:  tsx tools/scope-discovery/batch-dispose.ts \
              --ids a50e0d779738 \
              --disposition <refactor|keep-with-reason|ignore-with-justification> \
              --reason "<one-line rationale>"

---

## TF-004 · GATE · medium · Pre-commit gates fail one-at-a-time across the hook chain

**Repro:** Tried to commit the PageTitleRow promotion. The pre-commit hook chain blocked successively on:

1. `check-clone-duplication` — new group a50e0d779738 NEW
2. (after I dispositioned the clone) `check-anti-patterns` — 2 stale findings on the moved canonical files
3. (after I updated excludes_paths) `check-adopters` — page-title-row's old `from:` path

Each failure required a separate fix-and-retry cycle. Total: 3 round-trips to land a single commit. The signals were independent (different gates) but landed serially because the hook short-circuits on the first error.

**Workaround used:** worked through them one at a time.

**Suggested fix:** the pre-commit driver could run all gates in parallel, collect every failure, and present a single consolidated report. Operator does one fix-pass instead of N. The current short-circuit behavior is good for fast iteration when only one gate is red, but bad when multiple are red after a substantial change like a primitive promotion. A `--no-short-circuit` flag would let the operator opt in.

---

## TF-005 · DSC · medium · Scope-inventory's module list is over-broad (12-of-12 workspace modules)

**Repro:** `/scope-inventory akai-harmonization` produced a strawman manifest listing every workspace module (12 of 12) including out-of-scope `d110-editor`, `jv1080-editor`, `sampler-devices`, `sampler-library`, `synth-core`, `e2e-infra`. The discovery agents seem to default to "include every module that matched any pattern" rather than weighting by relevance to the PRD's In Scope / Out of Scope sections.

**Workaround used:** operator-curated the manifest to drop 6 out-of-scope modules.

**Suggested fix:** the PRD-themed-pattern-hunter agent already reads the PRD; it could parse the "In Scope" / "Out of Scope" sections explicitly and emit a `module_relevance_score` per module so the synthesizer can mark out-of-scope entries with `excluded_by: prd-out-of-scope` instead of including them silently. Operator curation would then be reviewing the agent's pruning judgment, not writing the prune list from scratch.

---

## TF-006 · DSC · low · Synthesizer warns "PRD has no References/Appendix section" but the warning is mild

**Repro:** synthesizer wrote `reference_docs[]` with just PRD + LAYOUT.md and surfaced a note in `synthesis-notes.md`: "PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md."

**Workaround used:** accepted the default; noted that a Phase 2 re-run after the operator appends an Appendix to the PRD would produce richer references.

**Suggested fix:** the `/dw-lifecycle:define` PRD template could include a default empty Appendix section with explicit "References" / "Related issues" subheadings so the synthesizer has hooks to populate.

---

## TF-007 · MISC · low · Editor-core has 7 pre-existing baseline-flaky tests that pollute every test run

**Repro:** `pnpm --filter @audiocontrol/editor-core test` ends with `Test Files 3 failed | 29 passed (32) · Tests 7 failed | 286 passed (293)` on a clean baseline. Failures live in `PluginLibraryBrowser.test.tsx` (2), `AcEnvelope.test.tsx` (1), `MoveDialog.test.tsx` (4) and are unrelated to current branch work — verified by stash + re-run. They make it impossible to use `pnpm --filter @audiocontrol/editor-core test` as a regression gate without manually correlating failures against the baseline.

**Workaround used:** ran the test, noted the failure count matched baseline, proceeded.

**Suggested fix:** triage + either fix or `.skip` the 7 baseline-flaky tests with `// TODO: ...` notes naming the underlying issue. A green editor-core test suite is more useful than a partially-green one with the same 7 always-failing entries.

---

## TF-008 · MISC · medium · roland-sxx0-editor's `_shared.css` is 1856 lines (well over the 300-500 cap)

**Repro:** The file pre-existed at ~2014 lines; the PageTitleRow promotion removed 158 lines (the `.ac-page-title-*` block now lives in editor-core) leaving 1856. Still way over the per-file 500-line cap mentioned in CLAUDE.md.

**Workaround used:** noted in the promotion commit message; not in scope for this commit.

**Suggested fix:** systematic per-section extraction pass — split `_shared.css` into role-named modules (e.g., `detail-pane-primitives.css`, `tab-primitives.css`, `device-memory-primitives.css`, `preview-pane-primitives.css`). Each Phase 2 primitive promotion to editor-core can take a chunk with it; the residual roland-specific bits stay in `_shared.css` until it's under the cap.

---

## TF-009 · A · medium · No automated regression test surfaces UI-accessibility regressions like the AUDIT-20260524-01 tab-stop bug

**Repro:** When I closed AUDIT-20260523-02 (span → button on TreeView's disclosure-btn), the change introduced a second tab stop per folder row. No existing test failed. The regression was caught by the next audit pass (AUDIT-20260524-01), days later.

**Workaround used:** added a vitest test asserting `<button class="ac-tree-disclosure-btn">` carries `tabindex="-1"` — but that's narrow (it only catches MY exact pattern, not the general class of "interactive child of role='treeitem' becomes focusable").

**Suggested fix:** a Playwright spec (or vitest-with-jsdom + @testing-library/user-event) that exercises canonical components for keyboard-navigation invariants: "tabbing through a TreeView with N folder rows produces N tab stops, not 2N". Could be a generic editor-core test that grows with the primitive surface. Pairs with WCAG-conformance checks (target-size, ARIA-roles) — same harness.

---

## TF-010 · GATE · low · `make check-adopters` output is verbose; the relevant findings get lost in tracked-holdout noise

**Repro:** `make check-adopters` after a clean state prints `adopter-manifests: 0 holdouts across 9 manifest(s); 9 tracked holdout(s) reported separately.` then several KB of per-manifest output including all tracked holdouts (the 9 SlideDrawer cross-editor entries that are pre-existing). When checking gate state during a commit, the operator has to scroll past unrelated output to find the actual finding count.

**Workaround used:** piped through `tail -5` to find the summary line.

**Suggested fix:** the summary line should be the LAST line of output, not the middle. Or a `--quiet` flag that prints only the summary unless there are non-tracked findings. Or color-code: tracked holdouts in muted gray, real findings in red.

---

## TF-011 · MISC · low · package.json `exports` needs manual updates when adding canonical CSS files

**Repro:** Promoting PageTitleRow required creating `modules/editor-core/src/design/page-title-primitives.css`. To make it consumable by external packages, `modules/editor-core/package.json` needed `"./page-title-primitives.css"` added to the `exports:` block. The sub-agent handled this correctly, but it's an extra step that's easy to miss.

**Workaround used:** verified package.json got updated.

**Suggested fix:** a build-time generator that walks `modules/editor-core/src/design/*.css` and emits the `exports:` block automatically. Or a pre-commit gate that grep-asserts every CSS file in `src/design/` has a corresponding `exports:` entry.

---

## TF-012 · MISC · medium · CSS tab-activation pattern requires N coupled selector lists; dropping one is silent + visually subtle

**Repro:** The canonical radio-driven tab chrome in `_shared.css` requires every tab-ID to appear in FOUR coupled selector lists: lit-tab fill (`:checked ~ .ac-tab-strip [for="..."]`), tab underline (`...::after`), panel show (`:checked ~ .ac-panels > [data-tab="..."]`), and reduced-motion (same selectors inside `@media (prefers-reduced-motion: reduce)`). During the d5d99516 akai-dialect.css token refactor, I accidentally dropped the third list (panel-show) when rewriting the file. The first two lists still functioned (active tab gets the accent fill + glow underline), and `.ac-panel { display: none }` got overridden somewhere else (specificity accident?), so the visual effect was subtle — the wrong panel might stay visible or the active panel might also display, depending on cascade order. Easy to miss in a quick screenshot review.

**Workaround used:** restored the missing selector list when lifting the akai tab registrations into `_shared.css`.

**Suggested fix:** the canonical chrome's authoring pattern would benefit from a build-time check or a single source-of-truth construct that fans out to all N lists. Two shapes:
- A CSS preprocessor / postcss plugin that takes `@tab-group(ap-common, ap-midi, ap-effects, ap-output)` and expands to the four selector lists.
- A JSON registry (e.g., `docs/scope-discovery/tab-groups.yaml`) listing every editor's tab IDs; a build-time script generates the four CSS selector blocks. Pre-commit gate fails if any tab ID appears in `.tsx`/`.html` as `id="<x>"` but not in the registry.

Either shape would make dropping one list structurally impossible: a missing entry would either fail the build or fail a gate, not silently break panel-switching.

---

## TF-013 · CL · medium · clone-detector regen silently wipes operator-curated dispositions

**Repro:** Running `tsx tools/scope-discovery/clone-detector.ts` (or any pre-commit invocation that calls it as part of the gate chain) regenerates `docs/scope-discovery/clones.yaml` in place. The regen writes the current detection output, which means operator-authored `disposition: keep-with-reason` + multi-paragraph `reason:` fields are reverted to `disposition: pending` + `reason: null` if the underlying clone group is re-detected with the same content hash. The pre-commit baseline-diff still reports `0 NEW, 0 DROPPED` (the group is structurally the same — same content hash), so the gate is happy and the regen lands silently in the workdir if the operator doesn't notice.

This session: after the sub-agent dispatch for harness pages + shell-contract spec, the workdir contained an unstaged diff on clones.yaml that reverted four operator-curated dispositions on the playwright-config-per-suite clone groups. The dispositions had been carefully authored (multi-sentence reasoning explaining why per-suite Playwright configs are intentional and what would have to change before the duplication is unifiable). Losing them would have erased the audit trail of "we considered this; here's why it's intentional" — a silent regression in documentation quality, not in code.

**Workaround used:** noticed the diff in `git status` before committing; reverted via `git checkout -- docs/scope-discovery/clones.yaml`. Permission gate flagged the revert as destructive (correct behavior — it IS destructive against the regen state, even if the regen itself was the unwanted change); the operator had to approve.

**Suggested fix:** several shapes, in increasing order of structural soundness:
- (Light): The detector preserves any existing `disposition:` + `reason:` field whose group's content-hash key still exists in the new output. Only `pending: null` groups get replaced when the hash changes; everything else carries forward.
- (Medium): The detector emits a separate `clones-detected.yaml` (machine-generated, regenerated freely) and `clones-dispositions.yaml` (operator-authored, append-only modifications). The gate composes both at check time. Operator dispositions can never be silently lost.
- (Heavy): A pre-commit "disposition-survivor" gate that fails the commit if the diff includes any `keep-with-reason → pending` transitions. Forces the operator to consciously confirm the loss (or — more likely — fix the detector).

The middle option seems most aligned with the existing scope-discovery design (machine artifacts vs operator artifacts, audited separately). It would also make the `clones-dispositions.yaml` file the single place operators look for "what have we decided to keep, and why" — useful for new operators joining a feature.

---

## How to add an entry

1. Hit friction or pathology or notice an improvement opportunity.
2. Pick a category (A / AM / CL / GATE / DSC / MISC) and severity (high / medium / low).
3. Append a new section at the bottom (or insert by topic if it pairs with an existing entry) with the next TF-NNN id.
4. Include: Repro (what happened), Workaround used (what unblocked), Suggested fix (the operator-recognizable shape of a fix, not just "make it better").
5. Commit alongside the work that surfaced it.
