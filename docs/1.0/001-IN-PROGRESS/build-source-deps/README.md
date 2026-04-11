# Build Source Dependencies

**Status:** In Progress
**Branch:** `feature/build-source-deps`

## Documentation

- [PRD](./prd.md) — Product requirements
- [Workplan](./workplan.md) — Implementation plan

## Overview

Make the Makefile build system track CSS file changes (in addition to existing `.ts`/`.tsx` tracking) and add inline documentation to prevent agents from cargo-culting stamp file deletion. Small fix: Makefile source patterns, Makefile comments, and a CLAUDE.md reinforcement note.

## Current Status

| Phase | Status | Commit |
|-------|--------|--------|
| 1. CSS tracking + Makefile docs + CLAUDE.md note | Complete | — |

## Motivation

Session transcript analysis found 20+ instances of unnecessary `rm -f .build-stamp && make` in a single session. Agents learn this pattern from the Makefile because the Makefile does not explain that source changes are already tracked. Additionally, 9 CSS files across 5 modules are not included in the source dependency lists, so CSS changes genuinely do require manual intervention until this fix lands.
