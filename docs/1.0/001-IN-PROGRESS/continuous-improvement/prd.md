# Continuous Improvement Process — Product Requirements Document

**Created:** 2026-04-10
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol project has comprehensive project management infrastructure (PRDs, workplans, GitHub issues, phased delivery, CLAUDE.md guidelines) but Claude Code sessions operate disconnected from it. Agents don't read existing plans, don't update status, repeat documented mistakes, and require constant user correction on the same categories of errors (fabrication, unnecessary complexity, missing UX feedback, insufficient documentation).

With 1,771 session logs totaling 544MB across two machines, 11 features in progress, and 20 completed, the project has rich data for quantitative analysis but no systematic process for extracting insights and feeding them back into the workflow.

## User Stories

### Session Effectiveness
- As a developer, I want Claude to read the feature workplan and last session journal before starting work so it doesn't repeat mistakes or lose context
- As a developer, I want Claude to update workplan status and write a journal entry at the end of each session so context carries forward
- As a developer, I want to say "remind me of the virtuous cycle" and get a concise reminder of how to steer Claude effectively

### Quantitative Feedback
- As a developer, I want to run session log analysis to see correction rates, arc distributions, and time sinks across sessions so I can identify process gaps
- As a developer, I want journal entries to include quantitative data (message counts, commit counts, correction counts) so trends are measurable

### Agent Leverage
- As a developer, I want Claude to proactively use the right sub-agent for each task type without me having to ask
- As a developer, I want workflow skills (/session-start, /session-end, /deploy-bridge) that encode repeatable multi-step operations as single commands

### Cross-Machine Continuity
- As a developer, I want to switch between orion-m4 and orion-m1 without losing session context, because feature branches sync via git but session logs don't

## Success Criteria

- [ ] CLAUDE.md has session start/end checklists that agents follow automatically
- [ ] CLAUDE.md references PROJECT-MANAGEMENT.md and the roadmap
- [ ] CLAUDE.md has workflow playbooks for common operations
- [ ] CLAUDE.md has agent selection guidance with task-to-agent mapping
- [ ] DEVELOPMENT-NOTES.md has structured template with correction categories
- [ ] Session log analyzer is set up and produces baseline metrics
- [ ] At least 2 custom skills created (/session-start, /session-end)
- [ ] hardware-protocol-engineer agent created
- [ ] Virtuous cycle memory is retrievable by user request
- [ ] Next 3 sessions show agent reading workplan at start and writing journal at end

## Scope

### In Scope
- CLAUDE.md additions (session lifecycle, playbooks, agent guidance, pre-commit review)
- DEVELOPMENT-NOTES.md template restructuring
- Session data extractor (TypeScript, extracts structured records from JSONL logs, commits to git)
- Custom agent creation (hardware-protocol-engineer, library-ux-engineer)
- Custom skill creation (/session-start, /session-end, /deploy-bridge)
- Feature doc updates for library-ux (this session's work)
- Virtuous cycle memory entry

### Out of Scope
- MCP servers or databases
- Python or Docker dependencies
- LLM-powered analysis (Gemini API) — extract data first, analyze later
- Autonomous multi-hour execution (Tier 3)
- Cross-project automation beyond ~/work/CLAUDE.md
- Changes to completed features
- Review gate tooling (future iteration)

## Dependencies

- tsx (already installed — used for running TypeScript scripts)
- SSH access to orion-m1.local (for remote session data extraction)

## Open Questions

- [ ] Should /session-start be a skill or a hook that runs automatically?
- [ ] Should the analyzer be a git submodule, a clone in tools/, or installed globally?
- [ ] Should we create a DEVICE-NOTES.md pattern for each device (Roland, Akai, JV-1080) or keep SCSI-NOTES.md as the only one?
