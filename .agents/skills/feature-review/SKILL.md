---
name: feature-review
description: Review recent feature changes with a code-review mindset focused on correctness, regressions, risks, and missing tests.
---

# Feature Review

Use this when the user asks for a review or pre-ship quality pass.

## Workflow

1. Determine the review scope from:
   - uncommitted changes
   - staged changes
   - or branch diff vs `main`
2. Read the relevant workplan context.
3. Review for:
   - correctness
   - regressions
   - missing tests
   - guideline violations from `AGENTS.md`
4. Report findings first, ordered by severity, with file and line references.

This skill reports issues. It does not silently fix them unless the user asks.
