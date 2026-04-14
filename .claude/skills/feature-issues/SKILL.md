---
name: feature-issues
description: "Create GitHub issues from a completed workplan: parent feature issue, implementation issues, then update workplan with links."
user_invocable: true
---

# Feature Issues

This skill creates GitHub issues from a completed workplan. When invoked:

1. **Identify feature:**
   - Run: `basename $(pwd)` and `git rev-parse --abbrev-ref HEAD`
   - Extract feature slug from worktree name or branch
   - Locate workplan: `docs/1.0/001-IN-PROGRESS/<slug>/workplan.md`
   - Locate PRD: `docs/1.0/001-IN-PROGRESS/<slug>/prd.md`

2. **Read and parse workplan:**
   - Read workplan.md
   - Extract: phases, tasks, acceptance criteria
   - Read prd.md for the problem statement (used in parent issue body)

3. **Determine GitHub link base:**
   - Branch: `feature/<slug>`
   - Format: `https://github.com/audiocontrol-org/audiocontrol/blob/feature/<slug>/path/to/file`
   - PRD link: `https://github.com/audiocontrol-org/audiocontrol/blob/feature/<slug>/docs/1.0/001-IN-PROGRESS/<slug>/prd.md`
   - Workplan link: same pattern with `workplan.md`

4. **Create parent feature issue:**
   - Determine the module prefix from the dominant module being modified (e.g., `[sampler-devices]`, `[s330-editor]`, `[build]`)
   - Check for existing milestone: `gh milestone list`
   - If no appropriate milestone exists, create one or omit (milestone assignment is optional — can be added later)
   ```bash
   gh issue create \
     --title "[module] Feature Name" \
     --body "$(cat <<'EOF'
   ## Overview
   [Problem statement from PRD, first paragraph]

   ## Documentation
   - PRD: [GitHub link to prd.md]
   - Workplan: [GitHub link to workplan.md]

   ## Implementation Phases
   - [ ] Phase 1: [phase title]
   - [ ] Phase 2: [phase title]
   ...
   EOF
   )" \
     --label "enhancement"
   ```
   - If a milestone was identified, add it: `gh issue edit <number> --milestone "<milestone>"`
   - Capture the issue number from output

5. **Create implementation issues:**
   - One issue per phase (or per major task group if phases are large)
   - Title: action-focused verb phrase from phase/task title
   - Body format:
     ```
     Part of #<parent-number>

     ## Acceptance Criteria
     - [ ] [criterion from workplan]
     - [ ] [criterion from workplan]
     ```
   - Label: "enhancement"
   - Capture each issue number

6. **Update workplan:**
   - Add/update the GitHub Tracking section at the top of workplan.md with:
     - Parent issue link
     - Implementation issues table: Phase | Issue # | Description
   - Use Write tool to update the file

7. **Report results:**
   - List all created issues with URLs
   - Confirm workplan was updated
   - Next step: implementation can begin (hand off to feature-orchestrator)
