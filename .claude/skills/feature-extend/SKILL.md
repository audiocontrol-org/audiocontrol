---
name: feature-extend
description: "Extend a feature's scope mid-implementation: add phases to the PRD, workplan, and create new GitHub issues. Reuses the existing worktree and branch."
user_invocable: true
---

# Feature Extend

Broaden the scope of an in-progress feature. Adds new phases and tasks to existing docs and issue infrastructure without creating a new worktree or branch.

**Use this when:** you're implementing a feature and realize it needs more work than originally scoped — new phases, new tasks, new acceptance criteria.

**Do NOT use this for:** starting a new feature (use `/feature-define` + `/feature-setup`), or for breaking a feature into smaller features (create a new feature instead).

## Process

### Step 1: Identify Feature and Current State

1. Identify the feature from the worktree/branch:
   ```bash
   basename $(pwd)
   git rev-parse --abbrev-ref HEAD
   ```
2. Read the existing docs:
   - `docs/1.0/001-IN-PROGRESS/<slug>/prd.md`
   - `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
   - `docs/1.0/001-IN-PROGRESS/<slug>/README.md`
3. Check existing GitHub issues:
   ```bash
   gh issue list --state open
   ```
4. Report to the user:
   - Feature name and current phase
   - Completed phases
   - In-progress and remaining phases
   - Total existing issues

### Step 2: Interview — What's Being Added

Ask the user:
- **What new capability do you need?** — What's missing from the current scope?
- **Why now?** — Did something come up during implementation, or was this always needed?
- **Does this change the existing phases?** — Or is it purely additive?

If the user has already described what they want (in the prompt that invoked this skill), extract answers from their description instead of re-asking.

### Step 3: Propose New Phases

Based on the interview:
- Determine the next phase number (after the last existing phase)
- Propose new phases with:
  - Phase title
  - Tasks (each starting with a verb)
  - Acceptance criteria
  - Files affected
- Present to the user for confirmation

### Step 4: Update PRD

Append to the existing PRD's scope section:
- Add new items to "In Scope"
- Update "Success Criteria" if needed
- Do NOT rewrite existing content — only append

Use the Edit tool to modify the file.

### Step 5: Update Workplan

Append new phase sections to the workplan, following the existing format exactly:
- Match the heading level, task numbering, and acceptance criteria style
- Place new phases after the last existing phase, before the Dependency Graph
- Update the Dependency Graph if the new phases have dependencies

Use the Edit tool to modify the file.

### Step 6: Create GitHub Issues

For each new phase, create an implementation issue:
1. Find the parent feature issue number from the workplan's GitHub Tracking section
2. Create issues:
   ```bash
   gh issue create \
     --title "<phase title>" \
     --body "$(cat <<'EOF'
   Part of #<parent-number>

   ## Acceptance Criteria
   - [ ] [criterion from workplan]
   EOF
   )" \
     --label "enhancement"
   ```
3. Update the workplan's GitHub Tracking table with the new issue numbers

### Step 7: Report

Tell the user:
- Summary of what was added (new phases, tasks, issues)
- Updated phase count and next phase to implement
- Any changes to the dependency graph
