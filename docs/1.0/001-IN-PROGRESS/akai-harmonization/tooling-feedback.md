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

**7 of 10 logged scope-discovery TF entries are now closed** — 6 by PR #462 (2026-05-24) and TF-013 by PR #463 (2026-05-24 evening). 3 new entries filed during continued Phase 2 work: TF-014 + TF-015 (AcZoneStrip dispatch, low-severity authoring-discipline gaps in the clone-detector + anti-pattern workflows); TF-016 (medium, dispatch-hygiene gap surfaced by 3 audit cycles of integration-layer regressions after primitive extractions).

| TF | Status | Closing commit |
|---|---|---|
| TF-001, TF-002 | Addressed | `fddbad06` (PR #462) — primitive-relocation awareness |
| TF-003 | Addressed | `10dee19f` (PR #462) — clone-detector cites batch-dispose for NEW groups |
| TF-004 | Addressed | `a5986c8e` (PR #462) — pre-commit gate consolidation |
| TF-005 | Addressed | `e294a29a` (PR #462) — scope-inventory PRD-scoped module pruning |
| TF-006 | Addressed | `4278986f` (PR #462) — synthesizer References warning gains paste-ready skeleton |
| TF-010 | Addressed | `837c9336` (PR #462) — check-adopters summary moves to last line + --quiet flag |
| TF-013 | Addressed | `6a1f8365` (PR #463) — disposition-survivor gate + strict-parse fix |
| TF-014 | Open (low) | — — `batch-dispose.ts` workflow gap (refresh-baseline is a separate prereq step) |
| TF-015 | Open (low) | — — anti-pattern regex prefix-matching trap (sibling classes false-positive without explicit negative-test scenarios) |
| TF-016 | Open (medium) | — — primitive-extraction dispatches recurrently land integration-layer regressions (3 audit cycles 2026-05-24); dispatch hygiene is the upstream issue |

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

**Addressed by:** `6a1f8365` (fix(scope-discovery-protocol): disposition-survivor gate + strict-parse fix, PR #463). Tools team picked the "Heavy" option from my suggested-fix list — a pre-commit `check-disposition-survivor` gate (`tools/scope-discovery/check-disposition-survivor.ts`, 309 lines) that fails the commit if any staged diff transitions a clones.yaml group from `keep-with-reason` / `refactor` / `ignore-with-justification` → `pending` without operator-conscious confirmation. Paired strict-parse fix (`tools/scope-discovery/clones-yaml.parse.ts`, 237 lines) ensures the YAML loader is strict-mode about disposition shape so the gate's comparison is deterministic. Paired adversarial scenarios across two new validators: `disposition-survivor.validate.ts` (319 lines, full subprocess invocation suite) + `disposition-survivor.gate-scenarios.ts` (268 lines, fixture-based gate scenarios). Audit-log filed as AUDIT-20260524-14 in scope-discovery-protocol (referenced in `b6e32883`). Verified locally post-merge: `pnpm test:scope-discovery` includes the new validator suites in its run; all green. The recurrence of TF-013 across my session's 8+ commits (every commit had the workdir regen) should stop now — the gate either prevents the silent disposition wipe at commit time OR fires loudly to surface it.

---

## TF-014 · CL · low · `batch-dispose.ts` requires IDs to already exist in clones.yaml; refresh-baseline is a separate prereq step

**Repro:** During the AcZoneStrip extraction dispatch (commits `03f36ce3..b9e7dbf8`), the sub-agent detected 5 NEW intra-file boilerplate clone groups created by the extraction. Tried to run `tsx tools/scope-discovery/batch-dispose.ts --ids <new-ids> --disposition keep-with-reason --reason "..."` to mark them. The tool rejected the call with an error indicating the IDs weren't present in `docs/scope-discovery/clones.yaml`. The sub-agent had to first run `tsx tools/scope-discovery/clone-detector.ts --refresh-baseline` to write the new IDs as `pending`, THEN batch-dispose worked.

This is a two-step workflow that the operator-facing help text doesn't surface clearly. A new clone group's lifecycle is: `detector finds it → refresh-baseline writes it as pending → batch-dispose updates the disposition → pre-commit gate validates the diff`. Skipping the refresh-baseline step leaves the operator stuck (the error doesn't suggest the fix).

**Workaround used:** ran refresh-baseline first, then batch-dispose. Documented for future dispatchers.

**Suggested fix:** several shapes:
- (Light) `batch-dispose.ts`'s error message could explicitly cite the `--refresh-baseline` prereq when it rejects unknown IDs ("ID `xxx` not in clones.yaml; run `tsx tools/scope-discovery/clone-detector.ts --refresh-baseline` first to add it as pending, then re-run this command").
- (Medium) `batch-dispose.ts` could auto-run the refresh-baseline check internally when given IDs not currently in the file — single command, no operator-visible two-step.
- (Heavy) The clone-detector could emit a paste-ready `batch-dispose.ts --ids X --disposition pending --reason "(default)"` command on stderr when it finds NEW groups, completing the loop already partially built by TF-003's closure (`10dee19f` — clone-detector cites batch-dispose for NEW groups). Currently the hint command works for IDs already in the file, not for the truly-new ones the detector just discovered.

The Heavy option pairs well with the existing TF-003 fix: TF-003 closes the gap for IDs the detector finds but the operator hasn't dispositioned; TF-014 closes the gap for IDs that don't exist in the file yet.

---

## TF-015 · A · low · Anti-pattern regex authoring trips on prefix-matching; sibling classes silently false-positive

**Repro:** During the AcZoneStrip extraction dispatch (commit `cfe6337b`), the sub-agent authored a new anti-pattern entry (`inline-zone-segment-bar`) with an initial pattern `\bac-zone-(segment|handle)\b`. The intent was to flag re-introduction of the canonical `.ac-zone-segment` / `.ac-zone-handle` chrome that AcZoneStrip now encapsulates. The pattern looked correct — both class-name fragments are bounded by word-boundaries.

But the regex flagged 6 false positives in the broader codebase: JSDoc comments and CSS sibling classes that share the `ac-zone-` prefix but aren't the targeted shape (`.ac-zone-bar`, `.ac-zone-section`, `.ac-zone-axis`, `.ac-zone-form`, `.ac-keygroup-zone-rect`). The `\b` boundary doesn't help because `-` is a non-word character; `ac-zone-bar` matches `ac-zone-` as the prefix and `bar` happens to start a word. The pattern needed tightening to `\bac-zone-(segment(--off|--editing|--dragging|-body)?|handle(--start|--end|--dragging)?)\b` — explicit per-suffix alternation rather than naive prefix-plus-bare-segment.

The author has to remember to write negative-test scenarios for prefix collisions. The gutted-stub self-check pattern (which every adversarial scenario file includes) covers the case "scanner returns empty → assertion fails" but does NOT cover "scanner matches sibling classes that share a prefix → assertion silently over-matches." The sub-agent caught this only because the false positives blocked the gate-clean assertion; without that secondary signal, the overbroad pattern could ship and silently flag every related class as an anti-pattern in future commits.

**Workaround used:** tightened the regex to enumerate explicit class-suffix shapes. Added negative-test scenarios to the paired adversarial scenario file asserting that sibling classes (`.ac-zone-bar`, `.ac-zone-section`, `.ac-zone-axis`, `.ac-zone-form`, `.ac-keygroup-zone-rect`) do NOT match.

**Suggested fix:**
- (Light) Anti-pattern entry-author convention: every new entry with a `pattern:` field that uses prefix-style matching MUST include negative-test scenarios for each related sibling class. The convention lives in the `tools/scope-discovery/anti-patterns.<id>-scenarios.ts` author template (currently each scenario file has positive + gutted-stub; add a "negative-match sibling classes" section).
- (Medium) Anti-pattern registry schema gains an optional `negative_match_classes:` array (e.g., `[".ac-zone-bar", ".ac-zone-section"]`); the validator auto-generates negative-test scenarios asserting those classes do NOT match the pattern. Authoring discipline shifts from "remember to write negative scenarios" to "declare the sibling classes to protect."
- (Heavy) Anti-pattern validator runs the pattern against a corpus of common-prefix class names sampled from the actual codebase (grep for all `.${prefix}-*` classes) and reports any matches as authoring warnings ("your pattern matches N sibling classes; declare excludes or tighten the regex").

The Medium option fits the existing scope-discovery design (registries are the source of truth; validators enforce shape). Pairs well with TF-002's primitive-relocation awareness, where the registry already carries `excludes_paths:` for the canonical-file case — extending to `negative_match_classes:` is a natural shape-fit.

**Note on overlap with the validator-paired-changes rule:** the agent-discipline.md "Validator-paired changes" section says new gate-semantic changes ship with adversarial scenarios that would have FAILED against the prior behavior. That rule is upstream of THIS friction — it requires SOMEONE to write the negative scenarios, but doesn't enforce the "sibling-class prefix collision" specific case. TF-015's fix would close that subgap.

---

## TF-016 · MISC · medium · Primitive-extraction dispatches recurrently land integration-layer regressions the audit catches

**Repro:** Three audit cycles in one session (2026-05-24) caught integration-layer regressions after primitive-extraction dispatches:

| Cycle | Primitive | Audit findings | Pattern |
|---|---|---|---|
| 1 | AcRadioTabs (commits a444acd5..1ae3420f) | AUDIT-10 (HIGH): CSS class-name conflict with existing `.ac-tabs`/`.ac-tab` button-tab consumers (LibraryPanel + BuildInfo) — global override broke their layout. AUDIT-11 (medium): invalid ARIA (`role="tablist"` + `role="tab"` + `tabIndex={0}` without keyboard handler implementation). | Sub-agent moved CSS class names verbatim without grepping for existing consumers; carried-forward fake-ARIA semantics from the legacy roland-local source. |
| 2 | AcZoneStrip (commits 03f36ce3..edab3add) | AUDIT-12 (medium): VelocityRangeBar callback-index drift after `.filter(Boolean)` compaction. AUDIT-13 (medium): invalid ARIA (`aria-pressed` on `role="group"` — wrong role/state pairing). | Sub-agent's wrapper introduced compaction without preserving source-array indices for callbacks; copied an invalid ARIA pattern from the legacy source. |
| 3 | AcFrequencyResponse + AcEnvelope (commits d524da07..6c1bb4fe) | AUDIT-14 (medium): wire-format regression — primitive emits float `resonance`; akai adapter forwarded straight into integer `FILQ` device field. AUDIT-15 (low): `activeSegment={0}` passed to AcEnvelope's 1-based API → silent clamp to 1 → permanent fake "segment 1 active" highlight on a surface that has no selection-state model. | Sub-agent matched primitive's continuous-value API but didn't add the rounding+clamping the legacy adapter performed; used 0 as a "no value" sentinel against a 1-based contract that silently coerces it. |

Common shape across all three: the primitive's API surface changes (different value type, different ARIA role, different state contract) and the consumer adapter simply passes through what the legacy primitive accepted. The dispatch brief focuses on primitive shape + migration mechanics; integration-layer details (rounding, clamping, valid index ranges, ARIA contract correctness, class-name conflicts) get missed because the sub-agent reads existing adapter code as "still works" (it compiles + types pass) — but semantic correctness was lost in the contract delta.

Each fix has been small and contained (a single follow-up commit closes both findings per cycle, with validator-paired-changes hard tests confirming teeth). But the recurring shape suggests dispatch hygiene is the upstream issue, not implementation skill.

**Workaround used:** auditor catches each cycle's regressions after the primitive lands; controller files findings; ui-engineer closes them in a follow-up dispatch with paired adversarial scenarios.

**Suggested fix:**
- **(Light) Dispatch-brief template addition.** Every primitive-extraction dispatch brief gains a mandatory "Consumer-side adapter contract delta" section that explicitly enumerates: (a) what changed in the primitive's API surface vs the legacy implementation (value types, range, integer-vs-float, ARIA roles, class-name semantics, index base 0 vs 1, state contract — selection / active / disabled / etc.); (b) what EACH consumer adapter MUST do to preserve the legacy wire-format / UI-state contract (round-then-clamp at the boundary, pass-null-instead-of-0, translate-rendered-index-to-source-index, etc.); (c) regression-test scaffolding the sub-agent must add at the adapter layer (NOT just at the primitive layer). Lives in `.claude/agents/ui-engineer.md` or in a documented dispatch-brief template the controller pastes into every primitive-extraction dispatch.

- **(Medium) Controller-side pre-dispatch checklist.** Before sending any primitive-extraction dispatch, the controller runs a checklist: (a) grep for class-name conflicts across all modules (`grep -r '\.ac-<primitive-name>' modules/`); (b) grep for the legacy primitive's value-type / range constants (`grep -r 'MAX_VAL\|0..127\|0..15' <legacy-file>`); (c) ARIA roles audit on the legacy source — check every role + state attribute against the WAI-ARIA spec for valid pairings; (d) consumer-side adapter survey — read every consumer file's `onChange` handler to identify rounding/clamping/index-translation that the new primitive may break. Lives in `.claude/rules/primitive-extraction-checklist.md` (new). The checklist's output becomes input to the dispatch brief.

- **(Heavy) Sub-agent template self-checks before DONE.** The ui-engineer sub-agent's prompt (or a new specialized `primitive-extraction-engineer` agent) carries an "integration-layer audit" subroutine that runs before signaling DONE: (a) re-read every consumer file's adapter code post-migration; (b) verify each value forwarded to the primitive AND each value received from the primitive matches the legacy wire-format contract (rounding, clamping, range); (c) verify the primitive's ARIA contract is correct per WAI-ARIA spec (cross-check role + state attribute pairings); (d) verify class-name namespaces don't conflict with existing consumers. Subroutine output appears in the sub-agent's final report as an "Integration-layer audit" section the controller can spot-check before accepting DONE.

The Medium option is operator-actionable now: drafting `.claude/rules/primitive-extraction-checklist.md` requires no agent-template changes and produces immediate value for the next primitive extraction (virtual front panel, AcEnvelope's `kind: 'adsr'` consumer adapter on roland if needed, etc.). The Light option is also incremental but requires the controller to remember to paste the section into every brief. The Heavy option closes the loop structurally but requires sub-agent prompt updates the operator may want to vet separately.

**Note on validator-paired-changes interaction:** the `.claude/rules/agent-discipline.md` "Validator-paired changes" section requires adversarial scenarios for new gate-semantic behavior. Each of the 3 audit-cycle fixes added such scenarios (with teeth, confirmed by stash-and-rerun). TF-016 is upstream of that rule — it asks "did the DISPATCH itself surface the integration-layer concerns that need adversarial scenarios?" The current discipline is reactive (audit catches, fix scenarios get written); TF-016 makes it proactive (dispatch identifies concerns up-front, scenarios land with the primary commit).

---

## How to add an entry

1. Hit friction or pathology or notice an improvement opportunity.
2. Pick a category (A / AM / CL / GATE / DSC / MISC) and severity (high / medium / low).
3. Append a new section at the bottom (or insert by topic if it pairs with an existing entry) with the next TF-NNN id.
4. Include: Repro (what happened), Workaround used (what unblocked), Suggested fix (the operator-recognizable shape of a fix, not just "make it better").
5. Commit alongside the work that surfaced it.
