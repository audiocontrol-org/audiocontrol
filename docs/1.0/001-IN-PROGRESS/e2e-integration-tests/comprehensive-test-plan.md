# Comprehensive E2E Test Plan: Roland S-330/S-550 Editor

**Generated:** 2026-03-29
**Version:** 1.0
**Based on:** Application capabilities audit and existing test review

## Document Purpose

This document provides a full-coverage test plan for the roland-sxx0-editor application. Each test is categorized by:
- **Hardware Required** - Whether a physical Roland S-330/S-550 device must be connected
- **Priority** - P0 (critical), P1 (important), P2 (nice-to-have)
- **Status** - ✅ Covered, ⚠️ Partial, ❌ Not Tested

---

## 1. Device Connection Flow

### 1.1 Connection UI (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.1.1 | App initializes with disconnected state | P0 | ✅ | `hardware-connected.spec.ts` |
| 1.1.2 | Connection UI displays port selectors | P0 | ✅ | `hardware-connected.spec.ts` |
| 1.1.3 | Device ID selector shows valid range (1-17) | P1 | ✅ | `app.spec.ts` |
| 1.1.4 | Transport selector shows Web MIDI and HTTP MIDI options | P1 | ❌ | |
| 1.1.5 | Transport selection persists to localStorage | P1 | ❌ | |
| 1.1.6 | Help section expands/collapses | P2 | ✅ | `app.spec.ts` |
| 1.1.7 | Browser compatibility info displays correctly | P2 | ✅ | `app.spec.ts` |

### 1.2 Connection Flow (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.2.1 | Can connect to S-330 via MIDI port selection | P0 | ✅ | `hardware-connected.spec.ts` |
| 1.2.2 | Can connect to S-550 via MIDI port selection | P0 | ⚠️ | Not device-specific tested |
| 1.2.3 | Connection persists across page navigation | P0 | ✅ | `hardware-connected.spec.ts` |
| 1.2.4 | Can disconnect from device | P0 | ✅ | `hardware-connected.spec.ts` |
| 1.2.5 | Can reconnect to same device | P1 | ❌ | |
| 1.2.6 | Handles device timeout during connection | P1 | ❌ | |
| 1.2.7 | Handles device ID mismatch (UI 1 = protocol 0) | P1 | ⚠️ | Implicit in tests |
| 1.2.8 | Handles no MIDI interfaces available | P1 | ❌ | |
| 1.2.9 | Handles device disconnected mid-operation | P1 | ❌ | |
| 1.2.10 | HTTP MIDI transport connects via midi-server | P0 | ✅ | `hardware-device.spec.ts` |
| 1.2.11 | Web MIDI transport requests SysEx permission | P1 | ⚠️ | Manual tests |

---

## 2. Patches Page

### 2.1 Patch List (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.1.1 | Navigates to patches page | P0 | ✅ | `hardware-connected.spec.ts` |
| 2.1.2 | Connection persists after navigation | P0 | ✅ | `hardware-connected.spec.ts` |
| 2.1.3 | Patch list loads patches from device | P0 | ✅ | `hardware-connected.spec.ts` |
| 2.1.4 | Progressive bank loading (8 patches per bank) | P1 | ❌ | |
| 2.1.5 | Click to load unloaded bank | P1 | ❌ | |
| 2.1.6 | Shows loading state during bank fetch | P1 | ❌ | |
| 2.1.7 | Displays empty patches distinctly | P2 | ❌ | |
| 2.1.8 | Selecting patch shows detail view | P1 | ✅ | `hardware-connected.spec.ts` |

### 2.2 Patch Editing (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.2.1 | Edit patch name | P1 | ❌ | |
| 2.2.2 | Patch name syncs to device | P1 | ❌ | |
| 2.2.3 | Edit key mode selection | P1 | ❌ | |
| 2.2.4 | Edit bender range | P1 | ❌ | |
| 2.2.5 | Edit tone zone assignments | P1 | ❌ | |
| 2.2.6 | Configure velocity split zones | P2 | ❌ | |
| 2.2.7 | Configure key split zones | P2 | ❌ | |
| 2.2.8 | Parameter changes persist after reload | P1 | ⚠️ | `dt1-write-test.spec.ts` |

