---
name: feature-help
description: "Show the feature lifecycle workflow, explain each skill's role, and report current state of any active or in-progress features."
user_invocable: true
---

# Feature Help

Show the user the feature lifecycle and current state. Do NOT start any work — this is informational only.

## 1. Show the Feature Lifecycle

Display this workflow:

```
/feature-define    Interview to capture problem, scope, approach, tasks
        │          Output: /tmp/feature-definition-<slug>.md
        ▼
/feature-setup     Create branch, worktree, and docs from definition
        │          Output: feature/<slug> branch, worktree, populated docs
        ▼
/feature-issues    Create GitHub issues from workplan
        │          Output: parent + implementation issues, workplan updated with links
        ▼
/feature-implement Execute workplan tasks via sub-agents
        │
        ▼
/feature-review    Code review of recent changes
        │
        ▼
/feature-ship      Verify acceptance criteria, run tests, create PR
        │
        ▼
/feature-complete  Move docs to 003-COMPLETE, update ROADMAP, close issues
        │
        ▼
/feature-teardown  Remove worktree and branch
```

**Supporting skills:**
- `/session-start` — Bootstrap a session: read workplan, journal, issues, confirm goal
- `/session-end` — Write journal entry, update docs, commit
- `/feature-pickup` — Resume a feature in a new session (reads workplan + issue status)

## 2. Show Current State

Detect and report the current state:

### Active worktree check
- Run: `basename $(pwd)` and `git rev-parse --abbrev-ref HEAD`
- If on a `feature/*` branch, extract the slug and report which feature is active

### In-progress features
- Run: `ls docs/1.0/001-IN-PROGRESS/` to list all in-progress feature slugs
- For each, check:
  - Does a worktree exist? `git worktree list | grep <slug>`
  - Does a definition file exist? Check `/tmp/feature-definition-<slug>.md`
  - Do GitHub issues exist? Check for a GitHub Tracking section in `workplan.md`

### Pending definition files
- Run: `ls /tmp/feature-definition-*.md 2>/dev/null`
- Report any definition files that haven't been consumed by `/feature-setup` yet (no matching docs directory)

### Report format

```
## Current State

**Active worktree:** <slug> (or "none — on main")

**In-progress features:**

| Feature | Worktree | Definition | Docs | Issues | Next Step |
|---------|----------|------------|------|--------|-----------|
| <slug>  | yes/no   | yes/no     | yes/no | yes/no | /feature-X |

**Pending definitions (not yet set up):**
- /tmp/feature-definition-<slug>.md → run `/feature-setup <slug>`
```

For the "Next Step" column, determine the earliest incomplete step:
- No definition file and no docs → `/feature-define`
- Definition file exists but no docs → `/feature-setup <slug>`
- Docs exist but no GitHub issues in workplan → `/feature-issues`
- Issues exist → `/feature-implement` or `/feature-pickup`
