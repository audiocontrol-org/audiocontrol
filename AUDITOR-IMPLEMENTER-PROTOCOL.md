# Audit Log Protocol

## Purpose

How findings get recorded, tracked, and closed in this repo. Optimized for the case where one person plays both auditor and implementer roles, and where most bugs are fixed directly rather than routed through a separate verification team.

Earlier versions of this document assumed a four-tier coverage model, a separate auditor team that owned live-hardware verification, and a workplan-mapping step between acknowledgement and remediation. Those layers were retired 2026-05-17 (capability inventory mothballed) and 2026-05-18 (runbook/sign-off layer rolled back). This document reflects what actually works now: an audit log of durable findings, plus GitHub issues for the ones that need parallel tracking.

## What goes in the audit log

A finding is anything worth recording that:

- a code reader would not derive from `git log` alone, and
- might recur, regress, or need to be cited later.

Bugs caught on live hardware. Design decisions that landed and then drifted. Tooling defects whose fix needs to wait. Things that "look fine in the UI test but break on the device." Things you want to be able to grep for in six months.

Throwaway debugging notes do not belong here. Use a journal entry, a commit message, or a code comment.

## Finding format

Every finding carries these fields, in order, directly under its heading:

```
Finding-ID: <stable-id>
Status:     <one of the status values below>
Severity:   blocking | high | medium | low | informational
Surface:    <route, module, file, or "n/a">
```

Below the fields, in prose:

- what was observed
- evidence (logs, commits, test paths, screenshots) with line refs where useful
- repro steps if non-obvious
- expected vs actual
- optional fix guidance

`Finding-ID` is stable forever. Never reused, never renamed, never deleted. Format is free-form but should be greppable — e.g. `AUDIT-YYYYMMDD-NN`, `LIVE-S550-LIB-002`, `S330-PARSER-003`.

## Status vocabulary

| Value | Meaning |
|---|---|
| `open` | Reported; not yet investigated |
| `acknowledged-<ref>` | Investigated and accepted; `<ref>` is a GitHub issue (`#430`) or a one-line plan |
| `fixed-<sha>` | Commit `<sha>` lands the fix |
| `verified-<date>` | Fix confirmed against the surface (live hardware, regression test, or direct inspection) |
| `rejected-<date>` | Fix didn't hold up; reopen as a new finding or amend |
| `superseded-by-<finding-id>` | A later finding is now the canonical record |
| `withdrawn-<date>` | Finding invalidated without a fix (false alarm, environment-only, etc.) |
| `informational` | Observation; no remediation needed |

A finding never disappears from the log. It only changes status.

## Lifecycle

The simplest path is two transitions:

```
open → fixed-<sha> → verified-<date>
```

A finding can also be `acknowledged-<ref>` if remediation is deferred (e.g. needs hardware not currently available, blocked on an upstream change, or the operator explicitly accepts the deferral).

`verified-<date>` does not require a separate person to set. The simpler shape: whoever lands the fix verifies it against the surface that surfaced the finding, then sets `verified-<date>`. If the surface is operator-only (hardware sign-off the agent can't reach), the agent leaves it at `fixed-<sha>` and the operator flips it on confirmation.

The earlier prohibition on self-verification only made sense when there was a separate auditor team. With one operator playing both roles, the rule becomes: **don't claim `verified-<date>` without actually re-exercising the surface that produced the finding.** A commit message claiming the fix is not verification. Re-running the failing test or re-loading the broken page is.

## GitHub issues are optional

File one only when:

- the work spans multiple commits or sessions, or
- it needs scheduling against other work, or
- it's hardware-blocked and needs to be visible to the operator before a hardware session.

Most direct regression fixes do not need an issue. The commit that closes the finding cites the `Finding-ID` and lands. The audit log Status line moves to `fixed-<sha>` and then `verified-<date>`.

When an issue is filed, the Status line carries it: `acknowledged-#430` or `fixed-<sha>` (issue closed via the commit's `Closes #N`).

## Commit shape

When a commit closes a finding:

- commit message references the `Finding-ID` (e.g. `Refs AUDIT-20260518-01` or `Closes #430. Refs LIVE-S550-LIB-002`)
- update the finding's `Status:` line to `fixed-<sha>` in the same commit (or an immediate follow-up)
- once the surface is re-exercised, update to `verified-<date>`

The Status line lives in the audit log, not in the commit, because the log is what's grep'd to find current state.

## Work queues

Canonical greps:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" <audit-log>`
- new things to look at: `grep -nE "^Status: open" <audit-log>`
- needs verification re-run: `grep -nE "^Status: fixed-" <audit-log>`

## Stable invariants

1. Findings never get deleted; only their status changes.
2. The audit log is the source of truth for current finding state — not GitHub, not the workplan, not commit messages.
3. A `Finding-ID` is stable forever and never reused.
4. `verified-<date>` requires actually re-exercising the surface.
5. Feature docs may extend this protocol but should not contradict it.

## Worked example

The Roland S-550 feature audit log at `docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md` is the longest-running worked example. Findings from before 2026-05-17 use older shapes — capability-inventory rows, `workplan §9R-*` pointers, four-tier coverage references — that this revision retires. Existing entries stay as historical record; new entries follow the format above.
