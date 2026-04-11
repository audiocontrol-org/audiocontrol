---
name: feature-pickup
description: "Bootstrap a feature-orchestrator session: read workplan, check issue status, report current state and next steps."
user_invocable: true
---

# Feature Pickup

This skill bootstraps a feature-orchestrator session by assessing current state. When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` to get worktree name, extract feature slug
   - Run: `git rev-parse --abbrev-ref HEAD` to confirm branch (`feature/<slug>`)
   - If on `main` or cannot determine slug, ask the user

2. **Read workplan:**
   - Read: `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
   - Identify: current phase, completed tasks (checked acceptance criteria), next uncompleted task
   - Count: total tasks, completed tasks, percentage complete

3. **Check GitHub issues:**
   - Run: `gh issue list --state open` and filter for issues referencing this feature
   - Note which implementation issues are still open

4. **Read last session context:**
   - Read: `DEVELOPMENT-NOTES.md` (last entry only)
   - Note: what was accomplished, what failed, course corrections from last session

5. **Read feature README:**
   - Read: `docs/1.0/001-IN-PROGRESS/<slug>/README.md`
   - Note: current status field

6. **Report to user:**
   - Feature: `<slug>` on branch `feature/<slug>`
   - Progress: X/Y tasks complete (Z%)
   - Current phase: [phase name]
   - Next task: [task title and brief acceptance criteria]
   - Open issues: list with numbers
   - Last session: [1-line summary of what happened]
   - Proposed approach: [what to work on next]

7. **Wait for confirmation:**
   - Do NOT start implementation
   - Ask user to confirm the proposed approach or redirect
