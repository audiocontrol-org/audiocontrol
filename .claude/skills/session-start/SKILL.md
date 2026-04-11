---
name: session-start
description: "Bootstrap a Claude Code session by reading the feature workplan, latest journal entry, and open issues. Reports context to the user so they can confirm the session goal."
user_invocable: true
---

# Session Start

Read the following and report a concise summary to the user:

1. **Identify the feature** from the worktree name and branch:
   - Run: `basename $(pwd)` and `git rev-parse --abbrev-ref HEAD`
   - Extract the feature slug

2. **Read the feature workplan**:
   - Read: `docs/1.0/001-IN-PROGRESS/<feature-slug>/README.md`
   - Read: `docs/1.0/001-IN-PROGRESS/<feature-slug>/workplan.md`
   - Note: current phase, completed tasks, next tasks

3. **Read the latest DEVELOPMENT-NOTES.md entry**:
   - Read: `DEVELOPMENT-NOTES.md` (last entry only)
   - Note: what was accomplished, what failed, course corrections

4. **Read device notes if applicable**:
   - If the feature involves SCSI/device work: read `SCSI-NOTES.md` (last 2-3 entries)

5. **Read the session analysis report** (if it exists):
   - Read: `data/sessions/report-all.md` — look for the "LLM Session Analysis" section
   - Note: top correction categories, most common patterns, improvement suggestions
   - These are mistakes from previous sessions — actively avoid repeating them

6. **Check open GitHub issues**:
   - Run: `gh issue list --label <relevant-label> --state open`

7. **Report to the user**:
   - Feature name and current phase
   - Last session's key accomplishments and failures
   - Top correction patterns to watch for (from analysis report)
   - Top unresolved issues
   - Proposed goal for this session

Do NOT start coding until the user confirms the session goal.
