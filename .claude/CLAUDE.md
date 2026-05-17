# audiocontrol

TypeScript monorepo for audio device control, MIDI communication, and web-based editors for vintage samplers and synthesizers. Uses pnpm workspaces with Vitest for testing.

This file is the Claude equivalent of the workspace-level `AGENTS.md`. Keep both in sync while the repo supports both agents.

## Canonical Sync Path

Shared repo guidance must stay aligned between `AGENTS.md` and `.claude/CLAUDE.md`.

- Start edits in whichever file is more natural for the current agent session
- Before finishing, mirror the same substantive guidance into the counterpart file
- Preserve only differences that are explicitly tied to real tool constraints
- If a difference is intentional, say so at the point of divergence instead of letting it look accidental

## Session Lifecycle

### Starting a Session

Before writing any code:
1. **Identify the feature**: check the worktree name, branch name, or ask the user
2. **Read the feature docs**: `docs/<version>/<feature-slug>/README.md` and `workplan.md` — know the current phase, what's done, what's next
3. **Read DEVELOPMENT-NOTES.md** — the latest entry has what the last session accomplished, what failed, and what the user corrected. This is critical context for avoiding repeat mistakes.
4. **Check open GitHub issues**: `gh issue list` for the feature's issues
5. **If hardware/device work**: read `SCSI-NOTES.md` or relevant device notes
6. **Tell the user** what you found and confirm the session goal

### Ending a Session

Before the session ends:
1. **Update feature README.md** status table
2. **Update workplan.md** — check off completed tasks, note new tasks discovered
3. **Write a DEVELOPMENT-NOTES.md entry** (see Development Journal section below)
4. **Update/close relevant GitHub issues**
5. If hardware work: **update SCSI-NOTES.md** with dated entry
6. **Commit all documentation changes**

## Project Management

Features follow the workflow in [PROJECT-MANAGEMENT.md](~/work/PROJECT-MANAGEMENT.md):

```
PRD → workplan.md → GitHub issues → implementation → implementation-summary.md
```

**Feature docs:** `docs/<version>/<feature-slug>/` containing prd.md, workplan.md, README.md

**Roadmap:** `docs/1.0/ROADMAP.md` — dependency graph, feature states, phase tracking

**Worktrees:** `~/work/audiocontrol-work/audiocontrol-<feature-slug>/` on branch `feature/<feature-slug>`

**Multi-machine:** Work happens on orion-m4 (Mac Studio, SCSI hardware access) and orion-m1 (MacBook). Session logs are machine-local at `~/.claude/projects/`. Feature branches sync via git; session context does NOT sync — always read the workplan and latest DEVELOPMENT-NOTES.md to pick up context.

### Start a new feature
1. Read `docs/1.0/ROADMAP.md` for prerequisites and dependencies
2. Create feature directory: `docs/<version>/<feature-slug>/`
3. Write prd.md, workplan.md, README.md
4. Create GitHub issues linked to workplan
5. Create worktree: `git worktree add ~/work/audiocontrol-work/audiocontrol-<slug> -b feature/<slug>`

## Before Committing

Review changes against project standards:
- [ ] Progress indicators show bytes, elapsed time, ETA (not just item counts)
- [ ] No hardcoded pixel values in layouts (use flex ratios)
- [ ] No defensive sleeps added (ACK/response is definitive)
- [ ] No fabricated claims about device behavior (test it or cite docs)
- [ ] Error messages are actionable
- [ ] UI features visually verified via test harness screenshot (see TESTING-UI.md)
- [ ] Feature workplan.md updated with completed tasks
- [ ] Could any of this work have been delegated to a sub-agent?
- [ ] No ad-hoc test infrastructure built — use `modules/e2e-infra/` and `make test-*` targets

## Sub-Agent Delegation

Delegate to sub-agents proactively — don't wait for the user to ask. The main agent should orchestrate; sub-agents should do the work.

This is an intentional difference from `AGENTS.md`, which restricts Codex sub-agent use to cases where the user explicitly asks for delegation, sub-agents, or parallel agent work.

| Task Pattern | Agent | Why |
|-------------|-------|-----|
| Investigate protocol/encoding question | hardware-protocol-engineer | Knows SCSI CDBs, SDS, ASPACK, Roland SysEx, serial MIDI, Web MIDI |
| Review code changes before commit | code-reviewer or codebase-auditor | Catches guideline violations |
| Research codebase for existing patterns | Explore (built-in) | Fast file/pattern search |
| Design implementation approach | Plan (built-in) | Considers alternatives |
| Build/modify UI components | ui-engineer or library-ux-engineer | Knows design system, accessibility |
| Write or update documentation | documentation-engineer | Consistent style, complete coverage |
| Debug SysEx/MIDI/device issues | hardware-protocol-engineer | All device transports |
| Multiple independent tasks | Launch agents in parallel | Maximizes throughput |

