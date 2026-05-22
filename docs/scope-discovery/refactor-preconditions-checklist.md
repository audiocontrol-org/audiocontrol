<!--
  Canonical source for the Refactor Preconditions (Step 0) checklist.

  This fragment is referenced from:
    - docs/scope-discovery/README.md §"Refactor Preconditions (Step 0)"
    - .claude/agents/code-reviewer.md §"Refactor preconditions (Phase 5)"
    - .claude/agents/codebase-auditor.md §"Refactor preconditions (Phase 5)"
    - tools/scope-discovery/refactor-preconditions-prompt.ts
      (exports REFACTOR_PRECONDITIONS_CHECKLIST for the dispatch wrapper)

  Editing rule: when you change Step 0a / Step 0b semantics here, sync the
  same wording to the four mirror locations above. The mirror locations
  exist because static markdown agent prompts and the dispatched-prompt
  string constant cannot transclude this file at load time — the duplication
  is intentional, the synchronization is not optional.

  T5.4 may replace the agent-side copies with a build-time concat step;
  until then the SYNC-WITH comments in each mirror file name this path.
-->

# Refactor Preconditions (Step 0)

A `disposition: refactor` entry in `docs/scope-discovery/clones.yaml` is incomplete without both Step 0a (canonical-side identification) and Step 0b (regression-detection coverage). Run Step 0 BEFORE writing extraction code, BEFORE opening a refactor PR.

The two-part check exists because clone-count-driven refactor work has two failure modes that look like progress while introducing regression:

- **Regime erasure** — extracting from the wrong (legacy) side of a clone silently downgrades new-regime call sites to legacy semantics. Step 0a names the canonical side BEFORE extraction so the wrong-side mistake gets caught at disposition time, not after the merge.
- **Behavior regression masked by clone-count drop** — a refactor lands, the clone counter drops, but no test actually exercises the class of regression the refactor risks. Step 0b requires the test + a recorded failing-then-passing commit (proof-of-detection) BEFORE the refactor PR is built on top.

## Step 0a — Identify the canonical side (four branches)

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

## Step 0b — Identify regression-detection coverage (three branches)

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

## Rationale (operator's MUST HAVE)

Step 0 is the operator-declared MUST HAVE for Phase 5. The goal is twofold:

1. **Prevent behavior regression during refactoring.** The proof-of-detection commit anchors the test to a specific failing-then-passing pair; the refactor PR can no longer be a clone-count drop without a corresponding behavior-preservation guarantee.

2. **Systematically reinforce test coverage and quality as a side effect of the gate.** Every time a refactor disposition would have been written without coverage, Step 0b forces the test to be written or proven first. The clone-disposition backlog becomes a test-coverage forcing function. Drains that look like cleanup are also coverage walks.

The gate is enforced mechanically by the T5.3 pre-commit hook (`make check-refactor-preconditions`); the schema validator in `tools/scope-discovery/clones-yaml.refactor.ts` catches parse-time omissions; this document is the operator-facing protocol that the schema enforces. T5.4 wires the same checklist into sub-agent dispatched prompts so refactor-context dispatches carry the Step 0 obligation without operator restatement.
