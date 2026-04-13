# Draggable Zone Editing - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD
**GitHub Issues:**
- TBD (to be filled by /feature-issues)

## Technical Approach

All changes are scoped to `modules/akai-s3k-editor/src/components/keygroups/`.

The implementation follows the established EnvelopeEditor drag interaction pattern from the Roland editor: `onDrag` callbacks for continuous UI updates during pointer movement, `onCommit` callbacks for device writes on mouseup, invisible hit areas larger than visible elements for comfortable targeting, and `getState()` reads to avoid stale closures in event handlers.

A shared coordinate mapping utility will replace the independent note-to-pixel calculations currently used by ZoneOverview and KeyRangeEditor, ensuring visual alignment between the overview and detail views.

## Implementation Phases

### Phase 1: Shared Coordinate System

**Goal:** Extract and share the note-to-pixel coordinate mapping so ZoneOverview and KeyRangeEditor align horizontally.

**Tasks:**
- [ ] Extract note-to-pixel coordinate mapping into a shared utility
- [ ] Update ZoneOverview to use the shared mapping
- [ ] Update KeyRangeEditor to use the shared mapping
- [ ] Verify horizontal alignment between the two components

**Acceptance:** Both components use identical note-to-pixel calculations. Viewing the same keygroup, note positions align vertically between ZoneOverview and KeyRangeEditor.

### Phase 2: Draggable ZoneOverview Boundaries

**Goal:** Enable direct manipulation of zone edges in the ZoneOverview.

**Tasks:**
- [ ] Investigate S3000XL overlap rules for key ranges and velocity zones
- [ ] Create a drag interaction hook following the EnvelopeEditor pattern
- [ ] Add drag handles to left/right edges (LONOTE/HINOTE)
- [ ] Add drag handles to top/bottom edges (LOVEL/HIVEL)
- [ ] Add visual feedback during drag (hover highlights, drag preview)
- [ ] Constrain boundaries per S3000XL device behavior

**Acceptance:** Can drag zone edges to change LONOTE/HINOTE/LOVEL/HIVEL. UI updates continuously during drag. Device write occurs on mouseup. Boundaries respect S3000XL constraints.

### Phase 3: Draggable VelocityRangeBar

**Goal:** Enable direct manipulation of velocity zone split points in the VelocityRangeBar.

**Tasks:**
- [ ] Add draggable split point handles to VelocityRangeBar
- [ ] Reuse drag interaction hook from Phase 2
- [ ] Add visual feedback during drag

**Acceptance:** Can drag velocity zone boundaries. Changes reflect in ZoneOverview and numeric inputs. Device write occurs on mouseup.

### Phase 4: Zone Creation via Drag

**Goal:** Enable creating new keygroups by dragging in empty space in the ZoneOverview.

**Tasks:**
- [ ] Detect drag gestures in empty ZoneOverview space
- [ ] Create new keygroup covering the dragged range
- [ ] Determine sensible defaults for new keygroup fields
- [ ] Add visual feedback showing zone being created during drag

**Acceptance:** Dragging in empty space creates a new keygroup with the dragged key and velocity range. The new keygroup appears in the UI and is written to the device.

## Dependencies

None. This feature builds on existing ZoneOverview and KeyRangeEditor components within the akai-s3k-editor module.
