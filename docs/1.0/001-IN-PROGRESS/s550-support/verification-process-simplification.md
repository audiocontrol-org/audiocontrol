# Verification Process Simplification Proposal

This document is a feature-local rationale and worked example for the Roland S-550 redesign. The project-wide policy now lives at [UI-CONTRACT-AND-VERIFICATION-STANDARD.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/UI-CONTRACT-AND-VERIFICATION-STANDARD.md).

## Purpose

This document explains why the current verification and sign-off system for the S-550 redesign has become hard to understand, and proposes a simpler model that preserves the useful parts while removing operator-facing complexity.

The immediate problem is not that any one artifact is wrong. The problem is that too many artifacts are trying to explain overlapping parts of the same reality:

- what the UI is supposed to do
- what has been tested
- what is broken
- what still needs a human decision
- what the implementation team is waiting on

That split is defensible for traceability, but hard to reason about in practice.

## The Current System

### Original motivation

The capabilities document was invented for a good reason: the redesign had previously shipped controls that were visually present but not actually usable. The capability inventory was meant to say, in plain terms, what the UI is supposed to do so that verification could be tied to the product rather than to implementation guesses.

That intent is still correct.

### What exists now

The current verification/sign-off system is distributed across these artifacts:

1. `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`
   - intended behavior inventory
   - currently also carries verification state (`Sign-off`, `Coverage`)

2. `docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md`
   - source of truth for findings
   - contains historical audits, controller acknowledgements, closures, and follow-up evidence

3. `docs/1.0/001-IN-PROGRESS/s550-support/live-s550-conformance-matrix.md`
   - maps live conformance specs to pages and D-IDs
   - shows which surfaces are `pass`, `fail`, `unrun`, or `blocked`

4. `docs/1.0/001-IN-PROGRESS/s550-support/operator-review-runbook-current.md`
   - operator-facing sign-off checklist
   - now narrowed to manual-only work, but still depends on the other documents for context

5. `docs/1.0/001-IN-PROGRESS/s550-support/operator-review-runbook.manifest.json`
   - machine-readable decomposition of the runbook
   - useful for integration tooling, not useful for direct human consumption

6. `docs/1.0/001-IN-PROGRESS/s550-support/workplan.md`
   - assigns ownership and closure criteria
   - distinguishes auditor-owned execution work from operator-owned sign-off

### Why it feels too complicated

The system now asks the operator to understand distinctions that matter to the tooling, but should not matter to the operator:

- auditor-owned vs operator-owned
- live conformance vs structural rerun
- inventory coverage vs sign-off
- current blocker vs historical finding
- machine-readable runbook vs human runbook

These distinctions are useful to keep engineering work disciplined, but they are not the right interface for the person trying to answer a simpler question:

> "Is the UI good enough to sign off, and if not, what exactly is still wrong?"

The operator should not need to understand the whole verification edifice to answer that.

## What Should Stay

Not everything here is accidental complexity.

These parts are still valuable and should remain:

### 1. The capability inventory

The capabilities document remains the best place to define what the UI is supposed to do.

It prevents a recurrence of the earlier failure mode where tests passed but the visible UI was unusable.

### 2. The audit log

The audit log remains useful as the durable record of what broke, how it was verified, and what changed over time.

It is the right place for engineering memory and evidence.

### 3. The live conformance specs

The live-device Playwright work is valuable because it catches the exact class of failure that motivated the capability inventory in the first place: controls that exist visually but do not actually work on hardware.

### 4. Explicit operator sign-off

A final operator-owned sign-off step is still correct. Some questions are inherently judgment calls that cannot be reduced to automated checks.

## What Should Change

The main reform is not to delete rigor. It is to change which artifact is allowed to talk to which audience.

### Principle 1: The operator should see only decision-shaped information

The operator-facing surface should answer:

1. What am I personally being asked to check?
2. Where do I look?
3. What is already known?
4. What decision do I need to make?

It should not require the operator to understand the testing architecture.

### Principle 2: Machine-state and human-state should be separated cleanly

Machine state:

- manifest
- coverage calculations
- dispatcher commands
- structural rerun outputs
- tier/credibility machinery

Human state:

- this behavior looks right
- this behavior still looks broken
- this finding blocks sign-off
- this capability row is signed off

The current system mixes these too often.

### Principle 3: Each artifact should have one primary job

Today, several artifacts do double or triple duty. That creates confusion.

The desired simplified model is:

1. **Capabilities document**
   - only the intended behavior and its final human verification state

2. **Audit log**
   - only broken things and their evidence/history

3. **Conformance matrix**
   - only test coverage/execution state for the live suite

4. **Operator runbook**
   - only the manual decisions the operator must make now

5. **Workplan**
   - only ownership and delivery sequencing

## Proposed Simplified Model

### A. Capabilities document becomes the product contract

The capabilities document should be treated as the plain-language statement of what the UI must do.

Operator-facing meaning of the row state should be simple:

- `unsigned` / not yet signed off
- `signed off`
- `blocked by finding <ID>`

The operator should not need to infer product health from test architecture vocabulary.

The `Coverage` column can continue to exist for engineering purposes, but it should not be the thing the operator is being asked to interpret.

### B. Audit log becomes failure-only

If something is not broken, it should not dominate the operator story.

The audit log should remain the deep record, but the operator should only consume a filtered view:

- current open findings
- their plain-language meaning
- whether they block sign-off

Historical appendices should remain for engineering memory, not as the operator’s primary interface.

### C. Live conformance matrix becomes engineering-only

The matrix is useful for the auditor and implementation team, but it is not the right primary artifact for operator sign-off.

It should continue to exist, but it should be explicitly treated as supporting engineering state, not as the thing the operator is expected to read to understand what is happening.

### D. Operator runbook becomes a true checklist

The operator runbook should be short and human-shaped.

Each step should look like:

- `Behavior to judge`
- `Where to look`
- `Known evidence`
- `Your decision`

The operator should never need to execute auditor-owned reruns from this document.

### E. One operator summary should exist

The operator should have a single short summary page that answers:

- what is already verified
- what remains open
- what decisions are needed
- what result to record

That summary can live at the top of the runbook, but it must stay short enough to be understandable in one read.

## Proposed Reforms

### Reform 1 — Make the operator runbook strictly manual-only

Status: already partially achieved.

The current runbook has now been narrowed to operator-only work. This direction should be preserved.

### Reform 2 — Stop treating the operator runbook as a mixed execution surface

The runbook should no longer contain:

- auditor rerun commands
- machine-check commands
- dispatcher usage instructions
- structural validation steps

Those belong to the auditor workflow, not the operator workflow.

### Reform 3 — Add a short “open sign-off blockers” summary

Instead of making the operator read multiple docs, create a short stable summary that lists only:

- capabilities still awaiting sign-off
- open findings that block sign-off
- findings explicitly judged out of scope

This summary can either be:

- the top section of the operator runbook, or
- a separate `operator-signoff-summary.md`

Either is acceptable as long as it remains the one page the operator can trust.

### Reform 4 — Demote engineering vocabulary in operator-facing docs

Operator-facing docs should avoid using these as primary explanatory concepts:

- Tier 1 / Tier 2 / Tier 3 / Tier 4
- credibility checks
- structural rerun
- dispatcher
- manifest classifications

Those can exist in supporting notes, but not as the main language of operator review.

### Reform 5 — Keep the engineering machinery, but push it behind the curtain

The underlying machinery still has value:

- it keeps the auditor honest
- it keeps the implementation team from claiming closure too early
- it preserves evidence when findings evolve

The reform is not to remove that machinery. The reform is to stop exposing it as the operator’s primary interface.

## Migration Steps

The reforms should be made in a small number of controlled steps.

### Step 1 — Finalize the operator-only runbook

Goal:

- ensure `operator-review-runbook-current.md` contains only operator-unique actions

Done when:

- no auditor-owned rerun commands remain
- each section ends in a human decision, not a machine action

### Step 2 — Add a sign-off blocker summary

Goal:

- provide one short operator-facing summary of what still blocks sign-off

Recommended contents:

- `Already verified`
- `Awaiting operator sign-off`
- `Open blocking findings`
- `Final decision format`

### Step 3 — Clarify artifact roles in README

Goal:

- explain, in one short place, what each document is for

This should explicitly distinguish:

- product contract
- engineering evidence
- operator checklist

### Step 4 — Reduce operator-facing references to internal test architecture

Goal:

- remove or minimize tier/credibility/dispatcher language in the operator-facing materials

This is documentation cleanup, not infrastructure deletion.

### Step 5 — Optionally simplify the capability row semantics

Goal:

- make the human meaning of a capability row more obvious

Possible approach:

- preserve the current `Coverage` machinery for engineering
- but add or standardize an operator-facing status language around sign-off and blockers

This is optional because it touches a bigger document and may have knock-on effects.

## Recommended Implementation Sequence

The least disruptive order is:

1. finalize the operator-only runbook
2. add the short sign-off blocker summary
3. update README so artifact roles are easy to understand
4. only then consider simplifying capability-row semantics

This preserves the working verification system while making the human interface much easier to understand.

## Success Criteria

The reforms are successful when the operator can answer these questions without reading the audit log, matrix, and workplan together:

1. What is already verified?
2. What am I being asked to judge?
3. What is still broken?
4. What do I need to record when I am done?

If those answers fit on one page and are understandable without knowing the testing architecture, the process is simple enough.

## Non-Goals

These reforms do **not** attempt to:

- remove the audit log
- remove the conformance matrix
- remove the capabilities document
- remove live hardware testing
- replace explicit operator sign-off with automation

The point is not to reduce rigor. The point is to reduce operator-facing complexity while keeping the rigor behind the scenes.