### 2.3 Patch Edge Cases (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.3.1 | Patch with all 8 key zones | P2 | ❌ | |
| 2.3.2 | Patch referencing invalid tone slots | P1 | ❌ | |
| 2.3.3 | Rapid sequential edits (debouncing) | P2 | ❌ | |
| 2.3.4 | Edit while device is modifying same data | P2 | ❌ | |

---

## 3. Tones Page

### 3.1 Tone List (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.1.1 | Navigates to tones page | P0 | ✅ | `hardware-connected.spec.ts` |
| 3.1.2 | Tone list loads tones from device | P0 | ✅ | `hardware-connected.spec.ts` |
| 3.1.3 | Progressive bank loading | P1 | ❌ | |
| 3.1.4 | Click to load unloaded bank | P1 | ❌ | |
| 3.1.5 | Shows loading state during bank fetch | P1 | ❌ | |
| 3.1.6 | Displays empty tones distinctly | P2 | ❌ | |
| 3.1.7 | Selecting tone shows detail view | P1 | ✅ | `hardware-connected.spec.ts` |
| 3.1.8 | Detail view shows parameter controls | P1 | ✅ | `hardware-connected.spec.ts` |

### 3.2 Tone Editing (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.2.1 | Edit tone name | P1 | ❌ | |
| 3.2.2 | Tone name syncs to device | P1 | ❌ | |
| 3.2.3 | Edit sample rate (15kHz/30kHz) | P1 | ❌ | |
| 3.2.4 | Edit original key | P1 | ❌ | |
| 3.2.5 | Edit wave start/end points | P1 | ❌ | |
| 3.2.6 | Edit loop point and mode | P1 | ❌ | |
| 3.2.7 | Edit LFO parameters | P2 | ❌ | |
| 3.2.8 | Edit TVA envelope (8 points) | P1 | ❌ | |
| 3.2.9 | Edit TVF envelope (8 points) | P1 | ❌ | |
| 3.2.10 | Parameter changes persist after reload | P1 | ❌ | |

### 3.3 Sample Operations (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.3.1 | Export sample as WAV download | P1 | ❌ | |
| 3.3.2 | Import sample from WAV file | P1 | ❌ | |
| 3.3.3 | Wave bank selection during import | P1 | ❌ | |
| 3.3.4 | Sample rate conversion accuracy | P2 | ❌ | |
| 3.3.5 | Large WAV file handling | P2 | ❌ | |

### 3.4 Tone Edge Cases (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.4.1 | Tone with no wave data | P1 | ❌ | |
| 3.4.2 | Tone with very short loop (<10 samples) | P2 | ❌ | |
| 3.4.3 | Parameter value boundaries (min/max) | P2 | ❌ | |
| 3.4.4 | Import WAV with unsupported format | P1 | ❌ | |
| 3.4.5 | Import corrupted WAV file | P1 | ❌ | |

---

## 4. Play Page

### 4.1 Multi-mode Configuration (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.1.1 | Navigates to play page | P1 | ❌ | |
| 4.1.2 | Loads function parameters from device | P1 | ❌ | |
| 4.1.3 | Configure MIDI channel per part | P1 | ❌ | |
| 4.1.4 | Configure patch assignment per part | P1 | ❌ | |
| 4.1.5 | Configure output routing per part | P2 | ❌ | |
| 4.1.6 | Adjust part volume | P2 | ❌ | |
| 4.1.7 | Changes sync to device | P1 | ❌ | |

---

## 5. Library - Directory Operations (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.1.1 | Create directory in tones category | P0 | ✅ | `library-directories.spec.ts` |
| 5.1.2 | Create directory in patches category | P0 | ✅ | `library-directories.spec.ts` |
| 5.1.3 | Create nested directories (3+ levels) | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.4 | Rename directory | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.5 | Delete empty directory | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.6 | Delete directory with contents | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.7 | Move directory to new location | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.8 | Prevent moving directory into itself | P1 | ✅ | `library-directories.spec.ts` |
| 5.1.9 | Handle special characters in name | P2 | ✅ | `library-directories.spec.ts` |
| 5.1.10 | Handle Unicode characters | P2 | ✅ | `library-directories.spec.ts` |
| 5.1.11 | Reject empty directory name | P1 | ❌ | |
| 5.1.12 | Handle name collision | P1 | ❌ | |

