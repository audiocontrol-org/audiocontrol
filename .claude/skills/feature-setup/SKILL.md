---
name: feature-setup
description: "Create feature infrastructure: git branch, worktree, docs directory, and delegate documentation creation to documentation-engineer agent."
user_invocable: true
---

# Feature Setup

This skill automates creating the infrastructure for a new feature. When invoked:

1. **Determine feature slug and read definition:**
   - If invoked with an argument, use that as the slug
   - Otherwise, ask the user for the feature slug
   - Validate: 2-4 words, lowercase, hyphen-separated
   - Check for `/tmp/feature-definition-<slug>.md` — if it exists, read it and use its contents to populate the docs with real content (not just templates)
   - If no definition file exists, create blank templates instead and tell the user to run `/feature-define <slug>` first for better results

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
     - `docs/1.0/001-IN-PROGRESS/<slug>/prd.md` — PRD from definition file's Problem Statement, Acceptance Criteria, Out of Scope, and Open Questions. If no definition file, use template.
     - `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md` — workplan from definition file's Implementation Phases, Technical Approach, and Dependencies. Include GitHub Tracking section (to be filled by `/feature-issues`). If no definition file, use template.
     - `docs/1.0/001-IN-PROGRESS/<slug>/README.md` — status table with phases from definition file
     - `docs/1.0/001-IN-PROGRESS/<slug>/implementation-summary.md` — draft template for post-completion report
   - Instruct the agent to use the Write tool for each file
   - Provide the definition file contents AND the templates from PROJECT-MANAGEMENT.md as reference

5. **Report results:**
   - Branch name: `feature/<slug>`
   - Worktree path: `~/work/audiocontrol-work/audiocontrol-<slug>`
   - Docs path: `docs/1.0/001-IN-PROGRESS/<slug>/`
   - Files created: list each
   - Whether docs were populated from definition file or are blank templates
   - Next step: review the docs, then run `/feature-issues`
