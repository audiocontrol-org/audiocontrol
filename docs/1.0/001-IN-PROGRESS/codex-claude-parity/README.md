# Codex and Claude Parity

**Status:** In Progress
**Branch:** `feature/codex-claude-parity`

## Documentation

- [PRD](./prd.md) -- Product requirements
- [Workplan](./workplan.md) -- Implementation plan
- [Parity Audit](./parity-audit.md) -- Phase 1 inventory and gap baseline
- [Parity Maintenance](./parity-maintenance.md) -- Drift-prevention checklist and intentional divergences
- [Implementation Summary](./implementation-summary.md) -- Ship summary

## Overview

Ensure skill and directive parity between Codex and Claude Code in this repository so both agents can operate against the same workflows, project rules, and expected session behaviors without drift.

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Audit | Complete | Baseline captured in `parity-audit.md` after comparing current branch to `origin/main` |
| 2. Directive Alignment | Complete | `AGENTS.md` expanded to match shared Claude guidance; canonical sync path and intentional delegation difference are now explicit in both top-level guides |
| 3. Skill and Workflow Parity | Complete | Added Codex `feature-extend` and aligned repo-local session lifecycle skills; remaining one-sided repo artifacts are now explicit rather than accidental |
| 4. Verification and Drift Prevention | Complete | Audit normalized to final state and maintenance checklist added for future parity edits |

## Motivation

This repo already expects both Codex and Claude Code to follow the same project-management lifecycle, session behaviors, and engineering rules. If the two systems drift, agents will produce inconsistent setup, inconsistent close-out behavior, and inconsistent workflow coverage. The fix is to make parity explicit: inventory both sides, close accidental gaps, document intentional differences, and leave a maintainable parity artifact behind.
