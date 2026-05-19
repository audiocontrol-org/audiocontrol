# Auditor–Implementer Protocol

## Purpose

This document defines the repeatable project-wide protocol between the auditing/testing side of the project and the implementation/remediation side.

It exists to keep three things separate and explicit:

- who discovers and reports a problem
- who decides how that problem is tracked
- who fixes it and who verifies the fix

This file is the canonical top-level protocol. Feature-local audit logs may apply it and preserve worked examples, but they are not the policy source.

## Roles

### Auditor

Owns:

- integration-level verification
- live-hardware verification
- filing findings into the audit log
- proposing the initial disposition of a finding
- re-verifying fixes after they land

Does not own:

- filing GitHub issues directly under this protocol
- editing implementer ACK prose
- remediating the product code as part of the audit role

### Implementer

Owns:

- independently verifying each finding against current HEAD
- deciding issue mapping and filing GitHub issues
- scoping accepted work into the workplan
- remediating the underlying defect
- adding durability tests at the implementer-owned UI tiers
- updating finding status after a fix lands

Does not own:

- editing the auditor’s evidence or prose
- silently absorbing findings without acknowledgement

### Operator

Owns:

- accepting or rejecting scope additions when needed
- final hardware sign-off where the closure gate requires human judgment

## Test-Tier Ownership

| Tier | Location | Owned by |
|---|---|---|
| Wiring / seam | `test/wiring/` | Auditor |
| UI contract | `test/ui/contract/` | Implementer |
| UI in-context | `test/ui/in-context/` | Implementer |
| Live-hardware e2e | `test/e2e/` | Auditor |
| Rendering smoke | `test/rendering/` | Either |
| Hardware sign-off | capability inventory `Sign-off` | Operator |

## Core Round Trip

1. Auditor publishes a finding.
2. Implementer independently verifies it.
3. Implementer maps it to an issue or confirms an existing issue.
4. Implementer scopes it into the workplan.
5. Implementer lands a fix and flips the finding to a fixed state.
6. Auditor reruns the relevant verification and either verifies the fix or rejects it.

The key rule is that the same party does not both declare a finding fixed and verify that fix as the final authority.

## Finding Format

Every new finding should carry, in order:

- `Finding-ID:`
- `Status:`
- `Severity:`
- `Surface:`
- `Disposition (proposed):`

Below those fields, the auditor records:

- observation
- evidence
- repro if applicable
- expected vs actual
- optional fix guidance

## Status Vocabulary

| Value | Meaning | Set by |
|---|---|---|
| `open` | Finding reported; waiting on implementer acknowledgement | Auditor |
| `acknowledged-#N` | Implementer verified and mapped/filed issue `#N` | Implementer |
| `fixed-<sha>` | Fix landed; waiting on auditor re-run | Implementer |
| `verified-<date>` | Auditor confirmed the fix | Auditor |
| `rejected-<date>` | Auditor rejected the attempted fix | Auditor |
| `superseded-by-<finding-id>` | Later finding is now canonical | Either |
| `withdrawn-<date>` | Finding invalidated without a fix | Either |
| `informational` | Observation only; no remediation required | Auditor |

## Work Queues

These grep patterns are the canonical queues:

- all live findings: `grep -nE "^Status:" <audit-log>`
- implementer hand-off queue: `grep -nE "^Status: open" <audit-log>`
- auditor re-verification queue: `grep -nE "^Status: fixed-" <audit-log>`

## Required Implementer Response

When a new finding appears, the implementer must respond within one working session by doing all of the following:

1. independently verify the finding against current HEAD
2. append an ACK section near the finding or appendix
3. file or map the GitHub issue
4. scope the remediation into the workplan
5. flip the `Status:` line to the acknowledged form

It is not acceptable to leave a valid finding only in prose or only in GitHub.

## Workplan Mapping Rules

After acknowledgement, the implementer must map the finding to one of:

- a new cross-cutting workplan task
- an existing natural-fit phase or task

The `Status:` line should include that pointer when practical, for example:

- `acknowledged-#425; workplan §Phase-11-Task-1`
- `acknowledged-#423; workplan §9R-C`

## Commit Rules

When landing a remediation:

- the commit message should cite both the GitHub issue and the finding ID
- the finding’s `Status:` line should move to `fixed-<sha>`

Example shape:

- `Closes #426. Refs AUDIT-20260514-FU3-01`

## Authority Boundaries

- The auditor proposes dispositions; the implementer decides issue filing and workplan landing.
- The implementer may update finding status and add ACK prose, but does not edit the auditor’s evidence.
- The auditor may verify or reject a fix, but does not rewrite implementer remediation history.
- The operator is the final authority only for operator-owned hardware sign-off gates.

## Where Things Live

### Audit log

- durable record of findings, acknowledgements, status changes, and verification history

### GitHub issue

- per-fix work tracker

### Workplan

- sequencing, ownership, and closure criteria

### Capability inventory

- product contract plus operator sign-off state

## Stable Invariants

1. Findings do not disappear from the audit log; they only change status.
2. The audit log is the source of truth for current finding state.
3. GitHub issues track remediation work, not the full audit conversation.
4. Implementers do not self-verify final closure of auditor findings.
5. Feature-local examples may extend this protocol, but they should not contradict it.

## Scope

This document defines the team-to-team handoff and closure protocol around findings discovered during audit and verification work. It does not prescribe a separate UI-verification standard; a prior attempt at that lived in `UI-CONTRACT-AND-VERIFICATION-STANDARD.md` and was retired after it produced more process overhead than verification value.

## Worked Example

The Roland S-550 feature audit log under `docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md` is the first full worked example of this protocol in practice.
