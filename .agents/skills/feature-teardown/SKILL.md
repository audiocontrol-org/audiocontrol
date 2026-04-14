---
name: feature-teardown
description: Remove local feature infrastructure such as worktree and branch without making assumptions about feature status.
---

# Feature Teardown

Use this when the user wants local cleanup only.

## Workflow

1. Identify the feature slug.
2. Verify the worktree exists.
3. Check for uncommitted changes.
4. If the worktree is clean, remove it.
5. Delete the local branch with safe deletion first.
6. Prune stale worktree references.

If uncommitted changes exist, stop and ask before removing anything.
