---
name: feature-extend
description: Extend a feature's scope mid-implementation by adding new phases to the existing docs and issue plan without creating a new branch or worktree.
---

# Feature Extend

Use this when an in-progress feature needs additional scope that should stay on the same feature branch and worktree.

Do not use this to start a new feature or to split work into a separate feature.

## Workflow

1. Identify the active feature from `pwd` and `git rev-parse --abbrev-ref HEAD`.
2. Read:
   - `docs/1.0/001-IN-PROGRESS/<feature>/prd.md`
   - `docs/1.0/001-IN-PROGRESS/<feature>/workplan.md`
   - `docs/1.0/001-IN-PROGRESS/<feature>/README.md`
3. Check current GitHub issue state if the feature already tracks issues.
4. Summarize the current phase layout, completed phases, remaining phases, and issue coverage.
5. Capture the added scope:
   - what new capability is needed
   - why the existing scope is insufficient
   - whether the change modifies an existing phase or adds a new one
6. Propose the added phases or tasks before editing docs.
7. After confirmation, update the existing docs:
   - append to `prd.md` rather than rewriting earlier scope
   - append new phases or tasks to `workplan.md` using the existing format
   - update `README.md` if the phase table or summary needs to reflect the broader scope
8. If GitHub tracking exists, create or plan the additional implementation issues and backfill the workplan links.
9. Report the new phase count, changed scope, and next implementation step.

Do not create a new worktree or branch as part of feature extension.
