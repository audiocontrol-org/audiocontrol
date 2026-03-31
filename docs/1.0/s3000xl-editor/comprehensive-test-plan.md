# Comprehensive E2E Test Plan: Akai S3000XL Editor

**Generated:** 2026-03-31
**Version:** 1.0
**Based on:** Application capabilities audit and existing test review

## Document Purpose

This document provides a full-coverage test plan for the akai-s3k-editor application. Each test is categorized by:
- **Hardware Required** - Whether a physical Akai S3000XL device must be connected
- **Priority** - P0 (critical), P1 (important), P2 (nice-to-have)
- **Status** - ✅ Covered, ⚠️ Partial, ❌ Not Tested

---

## 1. Device Connection Flow

### 1.1 Connection UI (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.1.1 | App initializes with disconnected state | P0 | ✅ | `device-connected.spec.ts` |
| 1.1.2 | Connection UI is available | P0 | ✅ | `device-connected.spec.ts` |
| 1.1.3 | Device ID selector shows valid range (0-127) | P1 | ❌ | |
| 1.1.4 | Transport selector shows Web MIDI and HTTP MIDI options | P1 | ❌ | |
| 1.1.5 | Transport selection persists to localStorage | P1 | ❌ | |
| 1.1.6 | MIDI Input/Output port selectors display | P1 | ❌ | |
| 1.1.7 | Device ID help text references S3000XL Exclusive Channel | P2 | ❌ | |
| 1.1.8 | Secure context warning displays on non-HTTPS | P2 | ❌ | |

### 1.2 Connection Flow (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.2.1 | Can connect to S3000XL via MIDI port selection | P0 | ✅ | `device-connected.spec.ts` |
| 1.2.2 | Connection persists across page navigation | P0 | ✅ | `device-connected.spec.ts` |
| 1.2.3 | Can disconnect from device | P0 | ❌ | |
| 1.2.4 | Can reconnect to same device | P1 | ❌ | |
| 1.2.5 | Handles device timeout during connection | P1 | ❌ | |
| 1.2.6 | Handles no MIDI interfaces available | P1 | ❌ | |
| 1.2.7 | Handles device disconnected mid-operation | P1 | ❌ | |
| 1.2.8 | HTTP MIDI transport connects via midi-server | P0 | ❌ | |
| 1.2.9 | Web MIDI transport requests SysEx permission | P1 | ❌ | |
| 1.2.10 | "Continue to Programs" navigates to /programs | P1 | ❌ | |

---

## 2. Programs Page

### 2.1 Program List (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.1.1 | Navigates to programs page | P0 | ❌ | |
| 2.1.2 | Connection persists after navigation | P0 | ❌ | |
| 2.1.3 | Program names load from device | P0 | ❌ | |
| 2.1.4 | Shows loading state during name fetch | P1 | ❌ | |
| 2.1.5 | Displays loading progress percentage | P1 | ❌ | |
| 2.1.6 | Selecting program loads program header | P1 | ❌ | |
| 2.1.7 | Refresh button reloads program names | P1 | ❌ | |
| 2.1.8 | Load All button fetches all program headers | P1 | ❌ | |
| 2.1.9 | Displays empty/unnamed programs distinctly | P2 | ❌ | |
| 2.1.10 | "Connect first" message when not connected | P1 | ❌ | |

### 2.2 Program Editing: Basic (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.2.1 | Edit program name (PRNAME, 12 char max) | P0 | ❌ | |
| 2.2.2 | Program name syncs to device | P0 | ❌ | |
| 2.2.3 | Edit MIDI program number (PRGNUM, 0-128) | P1 | ❌ | |
| 2.2.4 | Edit MIDI channel (PMCHAN, 0-255) | P1 | ❌ | |
| 2.2.5 | Edit polyphony (POLYPH, 0-31) | P1 | ❌ | |
| 2.2.6 | Edit priority (Low/Normal/High/Hold) | P1 | ❌ | |
| 2.2.7 | Edit voice stealing (Oldest/Quietest) | P1 | ❌ | |

