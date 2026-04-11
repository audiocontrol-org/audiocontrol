---
name: feature-complete
description: "Mark a feature as complete: move docs to 003-COMPLETE on main, update ROADMAP.md, close GitHub issues and milestone."
user_invocable: true
---

# Feature Complete

This skill marks a feature as complete by updating documentation on `main` and closing tracking items. It operates on the main repo clone because the PR is already merged — this is post-merge bookkeeping.

When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` to get worktree name, extract feature slug
   - Determine the main repo path: `~/work/audiocontrol-work/audiocontrol`
   - Confirm the feature's PR is merged (this skill runs AFTER merge)

2. **Pull latest main:**
   ```bash
   git -C ~/work/audiocontrol-work/audiocontrol pull
   ```

3. **Move docs to complete (on main):**
   ```bash
   git -C ~/work/audiocontrol-work/audiocontrol mv docs/1.0/001-IN-PROGRESS/<slug> docs/1.0/003-COMPLETE/<slug>
   ```
   - If `docs/1.0/003-COMPLETE/` doesn't exist, create it first

4. **Update ROADMAP.md (on main):**
   - Read `~/work/audiocontrol-work/audiocontrol/docs/1.0/ROADMAP.md`
   - Move the feature entry from its current section to the "003-COMPLETE" section in the Feature Index
   - Check "Serial Dependencies" — if any features were blocked by this one, move them to "Ready to Work (Parallel)"
   - If no ROADMAP entry exists for this feature, skip this step

5. **Update feature README.md (on main):**
   - Change status to "Complete" in the status field
   - Mark PR as "(merged)"

6. **Commit and push on main:**
   ```bash
   git -C ~/work/audiocontrol-work/audiocontrol add -A
   git -C ~/work/audiocontrol-work/audiocontrol commit -m "docs: complete <slug> — move to 003-COMPLETE"
   git -C ~/work/audiocontrol-work/audiocontrol push
   ```

7. **Close GitHub issues:**
   - Read workplan's GitHub Tracking section for issue numbers
   - Close each open issue:
     ```bash
     gh issue close <number>
     ```
   - If a milestone is referenced, check if all its issues are closed and close the milestone if so

8. **Report results:**
   - Docs moved to: `docs/1.0/003-COMPLETE/<slug>/`
   - ROADMAP.md updated (or skipped)
   - Issues closed: list each with number
   - Newly unblocked features (if any)
   - Next step: run `/feature-teardown` to remove local worktree infrastructure
