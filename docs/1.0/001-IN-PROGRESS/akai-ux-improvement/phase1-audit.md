# Phase 1 Audit: Akai S3000XL Editor UX Improvement

## 1. SysEx CRUD Coverage

### Programs

| Operation | Status | Notes |
|-----------|--------|-------|
| List programs | Working | `fetchProgramNames()` via RPLIST (0x02) |
| Read program header | Working | `fetchProgramHeader()` via RPDATA (0x06) |
| Write program header | Working | `writeProgramHeader()` via PDATA (0x07) |
| Delete program | Working | `deleteProgram()` via DELP (0x12) |
| Create program | Broken | S3000XL accepts PDATA write (REPLY OK) but does NOT create RPLIST entry. Disabled in test suite. Hardware limitation, not fixable via SysEx. |
| Rename program | Missing on branch | Exists on feature/library-ux (commit 2656a2d1). Pattern: fetch header, call `ProgramHeader_writePRNAME()`, write back via PDATA. ~5 min to port. |

**Program creation workaround:** Programs must be created via front panel or imported from disk. The editor cannot create blank programs. This should be documented in the UI.

### Keygroups

| Operation | Status | Notes |
|-----------|--------|-------|
| Read keygroup header | Working | `fetchKeygroupHeader()` via RKDATA (0x08) |
| Write keygroup header | Working | `writeKeygroupHeader()` via KDATA (0x09) |
| Create keygroup | Working | `createKeygroup()` sends KDATA with template cloning. Device auto-increments GROUPS count. |
| Delete keygroup | Working | `deleteKeygroup()` via DELK (0x13). Device auto-decrements GROUPS count. |
| Rename keygroup | N/A | Keygroups have no name field in the SysEx spec. |
| List keygroups | Partial | No convenience function; pattern is: read `ProgramHeader.GROUPS` count, loop `fetchKeygroupHeader()`. |

### Samples

| Operation | Status | Notes |
|-----------|--------|-------|
| List samples | Working | `fetchSampleNames()` via RSLIST (0x04) |
| Read sample header | Working | `fetchSampleHeader()` via RSDATA (0x0a) |
| Write sample header | Working | `writeSampleHeader()` via SDATA (0x0b) |
| Delete sample | Working | `deleteSample()` via DELS (0x14) |
| Upload sample | Working | `sendSampleViaSds()` via SDS + ASPACK fast path |
| Rename sample | Partial | Post-upload rename works (in `sendSampleViaSds`). Standalone rename missing on this branch; exists on feature/library-ux. |

### CRUD Summary

- **Programs:** 4/6 working, 1 broken (create — hardware limitation), 1 missing (rename — easy port)
- **Keygroups:** 4/4 working (rename N/A)
- **Samples:** 5/6 working, 1 missing (standalone rename — easy port)

**Go/no-go for Phase 2:** GO. Rename functions need porting from library-ux branch (~10 min). Program creation limitation requires UI documentation but does not block workflow editing.

---

## 2. Parameter Mapping

### Program Parameters (83 total writable fields)

**Currently exposed in UI: 37 parameters (45%)**

#### Basic Settings (6) — EXPOSED
`PRNAME`, `PRGNUM`, `PMCHAN`, `POLYPH`, `PRIORT`, `VASSOQ`

#### Output/Routing (6) — EXPOSED
`OUTPUT`, `STEREO`, `PANPOS`, `PRLOUD`, `V_LOUD`, `PFXCHAN`

#### Pitch/Tuning (5) — EXPOSED
`B_PTCH`, `B_PTCHD`, `P_PTCH`, `PTUNO`, `TRANSPOSE`

#### Portamento (3) — EXPOSED
`PORTEN`, `PORTIME`, `PORTYPE`

#### LFO 1 (8) — EXPOSED
`LFORAT`, `LFODEP`, `LFODEL`, `LFO1WAVE`, `MWLDEP`, `PRSDEP`, `VELDEP`, `DESYNC`

#### LFO 2 / Pan (5) — EXPOSED
`PANRAT`, `PANDEP`, `PANDEL`, `LFO2WAVE`, `LFO2TRIG`

#### Soft Pedal (3) — EXPOSED
`SPLOUD`, `SPATT`, `SPFILT`

#### Advanced (4) — EXPOSED
`KXFADE`, `LEGATO`, `B_MODE`, `GROUPS` (read-only)