---

## 6. Library - Tone Operations

### 6.1 Tone CRUD (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.1.1 | List tones in library | P0 | ✅ | `library-tones.spec.ts` |
| 6.1.2 | Read tone metadata (YAML) | P0 | ✅ | `library-tones.spec.ts` |
| 6.1.3 | Create tone (YAML + WAV) | P0 | ✅ | `library-tones.spec.ts` |
| 6.1.4 | Rename tone (both files) | P1 | ✅ | `library-tones.spec.ts` |
| 6.1.5 | Delete tone | P1 | ✅ | `library-tones.spec.ts` |
| 6.1.6 | Move tone between directories | P1 | ✅ | `library-tones.spec.ts` |
| 6.1.7 | Handle orphaned YAML (no WAV) | P2 | ✅ | `library-tones.spec.ts` |
| 6.1.8 | Handle corrupted YAML | P1 | ✅ | `library-tones.spec.ts` |
| 6.1.9 | Handle special characters in name | P2 | ✅ | `library-tones.spec.ts` |

### 6.2 Tone Device Integration (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.2.1 | Tone round trip: import → export → compare | P0 | ✅ | `device-library-roundtrip.spec.ts` |
| 6.2.2 | Tone import with auto-fit slot allocation | P0 | ❌ | Use "Find Best Fit" instead of manual slot selection |
| 6.2.3 | Auto-fit selects non-conflicting tone slot | P1 | ❌ | Verify slot is empty after auto-fit |
| 6.2.4 | Auto-fit selects non-conflicting wave bank/segments | P1 | ❌ | Verify no wave memory collision |
| 6.2.5 | Auto-fit round trip: import with auto-fit → export → compare | P0 | ❌ | Full round trip using auto-fit allocation |
| 6.2.6 | Show progress during import | P1 | ⚠️ | Implicit in round trip tests |
| 6.2.7 | Handle device memory full | P1 | ❌ | |
| 6.2.8 | Handle export of empty tone | P2 | ❌ | |

---

## 7. Library - Patch Operations

### 7.1 Patch CRUD (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 7.1.1 | List patches in library | P0 | ✅ | `library-patches.spec.ts` |
| 7.1.2 | Read patch metadata | P0 | ✅ | `library-patches.spec.ts` |
| 7.1.3 | Create patch | P0 | ✅ | `library-patches.spec.ts` |
| 7.1.4 | Rename patch | P1 | ✅ | `library-patches.spec.ts` |
| 7.1.5 | Delete patch | P1 | ✅ | `library-patches.spec.ts` |
| 7.1.6 | Move patch between directories | P1 | ✅ | `library-patches.spec.ts` |
| 7.1.7 | Extract tone references from patch | P1 | ✅ | `library-patches.spec.ts` |
| 7.1.8 | Handle corrupted YAML | P1 | ✅ | `library-patches.spec.ts` |

### 7.2 Patch Device Integration (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 7.2.1 | Patch round trip: import → export → compare | P0 | ✅ | `device-library-roundtrip.spec.ts` |
| 7.2.2 | Patch import with auto-fit slot allocation | P0 | ❌ | Use "Find Best Fit" for patch + dependent tones |
| 7.2.3 | Auto-fit allocates non-conflicting patch slot + tone slots + wave segments | P1 | ❌ | Verify all allocations are collision-free |
| 7.2.4 | Auto-fit patch round trip: import with auto-fit → export → compare | P0 | ❌ | Full round trip using auto-fit allocation |
| 7.2.5 | Handle patch with missing tone references | P1 | ❌ | |
| 7.2.6 | Handle device memory full | P1 | ❌ | |

---

## 8. Library - Set Operations

