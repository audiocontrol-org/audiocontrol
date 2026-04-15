---
name: feature-setup
description: "Create feature infrastructure: branch, worktree, docs directory, and initial project documents derived from a feature definition."
---

# Feature Setup

Use this when the user wants to create the project-management scaffolding for a new feature.

## Workflow

1. Determine the slug.
2. Read `/tmp/feature-definition-<slug>.md` if it exists.
3. Create the worktree and branch:
   - `git worktree add ~/work/audiocontrol-work/audiocontrol-<slug> -b feature/<slug>`
4. Create `docs/1.0/001-IN-PROGRESS/<slug>/`.
5. Create:
   - `prd.md`
   - `workplan.md`
   - `README.md`
   - `implementation-summary.md`
6. Populate those files from the definition if present; otherwise create minimal templates.
7. Report the branch, worktree, docs path, and whether the docs were template-only or definition-backed.

Do not start implementation as part of setup.
