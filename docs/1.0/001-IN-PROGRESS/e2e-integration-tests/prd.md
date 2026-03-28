# E2E Integration Tests - Product Requirements Document

**Created:** 2026-03-28
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The roland-sxx0-editor module has limited e2e test coverage. Existing tests validate basic navigation and UI rendering but do not exercise the application while connected to actual Roland S-series hardware. Additionally, browser permission prompts for the Web MIDI API and File System Access API require manual intervention, blocking full automation.

The Library functionality is particularly undertested and known to have issues. There is no automated way to verify that library operations (import, export, directory management, set operations) work correctly with real device data and filesystem access.

## User Stories

- As a developer, I want automated e2e tests that exercise the editor while connected to real hardware so I can catch regressions in device communication flows.
- As a developer, I want browser permission prompts to be handled automatically so tests can run without human intervention.
- As a developer, I want comprehensive coverage of Library functionality (the weakest part of the system) so I can improve it with confidence.
- As a developer, I want a documented catalog of features, scenarios, and corner cases so I know what needs testing and can track coverage.

## Success Criteria

- [ ] E2E tests run against real Roland S-series hardware without manual intervention
- [ ] Browser permissions (Web MIDI API, File System Access API) are granted automatically
- [ ] Library functionality has comprehensive test coverage including corner cases
- [ ] Test infrastructure uses existing port 0 dynamic assignment pattern
- [ ] Feature/scenario/corner case catalog is documented and maintained
- [ ] Tests run in CI with appropriate hardware availability checks

## Scope

### In Scope

- Automated browser permission handling for Web MIDI API and File System Access API
- E2E tests for Library functionality (tones, patches, sets, templates, directories)
- E2E tests for device connection and communication flows
- E2E tests for sample editor, loop editor, and sample chopper (with device)
- Feature/scenario/corner case documentation
- Test fixtures using mock library data where appropriate
- Hardware availability detection and graceful skipping

### Out of Scope

- Visual regression testing
- Performance benchmarking
- Tests for samplers other than S-330/S-550
- CI hardware infrastructure setup (tests skip if hardware unavailable)

## Dependencies and Constraints

### Browser Permission Handling

**Web MIDI API:** Playwright supports granting `midi` and `midi-sysex` permissions via context configuration:
```typescript
use: {
  permissions: ['midi', 'midi-sysex'],
}
```
This is already working in existing tests.

