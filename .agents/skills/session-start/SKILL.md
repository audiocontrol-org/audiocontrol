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
   - the latest relevant entry in `DEVELOPMENT-NOTES.md`
3. If the task is hardware-facing, read the latest relevant entries in `SCSI-NOTES.md` or the matching device notes file.
4. If `data/sessions/report-all.md` exists, extract the top correction patterns that should influence this session.
5. If issue state matters, inspect the relevant GitHub issues.
6. If the feature involves UI work:
   - read `TESTING.md`
   - read `TESTING-UI.md`
   - check whether the feature already has a harness page
   - check whether UI specs already exist for the interactions being changed
7. Report:
   - feature name and current phase
   - completed vs pending work
   - last session outcome
   - top correction patterns to avoid repeating
   - top unresolved issues
   - likely risks
   - proposed goal for this session

Do not start coding until the user confirms or redirects.
