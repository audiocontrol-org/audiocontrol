# Codex Draggable Zones

**Status:** In Progress
**Branch:** `feature/codex-draggable-zones`
**Milestone:** TBD

## Overview

Clean-room Codex implementation of draggable zone editing for the Akai S3000XL editor. This feature adds direct manipulation for key and velocity boundaries in the overview surfaces, shared coordinate mapping between overview and detail views, draggable velocity split points, and zone creation via drag.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach
- [Implementation Summary](./implementation-summary.md) - Session and implementation outcomes

## Quick Links

- **Docs Path:** `docs/1.0/001-IN-PROGRESS/codex-draggable-zones/`
- **Primary Module:** `modules/akai-s3k-editor/src/components/keygroups/`
- **Comparison Issue:** [#252](https://github.com/audiocontrol-org/audiocontrol/issues/252)

## Key Design Decisions

1. **Shared coordinate model** — overview and detail note positions should come from one mapping utility.
2. **Direct manipulation is additive** — numeric inputs remain available and authoritative alongside drag interactions.
3. **Commit on release** — drag updates the UI continuously and commits the final value when the interaction ends.
4. **Constraint handling must be evidence-based** — S3000XL overlap and creation rules should be verified before encoding.

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Shared coordinate system | Complete |
| 2 | Draggable ZoneOverview boundaries | Complete |
| 3 | Draggable VelocityRangeBar | Complete |
| 4 | Zone creation via drag | Pending |
