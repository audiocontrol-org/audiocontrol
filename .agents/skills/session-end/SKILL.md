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
6. If requested, run the session-analysis tooling and include the key metrics in the notes.
7. Commit the documentation updates with the code changes they describe.