### 2.3 Program Editing: Output (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.3.1 | Edit output routing (OUTPUT, 0-99) | P1 | ❌ | |
| 2.3.2 | Edit stereo level (STEREO, 0-99) | P1 | ❌ | |
| 2.3.3 | Edit pan position (PANPOS, -50 to 50) | P1 | ❌ | |
| 2.3.4 | Edit program level (PRLOUD, 0-99) | P1 | ❌ | |
| 2.3.5 | Edit velocity to amp (V_LOUD, -50 to 50) | P1 | ❌ | |
| 2.3.6 | Edit effects bus (PFXCHAN, 0-4) | P1 | ❌ | |

### 2.4 Program Editing: Pitch (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.4.1 | Edit bend up (B_PTCH, 0-99) | P1 | ❌ | |
| 2.4.2 | Edit bend down (B_PTCHD, 0-99) | P1 | ❌ | |
| 2.4.3 | Edit pressure to pitch (P_PTCH, -50 to 50) | P1 | ❌ | |
| 2.4.4 | Edit tuning (PTUNO, -50 to 50) | P1 | ❌ | |
| 2.4.5 | Edit transpose (TRANSPOSE, -50 to 50) | P1 | ❌ | |

### 2.5 Program Editing: Portamento (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.5.1 | Toggle portamento enable (PORTEN) | P1 | ❌ | |
| 2.5.2 | Edit portamento time (PORTIME, 0-99) | P1 | ❌ | |
| 2.5.3 | Edit portamento type (Rate/Time) | P1 | ❌ | |

### 2.6 Program Editing: LFO 1 (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.6.1 | Edit LFO rate (LFORAT, 0-99) | P1 | ❌ | |
| 2.6.2 | Edit LFO depth (LFODEP, 0-99) | P1 | ❌ | |
| 2.6.3 | Edit LFO delay (LFODEL, 0-99) | P1 | ❌ | |
| 2.6.4 | Edit LFO waveform (Triangle/Sawtooth/Square) | P1 | ❌ | |
| 2.6.5 | Toggle LFO desync (DESYNC) | P1 | ❌ | |

### 2.7 Program Editing: LFO 1 Mod Sources (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.7.1 | Edit modwheel to LFO1 (MWLDEP, 0-99) | P1 | ❌ | |
| 2.7.2 | Edit aftertouch to LFO1 (PRSDEP, 0-99) | P1 | ❌ | |
| 2.7.3 | Edit velocity to LFO1 (VELDEP, 0-99) | P1 | ❌ | |

### 2.8 Program Editing: LFO 2 (Pan) (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.8.1 | Edit pan LFO rate (PANRAT, 0-99) | P1 | ❌ | |
| 2.8.2 | Edit pan LFO depth (PANDEP, 0-99) | P1 | ❌ | |
| 2.8.3 | Edit pan LFO delay (PANDEL, 0-99) | P1 | ❌ | |
| 2.8.4 | Edit pan LFO waveform (Triangle/Sawtooth/Square) | P1 | ❌ | |
| 2.8.5 | Toggle pan LFO retrigger (LFO2TRIG) | P1 | ❌ | |

### 2.9 Program Editing: Soft Pedal (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.9.1 | Edit loudness reduction (SPLOUD, 0-99) | P1 | ❌ | |
| 2.9.2 | Edit attack stretch (SPATT, 0-99) | P1 | ❌ | |
| 2.9.3 | Edit filter reduction (SPFILT, 0-99) | P1 | ❌ | |

### 2.10 Program Editing: Advanced (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.10.1 | Toggle keygroup crossfade (KXFADE) | P1 | ❌ | |
| 2.10.2 | Toggle legato (LEGATO) | P1 | ❌ | |
| 2.10.3 | Edit bend mode (Normal/Held) | P1 | ❌ | |
| 2.10.4 | Keygroup count (GROUPS) displays read-only | P2 | ❌ | |

### 2.11 Program Round-Trip (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.11.1 | Edit parameter, re-read from device, verify match | P0 | ❌ | |
| 2.11.2 | All Basic section parameters sync to device | P0 | ❌ | |
| 2.11.3 | All Output section parameters sync to device | P1 | ❌ | |
| 2.11.4 | All Pitch section parameters sync to device | P1 | ❌ | |
| 2.11.5 | All LFO parameters sync to device | P1 | ❌ | |
| 2.11.6 | All toggle parameters sync to device | P1 | ❌ | |

