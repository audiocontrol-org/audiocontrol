# Orchestrator Agents — Product Requirements Document

**Created:** 2026-04-11
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol project has a generic boilerplate orchestrator agent (`.claude/agents/orchestrator.md`) that describes abstract multi-agent coordination patterns (sequential/parallel/hybrid execution, quality gates, artifact handoffs) but knows nothing about the actual orchestrator workflow used in this project.

The real workflow requires two distinct orchestrator roles:

1. **Project Orchestrator** — investigates issues via session transcript forensics, creates a plan, sets up feature infrastructure (branch, worktree, docs directory), creates GitHub issues, and hands off to an implementation team. It operates on `main` and never implements code.

2. **Feature Orchestrator** — picks up where the project-orchestrator leaves off, operates in the feature worktree, reads the workplan and issues, and deploys sub-agents (typescript-pro, ui-engineer, hardware-protocol-engineer, etc.) to implement code. It directs implementation but does not write code directly.

Neither role is currently encoded. The project-orchestrator workflow is performed manually every session. The feature-orchestrator role does not exist at all — implementation is currently ad-hoc, with the user manually directing which agents to use for which tasks.

Additionally, repeatable sub-workflows (feature infrastructure setup, GitHub issue creation from workplans, feature completion, and infrastructure teardown) are not captured as reusable skills. Each session reinvents them.

## User Stories

### Project Orchestration
- As a developer, I want to tell the project-orchestrator "plan the X feature" and have it investigate, create the PRD and workplan, set up the branch/worktree/docs, and create GitHub issues — without me directing each step
- As a developer, I want the project-orchestrator to know that it plans and delegates but never implements code changes, so it does not overstep its role
- As a developer, I want the project-orchestrator session to end with a clearly defined handoff point for the feature-orchestrator

### Investigation
- As a developer, I want the project-orchestrator to investigate problems by reading session transcripts, git history, and codebase patterns, so it can create well-informed plans
- As a developer, I want the project-orchestrator to decrypt and search session transcripts using `age -d -i ~/.config/age/audiocontrol.key` when investigating past session decisions

### Feature Setup
- As a developer, I want a single skill that creates a feature branch, worktree, docs directory, and delegates doc creation to the documentation-engineer agent
- As a developer, I want this skill to follow the exact naming conventions from PROJECT-MANAGEMENT.md without me having to remind it every time

### Issue Creation
- As a developer, I want a skill that reads a completed workplan.md, creates a parent GitHub issue and implementation issues, and updates the workplan with issue links
- As a developer, I want issue descriptions to include GitHub links to the PRD and workplan (not file paths), following the linking conventions in PROJECT-MANAGEMENT.md

### Feature Completion
- As a developer, I want to mark a feature as complete and have all documentation moved, issues closed, and roadmap updated in one step
- As a developer, I want the completion skill to move docs from `001-IN-PROGRESS` to `003-COMPLETE`, update the ROADMAP.md Feature Index, and close the GitHub milestone and issues

### Feature Teardown
- As a developer, I want to tear down a feature's local infrastructure (worktree, branch) without it implying the feature is complete — I might be freeing disk space or abandoning an approach
- As a developer, I want the teardown skill to remove the worktree, delete the local branch, and prune stale references, with a clear report of what was removed

### Feature Implementation
- As a developer, I want to tell the feature-orchestrator "implement phase 2" and have it read the workplan, identify the tasks, delegate to appropriate sub-agents, review the output, and update progress
- As a developer, I want the feature-orchestrator to know which sub-agent to use for which task type, so I do not have to specify agent selection myself
- As a developer, I want the feature-orchestrator to review sub-agent output before accepting it, catching guideline violations before they enter the codebase
- As a developer, I want the feature-orchestrator session to end with code implemented, tests passing, and a PR ready for review

## Success Criteria

