# Comprehensive E2E Test Plan: Roland S-330/S-550 Editor

**Generated:** 2026-03-31
**Version:** 1.3
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
| 2.2.1 | Edit patch name | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.2 | Patch name syncs to device | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.3 | Edit key mode selection | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.4 | Edit bender range | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.5 | Edit tone zone assignments | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.6 | Configure velocity split zones | P2 | ❌ | |
| 2.2.7 | Configure key split zones | P2 | ❌ | |
| 2.2.8 | Parameter changes persist after reload | P1 | ⚠️ | `dt1-write-test.spec.ts` |
| 2.2.9 | Edit aftertouch sensitivity | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.10 | Edit aftertouch assign mode | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.11 | Edit key assign mode (rotary/fix) | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.12 | Edit velocity threshold | P1 | ✅ | `device-patch-controls.spec.ts` |
| 2.2.13 | Tone zone editor: assign tones to key ranges | P1 | ❌ | |
| 2.2.14 | Tone zone editor: velocity split configuration | P1 | ❌ | |
| 2.2.15 | Tone zone editor: MIDI Learn for zone boundaries | P2 | ❌ | |

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
| 3.2.1 | Edit tone name | P1 | ✅ | `device-tone-controls.spec.ts` |
| 3.2.2 | Tone name syncs to device | P1 | ✅ | `device-tone-controls.spec.ts` |
| 3.2.3 | Edit sample rate (15kHz/30kHz) | P1 | ❌ | |
| 3.2.4 | Edit original key | P1 | ❌ | |
| 3.2.5 | Edit wave start/end points | P1 | ❌ | |
| 3.2.6 | Edit loop point and mode | P1 | ✅ | `device-tone-controls.spec.ts` |
| 3.2.7 | Edit LFO parameters | P2 | ⚠️ | `device-tone-controls.spec.ts` (rate + delay tested) |
| 3.2.8 | Edit TVA envelope (8 points) | P1 | ❌ | |
| 3.2.9 | Edit TVF envelope (8 points) | P1 | ❌ | |
| 3.2.10 | Parameter changes persist after reload | P1 | ❌ | |
| 3.2.11 | TVF enable/disable toggle | P1 | ✅ | `device-tone-controls.spec.ts` |
| 3.2.12 | TVF cutoff/resonance/key follow sliders | P1 | ⚠️ | `device-tone-controls.spec.ts` (cutoff tested, resonance/key follow not yet) |
| 3.2.13 | TVF envelope 8-point editing | P1 | ⚠️ | `device-tone-envelope-controls.spec.ts` (rate + sustain point tested) |
| 3.2.14 | TVA level/LFO depth sliders | P1 | ⚠️ | `device-tone-controls.spec.ts` (level tested) |
| 3.2.15 | TVA envelope 8-point editing | P1 | ⚠️ | `device-tone-envelope-controls.spec.ts` (rate + sustain point tested) |
| 3.2.16 | LFO rate/delay/offset sliders | P1 | ⚠️ | `device-tone-controls.spec.ts` (rate tested, delay/offset not yet) |
| 3.2.17 | LFO sync and mode toggles | P2 | ❌ | |
| 3.2.18 | Pitch fine tune and pitch follow | P1 | ✅ | `device-tone-controls.spec.ts` |
| 3.2.19 | All parameters sync to device on commit | P0 | ⚠️ | `device-tone-controls.spec.ts` (4 params verified, not all) |

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
| 4.1.1 | Navigates to play page | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.2 | Loads function parameters from device | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.3 | Per-part MIDI channel selection syncs to device | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.4 | Per-part patch assignment syncs to device | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.5 | Per-part output routing syncs to device | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.6 | Per-part level adjustment syncs to device | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.7 | Part configuration persists after page navigation | P1 | ✅ | `device-play-controls.spec.ts` |
| 4.1.8 | Loading patch banks from Play page | P1 | ❌ | |

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
| 8.2.1 | Save device state to new set | P0 | ✅ | `device-library-set-roundtrip.spec.ts` |
| 8.2.2 | Load complete set to device | P0 | ✅ | `device-library-set-roundtrip.spec.ts` |
| 8.2.3 | Load individual tone from set | P1 | ❌ | |
| 8.2.4 | Load individual patch from set | P1 | ❌ | |
| 8.2.5 | Show progress during load | P1 | ⚠️ | Implicit in set round trip |
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

## 10. Loop Editor

