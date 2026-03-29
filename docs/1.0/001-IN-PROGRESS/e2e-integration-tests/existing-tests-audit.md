# Existing E2E Tests Audit

**Generated:** 2026-03-29
**Purpose:** Document current test coverage and identify gaps

## Overview

The roland-sxx0-editor module contains 18 E2E test spec files covering:
- UI navigation
- Library management (OPFS)
- Loop/sample editing
- Hardware connectivity

## Test Files by Category

### App Navigation Tests

#### `app.spec.ts`
- **Transport:** None
- **Hardware:** No
- **Coverage:**
  - Page load and title verification
  - Navigation tabs visibility
  - MIDI connection card display
  - Device ID selector
  - Connection help section
  - Navigation to each main section
  - Footer and browser compatibility info
  - Route redirection
- **Status:** Passing

### Library Tests (OPFS)

#### `library-opfs.spec.ts`
- **Transport:** Browser Storage
- **Hardware:** No
- **Coverage:**
  - OPFS availability
  - Library structure initialization
  - File read/write operations
  - Fixture population
  - Directory listing
  - OPFS cleanup between tests
  - Test isolation verification
- **Status:** Passing

#### `library-directories.spec.ts`
- **Transport:** Browser Storage
- **Hardware:** No
- **Coverage:**
  - Directory creation in categories (tones, patches, sets)
  - Nested directory creation
  - Directory deletion (recursive)
  - Directory rename
  - Directory move operations
  - Cycle detection
  - Special characters handling
  - Unicode character handling
  - Deeply nested structures (5+ levels)
- **Status:** Passing

#### `library-tones.spec.ts`
- **Transport:** Browser Storage
- **Hardware:** No (hardware tests skipped)
- **Coverage:**
  - Tone listing
  - Tone metadata reading (YAML parsing)
  - Tone creation (YAML + WAV pair)
  - WAV file generation (sine wave)
  - YAML structure validation
  - Tone rename (both .yaml and .wav)
  - Tone delete
  - Tone move between directories
  - Orphaned file handling
  - Corrupted YAML graceful handling
  - Special characters in tone names
- **Status:** Passing

#### `library-patches.spec.ts`
- **Transport:** Browser Storage
- **Hardware:** No (hardware tests skipped)
- **Coverage:**
  - Patch listing
  - Patch metadata reading
  - Patch creation
  - Multi-tone patch support
  - Patch rename
  - Patch delete
  - Patch move between directories
  - Tone reference extraction
  - Malformed reference handling
  - Corrupted YAML graceful handling
- **Status:** Passing

#### `library-sets.spec.ts`
- **Transport:** Browser Storage
- **Hardware:** No (hardware tests skipped)
- **Coverage:**
  - Set listing
  - Set manifest reading
  - Empty set creation
  - Set with tones and patches
  - Manifest property parsing
  - Set rename
  - Set delete
  - Set move operations
  - Tone/patch content access within sets
  - Missing manifest handling
  - Corrupted manifest handling
- **Status:** Passing

### Sample Editor Tests

#### `loop-editor-production.spec.ts`
- **Transport:** Mock Library
- **Hardware:** No
- **Coverage:**
  - Feature parity between surfaces
  - Waveform canvas rendering
  - Auto-detect loop points
  - Preview button
  - Loop point inputs
  - Playback mode toggles
  - Discontinuity indicator
  - Crossfade length slider
  - Keyboard MIDI integration
- **Status:** Passing

#### `sample-chopper-production.spec.ts`
- **Transport:** Mock Library
- **Hardware:** No
- **Coverage:**
  - Feature parity between surfaces
  - Waveform canvas rendering
  - Dialog title showing source name
  - Slice method tabs (Manual, Transient, Fixed)
  - Fixed slicing
  - Transient detection
  - Zoom controls
  - Fullscreen toggle
  - Slice list rendering
  - Arrow key navigation
  - Save button visibility
- **Status:** Passing

#### `sample-editor-production.spec.ts`
- **Transport:** Mock Library
- **Hardware:** No
- **Coverage:**
  - Feature parity between surfaces
  - Waveform canvas rendering
  - Dialog title
  - Operation buttons (Normalize, Reverse, Trim Silence)
  - Undo/Redo functionality
  - Sample info display
  - Zoom controls
  - Split pane display
  - Trim handles and dragging
  - Different signal types
- **Status:** Passing (23 tests)

### Hardware Tests

#### `hardware-device.spec.ts`
- **Transport:** HTTP MIDI
- **Hardware:** Required
- **Coverage:**
  - midi-server health check
  - Port enumeration
  - Port discovery verification
  - Port open/close operations
  - SysEx message sending (RQD)
  - SSE event listener for responses
  - Response parsing and validation
  - Roland protocol constants
