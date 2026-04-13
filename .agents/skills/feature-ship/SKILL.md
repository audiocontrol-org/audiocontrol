---
name: feature-ship
description: Prepare a completed feature for merge by validating the workplan, running tests, and opening a pull request with a concise summary and test plan.
---

# Feature Ship

Use this when implementation is done and the user wants the branch prepared for review.

## Workflow

1. Verify all acceptance criteria in `workplan.md`.
2. Run the relevant tests for affected modules.
3. Perform a final review pass.
4. Ensure the branch is pushed.
5. Create a PR with:
   - concise summary
   - test plan based on acceptance criteria
6. Update the feature `README.md` to show PR-open state.
7. Report the PR URL and any residual risks.

Do not create a PR if critical tests are failing unless the user explicitly wants that.