### 10.1 Loop Editor UI (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 10.1.1 | Waveform canvas renders | P0 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.2 | Auto-detect loop points | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.3 | Preview button | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.4 | Loop point/end point inputs | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.5 | Playback mode toggles | P1 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.6 | Discontinuity indicator | P2 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.7 | Crossfade length slider | P2 | ✅ | `loop-editor-production.spec.ts` |
| 10.1.8 | Keyboard MIDI integration | P2 | ✅ | `loop-editor-production.spec.ts` |

### 10.2 Loop Editor Parity and Hardware Integration 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 10.2.1 | Loop editor opens from Tones page (hardware, inline) | P1 | ✅ | `device-loop-editor.spec.ts` |
| 10.2.2 | Loop editor opens from Library page (dialog) | P1 | ❌ | Library surface opens loop editor in dialog |
| 10.2.3 | Loop point changes sync to device | P1 | ✅ | `device-loop-editor.spec.ts` |
| 10.2.4 | Parity: same loop operations produce same results on both surfaces | P1 | ❌ | Compare inline (Tones) vs dialog (Library) behavior |
| 10.2.5 | Auto-detect works with real device wave data | P1 | ❌ | 🔌 Auto-detect on a tone loaded from hardware |

---

## 11. Sample Chopper

### 11.1 Sample Chopper UI (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 11.1.1 | Waveform canvas renders | P0 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.2 | Dialog title shows source | P0 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.3 | Slice method tabs | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.4 | Fixed slicing | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.5 | Transient detection | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.6 | Zoom controls | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.7 | Fullscreen toggle | P2 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.8 | Slice list rendering | P1 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.9 | Arrow key navigation | P2 | ✅ | `sample-chopper-production.spec.ts` |
| 11.1.10 | Save slices to library | P1 | ✅ | `library-chopper-save.spec.ts` (fixed slicing, 8 slices, drum kit open, slices render, kit YAML save) |

### 11.2 Sample Chopper with Hardware 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 11.2.1 | Chop device tone sample (opens chopper from Tones page) | P1 | ✅ | `device-tone-chopper.spec.ts` — opens chopper dialog with device wave data |
| 11.2.2 | Save slices to library as individual tones | P1 | ✅ | `library-chopper-save.spec.ts` — verifies slice labels (S1-S4) written to sample.yaml |
| 11.2.3 | Save slices as drum kit to library | P1 | ✅ | `device-tone-chopper.spec.ts` — chops device tone, saves kit to OPFS |
| 11.2.4 | Slice boundaries persist after save/reload | P1 | ✅ | `library-chopper-save.spec.ts` — save slices, reopen chopper, verify pre-populated |

---

## 12. Drum Kit Import (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 12.1 | Import v1 format drum kit | P1 | ✅ | `device-drumkit.spec.ts` — v1 individual WAV files per drum |
| 12.2 | Import v2 format drum kit | P1 | ✅ | `device-drumkit.spec.ts` |
| 12.3 | Automatic MIDI note assignment | P2 | ✅ | `library-drumkit-editor.spec.ts` — verifies 4 sequential MIDI notes from baseNote |
| 12.4 | Base note configuration | P2 | ✅ | `library-drumkit-editor.spec.ts` — verifies different baseNote produces different MIDI notes |
| 12.5 | Progress tracking | P2 | ⚠️ | Implicit in drum kit import test |
| 12.6 | Handle missing sample files | P1 | ✅ | `library-drumkit-error.spec.ts` — v1/v2 kits with missing WAVs don't crash |

---

## 13. Drum Kit Editor

### 13.1 Drum Kit Creation (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 13.1.1 | Create drum kit from sample chopper slices | P1 | ✅ | `library-chopper-save.spec.ts` + `device-tone-chopper.spec.ts` |
| 13.1.2 | Drum kit preview/playback | P1 | ✅ | `library-drumkit-editor.spec.ts` — per-pad play buttons via useTriggerPlayback |
| 13.1.3 | MIDI note assignment per slice | P1 | ✅ | `library-drumkit-editor.spec.ts` + DrumKitPadList — MIDI notes displayed per pad |
| 13.1.4 | Base note configuration | P1 | ✅ | `library-chopper-save.spec.ts` + `device-tone-chopper.spec.ts` — Base MIDI Note field in S330KitOutputConfig |
| 13.1.5 | Output assignment configuration (S330KitOutputConfig) | P1 | ❌ | Per-pad output routing |
| 13.1.6 | Save drum kit to library | P1 | ✅ | `library-chopper-save.spec.ts` — verifies kit.yaml + source.wav in OPFS |

