---
name: feature-ship
description: "Prepare feature for merge: verify acceptance criteria, run tests, create PR with summary and test plan."
user_invocable: true
---

# Feature Ship

This skill prepares a completed feature for merge by verifying completeness, running tests, and creating a PR. When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` to get worktree name, extract feature slug
   - Run: `git rev-parse --abbrev-ref HEAD` to confirm branch

2. **Verify workplan completeness:**
   - Read: `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
   - Check all acceptance criteria are marked complete (all checkboxes checked)
   - If any unchecked criteria remain, report them and ask user whether to proceed anyway or address them first

3. **Run tests:**
   - Determine affected modules from changed files: `git diff --name-only main..HEAD`
   - Run tests for each affected module: `pnpm --filter <module> test`
   - If tests fail, report failures and stop -- do not create PR with failing tests

4. **Run code review:**
   - Invoke the `/feature-review` skill logic (or delegate to code-reviewer agent directly)
   - If critical issues found, report them and ask user whether to proceed or fix first

5. **Ensure branch is pushed:**
   - Check if remote tracking branch exists: `git rev-parse --abbrev-ref @{upstream}`
   - If not, push: `git push -u origin feature/<slug>`
   - If exists, ensure local is ahead or in sync: `git status`
   - Push any unpushed commits: `git push`

6. **Create pull request:**
   - Generate PR title from feature name (short, under 70 characters)
   - Generate PR body from workplan:
     ```
     ## Summary
     [Problem statement from workplan/PRD, 1-3 bullets of what was done]

     ## Test plan
     - [ ] [acceptance criteria from workplan, reformatted as test checklist]
     ```
   - Create PR:
     ```bash
     gh pr create --title "<title>" --body "<body>"
     ```
   - Capture PR URL from output

7. **Update documentation:**
   - Update README.md status to "PR Open"
   - Note PR URL in README

8. **Report results:**
   - PR URL
   - Tests: all passing / N modules tested
   - Review: clean / N issues noted
   - Next steps: merge PR, then run `/feature-complete` and `/feature-teardown`
