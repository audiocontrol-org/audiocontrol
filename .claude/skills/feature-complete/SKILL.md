---
name: feature-complete
description: "Mark a feature as complete: move docs to 003-COMPLETE, update ROADMAP.md, close GitHub issues. Runs on the feature branch BEFORE merge so bookkeeping is part of the PR."
user_invocable: true
---

# Feature Complete

This skill marks a feature as complete by updating documentation **on the feature branch** before merge. All bookkeeping becomes part of the PR — no direct commits to main.

When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` to get worktree name, extract feature slug
   - Run: `git rev-parse --abbrev-ref HEAD` to confirm on feature branch
   - If on `main`, error — this skill runs on the feature branch before merge

2. **Verify PR exists:**
   - Run: `gh pr list --head feature/<slug> --state open`
   - If no open PR, warn the user — they may need to create one first

3. **Move docs to complete (on feature branch):**
   ```bash
   mkdir -p docs/1.0/003-COMPLETE
   git mv docs/1.0/001-IN-PROGRESS/<slug> docs/1.0/003-COMPLETE/<slug>
   ```

4. **Update feature README.md:**
   - Read `docs/1.0/003-COMPLETE/<slug>/README.md`
   - Change all phase statuses to "Complete"
   - Add PR number and link to the Links section

5. **Update ROADMAP.md:**
   - Read `docs/1.0/ROADMAP.md`
   - Move the feature entry from its current section to the "003-COMPLETE" section in the Feature Index
   - Check "Serial Dependencies" — if any features were blocked by this one, move them to "Ready to Work (Parallel)"
   - If no ROADMAP entry exists for this feature, skip this step

6. **Commit and push:**
   ```bash
   git add -A
   git commit -m "docs: complete <slug> — move to 003-COMPLETE"
   git push
   ```

7. **Close GitHub issues:**
   - Read workplan's GitHub Tracking section for issue numbers
   - Close each open issue with a comment referencing the PR:
     ```bash
     gh issue close <number> --comment "Completed in PR #<pr-number>"
     ```
   - If a milestone is referenced, check if all its issues are closed and close the milestone if so

8. **Report results:**
   - Docs moved to: `docs/1.0/003-COMPLETE/<slug>/`
   - ROADMAP.md updated (or skipped)
   - Issues closed: list each with number
   - Newly unblocked features (if any)
   - Next step: merge the PR, then run `/feature-teardown` to remove local worktree infrastructure
