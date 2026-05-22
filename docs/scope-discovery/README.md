# Scope Discovery Protocol

A repo-wide protocol that makes the agent's first move on a system-wide change an **upfront inventory pass** rather than a **reactive single-fix loop**, and that enforces **sibling-enumeration** on every code-writing sub-agent dispatch via a programmatic wrapper.

Motivated by the Roland S-330/S-550 v3 redesign (May 2026), which spent ~230 operator turns over 60 hours doing brute-force discovery the agent should have done in 10–15 minutes at session start. Background analysis: [`../analysis/s550-redesign-scope-discovery.md`](../analysis/s550-redesign-scope-discovery.md).

The protocol treats agent-side enforcement as **code, not directives** — passive rules in `CLAUDE.md` and agent prompts have demonstrably failed against persistent pathologies in this repo. Every gate the protocol introduces is code-shaped: it rejects the bad shape mechanically, not by asking the agent to remember.

## When to reach for each entry point

| Situation | Action | Why |
|---|---|---|
| Starting a **system-wide feature** (UI redesign, architectural refactor, cross-cutting pattern enforcement) | `/scope-inventory <feature-slug>` | Produces a strawman `scope-manifest.yaml` + evidence trail so you walk the routes / modules / themes / patterns once upfront instead of N times reactively. |
| **Mid-implementation operator complaint** ("the chevron is too small on Patches," "library uses a different primitive than Tones") | `/scope-widen "<complaint>"` | Greps for the named class/component/pattern, returns a `Searched / Included / Excluded` proposal naming every sibling that needs the same fix. |
| **Pre-commit hook blocked your commit** with "new clone groups detected" | Read the failure output. Then either: (a) refactor so the new clone disappears; (b) edit `docs/scope-discovery/clones.yaml` to disposition the group as `keep-with-reason` / `ignore-with-justification` with a one-line reason; (c) run `/scope-widen` to find sibling cases that should be fixed in the same commit. | The gate enforces "no new duplication beyond the dispositioned baseline." Bypassing it requires explicit disposition, not silent commit-amend. |
| Reviewing the **duplication backlog** | Inspect `docs/scope-discovery/clones.yaml` (1 entry per clone group) | Each entry carries `id`, `members: [file:line]`, `lines`, `disposition`, `reason`. Operator dispositions every entry; refactor-marked entries become merged PRs. |
| Sub-agent dispatch returned without enumerating siblings | The dispatch wrapper rejects the return automatically (when the orchestrator uses `wrap(...)` from `tools/scope-discovery/dispatch-wrapper.ts`) | Required return grammar: `Searched: <pattern> — <N matches>` / `Included: <file:line>, ...` / `Excluded: <file:line> — <reason>`. The wrapper parses + validates this block. |
| **Dispositioning a clone group as `refactor`** | Follow Step 0 (canonical-side identification + regression-detection coverage); see [`## Refactor Preconditions (Step 0)`](#refactor-preconditions-step-0) below | Prevents regime erasure + behavior regression masked by a clone-count drop. Required by T5.3's pre-commit gate; enforced at parse time by the schema validator in `tools/scope-discovery/clones-yaml.refactor.ts`. |

## Refactor Preconditions (Step 0)

A `disposition: refactor` entry in `clones.yaml` is incomplete without both Step 0a (canonical-side identification) and Step 0b (regression-detection coverage). Run Step 0 BEFORE writing extraction code, BEFORE opening a refactor PR.

The two-part check exists because clone-count-driven refactor work has two failure modes that look like progress while introducing regression:

- **Regime erasure** — extracting from the wrong (legacy) side of a clone silently downgrades new-regime call sites to legacy semantics. Step 0a names the canonical side BEFORE extraction so the wrong-side mistake gets caught at disposition time, not after the merge.
- **Behavior regression masked by clone-count drop** — a refactor lands, the clone counter drops, but no test actually exercises the class of regression the refactor risks. Step 0b requires the test + a recorded failing-then-passing commit (proof-of-detection) BEFORE the refactor PR is built on top.

### Step 0a — Identify the canonical side (four branches)

Pick exactly one branch and record the matching fields on the clone-group entry.

**(i) One side has a documented regime.** Cite the primitive, ADR, deprecation marker, migration commit, or design doc that makes that side authoritative. That side is canonical; holdouts migrate to it.

```yaml
canonical_side: <relative-file-path-of-canonical-side>
canonical_reason: <one-line citation — primitive name, ADR id, commit sha, etc.>
```

Extraction follows the named file's shape; the other clone members are migrated to match. No new shape is introduced.

**(ii) All sides are correctly migrated.** Every member of the clone group already follows the regime; the duplication is a missing-primitive gap. Extraction lifts the common shape into a new shared primitive (a component, a hook, a util fn) with zero behavior change at any call site.

```yaml
canonical_side: "all"
canonical_reason: <one-line explanation — which regime, why each side is correctly migrated, what primitive will lift the shape>
```

**(iii) No side is canonical.** All members are legacy / pre-regime; the refactor designs a NEW shape from scratch. The new shape MUST be named in the disposition record before extraction begins, otherwise the shape is invented in flight and inherits whichever side happened to be edited last.

```yaml
canonical_side: "new"
canonical_reason: <one-line explanation — why no current side is authoritative>
new_shape_summary: <one-line design summary naming the target shape>
```

The operator should review the named design before extraction work starts.

**(iv) Cannot decide which branch applies.** The clone group's canonical side is undetermined — perhaps the regime question itself is unsettled, or the members straddle two regimes whose relationship is unclear. **Do not proceed to extraction.** Disposition the group as `keep-with-reason` with a one-line note pointing to the regime question that needs resolving.

```yaml
disposition: keep-with-reason
reason: <regime-clarification needed — see issue #N or doc-path>
```

Once the regime clarification lands, re-evaluate the group; only then is `refactor` a valid disposition.

### Step 0b — Identify regression-detection coverage (three branches)

Pick exactly one branch and record the matching fields on the clone-group entry.

**(i) Regression-detecting tests exist AND have a recorded proof-of-detection commit.** Cite both — name the tests, and cite the commit that demonstrates the test catches the regression class the refactor risks.

```yaml
tests:
  - <test-id-or-command>
  - <test-id-or-command>
tests_proof:
  sha: <7-40 hex commit sha>
  demonstration: <one-line description of the failing-then-passing pair>
```

The refactor PR is built on top of the proof-of-detection commit's safety net.

**(ii) Tests exist but no recorded proof-of-detection.** The test file is present but nobody has ever broken the canonical code and watched the test fail. **Create the proof first.** The procedure is:

1. Deliberately break the canonical-side code in a way that simulates the regression class the refactor risks.
2. Run the named test(s). Capture the failure output (commit message body, comment block, or attached log).
3. Commit the demonstration with a marker phrase like `proof-of-detection: <test-id>` in the commit message body.
4. Restore the canonical code (revert the deliberate break) in a follow-up commit; the test now passes again.
5. The refactor PR then references the demonstration commit's SHA in `tests_proof.sha`.

```yaml
tests:
  - <test-id-or-command>
tests_proof:
  sha: <commit sha from step 3>
  demonstration: <one-line description of the deliberate break + failure>
```

**(iii) No tests exist.** The clone group has no regression-detecting coverage at all. **Create the tests first.** The procedure is:

1. Write the regression-detecting test against the canonical-side code (per Step 0a).
2. Run the test. It should pass (canonical code is correct).
3. Deliberately break the canonical code. Run the test. It should fail. This is the proof-of-detection.
4. Commit the demonstration with a marker phrase like `proof-of-detection: <test-id>` in the commit message body.
5. Restore the canonical code. The test passes again.
6. Build the refactor PR on top, referencing the demonstration commit's SHA.

```yaml
tests:
  - <test-id-or-command>
tests_proof:
  sha: <commit sha from step 4>
  demonstration: <one-line description of the failing-then-passing pair>
```

### Rationale (operator's MUST HAVE)

Step 0 is the operator-declared MUST HAVE for Phase 5. The goal is twofold:

1. **Prevent behavior regression during refactoring.** The proof-of-detection commit anchors the test to a specific failing-then-passing pair; the refactor PR can no longer be a clone-count drop without a corresponding behavior-preservation guarantee.

2. **Systematically reinforce test coverage and quality as a side effect of the gate.** Every time a refactor disposition would have been written without coverage, Step 0b forces the test to be written or proven first. The clone-disposition backlog becomes a test-coverage forcing function. Drains that look like cleanup are also coverage walks.

The gate is enforced mechanically by the T5.3 pre-commit hook (`make check-refactor-preconditions`); the schema validator in `tools/scope-discovery/clones-yaml.refactor.ts` catches parse-time omissions; this section is the operator-facing protocol that the schema enforces. T5.4 wires the per-branch verification language (canonical fragment §"Verification per branch") into sub-agent dispatched prompts via two paths:

- **Static agent-prompt mirrors** — `.claude/agents/code-reviewer.md` + `.claude/agents/codebase-auditor.md` each carry a §"Step 0 verification" section naming the four canonical_side branch verifications + the test-precondition verification action.
- **Dispatch-wrapper conditional prelude** — `tools/scope-discovery/dispatch-wrapper.ts` `wrap()` appends the prelude exported by `tools/scope-discovery/refactor-preconditions-prompt.ts` (`REFACTOR_PRECONDITIONS_CHECKLIST`) when the task prompt carries a refactor marker (`Closes clones.yaml` / `refactor disposition` / `disposition: refactor` / `extraction commit` / a literal `canonical_side` reference). This covers refactor-context dispatches without requiring a standalone refactor-orchestrator agent.

The canonical fragment used by sub-agent prompts and the dispatched-prompt string constant is [`refactor-preconditions-checklist.md`](refactor-preconditions-checklist.md); changes to Step 0a / Step 0b semantics + per-branch verification language must be mirrored to that file and to the four mirror locations its header enumerates.

## Day-to-day workflow

A typical system-wide feature lifecycle with the protocol active:

```
/dwd <slug>                          # define the feature; PRD + workplan stub
/dws <slug>                          # set up branch + worktree + GitHub issue
/scope-inventory <slug>              # upfront discovery (if system-wide)
↓
  → strawman scope-manifest.yaml in feature docs dir
  → per-run evidence trail under scope-inventory/runs/<stamp>-<runId>/
  → journal.md updated
↓
operator reviews + prunes the strawman
↓
implementation work begins
↓
operator surfaces inconsistency mid-flight   →   /scope-widen "<complaint>"
                                                   ↓
                                                 grep-based audit
                                                 widening proposal in chat
                                                 operator confirms
                                                 fix lands across all sibling sites
↓
commit
↓
pre-commit hook fires:
  - check-css-duplication (CSS class drift; existing)
  - check-clone-duplication (general jscpd-based TS/TSX detection; new)
↓
if new clone group: commit blocked → fix or disposition before retry
↓
PR opened, review, merge
```

## The four discovery agents (T3.1)

`/scope-inventory` fans these out in parallel; each produces structured JSON consumed by the synthesis pass:

| Agent | File | What it does |
|---|---|---|
| `ui-route-enumerator` | `tools/scope-discovery/discovery-agents/ui-route-enumerator.ts` | Reads the feature PRD to identify in-scope editor modules; walks each module's `src/App.tsx` for React-Router `<Route>` declarations; resolves each to its page file. Returns the route map. |
| `ast-grep-matrix` | `tools/scope-discovery/discovery-agents/ast-grep-matrix.ts` | Walks `modules/*/src/` for `.ts` / `.tsx` and matches a curated pattern set: `.ac-*` class consumers, `as Type` casts, `: any` annotations, `@ts-ignore` pragmas, hardcoded magic numbers. Returns `{ pattern, file:line, snippet }`. |
| `clone-detector-reader` | `tools/scope-discovery/discovery-agents/clone-detector-reader.ts` | Reads `docs/scope-discovery/clones.yaml`, filters clone groups whose members fall within the feature's module scope, returns the relevant groups. |
| `prd-themed-pattern-hunter` | `tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.ts` | Tokenizes the feature PRD, extracts theme keywords (top-12 by frequency, stopwords dropped), greps modules for those terms. Returns `{ term, occurrences }`. |

The synthesis pass at `tools/scope-discovery/synthesis.ts` consumes all four and produces a `scope-manifest.yaml` that validates against `tools/scope-discovery/schema/scope-manifest.schema.json`.

## The dispatch wrapper (T2.4)

`tools/scope-discovery/dispatch-wrapper.ts` exports `wrap(agentType, prompt, options)` that:

1. **Injects** a return-grammar prelude into the dispatched sub-agent's prompt. The prelude documents the required `Searched / Included / Excluded` block + the forbidden-deferral phrase list.
2. **Awaits** `options.dispatchFn(...)` — the orchestrator-supplied callback that invokes the actual Claude Code Agent tool.
3. **Parses** the return for the structured block.
4. **Validates** the parsed block against three rules:
   - All three labels present.
   - If `Searched: count > 1` and `Included: 1` match, `Excluded:` must enumerate the omitted matches (the "skipped the audit" failure mode).
   - No `Excluded:` reason may contain a forbidden deferral phrase (`"for now"`, `"TODO"`, `"fix later"`, `"until F<n>"`, etc. — see `tools/scope-discovery/dispatch-grammar.ts` `FORBIDDEN_DEFERRAL_PHRASES` + `FORBIDDEN_DEFERRAL_REGEXES`).
5. **Returns** the parsed structured object or **throws `DispatchRejected`** with the missing block(s) named.

The forbidden-phrase list is sourced from `.claude/rules/agent-discipline.md` §"Just for now is bullshit." The wrapper enforces that rule mechanically — sub-agents cannot reach orchestrator-side code with a "for now" exclusion reason intact.

## File layout

- `docs/scope-discovery/` — this directory
  - `README.md` — this file
  - `LAYOUT.md` — on-disk artifact contract (directory shape, file schemas, gitignore policy)
  - `clones.yaml` — the dispositioned clone-group baseline (committed, source of truth for the gate)
- `tools/scope-discovery/` — implementation
  - `clone-detector.ts` + `jscpd-runner.ts` + `clones-yaml.ts` — general clone detector
  - `clone-detector.validate.ts` — adversarial validator harness (4 scenarios incl. gutted-stub)
  - `dispatch-wrapper.ts` + `dispatch-grammar.ts` — sub-agent dispatch wrapper
  - `dispatch-wrapper.validate.ts` + `dispatch-wrapper.fixtures.ts` — adversarial validator harness (43 scenarios incl. two-level gutted-stub)
  - `discovery-agents/{ui-route-enumerator,ast-grep-matrix,clone-detector-reader,prd-themed-pattern-hunter}.ts` — the four agents
  - `discovery-agents/{shared.ts,types.ts}` — DRY scaffolding + discriminated-union types
  - `synthesis.ts` + `synthesis-derive.ts` + `synthesis-types.ts` — strawman manifest synthesizer
  - `schema/scope-manifest.schema.json` + `manifest-validator.ts` + `validate.ts` — manifest schema + validator
  - `find-feature.ts` — backs `make scope-inventory FEATURE=<slug>`
- `.claude/skills/scope-inventory/SKILL.md` — the upfront-discovery skill (10-step procedure)
- `.claude/skills/scope-widen/SKILL.md` — the mid-implementation widening skill (7-step procedure)
- `.githooks/pre-commit` — wires both gates (CSS-class + general clone) into pre-commit
- `Makefile` — `make scope-inventory FEATURE=<slug>`, `make refresh-clones-baseline`, `make test-scope-discovery`, etc.

Per-feature scope-discovery artifacts live in the feature docs directory; see `LAYOUT.md` for the contract.

## Running the validator suite

The adversarial validator harnesses prove the gates have teeth. Run them locally:

```bash
pnpm test:scope-discovery       # both validators, ~4s combined
# or
make test-scope-discovery       # equivalent
```

Output: `Summary: 4/4 scenarios passed` (clone-detector) + `Summary: 43/43 scenarios passed` (dispatch-wrapper).

Each suite includes a **gutted-logic self-check**: a stub of the underlying gate is fed through the harness's assertions, and the harness FAILS if the gate-stub correctly passes the assertion. In other words: if someone gutted the gate's logic, the validator catches it.

## Honest limitations (v1)

What the protocol catches:

- **Code-shaped duplication** in `.ts` / `.tsx` files: component clones, hardcoded-list clones, logic clones, near-duplicate JSX shells.
- **Cross-page CSS-class drift** (via the separate, pre-existing CSS-duplication checker).
- **Sub-agent returns missing audit evidence** (via the dispatch wrapper).
- **Sub-agent excluded-reason deferral language** (via the forbidden-phrase list).

What the protocol does NOT catch (v2 enhancement classes, named in `paper-test-s550.md`):

- **DOM-visual properties** — layout density, scrollbar-induced layout shift, clipped-element edge cases. Closes via a Playwright-driven DOM-walk agent (analysis report §5.1).
- **Accessibility violations** not tied to a CSS class — focus order, aria semantics, keyboard nav. Closes via an axe-core or a11y-audit agent.
- **Vestigial UI copy** — strings that no longer apply. Closes via a text-content audit agent.
- **Component-below-route surfaces** — sub-components inside pages aren't enumerated by the route-walker. Closes via an extended ui-route-enumerator or a component-roster agent.
- **Single-page edge cases with no siblings** — `/scope-widen` returns "no widening needed"; operator still has to fix the one instance. This is irreducible.

Paper-test result against the s550 redesign's 32 documented surfaces: **87.5% combined coverage** (5 caught by `/scope-inventory` + 23 by `/scope-widen` post-complaint). The 12.5% gap is documented v2 classes.

## Pointers

- **What shipped:** PR [#441](https://github.com/audiocontrol-org/audiocontrol/pull/441) ("scope-discovery-protocol: phases 1–3 + ship-ready Phase 4 slice").
- **On-disk contract:** [`LAYOUT.md`](LAYOUT.md).
- **Per-skill procedures:** [`.claude/skills/scope-inventory/SKILL.md`](../../.claude/skills/scope-inventory/SKILL.md) + [`.claude/skills/scope-widen/SKILL.md`](../../.claude/skills/scope-widen/SKILL.md).
- **PRD + workplan:** [`docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/`](../1.0/001-IN-PROGRESS/scope-discovery-protocol/) (until T4.6 flips it to `003-COMPLETE/`).
- **Background analysis:** [`docs/analysis/s550-redesign-scope-discovery.md`](../analysis/s550-redesign-scope-discovery.md) — the original 5-day brute-force tail that motivated the protocol.
- **Validation evidence:** [`docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/smoke-test-s550.md`](../1.0/001-IN-PROGRESS/scope-discovery-protocol/smoke-test-s550.md) (T3.6 run evidence) + [`paper-test-s550.md`](../1.0/001-IN-PROGRESS/scope-discovery-protocol/paper-test-s550.md) (T4.4 coverage matrix).

## Phase 4 status (validation-by-drain)

The feature is shipped at the tool level; Phase 4 (T4.2 / T4.3 / T4.6) is the operator-judgment drain of `clones.yaml`'s 495 dispositionable entries. That work happens on the active post-s550 bugfix branch as a natural by-product of its refactor scheduling — not as a separate ceremonial phase. The Phase 4 acceptance gate stays binding ("clones.yaml has zero un-dispositioned entries; every refactor entry has a merged PR"); only the geography of where the drain happens is flexible.

When the drain reaches zero, the feature flips to `docs/1.0/003-COMPLETE/scope-discovery-protocol/` (via a small finishing commit on `main` or as part of the bugfix branch's wrap-up).
