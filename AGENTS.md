# audiocontrol Codex Guide

This file is the Codex equivalent of the workspace-level `.claude/CLAUDE.md`. Keep both in sync while the repo supports both agents.

## Scope

TypeScript monorepo for MIDI device control, bridge services, and web-based editors. Primary tooling is `pnpm`, `tsx`, Vitest, and GitHub issue-driven feature work.

## Session Start

Before writing code:

1. Identify the active feature from the worktree name, branch, or the user request.
2. Read `docs/<version>/<feature-slug>/README.md` and `workplan.md`.
3. Read the latest relevant entry in `DEVELOPMENT-NOTES.md`.
4. If the work touches hardware or transport behavior, read the relevant notes file first, such as `SCSI-NOTES.md`.
5. Check related GitHub issues when the task depends on issue state.
6. Tell the user what you found and what you plan to do next.

## Session End

Before wrapping a feature session:

1. Update the feature `README.md` status table.
2. Update `workplan.md` with completed items and newly discovered work.
3. Write a `DEVELOPMENT-NOTES.md` entry.
4. Update hardware notes if device behavior was investigated.
5. Update or close relevant GitHub issues.
6. Commit documentation changes with the implementation changes they describe.

## Feature Workflow

Canonical flow:

`PRD -> workplan.md -> GitHub issues -> implementation -> implementation-summary.md`

Feature docs live under `docs/<version>/<feature-slug>/`.

## Worktree Discipline

When using git worktrees, make branch-owned changes from the worktree attached to that branch.

Before creating feature docs or implementation changes:

1. verify `pwd`
2. verify `git rev-parse --abbrev-ref HEAD`
3. confirm the active worktree matches the target feature branch
4. run `tsx tools/verify-feature-context.ts --slug <slug>` and require it to pass

Feature docs required for implementation must exist in the feature-specific worktree, not only in another worktree such as `main`.

If changes were made in the wrong worktree, prefer a git-native repair (`cherry-pick`, `merge`, or other branch-level transfer) over manual file recreation. Use manual copying only when the desired changes are not available as a clean, isolated git change.

## Repo-Local Codex Skills

Codex equivalents of the Claude skills live under `.agents/skills/`:

- `session-start`
- `session-end`
- `feature-help`
- `feature-define`
- `feature-setup`
- `feature-issues`
- `feature-pickup`
- `feature-implement`
- `feature-review`
- `feature-ship`
- `feature-complete`
- `feature-teardown`
- `deploy-bridge`
- `analyze-session`

Prefer these skills when the user asks for that workflow explicitly.

## Core Engineering Rules

- Use `@/` imports for internal module paths when the module already follows that convention.
- Do not add fallbacks or mock data outside test code. Throw explicit errors instead.
- TypeScript strict mode is required.
- Prefer interfaces and dependency injection across boundaries.
- Use composition, not inheritance.
- Avoid `any`; use `unknown` plus narrowing.
- Keep files under roughly 300-500 lines. Refactor before they become gravity wells.
- All public logic should be unit testable.
- If a convention must be broken, document the deviation at the point of use.

## Multi-Device UI Rule

Do not branch UI components on device type or device capability. Device-specific behavior belongs behind factory-created interfaces, not inline conditionals in shared UI.

## Nucleation Site Prevention

Remove bad patterns instead of documenting around them:

- duplicate logic
- dead code
- backward-compatibility shims
- large files that mix unrelated responsibilities

If future agents would be tempted to copy it, treat it as debt and fix or remove it.

## Hardware and Protocol Work

Do not speculate about device behavior. Test against real hardware or cite a primary source. Capture findings, timing, and evidence in the relevant docs.

For bridge work:

1. Edit `services/scsi-midi-bridge/src/`
2. Deploy with `make deploy-scsi-bridge`
3. Verify with `curl http://s3k.local:7033/status`
4. Check logs if needed

## Before Committing

- Progress indicators show bytes, elapsed time, and ETA when applicable.
- No hardcoded pixel layouts where proportional flex layouts are expected.
- No defensive sleeps when protocol ACK or response semantics already define completion.
- No fabricated claims about hardware behavior.
- Error messages are actionable.
- Feature docs are updated for the work performed.
- Feature docs and implementation changes live on the branch/worktree that owns the feature.

## Delegation in Codex

Codex can use sub-agents only when the user explicitly asks for delegation, sub-agents, or parallel agent work. When that happens:

- use `explorer` for narrow codebase questions
- use `worker` for bounded implementation tasks with an explicit write scope
- keep the critical-path task local when waiting would block progress

Do not assume agent delegation is available by default.
