# E2E Integration Tests — Workplan

**Feature:** E2E Integration Tests
**PRD:** [prd.md](./prd.md)
**GitHub Issues:** TBD

## Implementation Phases

### Phase 1: OPFS Library Integration

Implement OPFS-based library storage for e2e tests.

**Deliverables:**
- OPFS initialization helper for test setup
- Test fixture population utilities
- Cleanup utilities for test isolation
- Verify MIDI permission grants work reliably

**Approach:**
Tests use Origin Private File System (OPFS) for library storage:
- No permission prompts required
- Real filesystem semantics (same `StorageDirectoryHandle` API)
- Isolated per-origin (no cross-test contamination)
- Initialize via `navigator.storage.getDirectory()`

```typescript
// Example test setup
const opfsRoot = await navigator.storage.getDirectory();
const libraryDir = await opfsRoot.getDirectoryHandle('test-library', { create: true });
await populateTestFixtures(libraryDir);
```

### Phase 2: Test Infrastructure Setup

Extend existing e2e infrastructure for comprehensive testing.

**Deliverables:**
- Test fixtures directory with representative tone/patch/set data
- Helper functions for common test operations
- Hardware detection and graceful skipping
- Playwright config for library-focused tests
- Run script following port 0 pattern

**Files to create:**
```
e2e/
├── fixtures/
│   ├── tones/
│   │   ├── basic-sine.yaml
│   │   ├── basic-sine.wav
│   │   └── ...
│   ├── patches/
│   │   ├── basic-patch.yaml
│   │   └── ...
│   └── sets/
│       ├── test-set/
│       │   ├── set.yaml
│       │   ├── tones/
│       │   └── patches/
│       └── ...
├── helpers/
│   ├── library-helpers.ts
│   ├── hardware-helpers.ts
│   └── navigation-helpers.ts
└── ...
```

### Phase 3: Library Directory Tests

Test directory management operations.

**Tests:**
- Create directory in each category
- Create nested directories
- Rename directory (valid and invalid cases)
- Delete directory (empty and with contents)
- Move directory
- Handle special characters and edge cases

### Phase 4: Library Tone Tests

Test tone CRUD operations.

**Tests:**
- List tones
- Preview tone metadata
- Import tone to device (requires hardware)
- Export tone from device (requires hardware)
- Rename tone
- Delete tone
- Move tone between directories
- Handle corrupted/missing files

### Phase 5: Library Patch Tests

Test patch CRUD operations.

**Tests:**
- List patches
- Preview patch metadata
- Import patch to device (requires hardware)
- Export patch from device (requires hardware)
- Rename patch
- Delete patch
- Move patch between directories
- Handle patches with invalid tone references

### Phase 6: Library Set Tests

Test set operations (highest priority for Library improvements).

**Tests:**
- List sets
- Save device state to set (batch)
- Save device state to set (incremental streaming)
- Load set manifest
- Load individual items from set
- Load complete set to device
- Delete set
- Rename set
- Handle partial/corrupted sets

### Phase 7: Connected Device Tests

Tests requiring actual Roland S-330/S-550 hardware.

**Tests:**
- Device connection flow
- Tone editing with device sync
- Patch editing with device sync
- Sample recording
- Live preview playback
- Multi-device switching

### Phase 8: Integration Workflow Tests

End-to-end workflows combining multiple features.

**Tests:**
- Full backup workflow: Connect → Save set → Verify contents
- Full restore workflow: Connect → Load set → Verify device state
- Sample creation workflow: Record → Edit → Save to library
- Drum kit creation: Import samples → Chop → Create kit → Send to device

### Phase 9: UI Test ID Compliance

Add missing data-testid attributes required by e2e tests.

**Deliverables:**
- Verify TreeView node IDs match expected test selectors
- Add missing-tone-warning to ImportLibraryPatchDialog
- Run all device-library e2e tests to verify compliance

**Tests Fixed:**
- device-library-export.spec.ts (6 tests)
- device-library-import.spec.ts (5 tests)
- hardware-device-sets.spec.ts (3 tests)

## Task Breakdown

1. Implement OPFS initialization and cleanup helpers
2. Create test fixture population utilities
3. Create test fixtures (tones, patches, sets as static files)
4. Create helper functions (library, hardware, navigation)
5. Write directory management tests
6. Write tone operation tests
7. Write patch operation tests
8. Write set operation tests
9. Write connected device tests (hardware-gated)
10. Write integration workflow tests
11. Update CI configuration for hardware detection
12. Document test coverage and gaps

## Dependencies

- Existing e2e infrastructure (port 0 scripts, playwright configs)
- OPFS support in target browsers (Chrome, Edge — already supported)
- Hardware availability for connected tests

## Risk Mitigation

**Risk:** Hardware not available in CI
**Mitigation:** Skip hardware tests gracefully; run them in local development

**Risk:** Flaky tests due to MIDI timing
**Mitigation:** Use longer timeouts; add retry logic; ensure single-worker execution

**Risk:** OPFS quota limits in testing
**Mitigation:** Clean up test data after each test; monitor storage usage
