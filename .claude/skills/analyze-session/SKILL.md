---
name: analyze-session
description: "Full pipeline: extract session data, encrypt content, run LLM analysis, generate report."
user_invocable: true
---

# Analyze Session

Run the full extraction → analysis → report pipeline:

1. **Extract session metrics**:
   ```bash
   tsx tools/extract-sessions.ts
   ```

2. **Extract and encrypt session content**:
   ```bash
   tsx tools/extract-session-content.ts
   ```

3. **Run LLM analysis** (requires ANTHROPIC_API_KEY):
   ```bash
   ANTHROPIC_API_KEY=$(cat ~/.config/audiocontrol/audiocontrol-anthropic-key.txt) tsx tools/analyze-session-llm.ts
   ```
   This is idempotent — only analyzes sessions that don't already have results.
   Rate-limited to 50K tokens/min. Large batches take time.

4. **Generate report**:
   ```bash
   tsx tools/analyze-sessions.ts
   ```
   Report written to `data/sessions/report-all.md`.
   Optional: `tsx tools/analyze-sessions.ts --since YYYY-MM-DD`

5. **Commit results**:
   ```bash
   git add data/sessions/
   ```

6. **Report key findings to the user**:
   - Arc type distribution (feature vs debug vs exploration)
   - Total corrections and top categories
   - Sessions with most corrections
   - Improvement suggestions from LLM analysis
   - Note trends compared to previous reports
