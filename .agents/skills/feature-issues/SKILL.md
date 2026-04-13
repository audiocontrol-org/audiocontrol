---
name: feature-issues
description: Create GitHub tracking issues from a completed workplan and backfill the workplan with the resulting issue links.
---

# Feature Issues

Use this when feature docs exist and issue tracking needs to be created.

## Workflow

1. Identify the feature and read:
   - `docs/1.0/001-IN-PROGRESS/<slug>/prd.md`
   - `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
2. Create one parent feature issue.
3. Create child implementation issues per phase or major task group.
4. Update the workplan with a `GitHub Tracking` section containing the created issue links.
5. Report all created issues and the next likely step.

Use GitHub URLs, not local file paths, in issue bodies.