- **Status:** Requires midi-server + device

#### `hardware-connected.spec.ts`
- **Transport:** Web MIDI or HTTP MIDI
- **Hardware:** Required
- **Coverage:**
  - Device connection flow
  - MIDI status tracking via store
  - Connection UI availability
  - Port selection and connection
  - Disconnection
  - Navigation persistence
  - Tone page loading
  - Patch page loading
  - Tone detail view
  - Parameter controls
  - Sample playback triggering (skipped - not implemented)
  - Virtual keyboard interaction (skipped - not implemented)
  - Error handling
- **Status:** 17 passing, 2 skipped

### Protocol Debug Tests

#### `dt1-simple-test.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Optional
- **Purpose:** Test DT1 parameter changes
- **Status:** Debug test

#### `dt1-write-test.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Required
- **Purpose:** Verify DT1 writes persist to hardware
- **Status:** Hardware validation test

#### `fetch-patches.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Optional
- **Purpose:** Debug patch fetching
- **Status:** Debug test

#### `protocol-debug.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Optional
- **Purpose:** S-330 RJC investigation
- **Status:** Debug test

#### `rq1-test.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Optional
- **Purpose:** RQ1 vs RQD command testing
- **Status:** Debug test

#### `standalone-debug.spec.ts`
- **Transport:** Web MIDI
- **Hardware:** Optional
- **Purpose:** Protocol debugging without navigation
- **Status:** Debug test

#### `diagnose.spec.ts`
- **Transport:** None
- **Hardware:** No
- **Purpose:** MIDI diagnostics
- **Status:** Debug test

---

## Test Infrastructure

### Configurations
| Config | Purpose |
|--------|---------|
| `playwright.config.ts` | Default browser tests |
| `playwright.loop-editor.config.ts` | Loop editor focused |
| `playwright.sample-chopper.config.ts` | Sample chopper focused |
| `playwright.sample-editor.config.ts` | Sample editor focused |
| `playwright.visual.config.ts` | Visual regression tests |
| `playwright.hardware.config.ts` | Hardware tests with heartbeat |
| `playwright.library.config.ts` | Library OPFS tests |
| `playwright.http-midi.config.ts` | HTTP MIDI transport tests |

### Test Scripts
| Script | Purpose |
|--------|---------|
| `run-hardware-e2e.sh` | Web MIDI hardware tests |
| `run-http-midi-e2e.sh` | HTTP MIDI hardware tests (automated) |
| `run-loop-editor-e2e.sh` | Loop editor tests |
| `run-sample-chopper-e2e.sh` | Sample chopper tests |
| `run-sample-editor-e2e.sh` | Sample editor tests |
| `run-library-e2e.sh` | Library OPFS tests |

### Test Helpers
- `e2e/helpers/opfs-helpers.ts` - Browser-based OPFS operations
- `e2e/reporters/heartbeat-reporter.ts` - Watchdog for stuck tests

### Test Fixtures
- `fixtures/tones/basic-sine.yaml` + `.wav`
- `fixtures/patches/basic-patch.yaml`
- `fixtures/sets/test-set/` (manifest + content)

---

## Coverage Summary by Category

| Category | Test Count | Hardware | Status |
|----------|------------|----------|--------|
| App Navigation | 13 | No | Passing |
| Loop Editor | 12 | No | Passing |
| Sample Chopper | 7 | No | Passing |
| Sample Editor | 23 | No | Passing |
| Library - OPFS | 8 | No | Passing |
| Library - Directories | 11 | No | Passing |
| Library - Tones | 12 | No | Passing |
| Library - Patches | 12 | No | Passing |
| Library - Sets | 16 | No | Passing |
| Hardware - Device | 4 | Required | Hardware |
| Hardware - Connected | 11 | Required | Hardware |
| Protocol Debug | ~10 | Optional | Debug |

---

## Identified Gaps

### Not Tested
1. **Device ↔ Library Integration**
   - Export tone from device to library
   - Import tone from library to device
   - Export patch from device to library
   - Import patch from library to device
   - Export/import complete sets

2. **Multi-Device Support**
   - S-550 specific features
   - Device switching
   - Cross-device format conversion

3. **Play Page**
   - Part configuration
   - MIDI channel routing
   - Output assignment

4. **Sample Recording**
   - Input level monitoring
   - Sample rate selection
   - Recording workflow

5. **Error Scenarios**
   - Device timeout recovery
   - MIDI disconnection handling
   - Memory full conditions
   - Corrupted device data

6. **Performance**
   - Large library operations
   - Bulk import/export
   - Memory usage

7. **Cross-Browser**
   - Firefox compatibility
   - Safari compatibility