### 2.12 Program Edge Cases (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.12.1 | Program with maximum keygroups | P2 | ❌ | |
| 2.12.2 | Program with no keygroups | P1 | ❌ | |
| 2.12.3 | Rapid sequential edits (debouncing) | P2 | ❌ | |
| 2.12.4 | Edit while device is modifying same data | P2 | ❌ | |
| 2.12.5 | Parameter value boundary min/max enforcement | P1 | ❌ | |

---

## 3. Keygroups Page

### 3.1 Keygroup List (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.1.1 | Navigates to keygroups page | P0 | ❌ | |
| 3.1.2 | Requires program selection first | P0 | ❌ | |
| 3.1.3 | Keygroup list loads from device | P0 | ❌ | |
| 3.1.4 | Shows loading state during keygroup fetch | P1 | ❌ | |
| 3.1.5 | Displays keygroup note range (low-high) | P1 | ❌ | |
| 3.1.6 | Selecting keygroup shows editor | P1 | ❌ | |
| 3.1.7 | Refresh button reloads keygroups | P1 | ❌ | |
| 3.1.8 | Switching selected program reloads keygroups | P1 | ❌ | |
| 3.1.9 | Page title shows selected program name | P2 | ❌ | |

### 3.2 Keygroup Editing: Note Range (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.2.1 | Edit low note (LONOTE, 21-127) | P1 | ❌ | |
| 3.2.2 | Edit high note (HINOTE, 21-127) | P1 | ❌ | |
| 3.2.3 | Edit tuning offset (KGTUNO, -50 to 50) | P1 | ❌ | |
| 3.2.4 | Note name display updates with MIDI note value | P2 | ❌ | |

### 3.3 Keygroup Editing: Amplitude Envelope (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.3.1 | Edit attack (ATTAK1, 0-99) | P1 | ❌ | |
| 3.3.2 | Edit decay (DECAY1, 0-99) | P1 | ❌ | |
| 3.3.3 | Edit sustain (SUSTN1, 0-99) | P1 | ❌ | |
| 3.3.4 | Edit release (RELSE1, 0-99) | P1 | ❌ | |
| 3.3.5 | Edit velocity to attack (V_ATT1, -50 to 50) | P1 | ❌ | |
| 3.3.6 | Edit velocity to release (V_REL1, -50 to 50) | P1 | ❌ | |
| 3.3.7 | Edit off velocity to release (O_REL1, -50 to 50) | P1 | ❌ | |
| 3.3.8 | Edit key to decay/release (K_DAR1, -50 to 50) | P1 | ❌ | |

### 3.4 Keygroup Editing: Filter (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.4.1 | Edit filter frequency (FILFRQ, 0-99) | P1 | ❌ | |
| 3.4.2 | Edit filter resonance (FILQ, 0-15) | P1 | ❌ | |
| 3.4.3 | Edit key tracking (K_FREQ, -50 to 50) | P1 | ❌ | |
| 3.4.4 | Edit velocity to filter (V_FREQ, -50 to 50) | P1 | ❌ | |
| 3.4.5 | Edit pressure to filter (P_FREQ, -50 to 50) | P1 | ❌ | |
| 3.4.6 | Edit envelope to filter (E_FREQ, -50 to 50) | P1 | ❌ | |

### 3.5 Keygroup Editing: Filter Envelope (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.5.1 | Edit rate 1 / attack (ENV2R1, 0-99) | P1 | ❌ | |
| 3.5.2 | Edit level 1 (ENV2L1, 0-99) | P1 | ❌ | |
| 3.5.3 | Edit rate 2 (ENV2R2, 0-99) | P1 | ❌ | |
| 3.5.4 | Edit level 2 (ENV2L2, 0-99) | P1 | ❌ | |
| 3.5.5 | Edit rate 3 / decay (ENV2R3, 0-99) | P1 | ❌ | |
| 3.5.6 | Edit level 3 / sustain (ENV2L3, 0-99) | P1 | ❌ | |
| 3.5.7 | Edit rate 4 / release (ENV2R4, 0-99) | P1 | ❌ | |
| 3.5.8 | Edit level 4 / final (ENV2L4, 0-99) | P1 | ❌ | |
| 3.5.9 | Edit velocity to attack (V_ATT2, -50 to 50) | P1 | ❌ | |
| 3.5.10 | Edit velocity to release (V_REL2, -50 to 50) | P1 | ❌ | |
| 3.5.11 | Edit off velocity to release (O_REL2, -50 to 50) | P1 | ❌ | |
| 3.5.12 | Edit key to decay/release (K_DAR2, -50 to 50) | P1 | ❌ | |
| 3.5.13 | Edit velocity to env 2 level (V_ENV2, -50 to 50) | P1 | ❌ | |

