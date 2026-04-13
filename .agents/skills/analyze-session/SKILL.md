---
name: analyze-session
description: Run the session extraction and analysis pipeline, then summarize the resulting trends and improvement signals.
---

# Analyze Session

Use this when the user wants the full session-analysis pipeline run.

## Workflow

1. Extract metrics: `tsx tools/extract-sessions.ts`
2. Extract session content if needed: `tsx tools/extract-session-content.ts`
3. Run the LLM analysis step if credentials and environment are available.
4. Generate the report: `tsx tools/analyze-sessions.ts`
5. Stage the produced `data/sessions/` updates if the user wants them committed.
6. Report:
   - main arc distribution
   - top correction categories
   - sessions with the most corrections
   - useful improvement suggestions
