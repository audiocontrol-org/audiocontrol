# Codex Draggable Zones - Product Requirements Document

**Created:** 2026-04-13
**Status:** Draft
**Owner:** oletizi

## Problem Statement

The Akai S3000XL editor already shows a `ZoneOverview` (keyboard x velocity map) and `VelocityRangeBar`, but both are primarily display-oriented. Users still have to edit key and velocity boundaries through numeric inputs or a separate `KeyRangeEditor`, which breaks the direct-manipulation workflow. This feature adds direct spatial editing so users can reshape and create zones in the visualization while preserving numeric inputs as an alternate path.

## Purpose

This is a clean-room Codex implementation effort of the draggable zone editing feature requested in GitHub issue [#252](https://github.com/audiocontrol-org/audiocontrol/issues/252), intended for comparison against the parallel Claude Code implementation on `feature/draggable-zones`.

## User Stories

- As a user editing key ranges, I want to drag the left or right edge of a zone in `ZoneOverview` to change `LONOTE` or `HINOTE`, so I can reshape ranges visually.
- As a user editing velocity ranges, I want to drag the top or bottom edge of a zone in `ZoneOverview` to change `LOVEL` or `HIVEL`, so I can adjust velocity sensitivity directly in the map.
- As a user comparing overview and detail editors, I want `ZoneOverview` and `KeyRangeEditor` to align horizontally, so note positions correlate visually.
- As a user editing velocity-layer boundaries, I want to drag split points in `VelocityRangeBar`, so I can fine-tune velocity layers without using only numeric fields.
- As a user creating new keygroups, I want to drag in empty `ZoneOverview` space, so I can define zones spatially rather than through a separate creation flow.

## Success Criteria

- [ ] Zone boundaries in `ZoneOverview` can be dragged to edit `LONOTE`, `HINOTE`, `LOVEL`, and `HIVEL`.
- [ ] `VelocityRangeBar` exposes draggable split points for velocity boundary editing.
- [ ] `ZoneOverview` and `KeyRangeEditor` share the same horizontal note coordinate mapping.
- [ ] Users can create a new keygroup by dragging in empty space in `ZoneOverview`.
- [ ] Drag interactions update continuously during pointer movement and commit on pointer release.
- [ ] Drag affordances use larger invisible hit areas than the visible handle.
- [ ] Numeric inputs remain available as an alternate editing path.
- [ ] Boundary and overlap constraints match actual S3000XL behavior.
- [ ] Unit tests cover coordinate mapping, drag behavior, constraints, and creation flows.

## Scope

### In Scope

- Draggable note and velocity edges in `ZoneOverview`
- Draggable split points in `VelocityRangeBar`
- Shared coordinate mapping between `ZoneOverview` and `KeyRangeEditor`
- Zone creation gesture in empty `ZoneOverview` space
- Drag previews, hover states, and commit behavior
- Verified boundary and overlap constraints

### Out of Scope

- Touch-first or mobile drag interaction design
- Drag editing outside Akai keygroup editing surfaces
- Unrelated editor refactors
- Invented fallback device rules without verification

## Dependencies

- `modules/akai-s3k-editor`
- `@audiocontrol/sampler-devices/s3k`
- Existing Akai UX work that introduced the current keygroup editing surfaces

## Open Questions

1. What overlap rules does the S3000XL permit for keygroup note ranges?
2. What overlap rules does the S3000XL permit for velocity zones within a keygroup?
3. What defaults should a newly created keygroup receive beyond the dragged note and velocity range?
4. Should `VelocityRangeBar` support only shared split-point dragging between adjacent zones, or direct low/high edge edits per zone?
