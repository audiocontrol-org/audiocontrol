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

## Status summary

This log tracks **scope-discovery + duplication tooling** friction only. Entries that turned out to be implementation work in other modules were re-scoped into [`workplan.md`](./workplan.md) on 2026-05-24 (see "Re-scoped out of this log" below).

| TF | Status | Closing commit |
|---|---|---|
| TF-001, TF-002 | Addressed | `fddbad06` (PR #462) — primitive-relocation awareness |
| TF-003 | Addressed | `10dee19f` (PR #462) — clone-detector cites batch-dispose for NEW groups |
| TF-004 | Addressed | `a5986c8e` (PR #462) — pre-commit gate consolidation |
| TF-005 | Addressed | `e294a29a` (PR #462) — scope-inventory PRD-scoped module pruning |
| TF-006 | Addressed | `4278986f` (PR #462) — synthesizer References warning gains paste-ready skeleton |
| TF-010 | Addressed | `837c9336` (PR #462) — check-adopters summary moves to last line + --quiet flag |
| TF-013 | Open (genuine tooling) | — |

A parallel improvement landed in `676dd164` on this branch — the `imports:` field on adopter-manifests entries lets the gate distinguish "imports the canonical primitive" from "imports some other symbol from the same package," and recognizes transitive adoption via wrapping primitives (e.g., SteppedProgressDrawer wraps SlideDrawer; importing the wrapper now counts). Not a TF entry of its own — it surfaced as a finding during the SlideDrawer adoption work and was fixed in the same commit pair.

### Re-scoped out of this log

Originally logged here but re-classified as implementation work (not scope-discovery tooling):

| Previous TF | What it actually is | New home |
|---|---|---|
| TF-007 | Editor-core test bug (7 pre-existing failures in `PluginLibraryBrowser` / `AcEnvelope` / `MoveDialog`) | [`workplan.md`](./workplan.md) Phase 0 bug-triage row `BUG-EC-001` |
| TF-008 | Roland-sxx0-editor file-cap refactor (`_shared.css` 1856 lines) | [`workplan.md`](./workplan.md) Phase 2 task 2.8 |
| TF-009 | Editor-core a11y keyboard-navigation test harness gap | [`workplan.md`](./workplan.md) Phase 2 task 2.7 |
| TF-011 | Editor-core `package.json exports:` workflow (or small gate) | [`workplan.md`](./workplan.md) Phase 2 task 2.9 |
| TF-012 | CSS tab-activation architecture (N-coupled selector lists) | [`workplan.md`](./workplan.md) Phase 2 task 2.10 |

Keeping THIS log focused on `tools/scope-discovery/` + `docs/scope-discovery/` friction so the tools team's burndown signal stays clean.

---

## TF-001 · AM · medium · Adopter-manifest `from:` is a literal string; doesn't survive primitive relocation

**Repro:** Phase 2 task 2.2 of akai-harmonization promoted `PageTitleRow` from `modules/roland-sxx0-editor/src/components/common/PageTitleRow.tsx` to `modules/editor-core/src/components/PageTitleRow.tsx`. The roland consumers' imports changed from `@/components/common/PageTitleRow` to `@audiocontrol/editor-core`. `make check-adopters` then reported 3 holdouts ("0 file(s) import @/components/common/PageTitleRow"), accurate per the literal `from:` string but misleading — the consumers DO import the same component, just via a different module path.

**Workaround used:** manually updated `docs/scope-discovery/adopter-manifests.yaml` `page-title-row` entry's `from:` to `@audiocontrol/editor-core` + expanded `expected_adopters_glob` to include the 4 akai pages + 2 additional roland pages that already adopt.

**Suggested fix:** allow `from:` to be a list (`from: ['@audiocontrol/editor-core', '@/components/common/PageTitleRow']`) so a primitive in transit is recognized by either path. Better: a re-export-aware import resolver that follows the editor-core barrel + roland's local re-export so the `from:` can name ONE canonical path and the resolver walks aliases.

**Addressed by:** `fddbad06` (fix(scope-discovery-protocol): primitive-relocation awareness, PR #462). The `from:` field now accepts EITHER a single YAML string (back-compat) OR a non-empty list of strings; both forms normalize to `readonly string[]` internally, and the import-detection regex builds a path alternation so consumers importing via ANY listed path count as adopters. Paired adversarial scenarios in `tools/scope-discovery/adopter-manifests.from-list-scenarios.ts`. Verified locally post-merge: `make check-adopters` exits 0 across 9 manifests; `pnpm tsx tools/scope-discovery/adopter-manifests.validate.ts` reports 32/32 (the from-list suite contributes 6 scenarios including the relocation-mixed-state happy path).

---

## TF-002 · A · medium · Anti-pattern registry flags the canonical component itself when the primitive moves modules

**Repro:** Same PageTitleRow promotion as TF-001. `anti-patterns.yaml` had `page-title-row-inline` + `ac-reload-icon-inline` entries with `excludes_paths:` pinned at the OLD roland paths. After `git mv`, the canonical components (now in editor-core) matched the anti-pattern shape because the regexes match `<header class="ac-page-title-row">` and the inline reload SVG — which are inside the canonical component implementation itself, not just legacy consumers. `make check-anti-patterns` reported 2 findings on the moved files.

**Workaround used:** updated each entry's `excludes_paths:` to the new editor-core file paths + updated each entry's `from:` to `@audiocontrol/editor-core` so the message tells operators where to import from now.

**Suggested fix:** the registry should keep `excludes_paths:` relative to the primitive's canonical location, not a hardcoded path. Or: each entry could declare a `canonical_implementation_file:` field, and the matcher auto-excludes that file. Bonus: when a `canonical_implementation_file` moves (detected via git rename), the matcher could fail the build with a specific error ("primitive file `X` moved to `Y`; update `excludes_paths`") rather than silently flagging the new location.

**Addressed by:** `fddbad06` (fix(scope-discovery-protocol): primitive-relocation awareness, PR #462). Anti-pattern entries gained a `canonical_file:` field; the matcher auto-excludes that file regardless of whether it appears in `excludes_paths`, so a primitive relocation doesn't break the gate the moment the file moves modules. Paired adversarial scenarios in `tools/scope-discovery/anti-patterns.canonical-file-scenarios.ts`. Verified locally post-merge: `make check-anti-patterns` exits 0; the scope-discovery validator suite reports its anti-patterns-canonical-file scenarios PASS.

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

**Addressed by:** `10dee19f` (fix(scope-discovery-protocol): clone-detector cites batch-dispose for NEW groups, PR #462). The pre-commit clone-detector now prints a paste-ready `batch-dispose.ts` command with the NEW group id pre-filled when it fails on undispositioned new groups. Operator paste-and-edits the disposition + reason instead of hand-writing the YAML entry.

---

## TF-004 · GATE · medium · Pre-commit gates fail one-at-a-time across the hook chain

**Repro:** Tried to commit the PageTitleRow promotion. The pre-commit hook chain blocked successively on:

1. `check-clone-duplication` — new group a50e0d779738 NEW
2. (after I dispositioned the clone) `check-anti-patterns` — 2 stale findings on the moved canonical files
3. (after I updated excludes_paths) `check-adopters` — page-title-row's old `from:` path

Each failure required a separate fix-and-retry cycle. Total: 3 round-trips to land a single commit. The signals were independent (different gates) but landed serially because the hook short-circuits on the first error.

**Workaround used:** worked through them one at a time.

**Suggested fix:** the pre-commit driver could run all gates in parallel, collect every failure, and present a single consolidated report. Operator does one fix-pass instead of N. The current short-circuit behavior is good for fast iteration when only one gate is red, but bad when multiple are red after a substantial change like a primitive promotion. A `--no-short-circuit` flag would let the operator opt in.

**Addressed by:** `a5986c8e` (fix(scope-discovery-protocol): pre-commit gate consolidation, PR #462). The hook chain now runs all staged-file-relevant gates in a single pass with non-short-circuiting reporting; operator sees every failure in a single output rather than playing whack-a-mole. Paired adversarial scenarios in `tools/scope-discovery/pre-commit-consolidation.validate.ts`.

---

## TF-005 · DSC · medium · Scope-inventory's module list is over-broad (12-of-12 workspace modules)

**Repro:** `/scope-inventory akai-harmonization` produced a strawman manifest listing every workspace module (12 of 12) including out-of-scope `d110-editor`, `jv1080-editor`, `sampler-devices`, `sampler-library`, `synth-core`, `e2e-infra`. The discovery agents seem to default to "include every module that matched any pattern" rather than weighting by relevance to the PRD's In Scope / Out of Scope sections.

**Workaround used:** operator-curated the manifest to drop 6 out-of-scope modules.

**Suggested fix:** the PRD-themed-pattern-hunter agent already reads the PRD; it could parse the "In Scope" / "Out of Scope" sections explicitly and emit a `module_relevance_score` per module so the synthesizer can mark out-of-scope entries with `excluded_by: prd-out-of-scope` instead of including them silently. Operator curation would then be reviewing the agent's pruning judgment, not writing the prune list from scratch.

**Addressed by:** `e294a29a` (fix(scope-discovery-protocol): scope-inventory PRD-scoped module pruning, PR #462). PRD-themed-pattern-hunter now parses In Scope / Out of Scope sections explicitly and emits a `prd_relevance` field per finding (high / medium / low / excluded). Synthesizer drops `excluded` modules with a cited warning and annotates low-relevance entries so operator curation reviews the pruning judgment rather than authoring it from scratch. Paired adversarial scenarios in `tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.relevance-scenarios.ts`.

---

## TF-006 · DSC · low · Synthesizer warns "PRD has no References/Appendix section" but the warning is mild

**Repro:** synthesizer wrote `reference_docs[]` with just PRD + LAYOUT.md and surfaced a note in `synthesis-notes.md`: "PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md."

**Workaround used:** accepted the default; noted that a Phase 2 re-run after the operator appends an Appendix to the PRD would produce richer references.

**Suggested fix:** the `/dw-lifecycle:define` PRD template could include a default empty Appendix section with explicit "References" / "Related issues" subheadings so the synthesizer has hooks to populate.

**Addressed by:** `4278986f` (fix(scope-discovery-protocol): synthesizer References warning gains paste-ready skeleton, PR #462). When the missing-References warning fires, the warning text + `synthesis-notes.md` now include a paste-ready PRD skeleton (Related issues / Related ADRs / External docs subheadings) the operator drops into the PRD verbatim. Paired adversarial scenario in `tools/scope-discovery/synthesis-warnings.validate.ts`.

---

## TF-010 · GATE · low · `make check-adopters` output is verbose; the relevant findings get lost in tracked-holdout noise

**Repro:** `make check-adopters` after a clean state prints `adopter-manifests: 0 holdouts across 9 manifest(s); 9 tracked holdout(s) reported separately.` then several KB of per-manifest output including all tracked holdouts (the 9 SlideDrawer cross-editor entries that are pre-existing). When checking gate state during a commit, the operator has to scroll past unrelated output to find the actual finding count.

**Workaround used:** piped through `tail -5` to find the summary line.

**Suggested fix:** the summary line should be the LAST line of output, not the middle. Or a `--quiet` flag that prints only the summary unless there are non-tracked findings. Or color-code: tracked holdouts in muted gray, real findings in red.

**Addressed by:** `837c9336` (fix(scope-discovery-protocol): check-adopters summary moves to last line + --quiet flag, PR #462). Both fixes shipped: the summary line is now always the last non-empty line of stdout, AND `make check-adopters QUIET=1` (or `--quiet` on the CLI) suppresses per-manifest detail when there are zero real holdouts. The `--quiet` mode is automatically overridden when real holdouts are present so the operator never silently misses a finding. Paired adversarial scenarios in `tools/scope-discovery/adopter-manifests.summary-ordering-scenarios.ts` (4 scenarios). Verified locally: my post-merge `make check-adopters` invocation showed the summary cleanly at the tail.

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
