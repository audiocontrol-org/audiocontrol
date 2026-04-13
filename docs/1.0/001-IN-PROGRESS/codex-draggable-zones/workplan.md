# Codex Draggable Zones - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD

| Item | Link |
|------|------|
| Parent | [#257](https://github.com/audiocontrol-org/audiocontrol/issues/257) |
| Phase 1 | [#258](https://github.com/audiocontrol-org/audiocontrol/issues/258) |
| Phase 2 | [#261](https://github.com/audiocontrol-org/audiocontrol/issues/261) |
| Phase 3 | [#260](https://github.com/audiocontrol-org/audiocontrol/issues/260) |
| Phase 4 | [#259](https://github.com/audiocontrol-org/audiocontrol/issues/259) |

## Comparison Context

- Parallel Claude-track feature request: [#252](https://github.com/audiocontrol-org/audiocontrol/issues/252)

## Technical Approach

Keep the work scoped to `modules/akai-s3k-editor/src/components/keygroups/` unless code inspection proves a shared utility belongs elsewhere.

This feature extends the current Akai S3000XL keygroup editing surfaces with direct manipulation. The implementation should replace duplicated coordinate logic in `ZoneOverview` and `KeyRangeEditor` with a shared mapping utility, introduce a drag interaction model that supports continuous local updates with commit on pointer release, and centralize constraint handling so S3000XL rules are enforced consistently.

**Key design decisions:**

1. **Shared coordinate model** — `ZoneOverview` and `KeyRangeEditor` should compute note positions from the same utility.
2. **Direct manipulation augments numeric editing** — drag is additive, not a replacement.
3. **Commit on release** — drag updates local UI continuously and defers device writes until pointer release.
4. **Constraints are verified, not guessed** — overlap and creation defaults should come from inspected code, notes, or hardware evidence.

## Likely Files

### Modified Files

| File | Change |
|------|--------|
| `modules/akai-s3k-editor/src/components/keygroups/ZoneOverview.tsx` | Add shared coordinate mapping, drag handles, previews, and zone-creation gesture |
| `modules/akai-s3k-editor/src/components/keygroups/KeyRangeEditor.tsx` | Consume shared coordinate mapping |
| `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx` | Add draggable split points and synchronized preview behavior |
| `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx` | Integrate drag-driven updates with numeric editing |
| `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx` | Wire any necessary commit or state plumbing |
| `modules/akai-s3k-editor/src/components/keygroups/*.test.tsx` | Add coverage for coordinate, drag, and creation behavior |

### Likely New Files

| File | Purpose |
|------|---------|
| `modules/akai-s3k-editor/src/components/keygroups/note-coordinate.ts` | Shared note mapping utility |
| `modules/akai-s3k-editor/src/components/keygroups/useZoneDrag.ts` | Shared drag interaction helper |
| `modules/akai-s3k-editor/src/components/keygroups/zone-constraints.ts` | Centralized clamping and overlap rules |
| `modules/akai-s3k-editor/src/pages/harness/DraggableZonesHarnessPage.tsx` | Browser-only feature harness for isolated UI iteration |
| `modules/akai-s3k-editor/src/pages/harness/draggable-zone-fixtures.ts` | Realistic local fixtures for harness scenarios |
| `modules/akai-s3k-editor/e2e/library-draggable-zones-harness.spec.ts` | Playwright coverage for the isolated browser harness |

## Implementation Phases

### Phase 1: Shared Coordinate System

**Goal:** Align `ZoneOverview` and `KeyRangeEditor` horizontally using one note mapping model.

**Tasks:**
- [x] Extract shared note coordinate logic from the existing components
- [x] Update `ZoneOverview` to use the shared mapping
- [x] Update `KeyRangeEditor` to use the shared mapping
- [x] Add tests proving alignment behavior
- [x] Add a browser-only harness route and fixtures for isolated UI iteration
- [x] Add a Playwright harness spec that exercises the feature without hardware

**Acceptance:** Both components use identical note-position calculations, and the same note values line up visually between the overview and detail editor.

### Phase 2: Draggable ZoneOverview Boundaries

**Goal:** Make note and velocity bounds directly editable in the overview.

**Tasks:**
- [x] Verify S3000XL boundary and overlap rules before encoding them
- [x] Add drag handles and hit areas for left, right, top, and bottom zone edges
- [x] Add continuous drag preview state and commit-on-release behavior
- [x] Add tests for clamping, selection behavior, and field commits

**Acceptance:** Users can drag zone edges to change `LONOTE`, `HINOTE`, `LOVEL`, and `HIVEL`, with live UI updates and commit on release.

### Phase 3: Draggable VelocityRangeBar

**Goal:** Let users reshape velocity-layer boundaries directly in the velocity bar.

**Tasks:**
- [x] Add draggable split-point handles to `VelocityRangeBar`
- [x] Reuse the drag interaction model from Phase 2
- [x] Keep `VelocityRangeBar`, numeric inputs, and `ZoneOverview` synchronized
- [x] Add tests for boundary movement and adjacent-zone interactions

**Acceptance:** Users can drag velocity split points, with changes reflected consistently across the editor and committed on release.

### Phase 4: Zone Creation via Drag

**Goal:** Let users create keygroups spatially from empty overview space.

**Tasks:**
- [x] Detect drag initiation in unoccupied `ZoneOverview` regions
- [x] Show preview feedback for the pending new zone
- [x] Create the keygroup with sensible verified defaults on commit
- [x] Add tests for creation gesture handling and resulting editor state

**Acceptance:** Dragging in empty overview space creates a new keygroup covering the dragged note and velocity range, and the new keygroup is reflected in the UI and committed correctly.

## Verification

- Relevant Akai keygroup component tests and browser harness tests pass
- New unit tests cover coordinate mapping, drag constraints, and creation paths
- Manual verification confirms that direct manipulation and numeric inputs stay synchronized
- Any device-rule assumptions are documented with evidence

## Session Status

- Phase 1 is complete.
- Phase 2 is complete: ZoneOverview boundaries are draggable, overlapping keyspans are allowed, and keygroup note fields now clamp to the documented S3000XL `21-127` range.
- Phase 3 is complete: `VelocityRangeBar` split handles now drive adjacent velocity-zone updates and stay synchronized with numeric editing and ZoneOverview.
- Phase 4 is complete: empty-space drags in `ZoneOverview` now preview and create new keygroups in both the harness and the real page flow.
- Feature implementation is complete pending ship/merge workflow.
- The browser-only harness is now available for rapid UI iteration before hardware or transport e2e.