#### NOT EXPOSED (46 parameters)
- Modulation matrix sources (13): `MODSPAN1-3`, `MODSAMP1-3`, `MODSLFOT/L/D`, `MODSFILT1-3`, `MODSPITCH`
- Modulation matrix amounts (9): `MODVPAN1-3`, `MODVAMP1-2`, `MODVLFOR/LVOL/LFOD`
- Key/pressure routing: `OSHIFT`, `K_LOUD`, `P_LOUD`, `K_PANP`, `ECHOUT`, `MW_PAN`, `COHERE`, `PLAW`, `K_LRAT`, `K_LDEP`, `K_LDEL`, `VSSCL`
- Filter 2 (S3200 only): `MODSLFLT2_1-3`
- Internal/block: `KGRP1`, `TPNUM`, `RESERVED_1`, `TEMPER`

### Keygroup Parameters (132 total writable fields)

**Currently exposed in UI: ~50 parameters (38%)**

#### Note Range (3) — EXPOSED
`LONOTE`, `HINOTE`, `KGTUNO`

#### Amp Envelope / Env 1 (8) — EXPOSED
`ATTAK1`, `DECAY1`, `SUSTN1`, `RELSE1`, `V_ATT1`, `V_REL1`, `O_REL1`, `K_DAR1`

#### Filter 1 (6) — EXPOSED
`FILFRQ`, `FILQ`, `K_FREQ`, `V_FREQ`, `P_FREQ`, `E_FREQ`

#### Filter Envelope / Env 2 (13) — EXPOSED
`ENV2R1-4`, `ENV2L1-4`, `V_ATT2`, `V_REL2`, `O_REL2`, `K_DAR2`, `V_ENV2`

#### Velocity Zones 1-4 (32) — EXPOSED
Per zone: `SNAME#`, `LOVEL#`, `HIVEL#`, `VTUNO#`, `VLOUD#`, `VFREQ#`, `VPANO#`, `ZPLAY#`

#### NOT EXPOSED (82 parameters)
- Envelope 3 / pitch envelope (S3200+): `ATTAK3`, `ENV3L1-4`, `ENV3R2-4`, velocity/key mods
- Filter 2 (S3200+): `LSI2_ON`, `FLT2GAIN`, `FLT2MODE`, `FLT2Q`, `FIL2FR`, `K_FRQ2`, `TONEFREQ`, `TONESEQ`
- Per-keygroup effects routing: `KFXCHAN`, `KFXSLEV`, `PFXCHAN`, `PFXSLEV`
- Per-zone outputs: `VZOUT1-4`, `CP1-4`
- Advanced modulation: `KV_LO`, `MODVFILT1-3`, `MODVPITCH`, `MODVAMP3`
- Crossfade internals: `LKXF`, `RKXF`, `LVXF1-4`, `HVXF1-4`

### Sample Parameters (35 total)

**Currently exposed in UI: 0 parameters (0%)**

No dedicated sample header editor exists. Sample info is accessed indirectly through keygroup velocity zone assignments.

### Suggested Workflow-Oriented Groupings

**Program sections:**
1. **MIDI & Routing** — PMCHAN, PRGNUM, POLYPH, PRIORT, VASSOQ, TRANSPOSE
2. **Output** — OUTPUT, STEREO, PANPOS, PRLOUD, V_LOUD, PFXCHAN
3. **Pitch & Tuning** — PTUNO, B_PTCH, B_PTCHD, P_PTCH, B_MODE
4. **LFO 1 (Filter/Pitch)** — LFORAT, LFODEP, LFODEL, LFO1WAVE, DESYNC + mod sources
5. **LFO 2 (Pan)** — PANRAT, PANDEP, PANDEL, LFO2WAVE, LFO2TRIG
6. **Portamento** — PORTEN, PORTIME, PORTYPE, LEGATO
7. **Soft Pedal** — SPLOUD, SPATT, SPFILT
8. **Crossfade** — KXFADE

**Keygroup sections:**
1. **Zone Definition** — LONOTE, HINOTE, KGTUNO
2. **Velocity Zones** — SNAME1-4, LOVEL1-4, HIVEL1-4, VXFADE
3. **Zone Offsets** — VTUNO1-4, VLOUD1-4, VFREQ1-4, VPANO1-4, ZPLAY1-4
4. **Amp Envelope** — ATTAK1, DECAY1, SUSTN1, RELSE1 + velocity/key mods
5. **Filter** — FILFRQ, FILQ, K_FREQ, V_FREQ, P_FREQ, E_FREQ
6. **Filter Envelope** — ENV2R1-4, ENV2L1-4 + velocity/key mods
7. **Pitch Modulation** — L_PTCH, KBEAT

