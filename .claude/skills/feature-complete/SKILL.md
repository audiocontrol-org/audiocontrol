---
name: feature-complete
description: "Mark a feature as complete: move docs to 003-COMPLETE, update ROADMAP.md, close GitHub issues and milestone."
user_invocable: true
---

# Feature Complete

This skill marks a feature as complete by updating documentation and closing tracking items. When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` and `git rev-parse --abbrev-ref HEAD`
   - Extract feature slug
   - Confirm the feature docs exist at `docs/1.0/001-IN-PROGRESS/<slug>/`
   - If not found, report error and stop

2. **Move docs to complete:**
   ```bash
   mkdir -p docs/1.0/003-COMPLETE
   git mv docs/1.0/001-IN-PROGRESS/<slug> docs/1.0/003-COMPLETE/<slug>
   ```

3. **Update ROADMAP.md:**
   - Read `docs/1.0/ROADMAP.md`
   - Move the feature entry from its current section (likely "Ready to Work" or "In Progress") to the "003-COMPLETE" section in the Feature Index
   - Check "Serial Dependencies" — if any features were blocked by this one, move them to "Ready to Work (Parallel)"
   - Use Write tool to save changes

4. **Update feature README.md:**
   - Change status to "Complete" in the status field
   - Update file path references from `001-IN-PROGRESS` to `003-COMPLETE` if any

5. **Close GitHub issues:**
   - Read workplan's GitHub Tracking section for issue numbers
   - Close each open issue:
     ```bash
     gh issue close <number>
     ```
   - If a milestone is referenced, check if all its issues are closed and close the milestone if so

6. **Report results:**
   - Docs moved to: `docs/1.0/003-COMPLETE/<slug>/`
   - ROADMAP.md updated
   - Issues closed: list each with number
   - Newly unblocked features (if any)
   - Next step: run `/feature-teardown` to remove local worktree infrastructure