### 8.1 Set CRUD (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 8.1.1 | List sets in library | P0 | ✅ | `library-sets.spec.ts` |
| 8.1.2 | Read set manifest | P0 | ✅ | `library-sets.spec.ts` |
| 8.1.3 | Create empty set | P1 | ✅ | `library-sets.spec.ts` |
| 8.1.4 | Create set with tones/patches | P0 | ✅ | `library-sets.spec.ts` |
| 8.1.5 | Rename set | P1 | ✅ | `library-sets.spec.ts` |
| 8.1.6 | Delete set | P1 | ✅ | `library-sets.spec.ts` |
| 8.1.7 | Move set | P1 | ✅ | `library-sets.spec.ts` |
| 8.1.8 | Handle missing manifest | P1 | ✅ | `library-sets.spec.ts` |
| 8.1.9 | Handle corrupted manifest | P1 | ✅ | `library-sets.spec.ts` |

### 8.2 Set Device Integration (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 8.2.1 | Save device state to new set | P0 | ❌ | |
| 8.2.2 | Load complete set to device | P0 | ❌ | |
| 8.2.3 | Load individual tone from set | P1 | ❌ | |
| 8.2.4 | Load individual patch from set | P1 | ❌ | |
| 8.2.5 | Show progress during load | P1 | ❌ | |
| 8.2.6 | Handle device memory insufficient | P1 | ❌ | |
| 8.2.7 | Handle set with missing files | P1 | ❌ | |
| 8.2.8 | Target block selection (S-550) | P1 | ❌ | |

---

## 9. Sample Editor (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 9.1 | Waveform canvas renders | P0 | ✅ | `sample-editor-production.spec.ts` |
| 9.2 | Dialog title shows sample name | P0 | ✅ | `sample-editor-production.spec.ts` |
| 9.3 | Normalize operation | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.4 | Reverse operation | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.5 | Trim silence operation | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.6 | Undo/Redo functionality | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.7 | Zoom controls | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.8 | Split pane mode | P2 | ✅ | `sample-editor-production.spec.ts` |
| 9.9 | Trim handles dragging | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.10 | Close dialog (Escape) | P1 | ✅ | `sample-editor-production.spec.ts` |
| 9.11 | Sample info display | P2 | ✅ | `sample-editor-production.spec.ts` |

---

## 10. Loop Editor (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 10.1 | Waveform canvas renders | P0 | ✅ | `loop-editor-production.spec.ts` |
| 10.2 | Auto-detect loop points | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.3 | Preview button | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.4 | Loop point/end point inputs | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.5 | Playback mode toggles | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.6 | Discontinuity indicator | P2 | ✅ | `loop-editor-production.spec.ts` |
| 10.7 | Crossfade length slider | P2 | ✅ | `loop-editor-production.spec.ts` |
| 10.8 | Keyboard MIDI integration | P2 | ✅ | `loop-editor-production.spec.ts` |

---

## 11. Sample Chopper (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 11.1 | Waveform canvas renders | P0 | ✅ | `sample-chopper-production.spec.ts` |
| 11.2 | Dialog title shows source | P0 | ✅ | `sample-chopper-production.spec.ts` |
| 11.3 | Slice method tabs | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.4 | Fixed slicing | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.5 | Transient detection | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.6 | Zoom controls | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.7 | Fullscreen toggle | P2 | ✅ | `sample-chopper-production.spec.ts` |
| 11.8 | Slice list rendering | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.9 | Arrow key navigation | P2 | ✅ | `sample-chopper-production.spec.ts` |
| 11.10 | Save slices to library | P1 | ❌ | |

---

## 12. Drum Kit Import (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 12.1 | Import v1 format drum kit | P1 | ❌ | |
| 12.2 | Import v2 format drum kit | P1 | ❌ | |
| 12.3 | Automatic MIDI note assignment | P2 | ❌ | |
| 12.4 | Base note configuration | P2 | ❌ | |
| 12.5 | Progress tracking | P2 | ❌ | |
| 12.6 | Handle missing sample files | P1 | ❌ | |

---

## 13. Multi-Device Support

### 13.1 S-330 Specific (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 13.1.1 | Correct patch count (16) | P1 | ⚠️ | Implicit |
| 13.1.2 | Correct tone count (32) | P1 | ⚠️ | Implicit |
| 13.1.3 | Correct wave bank count (2) | P1 | ❌ | |
| 13.1.4 | Correct patch labels (P11-P28) | P2 | ❌ | |
| 13.1.5 | Correct tone labels (T11-T42) | P2 | ❌ | |

