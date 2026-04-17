# Codex and Claude Parity -- Workplan

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-17

---

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | TBD |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | TBD | Audit Codex and Claude directives, skills, and workflow coverage |
| Phase 2 | TBD | Align shared repo instructions and define canonical sync path |
| Phase 3 | TBD | Add, remove, or align workflows to achieve parity |
| Phase 4 | TBD | Verify parity and add drift-prevention artifact |

---

## Technical Approach

### Affected Areas

- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.agents/skills/`
- Claude-oriented workflow definitions and supporting docs
- Any parity summary or maintenance artifact added by this feature

### Strategy

1. Inventory directives and skills on both sides.
2. Classify each item as matched, missing on Codex, missing on Claude, or intentionally divergent.
3. Normalize shared operating guidance first.
4. Add, remove, or align skills and workflow docs to close unintended gaps.
5. Produce a parity summary artifact that makes future drift easy to detect.

---

## Phase 1: Audit

**Goal:** Establish the real parity baseline before changing any instructions or workflows.

**Audit Artifact:** [parity-audit.md](./parity-audit.md)

### Tasks

- [x] Inventory Codex repo-local skills and workflow docs
- [x] Inventory Claude-oriented instructions and workflow docs
- [x] Map equivalent items across both systems
- [x] Identify accidental gaps, duplicate concepts, and intentional differences
- [x] Capture audit findings in a parity artifact or feature-local audit note

### Acceptance Criteria

- Clear inventory exists for both agent systems
- Every item is classified as matched, missing, duplicate, or intentionally divergent
- The repo has a written baseline for parity work rather than relying on memory

---

## Phase 2: Directive Alignment

**Goal:** Synchronize shared repo instructions and remove contradictions.

### Tasks

- [x] Align `AGENTS.md` and `.claude/CLAUDE.md` where they are meant to stay in sync
- [x] Remove stale or contradictory guidance between the two systems
- [x] Decide and document the canonical maintenance path for shared directives
- [x] Preserve only intentional differences tied to real tool constraints

### Acceptance Criteria

- Shared instructions match in substance across both systems
- Any remaining differences are explicitly justified
- Maintainers can tell where future directive updates should start

---

## Phase 3: Skill and Workflow Parity

**Goal:** Close unintended workflow gaps between Codex and Claude.

### Tasks

- [x] Add missing equivalents where parity is required
- [x] Remove or deprecate one-sided workflows that should not persist
- [x] Align session-start, session-end, and feature lifecycle workflow coverage
- [x] Verify naming and behavior are coherent enough to prevent future drift

### Acceptance Criteria

- Workflow coverage is equivalent across both systems for active repo processes
- One-sided workflows are either removed or explicitly justified
- Session bootstrap and wrap-up behavior align in substance

---

## Phase 4: Verification and Drift Prevention

**Goal:** Leave behind a durable parity record and maintenance guidance.

### Tasks

- [x] Produce a canonical parity summary or checklist
- [x] Verify both systems can follow the same repo lifecycle at a high level
- [x] Add a lightweight maintenance note explaining how to keep parity intact
- [x] Record any follow-up gaps that are intentionally deferred

### Acceptance Criteria

- A maintainer can inspect one artifact and understand current parity state
- Future changes have a documented sync path instead of ad hoc duplication
- Deferred work is explicit rather than implicit drift
