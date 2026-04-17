# Codex and Claude Parity Audit Baseline

**Date:** 2026-04-17
**Feature Branch:** `feature/codex-claude-parity`
**Baseline:** `HEAD` was compared to `origin/main` before this audit and had no committed drift (`0 0`). The only local delta was this feature's untracked docs directory.

## Audit Scope

Artifacts reviewed for this baseline:

- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.agents/skills/*/SKILL.md`
- `.claude/skills/*/SKILL.md`
- `.claude/agents/*.md`
- `.claude/rules/*.md`
- `.claude/workflows/*.yaml`
- `.claude/project.yaml`

## Inventory Summary

| Surface | Codex | Claude | Classification |
|--------|-------|--------|----------------|
| Top-level repo guide | `AGENTS.md` | `.claude/CLAUDE.md` | Matched in substance |
| Repo-local skills | 15 | 15 | Matched by count |
| Repo-local agent personas | 0 | 13 | Missing on Codex |
| Repo-local rules | 0 | 7 | Missing on Codex |
| Repo-local workflow definitions | 0 | 3 | Missing on Codex |
| Repo-local project config | 0 | 1 | Missing on Codex |

## Directive Parity

| Topic | Status | Notes |
|------|--------|-------|
| Session start flow | Matched in substance | Both guides now require feature identification, README/workplan review, DEVELOPMENT-NOTES review, issue checks when relevant, hardware-note review, and UI-testing checks when UI work is involved. |
| Session end flow | Matched in substance | Both guides now require README/workplan updates, DEVELOPMENT-NOTES updates, hardware-note updates when relevant, issue updates, and support optional session analytics. |
| Feature lifecycle | Matched | Both describe the same core flow: `PRD -> workplan.md -> GitHub issues -> implementation -> implementation-summary.md`. |
| Core engineering rules | Matched in substance | Both align on `@/` imports, strict TypeScript, no fallbacks/mock data, DI/interfaces, composition, avoiding `any`, file-size discipline, unit testability, multi-device UI composition, hardware evidence, and anti-debt cleanup. |
| Delegation policy | Intentional divergence | `AGENTS.md` restricts Codex sub-agent use to explicit user requests. `.claude/CLAUDE.md` instructs proactive delegation and ships repo-local orchestrator agents that require delegation. This is an explicit tool-model difference. |
| Build and test guidance | Matched in substance | Both guides now state the Make-based build path, test expectations, UI verification expectations, and avoidance of ad-hoc test infrastructure. |
| Project-management detail | Matched in substance | Both guides now cover roadmap/worktree naming, multi-machine context, and new-feature setup flow. |
| Contract enforcement and repo hygiene | Matched in substance | Both guides now cover contract enforcement, repo hygiene, monorepo conventions, URL conventions, and documentation standards. |

## Skill Inventory

| Skill | Codex | Claude | Status | Notes |
|------|-------|--------|--------|-------|
| `session-start` | Yes | Yes | Matched in substance | Both now cover feature docs, notes, hardware context, issue state, session-analysis signals, and UI-testing checks when relevant. |
| `session-end` | Yes | Yes | Matched in substance | Both now cover README/workplan updates, notes, hardware and issue updates, and optional session-analysis handling. |
| `feature-help` | Yes | Yes | Matched in substance | Both now describe the same lifecycle shape, including `feature-extend` as a workflow step. |
| `feature-define` | Yes | Yes | Matched | Same role: capture feature definition before setup. |
| `feature-setup` | Yes | Yes | Partial | Same infrastructure goal. Claude version explicitly delegates doc creation to `documentation-engineer`; Codex version is tool-agnostic. |
| `feature-issues` | Yes | Yes | Matched | Same role: create tracking issues and backfill workplan links. |
| `feature-pickup` | Yes | Yes | Matched | Same role: rehydrate an in-progress feature from docs/issues. |
| `feature-implement` | Yes | Yes | Matched | Same core implementation-loop intent. |
| `feature-review` | Yes | Yes | Matched | Same review role. |
| `feature-ship` | Yes | Yes | Matched | Same ship/PR-prep role. |
| `feature-complete` | Yes | Yes | Matched | Same completion/closeout role. |
| `feature-teardown` | Yes | Yes | Matched | Same infrastructure cleanup role. |
| `deploy-bridge` | Yes | Yes | Matched | Same bridge deployment workflow exists on both sides. |
| `analyze-session` | Yes | Yes | Matched | Same session-analysis workflow exists on both sides. |
| `feature-extend` | Yes | Yes | Matched | Both now provide a repo-local workflow for broadening an in-progress feature without creating a new worktree. |

## Claude-Only Repo Surfaces

These artifacts currently have no repo-local Codex equivalent:

- `.claude/agents/*.md`
  Claude ships 13 task-specific agent personas, including `project-orchestrator`, `feature-orchestrator`, `documentation-engineer`, `hardware-protocol-engineer`, and `code-reviewer`.
- `.claude/rules/*.md`
  Claude ships separate rule docs for deployment, testing, UI development, session analytics, workflow playbooks, and device-specific guidance.
- `.claude/workflows/*.yaml`
  Claude ships workflow descriptors for general project work and feature development.
- `.claude/project.yaml`
  Claude has additional project metadata that points at workflows, skills, and feature infrastructure expectations.

For parity purposes, these are now treated as tool-specific repo artifacts rather than accidental gaps. Some of their behavior is already covered by Codex platform instructions, and the repo does not currently need one-to-one local mirrors for them.

## Current Conclusion

What is clearly matched:

- Top-level repo guidance in `AGENTS.md` and `.claude/CLAUDE.md`
- Repo-local workflow skills by name and purpose
- Core engineering constraints around typing, DI, UI composition, testing, and hardware evidence

What is clearly not yet aligned:

- Claude has additional repo-local rules, workflows, and agent persona docs that remain intentionally tool-specific
- Some Claude skill files still contain more execution detail, even where the workflow intent now matches

## Remaining Phase 4 Focus

- Leave behind a concise maintenance checklist for future parity edits.
- Record the intentional tool-specific artifacts so they are not re-audited as accidental drift.
- Note any deferred one-to-one mirroring work explicitly rather than implying it is complete.
