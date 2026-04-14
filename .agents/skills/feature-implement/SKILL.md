---
name: feature-implement
description: "Drive the core implementation loop for a feature: pick the next workplan task, implement it, verify it, and update progress."
---

# Feature Implement

Use this when the user wants the next planned task executed.

## Workflow

1. Identify the feature and read the next incomplete item in `workplan.md`.
2. Read the relevant source files, interfaces, and tests before editing.
3. Implement the smallest change that satisfies the task and acceptance criteria.
4. Run the relevant tests.
5. Update `workplan.md` if the task is now complete.
6. Report what changed, how it was verified, and what remains.

## Codex Delegation Rule

If the user explicitly asks for sub-agents or parallel work, Codex may use:

- `explorer` for narrow read-only research
- `worker` for bounded implementation with an explicit file ownership scope

Otherwise perform the work locally.
