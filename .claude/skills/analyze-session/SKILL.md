---
name: analyze-session
description: "Extract session metrics and run analysis on Claude Code session logs. Reports sessions by project, corrections, token usage, and trends."
user_invocable: true
---

# Analyze Session

Extract session data and run analysis:

1. **Extract latest session data**:
   ```bash
   tsx tools/extract-sessions.ts
   tsx tools/extract-session-content.ts
   ```

2. **Run analysis**:
   ```bash
   tsx tools/analyze-sessions.ts
   ```
   Optional filters:
   ```bash
   tsx tools/analyze-sessions.ts --since 2026-04-01
   tsx tools/analyze-sessions.ts --json
   ```

3. **Report key metrics to the user**:
   - Total sessions, commits, tool calls
   - Sessions by project and machine
   - Correction rate and top correction signals
   - Sessions with most corrections
   - Token-heaviest and longest sessions

4. **Note trends** compared to previous runs or baselines in DEVELOPMENT-NOTES.md