- [ ] `.claude/agents/project-orchestrator.md` reflects the actual audiocontrol project-orchestration workflow, not generic boilerplate
- [ ] Project-orchestrator knows the PROJECT-MANAGEMENT.md pipeline: PRD -> workplan -> GitHub issues -> implementation -> implementation-summary
- [ ] Project-orchestrator explicitly does NOT implement code — it plans and delegates
- [ ] `.claude/agents/feature-orchestrator.md` defines the implementation-delegation workflow
- [ ] Feature-orchestrator reads workplan/issues as input and deploys sub-agents to implement
- [ ] Feature-orchestrator explicitly does NOT write code — it delegates to implementation agents
- [ ] `.claude/skills/feature-setup/SKILL.md` automates branch, worktree, docs directory, and doc creation delegation
- [ ] `.claude/skills/feature-issues/SKILL.md` automates GitHub issue creation from workplans
- [ ] `.claude/skills/feature-complete/SKILL.md` automates doc moves, roadmap updates, and issue/milestone closure
- [ ] `.claude/skills/feature-teardown/SKILL.md` automates worktree removal and branch cleanup without implying feature status
- [ ] `.claude/project.yaml` entries accurately describe both orchestrator roles
- [ ] All naming conventions (feature slugs, branch names, worktree paths, doc paths) match PROJECT-MANAGEMENT.md

## Scope

### In Scope

- Rewrite `.claude/agents/orchestrator.md` as `.claude/agents/project-orchestrator.md` with project-specific orchestration workflow
- Create `.claude/agents/feature-orchestrator.md` with implementation-delegation workflow
- Create `.claude/skills/feature-setup/SKILL.md` for feature infrastructure automation
- Create `.claude/skills/feature-issues/SKILL.md` for GitHub issue creation from workplans
- Create `.claude/skills/feature-complete/SKILL.md` for marking features complete (docs, roadmap, issues)
- Create `.claude/skills/feature-teardown/SKILL.md` for removing local feature infrastructure
- Update `.claude/project.yaml` with entries for both orchestrator roles
- Session transcript forensics capability (age decryption, pattern search)
- Delegation patterns for both orchestrators (project-orchestrator -> docs/planning agents; feature-orchestrator -> implementation agents)

### Out of Scope

- Changes to other agents (hardware-protocol-engineer, library-ux-engineer, etc.)
- Automated PRD generation (the project-orchestrator creates PRDs via delegation, but the content requires human input)
- Changes to PROJECT-MANAGEMENT.md itself
- CI/CD integration
- MCP servers or external tooling

### Future Scope

None — all orchestrator skills are in scope for this feature.

## Role Distinction

| Aspect | Project Orchestrator | Feature Orchestrator |
|--------|---------------------|---------------------|
| Operates on | `main` branch | Feature worktree (`audiocontrol-<slug>`) |
| Outputs | Branches, worktrees, docs, issues | Implemented code (via agents) |
| Delegates to | documentation-engineer, Explore | typescript-pro, ui-engineer, hardware-protocol-engineer, code-reviewer |
| Tools | Read, Write (.md only), Bash (gh/git), Agent | Read, Write (.md only), Bash, Agent — no Write on code |
| Session ends when | Feature is ready for implementation team | Feature is implemented and PR-ready |

## Dependencies

- `age` CLI tool (for session transcript decryption) — already installed
- `gh` CLI tool (for GitHub issue creation) — already installed
- Existing documentation-engineer agent (for doc creation delegation)
- PROJECT-MANAGEMENT.md (defines the workflow the project-orchestrator follows)
- Existing implementation agents: typescript-pro, ui-engineer, hardware-protocol-engineer, code-reviewer

## Open Questions

- [ ] Should the project-orchestrator auto-detect the feature slug from the worktree/branch, or always require explicit input?
- [ ] Should the feature-setup skill also create an initial implementation-summary.md template, per PROJECT-MANAGEMENT.md Phase 2?
- [ ] Should issue creation support milestone assignment, or should that remain a manual step?
- [ ] Should the feature-orchestrator create the PR itself, or hand that back to the user?
- [ ] What is the escalation path when a sub-agent produces output that fails review — retry with more context, break into smaller tasks, or escalate to user?
