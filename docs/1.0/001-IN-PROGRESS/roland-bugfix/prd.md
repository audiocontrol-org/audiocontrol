# Roland Bug-Fix Catchment - Product Requirements Document

**Created:** 2026-05-20
**Status:** Draft
**Owner:** operator

## Problem Statement

The s550-support feature shipped a large redesign of the Roland S-330 / S-550 editors (PRs [#433](https://github.com/audiocontrol-org/audiocontrol/pull/433) + [#434](https://github.com/audiocontrol-org/audiocontrol/pull/434), merged 2026-05-20). Operator-driven use will surface regressions, layout drift, and small bugs that warrant fixes against the just-merged surface. This branch is the catchment for that work.

## User Stories

- As the operator, I want a dedicated branch where post-merge Roland bugs land as discrete commits so that fixes do not entangle with new-feature work
- As the operator, I want each fix verified against my own reproduction (visual + functional) before it is checked off, so that "green tests" never substitutes for "actually fixed"
- As a maintainer, I want a single bug-triage table per fix-pass round so that the diff between "shipped" and "still open" is always inspectable in one place

## Success Criteria

**Open-ended — operator declares completion.**

There is no fixed checklist of bugs to fix. Bugs are added to [`workplan.md`](./workplan.md)'s triage table as they are found by the operator; fixes land as individual commits; the branch ships (or stays open for another round) when the operator says so.

The per-fix gates (which are fixed) are recorded in [`workplan.md`](./workplan.md) under Phase 1 acceptance criteria.

## Scope

### In Scope

- Bugs and polish in `modules/roland-sxx0-editor` (primary surface)
- Bugs in `modules/editor-core` shared primitives that the Roland editors consume, when a Roland-surface bug traces into them
- Protocol bugs in `modules/sampler-devices` / `modules/sampler-midi`, only if a real hardware repro surfaces one
- Diagnostic additions in `modules/e2e-infra`, only if a hardware-touching bug needs one

### Out of Scope

- Anything that isn't a bug or polish in the Roland editor surface — new features get their own branch
- Refactors larger than what is needed to fix a specific bug
- Tone/patch data-model changes that would require a new PRD
- [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) (D-SYS page) — missing-affordance enhancement, not a bug
- [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) (Copy/Derive) — missing-affordance enhancement, not a bug

If the operator decides to scope #407 or #409 in, that is an explicit call recorded in the workplan, not a default.

## Dependencies

None. s550-support is merged; the Roland editor surface is stable.

## Open Questions

None at definition time. Bugs come in via operator triage and are recorded in [`workplan.md`](./workplan.md)'s bug triage table as they are surfaced.

## Appendix

### Predecessor Feature

This branch is the bug-fix catchment for the just-merged s550-support feature. See its post-completion report for what was shipped and the known caveats at merge time:

- [s550-support implementation summary](../../003-COMPLETE/s550-support/implementation-summary.md)
- [s550-support README](../../003-COMPLETE/s550-support/README.md)
