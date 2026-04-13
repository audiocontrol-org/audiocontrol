---
name: feature-pickup
description: Rehydrate context for an in-progress feature by reading the workplan, notes, and issue state, then propose the next implementation move.
---

# Feature Pickup

Use this when a feature worktree already exists and the user wants to resume.

## Workflow

1. Identify the feature from the current worktree and branch.
2. Verify the current context:
   - `pwd`
   - `git rev-parse --abbrev-ref HEAD`
   - `tsx tools/verify-feature-context.ts --slug <slug> --require-docs`
3. Confirm the feature docs exist in the current feature worktree. If they only exist in another worktree, stop and repair that first.
4. Read `workplan.md`, `README.md`, and the latest relevant `DEVELOPMENT-NOTES.md` entry.
5. Check issue state if the workplan references GitHub issues.
6. Report:
   - progress percentage
   - current phase
   - next incomplete task
   - open issues
   - likely next implementation move

If docs or changes need to be brought in from another worktree, prefer a git-native transfer over manual copying when possible.

Do not begin coding until the user confirms or redirects.