### 13.2 S-550 Specific (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 13.2.1 | Correct patch count (32) | P1 | ❌ | |
| 13.2.2 | Correct tone count (64) | P1 | ❌ | |
| 13.2.3 | Correct wave bank count (4) | P1 | ❌ | |
| 13.2.4 | Block selection during import | P1 | ❌ | |
| 13.2.5 | Roman numeral patch labels | P2 | ❌ | |

### 13.3 Cross-Device (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 13.3.1 | Load S-330 set into S-550 | P2 | ❌ | |
| 13.3.2 | Load S-550 set into S-330 (truncation) | P2 | ❌ | |
| 13.3.3 | Switch between devices | P1 | ❌ | |

---

## 14. Error Handling

### 14.1 Connection Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 14.1.1 | Display error when connection fails | P0 | ✅ | `hardware-connected.spec.ts` |
| 14.1.2 | Display timeout error | P1 | ❌ | |
| 14.1.3 | Display SysEx rejection error | P1 | ❌ | |
| 14.1.4 | Recover from device disconnect | P1 | ❌ | |

### 14.2 Data Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 14.2.1 | Handle corrupted device data | P1 | ❌ | |
| 14.2.2 | Handle checksum errors | P1 | ❌ | |
| 14.2.3 | Handle incomplete transfers | P1 | ❌ | |

---

## 15. HTTP MIDI Transport (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 15.1 | midi-server health check | P0 | ✅ | `hardware-device.spec.ts` |
| 15.2 | Port enumeration | P0 | ✅ | `hardware-device.spec.ts` |
| 15.3 | Port discovery | P0 | ✅ | `hardware-device.spec.ts` |
| 15.4 | Port open/close | P0 | ✅ | `hardware-device.spec.ts` |
| 15.5 | SysEx round-trip | P0 | ✅ | `hardware-device.spec.ts` |
| 15.6 | SSE event listening | P0 | ✅ | `hardware-device.spec.ts` |

---

## Coverage Summary

### By Priority

| Priority | Total | Covered | Partial | Not Tested |
|----------|-------|---------|---------|------------|
| P0 | 42 | 29 | 3 | 10 |
| P1 | 89 | 31 | 3 | 55 |
| P2 | 45 | 17 | 0 | 28 |
| **Total** | **176** | **77** | **6** | **93** |

### By Hardware Requirement

| Category | Total | Covered | Not Tested |
|----------|-------|---------|------------|
| No Hardware | 75 | 62 | 13 |
| Hardware Required | 101 | 21 | 80 |

### Critical Gaps (P0 Not Tested)

1. ~~**Device ↔ Library Export** - Export tone/patch from device to library~~ ✅ Covered by `device-library-roundtrip.spec.ts`
2. ~~**Device ↔ Library Import** - Import tone/patch from library to device~~ ✅ Covered by `device-library-roundtrip.spec.ts`
3. **Auto-Fit Slot Allocation** - "Find Best Fit" for tone and patch imports (suspected broken on S-550)
4. **Set Save to Library** - Save device state as set
5. **Set Load from Library** - Load set to device
6. **Multi-device support** - S-550 specific tests

---

## Recommended Next Steps

### Phase 1: Device ↔ Library Integration ✅ COMPLETE
Round-trip tests verify import → export → compare for both tones and patches:
- `device-library-roundtrip.spec.ts` - Atomic round-trip tests (tone + patch)

### Phase 1.5: Auto-Fit Slot Allocation (IN PROGRESS)
Test the "Find Best Fit" feature that auto-allocates non-conflicting slots:
- `device-library-roundtrip.spec.ts` - Add auto-fit variants of tone and patch round trips
- Click "Find Best Fit" instead of manually selecting slot 0
- Select the first (best) option from the BestFitPicker overlay
- Verify the import succeeds with the auto-selected allocation
- Suspected broken on S-550 — these tests will reveal the bug

### Phase 2: Set Operations
- `device-set-save.spec.ts` - Save device to library
- `device-set-load.spec.ts` - Load library to device

### Phase 3: Error Scenarios
- `device-error-recovery.spec.ts` - Connection/data errors

### Phase 4: Multi-Device
- `device-s550.spec.ts` - S-550 specific tests
- `device-cross-device.spec.ts` - Cross-device operations
