---
name: feature-pickup
description: Rehydrate context for an in-progress feature by reading the workplan, notes, and issue state, then propose the next implementation move.
---

# Feature Pickup

Use this when a feature worktree already exists and the user wants to resume.

## Workflow

1. Identify the feature from the current worktree and branch.
2. Read `workplan.md`, `README.md`, and the latest relevant `DEVELOPMENT-NOTES.md` entry.
3. Check issue state if the workplan references GitHub issues.
4. Report:
   - progress percentage
   - current phase
   - next incomplete task
   - open issues
   - likely next implementation move

Do not begin coding until the user confirms or redirects.
