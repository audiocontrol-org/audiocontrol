# audiocontrol Codex Guide

This file is the Codex equivalent of the workspace-level `.claude/CLAUDE.md`. Keep both in sync while the repo supports both agents.

## Canonical Sync Path

Shared repo guidance must stay aligned between `AGENTS.md` and `.claude/CLAUDE.md`.

- Start edits in whichever file is more natural for the current agent session.
- Before finishing, mirror the same substantive guidance into the counterpart file.
- Preserve only differences that are explicitly tied to real tool constraints.
- If a difference is intentional, say so at the point of divergence instead of letting it look accidental.

## Scope

TypeScript monorepo for MIDI device control, bridge services, and web-based editors. Primary tooling is `pnpm`, `tsx`, Vitest, and GitHub issue-driven feature work.

## Session Start

Before writing code:

1. Identify the active feature from the worktree name, branch, or the user request.
2. Read `docs/<version>/<feature-slug>/README.md` and `workplan.md`.
3. Read the latest relevant entry in `DEVELOPMENT-NOTES.md`.
4. Check open or related GitHub issues when the task depends on issue state.
5. If the work touches hardware or transport behavior, read the relevant notes file first, such as `SCSI-NOTES.md`.
6. If the work touches UI behavior, read `TESTING.md` and `TESTING-UI.md`, then verify whether the feature already has a harness page and UI specs.
7. Tell the user what you found and what you plan to do next.

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

## Project Management

Features follow the workflow in [PROJECT-MANAGEMENT.md](~/work/PROJECT-MANAGEMENT.md).

**Feature docs:** `docs/<version>/<feature-slug>/` containing `prd.md`, `workplan.md`, and `README.md`

**Roadmap:** `docs/1.0/ROADMAP.md` for dependency graph, feature states, and phase tracking

**Worktrees:** `~/work/audiocontrol-work/audiocontrol-<feature-slug>/` on branch `feature/<feature-slug>`

**Multi-machine:** Work happens on multiple machines. Session logs are machine-local and do not sync. Git branches do sync. Always rehydrate from `workplan.md` and the latest `DEVELOPMENT-NOTES.md` entry rather than assuming prior conversational context exists.

### Start a New Feature

1. Read `docs/1.0/ROADMAP.md` for prerequisites and dependencies.
2. Create `docs/<version>/<feature-slug>/`.
3. Write `prd.md`, `workplan.md`, and `README.md`.
4. Create GitHub issues linked from the workplan.
5. Create the worktree with `git worktree add ~/work/audiocontrol-work/audiocontrol-<slug> -b feature/<slug>`.

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
- `feature-extend`
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
- UI features are visually verified with the existing test harness process in `TESTING-UI.md`.
- No ad-hoc test infrastructure is introduced when `modules/e2e-infra/` or existing `make test-*` targets already cover the need.
- Feature docs are updated for the work performed.

## Build and Test

Use the root `Makefile` to build the monorepo in dependency order.

```bash
make
make clean
pnpm test
pnpm --filter <module> test
```

Prefer `make` over `pnpm -r build` for full builds because the Make-based flow enforces module build order.

## Delegation in Codex

Codex can use sub-agents only when the user explicitly asks for delegation, sub-agents, or parallel agent work. When that happens:

- use `explorer` for narrow codebase questions
- use `worker` for bounded implementation tasks with an explicit write scope
- keep the critical-path task local when waiting would block progress

Do not assume agent delegation is available by default.

This is an intentional difference from `.claude/CLAUDE.md`, which is allowed to assume proactive repo-local agent delegation.

## Contract Enforcement

The compiler must catch contract violations.

- Do not use optional bags of callbacks where a shared contract should be mandatory.
- Do not duplicate shared types to "get around" compile failures.
- Do not hide unsupported behavior behind silent no-ops.
- When shared interfaces change, update every consumer until the build fails nowhere.
- When changing shared code in `editor-core`, build all affected editors before committing.

## Repository Hygiene

- Build artifacts belong in `dist/`.
- Do not bypass pre-commit or pre-push hooks.
- Do not commit temporary files, logs, or generated artifacts unless the repo explicitly tracks them.
- Use `pnpm` for package operations.
- Use `tsx` for running TypeScript scripts.

## Monorepo Conventions

- Each module should have clear boundaries and self-contained responsibilities.
- Shared types belong in dedicated packages.
- Internal dependencies should use the `workspace:*` protocol where applicable.

## URL Convention for Editors

Editors are served at `https://audiocontrol.org/<manufacturer>/<device>/editor`.

## Documentation Standards

- Do not call unfinished work "production-ready".
- Do not express project-management goals in temporal promises when milestone or phase language is more accurate.
- Do not invent projection statistics.
- Use GitHub links, not local file paths, in GitHub issue descriptions.
