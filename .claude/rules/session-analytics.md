---
paths:
  - "tools/extract-sessions*"
  - "tools/analyze-sessions*"
  - "tools/analyze-session-llm*"
  - "tools/extract-session-content*"
  - "tools/bakeoff-analysis*"
  - "data/sessions/**"
---

# Session Analytics

Session logs: `~/.claude/projects/<project-dir>/<session-id>.jsonl`

## Per-Session (in DEVELOPMENT-NOTES.md entry)
- Total user messages / assistant messages (approximate)
- Number of commits
- User corrections count
- Tool call count (approximate work volume)

## Extract session data
```bash
tsx tools/extract-sessions.ts
```
Output: `data/sessions/sessions.jsonl` (one JSON line per session), `data/sessions/summary.csv`

Run on the local machine only — each machine extracts its own sessions. Data merges via git. The `--data-dir` and `--machine` flags exist for ad-hoc cross-machine extraction but are not part of the standard workflow.

## Analyze session data
```bash
tsx tools/analyze-sessions.ts
tsx tools/analyze-sessions.ts --since 2026-04-01
tsx tools/analyze-sessions.ts --json
```

| Metric | What It Tells Us | Target |
|--------|-----------------|--------|
| Corrections per session | How often user redirects agent | ↓ Decreasing |
| Same-category corrections | Unfixed process gaps | ↓ Decreasing |
| Time to first commit | Bootstrap efficiency | ↓ Decreasing |
| Arc distribution | Where time goes | More feature, less debug |
