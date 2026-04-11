---
name: feature-setup
description: "Create feature infrastructure: git branch, worktree, docs directory, and delegate documentation creation to documentation-engineer agent."
user_invocable: true
---

# Feature Setup

This skill automates creating the infrastructure for a new feature. When invoked:

1. **Determine feature slug:**
   - If invoked with an argument, use that as the slug
   - Otherwise, ask the user for the feature slug
   - Validate: 2-4 words, lowercase, hyphen-separated

2. **Create branch and worktree:**
   ```bash
   git worktree add ~/work/audiocontrol-work/audiocontrol-<slug> -b feature/<slug>
   ```
   - Run from the main repository directory
   - If worktree already exists, report it and skip

3. **Create docs directory:**
   ```bash
   mkdir -p docs/1.0/001-IN-PROGRESS/<slug>
   ```

4. **Delegate documentation creation:**
   - Launch documentation-engineer agent to create:
     - `docs/1.0/001-IN-PROGRESS/<slug>/prd.md` — PRD template with feature slug pre-filled
     - `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md` — workplan template with GitHub Tracking section
     - `docs/1.0/001-IN-PROGRESS/<slug>/README.md` — status table template
     - `docs/1.0/001-IN-PROGRESS/<slug>/implementation-summary.md` — draft template for post-completion report
   - Instruct the agent to use the Write tool for each file
   - Provide the templates from PROJECT-MANAGEMENT.md as reference

5. **Report results:**
   - Branch name: `feature/<slug>`
   - Worktree path: `~/work/audiocontrol-work/audiocontrol-<slug>`
   - Docs path: `docs/1.0/001-IN-PROGRESS/<slug>/`
   - Files created: list each
   - Next step: fill in the PRD, then create workplan, then run `/feature-issues`
