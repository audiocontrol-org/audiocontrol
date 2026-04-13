# Draggable Zone Editing - Product Requirements Document

**Created:** 2026-04-13
**Status:** Approved
**Owner:** oletizi

## Problem Statement

The ZoneOverview (keyboard x velocity map) and velocity zone boundaries in the S3000XL editor are display-only. Users must edit key ranges and velocity ranges through numeric inputs or the separate KeyRangeEditor, which is disconnected from the visualization. This makes zone editing tedious and unintuitive -- users see the zones they want to change but cannot interact with them directly.

## User Stories

1. **As a user editing key ranges**, I want to drag the left or right edge of a zone in the ZoneOverview to change its LONOTE or HINOTE, so that I can visually reshape key ranges without switching to numeric inputs.

2. **As a user editing velocity ranges**, I want to drag the top or bottom edge of a zone in the ZoneOverview to change its LOVEL or HIVEL, so that I can adjust velocity sensitivity directly in the map.

3. **As a user comparing the overview and detail editors**, I want note positions in the ZoneOverview and KeyRangeEditor to align horizontally, so that I can visually correlate the two views without mental translation.

4. **As a user creating new keygroups**, I want to drag in empty space in the ZoneOverview to create a new keygroup covering the dragged range, so that I can define zones spatially rather than through a creation dialog.

5. **As a user editing velocity zone split points**, I want to drag split point handles in the VelocityRangeBar to adjust velocity zone boundaries, so that I can fine-tune velocity layering visually.

## Success Criteria

- Zone boundaries (key range and velocity range) can be edited by dragging edges directly in the ZoneOverview.
- Velocity zone split points can be edited by dragging in the VelocityRangeBar.
- ZoneOverview and KeyRangeEditor share the same horizontal coordinate mapping so note positions visually align.
- New keygroups can be created by dragging in empty space in the ZoneOverview.
- Drag interactions follow the EnvelopeEditor pattern: onDrag for continuous UI updates, onCommit for device write on mouseup, invisible hit areas larger than visible elements, getState() reads to avoid stale closures.
- Boundary constraints match S3000XL device behavior.
- Numeric inputs remain as an alternative editing path (touch-friendly).

## Scope

### In Scope

- Draggable zone edges (LONOTE, HINOTE, LOVEL, HIVEL) in ZoneOverview.
- Draggable split point handles in VelocityRangeBar.
- Shared note-to-pixel coordinate mapping between ZoneOverview and KeyRangeEditor.
- Zone creation gesture (drag in empty space) in ZoneOverview.
- Visual feedback during drag interactions (hover states, drag previews).
- Boundary constraint enforcement matching S3000XL device rules.

### Out of Scope

- Touch/mobile drag interactions -- numeric inputs serve as the touch-appropriate editing path.
- Drag interactions in components other than ZoneOverview and VelocityRangeBar.

## Dependencies

None.

## Open Questions

1. What does the S3000XL allow for overlapping key ranges between keygroups?
2. What does the S3000XL allow for overlapping velocity zones within a keygroup?
3. What default values should a newly created keygroup have?
