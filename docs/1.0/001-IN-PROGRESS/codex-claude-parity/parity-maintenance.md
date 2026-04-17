# Codex and Claude Parity Maintenance

Use this checklist whenever shared agent guidance changes in this repo.

## Canonical Rule

If a change affects shared repo behavior, update both:

- `AGENTS.md`
- `.claude/CLAUDE.md`

If the difference is intentional because of tool constraints, say so explicitly in both places or in the parity docs.

## What Must Stay Aligned

- Session start and session end expectations
- Feature lifecycle terminology and ordering
- Core engineering rules
- Build and test guidance
- Project-management and worktree conventions
- Contract-enforcement and repository-hygiene rules
- Repo-local skills under `.agents/skills/` and `.claude/skills/` when the workflow is meant to exist for both agents

## Intentionally Tool-Specific Repo Artifacts

These do not currently require one-to-one Codex repo mirrors:

- `.claude/agents/*.md`
- `.claude/rules/*.md`
- `.claude/workflows/*.yaml`
- `.claude/project.yaml`

Reason: these artifacts primarily express Claude-side orchestration and repo-local tooling assumptions that are already handled differently by Codex platform instructions and tool policy.

## Drift Check

When editing parity-sensitive guidance:

1. Compare `AGENTS.md` and `.claude/CLAUDE.md`.
2. Compare `.agents/skills/` and `.claude/skills/`.
3. Confirm any difference is either:
   - matched in substance
   - an intentional tool-specific divergence
   - an explicitly deferred follow-up
4. Update [parity-audit.md](./parity-audit.md) if the classification changed.
5. Update [README.md](./README.md) and [workplan.md](./workplan.md) if the feature phase status changed.

## Deferred Follow-Up

- Claude skill files may still contain more detailed step-by-step instructions than their Codex equivalents even when the workflow intent matches.
- If future repo changes make Claude-only rules or workflow descriptors operationally important for Codex, revisit whether repo-local Codex mirrors should be added.