### 3.6 Keygroup Editing: Crossfade (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.6.1 | Toggle velocity crossfade (VXFADE) | P1 | ❌ | |
| 3.6.2 | Edit left key crossfade (LKXF, 0-99) | P1 | ❌ | |
| 3.6.3 | Edit right key crossfade (RKXF, 0-99) | P1 | ❌ | |

### 3.7 Keygroup Editing: Pitch (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.7.1 | Edit LFO to pitch (L_PTCH, -50 to 50) | P1 | ❌ | |

### 3.8 Keygroup Chain Navigation (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.8.1 | Navigate from keygroup 1 to keygroup 2 | P1 | ❌ | |
| 3.8.2 | Navigate through full keygroup chain | P1 | ❌ | |
| 3.8.3 | Keygroup list reflects GROUPS count from program | P1 | ❌ | |
| 3.8.4 | Keygroup index updates in editor title | P2 | ❌ | |

### 3.9 Keygroup Round-Trip (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.9.1 | Edit parameter, re-read from device, verify match | P0 | ❌ | |
| 3.9.2 | All Note Range parameters sync to device | P0 | ❌ | |
| 3.9.3 | All Amplitude Envelope parameters sync to device | P1 | ❌ | |
| 3.9.4 | All Filter parameters sync to device | P1 | ❌ | |
| 3.9.5 | All Filter Envelope parameters sync to device | P1 | ❌ | |
| 3.9.6 | Crossfade parameters sync to device | P1 | ❌ | |

### 3.10 Keygroup Edge Cases (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.10.1 | Keygroup with overlapping note ranges | P2 | ❌ | |
| 3.10.2 | Keygroup at MIDI note boundaries (21, 127) | P2 | ❌ | |
| 3.10.3 | Rapid sequential edits (debouncing) | P2 | ❌ | |
| 3.10.4 | Parameter value boundary min/max enforcement | P1 | ❌ | |

---

## 4. Velocity Zones (within Keygroups)

### 4.1 Velocity Zone Navigation (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.1.1 | Zone 1 active by default | P1 | ❌ | |
| 4.1.2 | Click to switch between 4 velocity zones | P1 | ❌ | |
| 4.1.3 | Zone tabs show sample name when assigned | P2 | ❌ | |
| 4.1.4 | Active zone tab visually distinct | P2 | ❌ | |

### 4.2 Velocity Zone: Sample Assignment (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.2.1 | Sample dropdown lists resident samples | P0 | ❌ | |
| 4.2.2 | Assign sample to zone 1 (SNAME1) | P0 | ❌ | |
| 4.2.3 | Assign sample to zone 2 (SNAME2) | P1 | ❌ | |
| 4.2.4 | Assign sample to zone 3 (SNAME3) | P1 | ❌ | |
| 4.2.5 | Assign sample to zone 4 (SNAME4) | P1 | ❌ | |
| 4.2.6 | Clear sample assignment (set to none) | P1 | ❌ | |
| 4.2.7 | Sample assignment syncs to device | P0 | ❌ | |

### 4.3 Velocity Zone: Per-Zone Parameters (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.3.1 | Edit low velocity (LOVEL1-4, 0-127) | P1 | ❌ | |
| 4.3.2 | Edit high velocity (HIVEL1-4, 0-127) | P1 | ❌ | |
| 4.3.3 | Edit tuning offset (VTUNO1-4, -50 to 50) | P1 | ❌ | |
| 4.3.4 | Edit loudness offset (VLOUD1-4, -50 to 50) | P1 | ❌ | |
| 4.3.5 | Edit filter freq offset (VFREQ1-4, -50 to 50) | P1 | ❌ | |
| 4.3.6 | Edit pan offset (VPANO1-4, -50 to 50) | P1 | ❌ | |
| 4.3.7 | Edit playback mode (ZPLAY1-4: As Sample/Loop In Release/Loop Til Release/No Loops/Play To End) | P1 | ❌ | |

