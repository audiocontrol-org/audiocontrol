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
4. Switch your work into that feature worktree and verify:
   - `pwd`
   - `git rev-parse --abbrev-ref HEAD`
   - `tsx tools/verify-feature-context.ts --slug <slug>`
5. Create `docs/1.0/001-IN-PROGRESS/<slug>/` in the feature worktree, not in another worktree such as `main`.
6. Create:
   - `prd.md`
   - `workplan.md`
   - `README.md`
   - `implementation-summary.md`
7. Populate those files from the definition if present; otherwise create minimal templates.
8. Verify the created docs with:
   - `git status`
   - `tsx tools/verify-feature-context.ts --slug <slug> --require-docs`
9. Report the branch, worktree, docs path, and whether the docs were template-only or definition-backed.

## Repair Rule

If setup was accidentally done in the wrong worktree, prefer a git-native transfer of the docs into the feature branch over manual recreation when a clean git change is available.

Do not start implementation as part of setup.
