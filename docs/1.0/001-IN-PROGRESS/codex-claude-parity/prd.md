# PRD: Codex and Claude Parity

## Problem Statement

Ensure skill and directive parity between Codex and Claude Code in this repository so both agents can operate against the same workflows, project rules, and expected session behaviors without drift.

Today, parity is partially implied but not guaranteed. Repo-local instructions already say some files should stay in sync, and both systems have workflow-specific skills, but there is no single maintained parity pass that answers:

1. Which directives are meant to match exactly?
2. Which workflows exist on one side but not the other?
3. Which differences are intentional because of tool constraints, and which are just drift?
4. What is the canonical maintenance path for future updates?

Without that clarity, the repo risks duplicated-but-divergent instructions, one-sided workflows, and future agent behavior differences that are hard to detect until they break a session.

## User Stories

1. As a maintainer, I want Codex and Claude Code to expose equivalent repo workflows so feature setup, implementation, review, and close-out behave consistently.
2. As a maintainer, I want shared agent instructions to stay synchronized so I do not have to debug agent-specific drift.
3. As a future agent, I want one clear parity artifact so I can tell what should match, what differs intentionally, and how to keep it aligned.
4. As a maintainer, I want low-value one-sided instructions removed instead of copied forward forever.

## Acceptance Criteria

- Every active Claude-oriented workflow in the repo has a Codex equivalent, or is explicitly documented as intentionally unsupported.
- Every active Codex-oriented workflow in the repo has a Claude equivalent, or is explicitly documented as intentionally unsupported.
- Workspace instructions that are meant to stay in sync are updated together and verified for parity.
- Session-start and session-end guidance match in substance across both agent systems.
- A maintainer can inspect one canonical parity artifact and understand which skills and directives are matched, which are intentionally different, and what follow-up work remains.

## Out of Scope

- Adding brand-new workflows that neither system currently supports.
- Changing underlying Codex or Claude product capabilities.
- Rewriting unrelated feature documentation.
- Broad repo refactors unrelated to agent parity.

## Dependencies

- Accurate inventory of existing Codex repo-local skills.
- Accurate inventory of Claude-oriented instructions and workflow definitions.
- A decision on whether parity should be enforced by duplicated files, a canonical shared source, or an explicit sync procedure.

## Open Questions

1. What should be the canonical source for shared agent guidance: `AGENTS.md`, `.claude/CLAUDE.md`, or a third shared doc?
2. Are there Claude-specific workflows that should be retired instead of ported?
3. Are there Codex-specific workflows that should remain intentionally different because of tool constraints?
4. Should parity target wording-level sync, behavior-level sync, or both?