### 4.4 Velocity Zone: Velocity Range Configuration (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.4.1 | Configure zone 1: 0-31, zone 2: 32-63, zone 3: 64-95, zone 4: 96-127 | P1 | ❌ | |
| 4.4.2 | Overlapping velocity ranges (for crossfade) | P2 | ❌ | |
| 4.4.3 | Single-zone full range (0-127) | P1 | ❌ | |
| 4.4.4 | Velocity zone parameters sync to device | P0 | ❌ | |

### 4.5 Velocity Zone Round-Trip (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.5.1 | Edit zone parameter, re-read from device, verify match | P0 | ❌ | |
| 4.5.2 | All per-zone parameters sync across 4 zones | P0 | ❌ | |
| 4.5.3 | Sample name persists after round-trip | P0 | ❌ | |

---

## 5. Library Operations

### 5.1 Library Connection (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.1.1 | OPFS backend available | P0 | ❌ | |
| 5.1.2 | Local filesystem backend available | P1 | ❌ | |
| 5.1.3 | Connect to OPFS storage | P0 | ❌ | |
| 5.1.4 | Disconnect from storage | P1 | ❌ | |
| 5.1.5 | Library browser shows empty state | P1 | ❌ | |

### 5.2 Directory CRUD (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.2.1 | Create directory in samples area | P0 | ❌ | |
| 5.2.2 | Create nested directories | P1 | ❌ | |
| 5.2.3 | Delete directory | P1 | ❌ | |
| 5.2.4 | Move directory | P1 | ❌ | |
| 5.2.5 | Handle special characters in name | P2 | ❌ | |

### 5.3 Sample Import (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.3.1 | Import WAV file to library | P0 | ❌ | |
| 5.3.2 | Import multiple WAV files | P1 | ❌ | |
| 5.3.3 | Import WAV to specific directory | P1 | ❌ | |
| 5.3.4 | Library detail panel displays for selected item | P1 | ❌ | |

### 5.4 Library Browsing (No Hardware)

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.4.1 | Tree view renders sample hierarchy | P0 | ❌ | |
| 5.4.2 | Select item shows detail panel | P1 | ❌ | |
| 5.4.3 | Refresh reloads library contents | P1 | ❌ | |
| 5.4.4 | Delete item from library | P1 | ❌ | |
| 5.4.5 | Move item between directories | P1 | ❌ | |

### 5.5 Library Device Integration (Hardware Required, Future) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.5.1 | Export program from device to library | P0 | ❌ | Requires SDS implementation |
| 5.5.2 | Import program from library to device | P0 | ❌ | Requires SDS implementation |
| 5.5.3 | Program round trip: import to device, export, compare | P0 | ❌ | Requires SDS implementation |
| 5.5.4 | Export sample from device to library | P0 | ❌ | Requires SDS implementation |
| 5.5.5 | Import sample from library to device | P0 | ❌ | Requires SDS implementation |
| 5.5.6 | Handle device memory full | P1 | ❌ | |

---

## 6. Modulation Routing (Future)

### 6.1 Source/Destination Assignment (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.1.1 | Display modulation routing matrix | P1 | ❌ | |
| 6.1.2 | Assign source 1 to destination | P1 | ❌ | |
| 6.1.3 | Assign source 2 to destination | P1 | ❌ | |
| 6.1.4 | Assign source 3 to destination | P1 | ❌ | |
| 6.1.5 | Clear modulation source assignment | P1 | ❌ | |

### 6.2 Modulation Destinations (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.2.1 | Pan modulation routing | P1 | ❌ | |
| 6.2.2 | Amplitude modulation routing | P1 | ❌ | |
| 6.2.3 | Filter modulation routing | P1 | ❌ | |
| 6.2.4 | LFO modulation routing | P1 | ❌ | |
| 6.2.5 | Pitch modulation routing | P1 | ❌ | |

### 6.3 Modulation Round-Trip (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.3.1 | Modulation assignments sync to device | P0 | ❌ | |
| 6.3.2 | Re-read modulation routing after edit, verify match | P0 | ❌ | |

---

## 7. Error Handling

### 7.1 Connection Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 7.1.1 | Display error when connection fails | P0 | ❌ | |
| 7.1.2 | Display timeout error | P1 | ❌ | |
| 7.1.3 | Display SysEx rejection error | P1 | ❌ | |
| 7.1.4 | Recover from device disconnect | P1 | ❌ | |