---

## 3. Roland Editor Patterns

### Parameter Grouping
- **Pattern:** Hard-coded JSX sections, each wrapped in `<div className="card">` with `<h4>` titles
- **Layout:** Responsive grid (`grid gap-4 md:grid-cols-3`) within each card
- **Spacing:** `space-y-6` between major sections
- **Key component:** `ParameterSlider` from editor-core (slider with label, value display, theming)
- **File:** `modules/roland-sxx0-editor/src/components/tones/ToneEditor.tsx`

### Page Layout
- **Pattern:** List-detail split using `ac-list-detail-grid` CSS class (1fr / 2fr responsive grid)
- **Left column:** Sticky list with item selection
- **Right column:** Full editor when item selected, placeholder otherwise
- **File:** `modules/roland-sxx0-editor/src/pages/TonesPage.tsx`

### CRUD
- **Update pattern:** Optimistic local state update (Zustand) + async device commit via `clientRef`
- **Delete pattern:** `ConfirmDialog` component from editor-core (Radix UI based)
- **Create:** Not extensively used (Roland devices have fixed tone/patch counts)
- **Rename:** Inline name editing with `handleNameChange` → local update + device write

### Navigation
- React Router: `/roland/{device}/editor/{page}`
- Click-to-select in list (no route change for item selection)
- Layout wrapper via `EditorLayout` from editor-core

### State Management
- **Zustand stores:** editorStore (selection, loading), deviceDataStore (tone/patch cache), uiStore (layout prefs), midiStore (connection)
- **Device config context:** URL-driven device type → factory creates typed client
- **Client wiring:** `clientRef` via useEffect, tied to adapter + deviceId

### Multi-Editor
- **Not implemented.** Roland editor uses single-selection list-detail. No split pane, no tabs, no side-by-side.

### editor-core Components Available

| Component | Purpose |
|-----------|---------|
| `ParameterSlider` | Slider with label, value, theming |
| `CollapsibleSection` | Collapsible parameter groups |
| `EditorLayout` | Main layout wrapper (header, nav, content) |
| `ConfirmDialog` | Delete/confirm modal (Radix UI) |
| `MoveDialog` | Move/reorganize items |
| `LibraryBrowser` | File/folder browser |
| `ac-list-detail-grid` | CSS: responsive list/detail layout |
| `ac-btn-*` | CSS: button styles |
| `ac-modal-*` | CSS: modal dialog styles |

---

## 4. editor-core Extraction Candidates

Components that should be extracted or already exist in editor-core and can be reused by S3K editor:

| Pattern | Current Location | Extraction Status |
|---------|-----------------|-------------------|
| ParameterSlider | editor-core | Already shared |
| CollapsibleSection | editor-core | Already shared |
| EditorLayout | editor-core | Already shared |
| ConfirmDialog | editor-core | Already shared |
| List-detail grid layout | editor-core CSS | Already shared |
| Bank loader hook | roland-sxx0-editor | Candidate for extraction (similar pattern needed for S3K) |
| Device config context | roland-sxx0-editor | Candidate for extraction (S3K needs same URL-driven config) |
| Parameter section card pattern | roland-sxx0-editor | Candidate — define shared card/section component |
| MIDI store factory | editor-core | Already shared |

---

## 5. Recommendations

### Phase 2 Prerequisites
1. Port `renameProgram()` and `renameSample()` from feature/library-ux branch
2. Document program creation limitation in UI (programs must be created via front panel)
3. Follow Roland editor patterns: Zustand stores, list-detail grid, card-based parameter sections, ParameterSlider

### Phase 2 Architecture
- Reuse `ac-list-detail-grid` for program list + editor split
- Reuse `ParameterSlider` and `CollapsibleSection` from editor-core
- Create S3K-specific Zustand stores following Roland pattern (editorStore, deviceDataStore)
- Wire device client via `clientRef` pattern with factory from device config
- Group program parameters into 8 workflow sections (see above)
- Show keygroups inline as collapsed/expandable list within program editor

### What NOT to Build in Phase 2
- Multi-editor (Phase 4)
- Sample header editor (nice-to-have, not in workplan)
- S3200-specific parameters (Filter 2, Envelope 3) — future scope
- Program modulation matrix UI — lower priority, most users don't use it
