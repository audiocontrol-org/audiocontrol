---
name: session-start
description: Bootstrap a Codex session by reading the active feature workplan, latest journal notes, and relevant issue context before implementation starts.
---

# Session Start

Use this when the user wants the current feature state summarized before work begins.

## Workflow

1. Identify the feature from `pwd` and `git rev-parse --abbrev-ref HEAD`.
2. Verify the active worktree context with:
   - `pwd`
   - `git rev-parse --abbrev-ref HEAD`
   - `tsx tools/verify-feature-context.ts --slug <feature> --require-docs`
3. Read:
   - `docs/1.0/001-IN-PROGRESS/<feature>/README.md`
   - `docs/1.0/001-IN-PROGRESS/<feature>/workplan.md`
   - latest relevant entry in `DEVELOPMENT-NOTES.md`
4. If the task is hardware-facing, read the latest relevant entries in `SCSI-NOTES.md` or the matching device notes file.
5. If `data/sessions/report-all.md` exists, extract the top correction patterns that should influence this session.
6. If issue state matters, inspect the relevant GitHub issues.
7. Report:
   - current phase
   - completed vs pending work
   - last session outcome
   - likely risks
   - proposed goal for this session

If the needed docs exist only in another worktree, stop and repair that with a git-native transfer when possible before proceeding.

Do not start coding until the user confirms or redirects.