### How to delegate
- **Sub-agents research, main agent executes.** For code changes, have the sub-agent investigate and propose, then the main agent reviews and applies the changes. This keeps the user in the loop.
- **Give complete context.** Sub-agents don't see prior conversation. Include the problem statement, relevant file paths, what's already been tried, and what output you need.
- **Instruct agents to write to disk.** Agents often fail to persist their work. Always tell them to use the Write or Edit tool when they need to produce files.
- **Run multiple agents in parallel** when tasks are independent.
- **Don't duplicate work.** If you delegate research, don't also do the same searches yourself.

### When NOT to delegate
- Simple single-file reads or grep searches — use tools directly
- Git operations — do these directly
- Decisions that need user input — ask the user directly

## Project Structure

Key modules: `editor-core` (shared editor infra), `roland-sxx0-editor` (Roland S-330/S-550), `akai-s3k-editor` (Akai S3000XL), `sampler-devices` (device communication), `sampler-midi` (SysEx protocols), `sampler-lib` (shared data structures), `e2e-infra` (E2E test infrastructure). Services: `scsi-midi-bridge` (Rust, runs on Pi).

See [SAMPLER-LIBRARY.md](/SAMPLER-LIBRARY.md) for the four-zone storage model and higher-order library objects.

## Core Requirements

### Import Pattern
Always use the `@/` import pattern for internal modules.

### Error Handling
Never implement fallbacks or use mock data outside of test code. Throw errors with descriptive messages instead. Errors let us know something isn't implemented. Fallbacks and mock data are bug factories.

### TypeScript
- Strict mode required
- Interface-first design — define contracts across boundaries
- Composition over inheritance — no class inheritance hierarchies
- Dependency injection — constructor injection with interface types
- Avoid `any` — use `unknown` with type guards
- Never stub modules — use dependency injection for testability

### Multi-Device Architecture
Never use conditionals in UI components to switch behavior based on device configuration. Instead, use context-specific factory methods that return implementations of interfaces with device-dependent behavior composed in at creation time. The UI calls interface methods without knowing which device is active.

### Code Quality
- Files must be under 300-500 lines — refactor larger files
- Unit tests for all public functions (Vitest)
- All code must be unit testable via dependency injection
- Guideline deviations must be documented in situ with a comment explaining what rule is broken and why

### Nucleation Site Prevention
Bad code attracts more bad code. Eliminate on sight: duplicate code, dead code, backward compatibility shims, and poorly structured code that agents would copy. If an agent reading the code would be confused or tempted to duplicate it, fix the code. Before implementing anything new, check if the same concept already exists in the codebase.

### Contract Enforcement
The compiler must catch contract violations. No optional bags of callbacks, no duplicated types, no silent no-ops. When a shared interface changes, every consumer must fail to compile until updated. When changing shared code in editor-core, build all editors before committing (`make`).

### Repository Hygiene
- Build artifacts only in `dist/`
- Never bypass pre-commit or pre-push hooks — fix issues instead
- Never commit temporary files, logs, or generated artifacts
- Never add Claude attribution to git commits or pull requests
- Use `pnpm` for all package operations
- Use `tsx` for running TypeScript (not `ts-node`)

## Monorepo Conventions
- Each module is self-contained with clear boundaries
- Shared types go in dedicated packages
- Use `workspace:*` protocol for internal dependencies

## URL Convention for Editors
Editors are served at: `https://audiocontrol.org/<manufacturer>/<device>/editor`

## Build System

The repo uses a `Makefile` at the root to build modules in topological order. `pnpm install` runs automatically when `pnpm-lock.yaml` is newer than the install stamp.

```bash
make                                 # Install deps + build all modules in dependency order
make clean                           # Remove all dist/ dirs and stamp files
make clean && make                   # Full rebuild from scratch
pnpm test                            # Run all tests
pnpm --filter <module> test          # Test specific module
make check-coverage-roland           # 9R-A.1 T8 — lint + test-ui-roland + credibility + manifest + coverage gate
```

`pnpm -r build` still works but does **not** enforce build order — use `make` instead. Source change detection is automatic via `.build-stamp` files.

## Development Journal

At least once per session, write a journal entry in `DEVELOPMENT-NOTES.md` (project root):

```markdown
## YYYY-MM-DD: [Session Title]

### Feature: [feature-slug]
### Worktree: audiocontrol-<slug>

### Goal
[What was the session trying to accomplish]

### Accomplished
- [Concrete outcome with commit hash]

### Didn't Work
- [What failed and root cause]

### Course Corrections
- [COMPLEXITY] [description]
- [UX] [description]
- [FABRICATION] [description]
- [DOCUMENTATION] [description]
- [PROCESS] [description]

### Quantitative
- User messages: ~N
- Commits: N
- User corrections: N

### Insights
[What would make the next session better]
```

Be honest about mistakes. The value is in pattern recognition, not looking good.

## Documentation Standards
- Don't call what you have built "production-ready"
- Never specify project management goals in temporal terms — use milestone, sprint, phase
- Never offer baseless projection statistics
- Use GitHub links (not file paths) in issue descriptions

## UI Contract Standard

Project-wide policy for UI contracts, UI verification, audit logging, and operator sign-off lives in [UI-CONTRACT-AND-VERIFICATION-STANDARD.md](/UI-CONTRACT-AND-VERIFICATION-STANDARD.md).

Feature docs may apply that standard, but they are not the canonical source for it.
