# Draggable Zone Editing - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD (assign when scheduling)

**GitHub Issues:**

| Phase | Issue | Description |
|-------|-------|-------------|
| Parent | [#252](https://github.com/audiocontrol-org/audiocontrol/issues/252) | [akai-s3k-editor] Draggable Zone Editing |
| Phase 1 | [#253](https://github.com/audiocontrol-org/audiocontrol/issues/253) | Extract shared note-to-pixel coordinate mapping |
| Phase 2 | [#254](https://github.com/audiocontrol-org/audiocontrol/issues/254) | Add draggable zone boundaries to ZoneOverview |
| Phase 3 | [#255](https://github.com/audiocontrol-org/audiocontrol/issues/255) | Add draggable split points to VelocityRangeBar |
| Phase 4 | [#256](https://github.com/audiocontrol-org/audiocontrol/issues/256) | Add zone creation via drag in ZoneOverview |

## Technical Approach

All changes are scoped to `modules/akai-s3k-editor/src/components/keygroups/`.

The implementation follows the established EnvelopeEditor drag interaction pattern from the Roland editor: `onDrag` callbacks for continuous UI updates during pointer movement, `onCommit` callbacks for device writes on mouseup, invisible hit areas larger than visible elements for comfortable targeting, and `getState()` reads to avoid stale closures in event handlers.

A shared coordinate mapping utility will replace the independent note-to-pixel calculations currently used by ZoneOverview and KeyRangeEditor, ensuring visual alignment between the overview and detail views.

## Implementation Phases

### Phase 1: Shared Coordinate System

**Goal:** Extract and share the note-to-pixel coordinate mapping so ZoneOverview and KeyRangeEditor align horizontally.

**Tasks:**
- [x] Extract note-to-pixel coordinate mapping into a shared utility
- [x] Update ZoneOverview to use the shared mapping
- [x] Update KeyRangeEditor to use the shared mapping
- [x] Verify horizontal alignment between the two components

**Acceptance:** Both components use identical note-to-pixel calculations. Viewing the same keygroup, note positions align vertically between ZoneOverview and KeyRangeEditor.

### Phase 2: Draggable ZoneOverview Boundaries

**Goal:** Enable direct manipulation of zone edges in the ZoneOverview.

**Tasks:**
- [x] Investigate S3000XL overlap rules for key ranges and velocity zones
- [x] Create a drag interaction hook following the EnvelopeEditor pattern
- [x] Add drag handles to left/right edges (LONOTE/HINOTE)
- [x] Add drag handles to top/bottom edges (LOVEL/HIVEL)
- [x] Add visual feedback during drag (hover highlights, drag preview)
- [x] Constrain boundaries per S3000XL device behavior

**Acceptance:** Can drag zone edges to change LONOTE/HINOTE/LOVEL/HIVEL. UI updates continuously during drag. Device write occurs on mouseup. Boundaries respect S3000XL constraints.

### Phase 3: Draggable VelocityRangeBar

**Goal:** Enable direct manipulation of velocity zone split points in the VelocityRangeBar.

**Tasks:**
- [x] Add draggable split point handles to VelocityRangeBar
- [x] Reuse drag interaction hook from Phase 2
- [x] Add visual feedback during drag

**Acceptance:** Can drag velocity zone boundaries. Changes reflect in ZoneOverview and numeric inputs. Device write occurs on mouseup.

### Phase 4: Zone Creation via Drag

**Goal:** Enable creating new keygroups by dragging in empty space in the ZoneOverview.

**Tasks:**
- [x] Detect drag gestures in empty ZoneOverview space
- [x] Create new keygroup covering the dragged range
- [x] Determine sensible defaults for new keygroup fields
- [x] Add visual feedback showing zone being created during drag

**Acceptance:** Dragging in empty space creates a new keygroup with the dragged key and velocity range. The new keygroup appears in the UI and is written to the device.

## Dependencies

None. This feature builds on existing ZoneOverview and KeyRangeEditor components within the akai-s3k-editor module.
