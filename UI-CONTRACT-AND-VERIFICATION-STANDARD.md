# UI Contract and Verification Standard

## Purpose

This document is the project-wide standard for how audiocontrol defines UI behavior, verifies it, records failures, and obtains operator sign-off.

It exists to prevent a specific failure mode: a UI can look complete, and even have passing tests, while the visible controls are still unusable or misleading. The standard separates:

- what the UI is supposed to do
- what engineering evidence exists
- what is broken right now
- what a human operator still needs to judge

This file is the canonical policy. Feature-local docs may apply it, extend it for a specific feature, or serve as worked examples, but they are not the primary source of truth for the process.

## Core Principles

1. The UI contract must describe operator-visible behavior, not implementation details.
2. Engineering evidence and operator judgment are different kinds of truth and must be recorded separately.
3. Failures belong in a failure log, not buried in feature notes or test output.
4. Operator-facing review documents must be short, decision-shaped, and understandable without test-architecture knowledge.
5. Project-wide process belongs at the repository top level, not inside feature directories or agent-specific docs.

## Standard Artifact Roles

Every UI-heavy feature should use the same artifact roles.

### 1. Capability Inventory

Purpose:

- the product contract for what the UI must let the operator do

Requirements:

- each row describes one affordance in operator language
- the affordance text is verb-led and value-named
- implementation nouns such as slider, checkbox, or dropdown are secondary

State model:

- `Status` says whether the affordance exists in the UI
- `Sign-off` says whether an operator has signed it off on hardware
- `Coverage` says what engineering evidence exists

Interpretation:

- `Status` is product implementation state
- `Sign-off` is operator decision state
- `Coverage` is engineering-only evidence state

### 2. Audit Log

Purpose:

- the source of truth for failures, evidence, acknowledgements, and verification history

Requirements:

- log only broken things or their verification history
- use stable finding IDs
- keep historical detail here, not in the operator checklist

Interpretation:

- if something is not broken, it should not need an audit-log entry

### 3. Conformance Matrix

Purpose:

- engineering view of test execution and coverage state for live or specialized suites

Requirements:

- track pass, fail, blocked, and unrun clearly
- map tests to surfaces or capabilities

Interpretation:

- this is an engineering coordination artifact, not the primary operator document

### 4. Operator Summary

Purpose:

- shortest human-facing explanation of what is already verified, what remains open, and whether sign-off is currently grantable

Requirements:

- one page
- no test-tier jargon as the main language
- should answer:
  - what is already verified?
  - what is still open?
  - what do I need to decide?
  - can sign-off be granted now?

### 5. Operator Runbook

Purpose:

- manual checklist for the remaining operator-only review steps

Requirements:

- checklist-shaped, not narrative
- no auditor-owned rerun commands in the main flow
- each step should read like:
  - `Behavior to judge`
  - `Where to look`
  - `Known evidence`
  - `Your decision`

### 6. Workplan

Purpose:

- ownership, sequencing, and closure criteria

Requirements:

- distinguish engineering execution from operator sign-off
- say what is manual-only
- never force the operator to infer process from issue chatter

## Standard Lifecycle

Every UI feature should follow this lifecycle:

1. Define the affordances in a capability inventory.
2. Implement the UI.
3. Add engineering evidence.
4. Log any broken behavior in the audit log.
5. Publish an operator summary.
6. Publish a checklist-style operator runbook if manual review is still required.
7. Obtain operator sign-off or record explicit blocking findings.
8. Record the final sign-off state back into the capability inventory.

## Evidence Model

Engineering evidence can be layered, but the operator should not need to learn the layering model to do their job.

Engineering evidence may include:

- seam or wiring tests
- primitive contract tests
- in-context page tests
- live-device Playwright tests
- targeted design or screenshot checks

Operator sign-off is still required when the question is inherently about live behavior, usability, or trust in the visible affordance.

## Operator vs Engineering Responsibilities

### Engineering owns

- test infrastructure
- coverage generation
- live-suite execution
- audit logging
- reproductions and evidence capture
- implementation fixes

### Operator owns

- final hardware judgment on the visible UI
- sign-off decisions
- blocked vs granted decision for requested scope

## Audience Guide

Use this table when deciding which document to open first.

| Audience | Start Here | Why |
|---|---|---|
| Operator | operator summary | fastest current-state view |
| Operator | operator runbook | checklist for manual review |
| Implementer | capability inventory | product contract |
| Implementer | audit log | current failures to fix |
| Auditor | conformance matrix | live-suite execution state |
| Auditor | audit log | evidence history and findings |
| Planner / reviewer | workplan | ownership and closure gates |

## Required Language Rules

When writing operator-facing UI verification docs:

- prefer decision-shaped language over test-architecture language
- do not make the operator interpret engineering counts or suite topology
- do not mix historical narrative into the main checklist
- do not use a feature-local doc as the canonical statement of project-wide policy

When writing engineering-facing UI verification docs:

- keep coverage state separate from operator sign-off state
- keep current blockers separate from historical appendices when possible
- use stable IDs for findings and capabilities

## Relationship to Feature Docs

Feature docs may contain:

- feature-specific capability inventories
- feature-specific audit logs
- feature-specific runbooks
- feature-specific live conformance matrices
- feature-specific rationale or reform proposals

But they should be treated as applications of this standard, not as the project standard itself.

## Worked Example

The Roland S-550 redesign verification reform under `docs/1.0/001-IN-PROGRESS/s550-support/` is the first full worked example of this standard.

That feature's local docs explain:

- why the reform was needed
- what artifacts were created
- how the simplified operator flow was derived

Those docs are useful reference material, but this file is the canonical project-wide standard.
