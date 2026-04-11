# Orchestrator Agents

**Status:** Complete
**PR:** https://github.com/audiocontrol-org/audiocontrol/pull/215 (merged)
**Branch:** `feature/orchestrator-agent`

## Documentation

- [PRD](./prd.md) — Product requirements
- [Workplan](./workplan.md) — Implementation plan

## Overview

Define two distinct orchestrator roles for the audiocontrol project:

1. **Project Orchestrator** — operates on `main`, creates feature infrastructure (branches, worktrees, docs, PRDs, workplans, GitHub issues), and hands off to implementation teams. It never implements code.

2. **Feature Orchestrator** — operates in feature worktrees, reads the workplan and issues created by the project orchestrator, and deploys sub-agents (typescript-pro, ui-engineer, hardware-protocol-engineer, etc.) to implement code. It directs implementation but does not write code directly.

Additionally, create reusable skills for the project-orchestrator's feature lifecycle operations: setup, issue creation, completion, and teardown.

| Aspect | Project Orchestrator | Feature Orchestrator |
|--------|---------------------|---------------------|
| Operates on | `main` branch | Feature worktree (`audiocontrol-<slug>`) |
| Outputs | Branches, worktrees, docs, issues | Implemented code (via agents) |
| Delegates to | documentation-engineer, Explore | typescript-pro, ui-engineer, hardware-protocol-engineer, code-reviewer |
| Tools | Read, Write (.md only), Bash (gh/git), Agent | Read, Bash, Agent — no Edit/Write on code |
| Session ends when | Feature is ready for implementation team | Feature is implemented and PR-ready |

## Current Status

| Phase | Status |
|-------|--------|
| 1. Rewrite project-orchestrator agent definition | Complete |
| 2. Create project-orchestrator skills (feature-setup, feature-issues, feature-complete, feature-teardown) | Complete |
| 3. Create feature-orchestrator agent definition + skills (feature-implement, feature-pickup, feature-review, feature-ship) | Complete |
| 4. Update project.yaml orchestrator entries | Complete |

## Deliverables

| File | Description |
|------|-------------|
| `.claude/agents/project-orchestrator.md` | Project-level orchestrator with investigation, planning, and delegation workflows |
| `.claude/agents/feature-orchestrator.md` | Feature-level orchestrator with implementation delegation and phase management workflows |
| `.claude/skills/feature-setup/SKILL.md` | Creates branch, worktree, docs directory, and delegates doc creation |
| `.claude/skills/feature-issues/SKILL.md` | Creates GitHub issues from workplan phases and updates workplan with links |
| `.claude/skills/feature-complete/SKILL.md` | Moves docs to complete, updates ROADMAP.md, closes issues and milestone |
| `.claude/skills/feature-teardown/SKILL.md` | Removes local worktree and branch infrastructure |
| `.claude/skills/feature-implement/SKILL.md` | Core loop: select next task, choose agent, delegate, review, update progress |
| `.claude/project.yaml` | Updated entries for both project-orchestrator and feature-orchestrator with accurate role descriptions |