**File System Access API:** Playwright does not support automatic permission grants for the File System Access API (`showDirectoryPicker`, `dirHandle.requestPermission`). This is a [known limitation](https://github.com/microsoft/playwright/issues/18267).

**Solution: Origin Private File System (OPFS)**

E2E tests will use OPFS for library storage. OPFS provides:
- Real filesystem semantics (directories, files, read/write)
- No permission prompts required
- Same `FileSystemDirectoryHandle` API as native filesystem
- Isolated per-origin storage (no cross-test contamination)
- Synchronous access available via `createSyncAccessHandle()` if needed

The application already supports OPFS via the `StorageDirectoryHandle` abstraction in `@audiocontrol/sampler-library`. Tests will initialize the library with OPFS instead of calling `showDirectoryPicker()`.

```typescript
// Test setup: get OPFS root for library
const opfsRoot = await navigator.storage.getDirectory();
const libraryDir = await opfsRoot.getDirectoryHandle('test-library', { create: true });
```

### Hardware Availability

Tests requiring real hardware must:
1. Check for hardware availability before running
2. Skip gracefully with informative message if unavailable
3. Support both local development and CI environments
4. Document required hardware setup

## Open Questions

1. What is the minimum hardware setup required for CI integration?
2. Should we support multiple device types (S-330, S-550) in the same test suite?

## Decisions Made

1. **OPFS for filesystem access** — Tests use Origin Private File System exclusively. This provides real filesystem semantics without permission prompts. Native filesystem testing (via `showDirectoryPicker`) requires manual testing.

---

## Feature/Scenario/Corner Case Catalog

### 1. Device Connection

#### Scenarios
- Connect to S-330 via MIDI input/output selection
- Connect to S-550 via MIDI input/output selection
- Disconnect and reconnect to same device
- Switch between multiple connected devices
- Handle device timeout during connection

#### Corner Cases
- Device ID mismatch (UI shows 1-17, protocol uses 0-16)
- Device disconnected mid-operation
- MIDI interface disconnected mid-operation
- No MIDI interfaces available
- Multiple devices with same ID on different ports

### 2. Library - Directory Management

#### Scenarios
- Create directory in tones category
- Create directory in patches category
- Create directory in drum-kits category
- Create nested directories (up to 3 levels)
- Rename directory
- Delete empty directory
- Delete directory with contents (recursive)
- Move directory to new location

#### Corner Cases
- Create directory with special characters in name (should sanitize)
- Create directory with empty name (should reject)
- Rename root category directory (should reject)
- Delete root category directory (should reject)
- Move directory into itself (should reject)
- Create directory when parent doesn't exist
- Rename to same name (should no-op)
- Name collision during move/rename

### 3. Library - Tone Operations

#### Scenarios
- List all tones in library
- Preview tone metadata (sample rate, loop mode, S-330 params)
- Import tone to device slot
- Export tone from device to library
- Rename individual tone (YAML + WAV files)
- Delete tone from library
- Move tone to different directory
- Import tone with missing WAV file (metadata only)

#### Corner Cases
- Tone with very long name (truncation)
- Tone with special characters in name
- Import tone when device memory is full
- Export tone with no wave data (empty slot)
- Tone YAML parsing errors
- WAV file corruption
- Large WAV file handling (>1MB)
- 12-bit to 16-bit sample conversion accuracy

### 4. Library - Patch Operations

#### Scenarios
- List all patches in library
- Preview patch metadata
- Import patch to device slot
- Export patch from device to library
- Rename patch bundle
- Delete patch from library
- Move patch to different directory
- Import patch with referenced tones not in device

#### Corner Cases
- Patch referencing invalid tone slots
- Patch with all 8 key zones used
- Patch with complex key zone splits
- Patch name collision during import
- Import patch when device memory is full

### 5. Library - Set Operations

#### Scenarios
- List all sets in library
- Save device state to new set
- Save device state incrementally (streaming from device)
- Load set manifest
- Load individual tone from set
- Load individual patch from set
- Load complete set to device
- Delete set
- Rename set

#### Corner Cases
- Save set with no tones (patches only)
- Save set with no patches (tones only)
- Save empty set (should reject or warn)
- Load set with missing tone files
- Load set with missing patch files
- Load set when device memory insufficient
- Save set while device state changes (race condition)
- Very large set (48 tones, 16 patches, maximum data)
- Set name with special characters
- Load set over existing device state (overwrite vs merge)

### 6. Library - Template Operations

#### Scenarios
- List all templates in library
- Apply template to new tone
- Apply template to existing tone
- Save tone as template
- Delete template

#### Corner Cases
- Template with invalid parameters for target device
- Template referencing unavailable features

### 7. Library - Drum Kit Operations

#### Scenarios
- List all drum kits in library
- Preview drum kit configuration
- Import drum kit to device
- Export drum kit from device
- Rename drum kit
- Delete drum kit

#### Corner Cases
- Drum kit with missing sample files
- Drum kit with 16 voices maximum
- Output assignment configuration (Mix vs individual outputs)

### 8. Library - Import/Export

#### Scenarios
- Import tone from external WAV file
- Import multiple samples at once
- Export all library contents as backup
- Import library backup
- Export tone as WAV file
- Export patch as JSON

#### Corner Cases
- Import WAV with unsupported sample rate
- Import WAV with unsupported bit depth
- Import stereo WAV (should convert to mono)
- Import very large WAV (memory limits)
- Import corrupted WAV file
- Export to read-only location

### 9. Library - File System Operations (OPFS)

#### Scenarios
- Initialize OPFS library directory
- Create library category structure (tones, patches, sets, etc.)
- Read/write files within OPFS
- Delete files and directories
- List directory contents
- Handle concurrent access from test setup/teardown

#### Corner Cases
- OPFS storage quota exceeded
- Concurrent writes to same file
- Deep directory nesting
- Very large files (approaching quota)
- Unicode filenames
- Empty directories

**Note:** Native filesystem operations via `showDirectoryPicker` require manual testing since Playwright cannot automate permission grants.

### 10. Sample Editor

#### Scenarios
- Open sample in editor from library
- Edit loop points (start, end, loop start)
- Preview sample playback
- Save edited sample back to library
- Discard changes and close

#### Corner Cases
- Edit sample with very short loop (<10 samples)
- Edit sample with loop at boundaries (start=0, end=length)
- Edit sample while device is disconnected
- Edit sample with corrupted audio data

### 11. Loop Editor

#### Scenarios
- Open tone in loop editor from library
- Edit loop mode (one-shot, forward, forward-back, reverse)
- Edit loop crossfade
- Preview loop playback on device
- Save edited loop parameters

#### Corner Cases
- Loop points outside sample bounds
- Crossfade longer than loop length
- Preview playback timeout

### 12. Sample Chopper

#### Scenarios
- Open sample in chopper from library
- Auto-detect transients
- Manual slice placement
- Preview individual slices
- Save slices as separate tones
- Create drum kit from slices

#### Corner Cases
- Sample with no clear transients
- Very many slices (>32)
- Overlapping slice boundaries
- Zero-length slices
- Slice at exact sample end

### 13. Patches Page (Connected)

#### Scenarios
- View all 16 patches from device
- Edit patch name
- Edit key zone assignments
- Edit tone assignments per zone
- Copy patch to another slot
- Swap patches between slots
- Send patch changes to device

#### Corner Cases
- Edit patch while device is modifying same data
- Rapid sequential edits (debouncing)
- Invalid key zone configuration (overlaps, gaps)

### 14. Tones Page (Connected)

#### Scenarios
- View all 48 tones from device
- Edit tone name
- Edit TVA/TVF parameters
- Edit original key
- Edit output assignment
- Send tone changes to device

#### Corner Cases
- Edit tone with no wave data
- Edit parameters while device is playing tone
- Parameter value boundary conditions (min/max)

### 15. Sampling Page (Connected)

#### Scenarios
- Start new sample recording
- Monitor input levels
- Set sample rate
- Stop recording manually
- Auto-stop at threshold
- Assign recorded sample to tone slot

#### Corner Cases
- Recording exceeds available memory
- Recording interrupted by device error
- Very short recording (<100ms)
- Recording at maximum sample rate (30kHz)

### 16. Multi-Device Support

#### Scenarios
- Switch between S-330 and S-550 device types
- Different memory layouts per device
- Different parameter ranges per device
- Device-specific UI adaptations

#### Corner Cases
- Load S-330 set into S-550 (format conversion)
- Import S-550 tone into S-330 (downgrade/truncate)

---

## Test Infrastructure Requirements

### Port 0 Dynamic Assignment
Continue using existing infrastructure from `scripts/run-sample-editor-e2e.sh`:
- Start vite servers with `--port 0`
- Capture actual ports from stdout
- Export as environment variables
- Pass to Playwright config via `process.env`

### OPFS Library Support
Tests use Origin Private File System for library storage:
- Initialize via `navigator.storage.getDirectory()`
- Pre-populate with test fixtures during setup
- Clean up after each test for isolation
- Same `StorageDirectoryHandle` API as native filesystem

```typescript
// Test fixture setup
async function setupTestLibrary(fixtures: TestFixtures): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await navigator.storage.getDirectory();
  // Clear previous test data
  try { await opfsRoot.removeEntry('test-library', { recursive: true }); } catch {}
  const libraryDir = await opfsRoot.getDirectoryHandle('test-library', { create: true });
  await populateFixtures(libraryDir, fixtures);
  return libraryDir;
}
```

### Hardware Detection
```typescript
async function isHardwareAvailable(): Promise<boolean> {
  // Check for MIDI devices matching S-330/S-550
  // Return false gracefully if unavailable
}
```

### Test Organization
```
e2e/
├── fixtures/             # Test data (tones, patches, sets)
├── helpers/              # Shared test utilities
├── library/              # Library-specific tests
│   ├── directory.spec.ts
│   ├── tones.spec.ts
│   ├── patches.spec.ts
│   ├── sets.spec.ts
│   └── ...
├── connected/            # Tests requiring hardware
│   ├── patches.spec.ts
│   ├── tones.spec.ts
│   └── ...
└── integration/          # Full workflow tests
    ├── save-load-set.spec.ts
    └── ...
```