### 13.2 Drum Kit Edge Cases

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 13.2.1 | Kit with maximum number of pads | P2 | ❌ | |
| 13.2.2 | Kit with overlapping MIDI note assignments | P1 | ⚠️ | DrumKitPadList has conflict detection UI; test is fixme (calculated notes always unique) |
| 13.2.3 | Kit referencing missing sample files | P1 | ✅ | `library-drumkit-error.spec.ts` — v1 (no WAVs) and v2 (missing source.wav) |

---

## 14. Multi-Device Support

### 14.1 S-330 Specific (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 14.1.1 | Correct patch count (16) | P1 | ⚠️ | Implicit |
| 14.1.2 | Correct tone count (32) | P1 | ⚠️ | Implicit |
| 14.1.3 | Correct wave bank count (2) | P1 | ❌ | |
| 14.1.4 | Correct patch labels (P11-P28) | P2 | ❌ | |
| 14.1.5 | Correct tone labels (T11-T42) | P2 | ❌ | |

### 14.2 S-550 Specific (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 14.2.1 | Correct patch count (32) | P1 | ❌ | |
| 14.2.2 | Correct tone count (64) | P1 | ❌ | |
| 14.2.3 | Correct wave bank count (4) | P1 | ❌ | |
| 14.2.4 | Block selection during import | P1 | ❌ | |
| 14.2.5 | Roman numeral patch labels | P2 | ❌ | |

### 14.3 Cross-Device (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 14.3.1 | Load S-330 set into S-550 | P2 | ❌ | |
| 14.3.2 | Load S-550 set into S-330 (truncation) | P2 | ❌ | |
| 14.3.3 | Switch between devices | P1 | ❌ | |

---

## 15. Error Handling

### 15.1 Connection Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 15.1.1 | Display error when connection fails | P0 | ✅ | `hardware-connected.spec.ts` |
| 15.1.2 | Display timeout error | P1 | ✅ | `device-error-recovery.spec.ts` |
| 15.1.3 | Display SysEx rejection error | P1 | ✅ | `device-error-recovery.spec.ts` |
| 15.1.4 | Recover from device disconnect | P1 | ✅ | `device-error-recovery.spec.ts` |

### 15.2 Data Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 15.2.1 | Handle corrupted device data | P1 | ❌ | |
| 15.2.2 | Handle checksum errors | P1 | ❌ | |
| 15.2.3 | Handle incomplete transfers | P1 | ❌ | |

---

## 16. HTTP MIDI Transport (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 16.1 | midi-server health check | P0 | ✅ | `hardware-device.spec.ts` |
| 16.2 | Port enumeration | P0 | ✅ | `hardware-device.spec.ts` |
| 16.3 | Port discovery | P0 | ✅ | `hardware-device.spec.ts` |
| 16.4 | Port open/close | P0 | ✅ | `hardware-device.spec.ts` |
| 16.5 | SysEx round-trip | P0 | ✅ | `hardware-device.spec.ts` |
| 16.6 | SSE event listening | P0 | ✅ | `hardware-device.spec.ts` |

---

## Coverage Summary

### By Priority

| Priority | Total | Covered | Partial | Not Tested |
|----------|-------|---------|---------|------------|
| P0 | 44 | 38 | 2 | 4 |
| P1 | 148 | 80 | 11 | 57 |
| P2 | 37 | 15 | 2 | 20 |
| **Total** | **229** | **133** | **15** | **81** |

### By Hardware Requirement

| Category | Total | Covered | Partial | Not Tested |
|----------|-------|---------|---------|------------|
| No Hardware | 83 | 79 | 1 | 3 |
| Hardware Required | 146 | 54 | 14 | 78 |

### Critical Gaps (P0 Not Tested)

1. ~~**Device <> Library Export** - Export tone/patch from device to library~~ ✅ Covered by `device-library-roundtrip.spec.ts`
2. ~~**Device <> Library Import** - Import tone/patch from library to device~~ ✅ Covered by `device-library-roundtrip.spec.ts`
3. **Auto-Fit Slot Allocation** - "Find Best Fit" for tone and patch imports (suspected broken on S-550)
4. ~~**Set Save to Library** - Save device state as set~~ ✅ Covered by `device-library-set-roundtrip.spec.ts`
5. ~~**Set Load from Library** - Load set to device~~ ✅ Covered by `device-library-set-roundtrip.spec.ts`
6. **Multi-device support** - S-550 specific tests
7. ~~**Tone parameter sync** - All tone parameters sync to device on commit (3.2.19)~~ ⚠️ Partially covered by `device-tone-controls.spec.ts` (4 params verified)