### 7.2 Data Errors (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 7.2.1 | Handle corrupted device data | P1 | ❌ | |
| 7.2.2 | Handle checksum errors | P1 | ❌ | |
| 7.2.3 | Handle incomplete transfers | P1 | ❌ | |
| 7.2.4 | Error display on Programs page | P1 | ❌ | |
| 7.2.5 | Error display on Keygroups page | P1 | ❌ | |

---

## 8. HTTP MIDI Transport (Hardware Required) 🔌

| # | Test | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 8.1 | midi-server health check | P0 | ❌ | |
| 8.2 | Port enumeration | P0 | ❌ | |
| 8.3 | Port discovery | P0 | ❌ | |
| 8.4 | Port open/close | P0 | ❌ | |
| 8.5 | SysEx round-trip | P0 | ❌ | |
| 8.6 | SSE event listening | P0 | ❌ | |

---

## Coverage Summary

### By Priority

| Priority | Total | Covered | Partial | Not Tested |
|----------|-------|---------|---------|------------|
| P0 | 34 | 4 | 0 | 30 |
| P1 | 140 | 0 | 0 | 140 |
| P2 | 19 | 0 | 0 | 19 |
| **Total** | **193** | **4** | **0** | **189** |

### By Hardware Requirement

| Category | Total | Covered | Partial | Not Tested |
|----------|-------|---------|---------|------------|
| No Hardware | 25 | 0 | 0 | 25 |
| Hardware Required | 168 | 4 | 0 | 164 |

### Critical Gaps (P0 Not Tested)

1. **Program name edit + sync** - Program name edits syncing to device (2.2.1, 2.2.2)
2. **Program round-trip** - Edit parameter, re-read from device, verify (2.11.1, 2.11.2)
3. **Keygroup list loading** - Keygroup list loads from device (3.1.1-3.1.3)
4. **Keygroup round-trip** - Edit parameter, re-read from device, verify (3.9.1, 3.9.2)
5. **Velocity zone sample assignment** - Assign sample and verify sync (4.2.1, 4.2.2, 4.2.7)
6. **Velocity zone round-trip** - Per-zone parameter sync verification (4.5.1-4.5.3)
7. **Library OPFS connection** - Connect to OPFS storage backend (5.1.1, 5.1.3)
8. **Library device integration** - Export/import programs and samples (5.5.1-5.5.5, requires SDS)
9. **Modulation round-trip** - Modulation assignments sync to device (6.3.1, 6.3.2)
10. **HTTP MIDI transport** - midi-server health check, port operations, SysEx round-trip (8.1-8.6)

---

## Recommended Next Steps

### Phase 1: HTTP MIDI Transport
Verify midi-server connectivity and SysEx round-trip for S3000XL protocol:
- Health check, port enumeration, port open/close, SysEx round-trip (section 8)

### Phase 2: Program Editing with Hardware Sync
Program list loading and parameter editing with device verification:
- Program name load, edit, sync to device (sections 2.1-2.2)
- Basic and Output section round-trip tests (section 2.11)

### Phase 3: Keygroup Editing with Hardware Sync
Keygroup list loading and parameter editing with device verification:
- Keygroup list from selected program (section 3.1)
- Note Range and Filter section editing (sections 3.2, 3.4)
- Keygroup chain navigation (section 3.8)

### Phase 4: Velocity Zone Editing
Sample assignment and per-zone parameter editing:
- Sample dropdown from resident sample list (section 4.2)
- Per-zone parameter editing across 4 zones (section 4.3)
- Velocity range configuration (section 4.4)

### Phase 5: Library Operations
OPFS storage and sample management (no hardware required):
- Library connection and directory CRUD (sections 5.1-5.2)
- WAV import and browsing (sections 5.3-5.4)

### Phase 6: Library Device Integration
Program and sample export/import (requires SDS implementation):
- Device-to-library and library-to-device transfers (section 5.5)

### Phase 7: Modulation Routing
Source/destination assignment UI and hardware sync:
- Modulation matrix editing (sections 6.1-6.2)
- Round-trip verification (section 6.3)

### Phase 8: Error Scenarios
Connection and data error handling:
- Connection failures, timeouts, device disconnect (section 7.1)
- Corrupted data, checksum errors (section 7.2)
