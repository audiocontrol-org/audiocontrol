---
name: session-start
description: Bootstrap a Codex session by reading the active feature workplan, latest journal notes, and relevant issue context before implementation starts.
---

# Session Start

Use this when the user wants the current feature state summarized before work begins.

## Workflow

1. Identify the feature from `pwd` and `git rev-parse --abbrev-ref HEAD`.
2. Read:
   - `docs/1.0/001-IN-PROGRESS/<feature>/README.md`
   - `docs/1.0/001-IN-PROGRESS/<feature>/workplan.md`
   - latest relevant entry in `DEVELOPMENT-NOTES.md`
3. If the task is hardware-facing, read the latest relevant entries in `SCSI-NOTES.md` or the matching device notes file.
4. If `data/sessions/report-all.md` exists, extract the top correction patterns that should influence this session.
5. If issue state matters, inspect the relevant GitHub issues.
   If the active coordination thread is issue `#315`, use `issue-315-read` to self-poll
   the mailbox issue before proposing the session goal.
6. Report:
   - current phase
   - completed vs pending work
   - last session outcome
   - likely risks
   - proposed goal for this session

Do not start coding until the user confirms or redirects.
