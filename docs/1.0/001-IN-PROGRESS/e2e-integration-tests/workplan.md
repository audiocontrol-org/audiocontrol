# E2E Integration Tests — Workplan

**Feature:** E2E Integration Tests
**PRD:** [prd.md](./prd.md)
**GitHub Issues:** TBD

## Implementation Phases

### Phase 1: Browser Permission Automation Research

Investigate and implement solutions for automatic browser permission handling.

**Deliverables:**
- Document findings on File System Access API permission automation
- Implement mock library connection for tests that don't need real filesystem
- Verify MIDI permission grants work reliably
- Create test harness that bypasses permission prompts where possible

**Approach Options:**
1. **OPFS (Origin Private File System)** — Use browser-native storage that doesn't require permission prompts
2. **Mock library injection** — Tests inject a mock library implementation via query param or global
3. **CDP permission override** — Use Chrome DevTools Protocol to manipulate permission state
4. **Pre-authenticated context** — Persist browser state with pre-granted permissions

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

## Task Breakdown

1. Research FSAA permission automation options
2. Implement mock library for testing
3. Create test fixtures (tones, patches, sets)
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
- Mock library support in dev harness (from chopper-testing-infra)
- Hardware availability for connected tests

## Risk Mitigation

**Risk:** File System Access API permissions cannot be automated
**Mitigation:** Use OPFS or mock library for most tests; manual testing for real filesystem paths

**Risk:** Hardware not available in CI
**Mitigation:** Skip hardware tests gracefully; run them in local development

**Risk:** Flaky tests due to MIDI timing
**Mitigation:** Use longer timeouts; add retry logic; ensure single-worker execution
