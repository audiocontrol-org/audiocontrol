---
name: session-end
description: Wrap up a Codex work session by updating feature docs, recording development notes, and closing the loop on issue and hardware notes where needed.
---

# Session End

Use this when the user wants a clean end-of-session wrap-up.

## Workflow

1. Update the active feature `README.md` status table.
2. Update `workplan.md`:
   - check off completed items
   - add new tasks discovered
   - record phase changes if any
3. Add a `DEVELOPMENT-NOTES.md` entry with:
   - goal
   - what was accomplished
   - what failed
   - course corrections
   - approximate quantitative notes if useful
4. Update hardware notes if protocol or device behavior was investigated.
5. Update or close related GitHub issues if the change materially advanced them.
   If the active coordination thread is issue `#315`, self-poll it first; then use
   `issue-315-write` to update `Current State of Play` whenever the live blocker,
   best explanation, or tactical focus materially changed.
6. Commit the documentation updates with the code changes they describe.
