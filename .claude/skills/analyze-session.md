---
name: analyze-session
description: "Run quantitative analysis on Claude Code session logs. Reports agent session counts, autonomous hours, and arc distributions."
user_invocable: true
---

# Analyze Session

Run the session log analyzer and report results:

1. **Check if analyzer is set up**:
   ```bash
   ls tools/session-analyzer/.venv/bin/python 2>/dev/null || echo "Run: cd tools/session-analyzer && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
   ```

2. **Run agent analysis** (no API key needed):
   ```bash
   cd tools/session-analyzer && source .venv/bin/activate
   python arc_analyzer.py agents
   ```

3. **Report key metrics**:
   - Total sessions
   - Total autonomous agent hours
   - Sessions by project

4. **If Gemini API key is available**, run arc analysis:
   ```bash
   python arc_analyzer.py extract
   python arc_analyzer.py stats
   ```

5. **For cross-machine analysis** (if orion-m1 is reachable):
   ```bash
   tools/analyze-session.sh --remote
   ```

6. **Summarize findings** for the user, noting trends vs any previous baseline in `docs/1.0/001-IN-PROGRESS/continuous-improvement/baseline-metrics.md`