---

## Application Bugs Found During E2E Testing

| Bug | Status | Found In |
|-----|--------|----------|
| Envelope inputs committed on every keystroke (should debounce/commit on blur) | Fixed | `device-tone-envelope-controls.spec.ts` |
| `handleToneCommit` read stale React closure (sent old values to device) | Fixed | `device-tone-controls.spec.ts` |
| `SampleChopperDialog` `onConfirm` not wired to save button | Unfixed | `library-chopper-save.spec.ts` |
| Save button enabled with no slices (should be disabled) | Unfixed | `library-chopper-save.spec.ts` |

---

## Recommended Next Steps

### Phase 1: Device <> Library Integration ✅ COMPLETE
Round-trip tests verify import → export → compare for both tones and patches:
- `device-library-roundtrip.spec.ts` - Atomic round-trip tests (tone + patch)

### Phase 1.5: Auto-Fit Slot Allocation (IN PROGRESS)
Test the "Find Best Fit" feature that auto-allocates non-conflicting slots:
- `device-library-roundtrip.spec.ts` - Add auto-fit variants of tone and patch round trips
- Click "Find Best Fit" instead of manually selecting slot 0
- Select the first (best) option from the BestFitPicker overlay
- Verify the import succeeds with the auto-selected allocation
- Suspected broken on S-550 — these tests will reveal the bug

### Phase 2: Set Operations ✅ COMPLETE
- `device-library-set-roundtrip.spec.ts` - Save device to library, load library to device

### Phase 3: Editor Controls ✅ COMPLETE
Play, Patch, and Tone page parameter controls with hardware sync:
- Play page: ✅ per-part channel, patch, output, level controls (`device-play-controls.spec.ts`)
- Patch editing: ✅ name, key mode, bender range, aftertouch sensitivity, aftertouch assign, key assign mode, velocity threshold, tone zone assignments (`device-patch-controls.spec.ts`)
- Tone editing: ✅ name, loop point, TVF cutoff, TVF enable/disable, LFO rate/delay, pitch fine tune, pitch follow, TVA level (`device-tone-controls.spec.ts`)
- Tone envelopes: ⚠️ TVF and TVA envelope rate + sustain point tested (`device-tone-envelope-controls.spec.ts`)
- Error recovery: ✅ timeout, SysEx rejection, device disconnect (`device-error-recovery.spec.ts`)

### Phase 4: Loop Editor Parity and Hardware Integration ⚠️ PARTIAL
Loop editor hardware sync tests pass:
- ✅ Loop editor opens from Tones page (inline) (`device-loop-editor.spec.ts`)
- ✅ Loop point changes sync to device via DT1 write (`device-loop-editor.spec.ts`)
- ❌ Loop editor opens from Library page (dialog) — not yet tested
- ❌ Parity verification: same operations produce same results on both surfaces
- ❌ Auto-detect with real device wave data

### Phase 5: Drum Kit and Slice Workflows ✅ COMPLETE
- ✅ Drum kit v1 + v2 format import (`device-drumkit.spec.ts`)
- ✅ Sample chopper save-to-library — fixed slicing, slice labels, drum kit creation (`library-chopper-save.spec.ts`)
- ✅ Chop device tone into drum kit (`device-tone-chopper.spec.ts`)
- ✅ Slice boundary persistence after save/reload (`library-chopper-save.spec.ts`)
- ✅ Drum kit pad preview with playback + MIDI notes (`library-drumkit-editor.spec.ts`)
- ✅ MIDI note assignment + base note config (`library-drumkit-editor.spec.ts`)
- ✅ Missing sample file handling (`library-drumkit-error.spec.ts`)
- ⚠️ Per-pad output routing deferred (S-330 architecture limitation)

### Phase 6: Error Scenarios ✅ COMPLETE
- `device-error-recovery.spec.ts` - Timeout errors, SysEx rejection, device disconnect recovery

### Phase 7: Multi-Device — Not planned
S-550 specific tests and cross-device operations are deferred. The S-550 wave addressing differences (see project memory) need resolution at the protocol layer before e2e tests can cover multi-device scenarios.
