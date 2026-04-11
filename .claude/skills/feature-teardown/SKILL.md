---
name: feature-teardown
description: "Remove local feature infrastructure: worktree and branch. Infrastructure-only, no opinion on feature status."
user_invocable: true
---

# Feature Teardown

This skill removes local feature infrastructure (worktree and branch). It is infrastructure-only — it does not imply the feature is complete. You might teardown because:
- The feature was merged
- You are freeing disk space
- You are abandoning an approach
- You want to re-create the worktree fresh

When invoked:

1. **Identify feature:**
   - If invoked with an argument, use that as the slug
   - Otherwise, infer from current directory: `basename $(pwd)` then extract slug from `audiocontrol-<slug>`
   - If on `main` or cannot determine slug, ask the user

2. **Verify worktree exists:**
   ```bash
   git worktree list
   ```
   - Check that `~/work/audiocontrol-work/audiocontrol-<slug>` appears in the list
   - If not found, report "worktree not found" and stop

3. **Check for uncommitted changes:**
   ```bash
   git -C ~/work/audiocontrol-work/audiocontrol-<slug> status --porcelain
   ```
   - If there are uncommitted changes, warn the user and ask for confirmation before proceeding
   - Do NOT proceed without explicit user confirmation if changes exist

4. **Remove worktree:**
   ```bash
   git worktree remove ~/work/audiocontrol-work/audiocontrol-<slug>
   ```
   - If removal fails (e.g., directory is locked), report the error

5. **Delete local branch:**
   ```bash
   git branch -d feature/<slug>
   ```
   - Use `-d` (not `-D`) so git refuses if the branch has unmerged changes
   - If deletion fails because branch is not fully merged, report this and ask user if they want to force-delete with `-D`

6. **Prune stale references:**
   ```bash
   git worktree prune
   ```

7. **Report results:**
   - Worktree removed: `~/work/audiocontrol-work/audiocontrol-<slug>`
   - Branch deleted: `feature/<slug>` (or "retained — not fully merged")
   - Stale references pruned
   - Note: this does NOT close issues or move docs. Run `/feature-complete` first if the feature is done.
