---
companion-to: ROLAND-S550-EDITOR-CAPABILITIES.md
deskwork:
  id: 9d37f677-67ce-4615-9b7a-99493a1a74b9
---

# Roland S-330/S-550 Editor — Detailed Affordance Inventory

This is the drill-down companion to [`ROLAND-S550-EDITOR-CAPABILITIES.md`](ROLAND-S550-EDITOR-CAPABILITIES.md).
The parent doc enumerates 51 high-level user capabilities (`C-<AREA>-<NN>`).
This doc itemizes every individual editor affordance that implements those capabilities — every parameter the user can read or edit, every list, every dialog, every navigation action — with stable `D-<AREA>-<NN>` ids.

The source of truth for native operations is `SSeriesClientInterface` (`modules/sampler-devices/src/devices/roland-s-series/s-series-client.ts`) and the data structures in `s-series-types.ts`. Every affordance must trace to either a real protocol op, a data field on the device, or a documented editor-side construct.

This doc is a working punch list for two kinds of gaps:

1. **Missing tests** — affordances marked `implemented` with no `Test` reference. The UI works but nothing locks it in against future redesign.
2. **Missing UI** — affordances marked `missing`. The protocol or storage layer supports the affordance but no editor surface exposes it. Each one represents a feature the editor *should* have.

## How to read this document

Each table row is one affordance. The columns are:

- **ID** — `D-<AREA>-<NN>`. Stable forever; never reused.
- **Affordance** — one-line user-facing description.
- **Source of truth** — the canonical reference (component file, client method, or data-structure field).
- **Parent** — the matching `C-<AREA>-<NN>` from the parent doc, or `n/a` for sub-affordances the parent doesn't enumerate.
- **Origin** — `native` / `client-derived` / `editor-derived` (see below).
- **Status** — `implemented` / `partial` / `missing`. Determined by reading actual TSX, not by parent test coverage.
- **Test** — the spec + test name that proves the affordance works, or `—` if no test exists yet. For affordances with `Status: missing`, the Test column shows `—` (a test can't exist until the UI does, but writing it should be part of the same PR that adds the affordance).

A `Test` reference like `capabilities/patches.spec.ts :: C-PATCH-02` points at the test whose name starts with `C-PATCH-02:` in that spec file. Wave 1 of Task 10 covers display capabilities (read affordances); write affordances (parameter edits) need fixture-replay tests captured in Wave 2 — those rows currently show `—`.

## Origin axis — native vs. derived

The editor's UI affords more than the device's raw SysEx surface. Three values:

| Origin | Meaning |
|--------|---------|
| `native` | Maps to exactly one device protocol operation. Example: `setPatchOctaveShift` writes a single parameter via DT1. The Virtual Front Panel buttons are also native — they emit the same DT1 the physical panel would. |
| `client-derived` | Composed inside the `SSeriesClientInterface` from multiple native ops. Example: `loadPatchRange(0, 8)` issues 8 native `requestPatchData` round trips with progress reporting. The device's protocol has no "load a range" op; the client builds it. |
| `editor-derived` | Lives entirely above the protocol — the device has no analog. Examples: the project library (OPFS-backed, cross-session), set save/load, sample chopping, drag-and-drop between zones, the memory-map visualization, sample export to WAV file. |

Why this matters for redesign: `native` capabilities are device-driven — their protocol contract is fixed by Roland's spec. `client-derived` capabilities can be reshaped without device changes (e.g., change loadPatchRange to streaming with cancellation). `editor-derived` capabilities are entirely under the editor's control and represent the value the editor adds beyond a transparent protocol bridge.

## Detail ID convention

`D-<AREA>-<NN>` matches the parent's `C-<AREA>-<NN>` areas. New areas (`PATCH-LIST`, `PATCH-ZONE`, `TONE-WAVE`, `TONE-LOOP`, `TONE-PITCH`, `TONE-TVF`, `TONE-TVA`, `TONE-LFO`, `TONE-ENV`, `TONE-SAMPLE`, `TONE-ADV`, `SYS`) sub-divide the parent areas where appropriate.

---

## Missing affordances roll-up (24)

These affordances *should* exist — the protocol supports them and/or sibling
affordances of the same shape are implemented — but no UI surface exists in
the current editor. Each is a feature the editor needs. Filed as four
GitHub issues grouped by feature coherence.

| ID | Affordance | Source of truth | Tracked in |
|----|-----------|-----------------|------------|
| D-PATCH-13 | Patch copy source | `SSeriesBasePatchCommon.copySource` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-WAVE-09 | Wave bank assignment (in tone editor) | `SSeriesWaveParams.bank` | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-WAVE-10 | Segment top (in tone editor) | `SSeriesWaveParams.segmentTop` | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-WAVE-11 | Segment length (in tone editor) | `SSeriesWaveParams.segmentLength` | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-TVA-06 | Top-level tvaLfoDepth (distinct from tva.lfoDepth) | `SSeriesBaseTone.tvaLfoDepth` (s-series-types.ts:258) | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-ADV-01 | Source tone reference | `SSeriesBaseTone.sourceTone` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-ADV-02 | Original sub-tone | `SSeriesBaseTone.origSubTone` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-ADV-03 | Recording threshold | `SSeriesBaseTone.recThreshold` | [#410](https://github.com/audiocontrol-org/audiocontrol/issues/410) |
| D-TONE-ADV-04 | Recording pre-trigger | `SSeriesBaseTone.recPreTrigger` | [#410](https://github.com/audiocontrol-org/audiocontrol/issues/410) |
| D-TONE-ADV-05 | Loop tune | `SSeriesBaseTone.loopTune` | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-ADV-06 | Envelope zoom | `SSeriesBaseTone.envZoom` | [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) |
| D-TONE-ADV-07 | Tone copy source | `SSeriesBaseTone.copySource` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-SYS-01 | Master tune | `SSeriesBaseSystemParams.masterTune` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-02 | Master level | `SSeriesBaseSystemParams.masterLevel` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-03 | System MIDI channel | `SSeriesBaseSystemParams.midiChannel` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-04 | System device ID | `SSeriesBaseSystemParams.deviceId` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-05 | Exclusive enable | `SSeriesBaseSystemParams.exclusiveEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-06 | Program change enable | `SSeriesBaseSystemParams.progChangeEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-07 | Control change enable | `SSeriesBaseSystemParams.ctrlChangeEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-08 | Bender enable (system-level) | `SSeriesBaseSystemParams.benderEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-09 | Mod wheel enable | `SSeriesBaseSystemParams.modWheelEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-10 | Aftertouch enable (system-level) | `SSeriesBaseSystemParams.aftertouchEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |
| D-SYS-11 | Hold pedal enable | `SSeriesBaseSystemParams.holdPedalEnabled` | [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) |

**Issue grouping:**

- **[#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) — System Parameters page** (11 affordances). Whole D-SYS area. No client interface methods exist; protocol research required first.
- **[#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) — Tone Editor polish** (6 affordances). UI placement work for fields the data model already supports.
- **[#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) — Copy/Derive operations** (4 affordances). Patch + tone copy/derive features.
- **[#410](https://github.com/audiocontrol-org/audiocontrol/issues/410) — Sample Recording research** (2 affordances). Resolves to a phase OR a strikethrough depending on protocol research outcome.

---

## Coverage summary

### By area (status)

| Area | Total | Implemented | Partial | Missing |
|------|-------|-------------|---------|---------|
| D-CONN | 12 | 12 | 0 | 0 |
| D-PATCH-LIST | 8 | 8 | 0 | 0 |
| D-PATCH | 13 | 11 | 1 | 1 |
| D-PATCH-ZONE | 8 | 8 | 0 | 0 |
| D-TONE-LIST | 7 | 7 | 0 | 0 |
| D-TONE-WAVE | 11 | 6 | 1 | 4 |
| D-TONE-LOOP | 6 | 6 | 0 | 0 |
| D-TONE-PITCH | 5 | 4 | 1 | 0 |
| D-TONE-TVF | 10 | 10 | 0 | 0 |
| D-TONE-TVA | 6 | 5 | 0 | 1 |
| D-TONE-LFO | 6 | 5 | 1 | 0 |
| D-TONE-ENV | 12 | 12 | 0 | 0 |
| D-TONE-SAMPLE | 4 | 4 | 0 | 0 |
| D-TONE-ADV | 7 | 0 | 0 | 7 |
| D-LIB | 22 | 19 | 3 | 0 |
| D-PLAY | 13 | 9 | 4 | 0 |
| D-SYS | 11 | 0 | 0 | 11 |
| D-XX | 12 | 11 | 1 | 0 |
| **Total** | **183** | **137** | **12** | **24** |

### By origin

| Origin | Count | Notes |
|--------|-------|-------|
| native | 95 | Direct device protocol ops + per-field tone writes via `sendToneData`. Includes 18 missing items where the field exists but no UI affordance does. |
| client-derived | 11 | `loadPatchRange`, `loadToneRange`, `requestFunctionParameters`, `panic`, etc. — composed in `SSeriesClientInterface`. |
| editor-derived | 77 | Library / OPFS / sample chopper / loop editor / sample editor / drag-drop / virtual-panel UI / video drawer — the value the editor adds beyond a transparent protocol bridge. |

### By test coverage

| Test status | Count | Definition |
|-------------|-------|------------|
| Tested | 25 | Affordance is implemented AND a capability spec asserts it. |
| Untested | 124 | Affordance is implemented (or partial) but no test asserts it. **These are the missing tests.** |
| Pending UI | 24 | Affordance is missing — test depends on UI being built. **These are the missing capabilities.** |
| Hardware-only | 10 | Affordance can only be verified against real hardware (e.g., front-panel button → device LED change). Lives in `test/e2e/`, not the UI capability suite. |

The 124 untested + 24 pending-UI rows are the punch list. Each tested row is
locked in against redesign; each untested row is at risk; each pending-UI row
is a feature gap.

---

## D-CONN — Connection

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-CONN-01 | MIDI input port selector | `HomePage.tsx` → `MidiConnectionPage` (`editor-core`) | C-CONN-01 | editor-derived | implemented | — |
| D-CONN-02 | MIDI output port selector | `HomePage.tsx` → `MidiConnectionPage` | C-CONN-01 | editor-derived | implemented | — |
| D-CONN-03 | Device ID entry field | `HomePage.tsx` → `MidiConnectionPageConfig.deviceIdLabel` | C-CONN-01 | editor-derived | implemented | — |
| D-CONN-04 | Connect / Continue action | `HomePage.tsx` → `MidiConnectionPageConfig.continueLabel` | C-CONN-01 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-01` |
| D-CONN-05 | Secure-context warning + help items | `HomePage.tsx` → `secureContextHelpItems` | C-CONN-01 | editor-derived | implemented | — |
| D-CONN-06 | Device-setup help items | `HomePage.tsx` → `MidiConnectionPageConfig.helpItems` | C-CONN-01 | editor-derived | implemented | — |
| D-CONN-07 | Connection status display (header) | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-02 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-02` |
| D-CONN-08 | Disconnect action | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-03 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-03` |
| D-CONN-09 | Navigate to Play | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-04` |
| D-CONN-10 | Navigate to Patches | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-04` |
| D-CONN-11 | Navigate to Tones | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-04` |
| D-CONN-12 | Navigate to Library | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | `capabilities/connection.spec.ts :: C-CONN-04` |

---

## D-PATCH-LIST — Patch List

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-PATCH-LIST-01 | Slot enumeration (sparse, full address space) | `PatchList.tsx` → `patches.map(...)` | C-PATCH-01 | editor-derived | implemented | `capabilities/patches.spec.ts :: C-PATCH-01` |
| D-PATCH-LIST-02 | Slot ID display (formatted per MemoryLayout) | `PatchList.tsx` → `<PatchLabel ... />` | C-PATCH-02 | editor-derived | implemented | `capabilities/patches.spec.ts :: C-PATCH-02` |
| D-PATCH-LIST-03 | Patch name display | `PatchList.tsx:100` → `patch.common.name` | C-PATCH-02 | native | implemented | `capabilities/patches.spec.ts :: C-PATCH-02` |
| D-PATCH-LIST-04 | Load-state indicator (loaded / loading / empty / not-loaded) | `PatchList.tsx` → class-based states | C-PATCH-03 | editor-derived | implemented | `capabilities/patches.spec.ts :: C-PATCH-03` |
| D-PATCH-LIST-05 | Click-to-load unloaded bank | `PatchList.tsx:51` → `onLoadBank(bankIndex)` | C-PATCH-04 | client-derived | implemented | — |
| D-PATCH-LIST-06 | Per-bank force-reload buttons (dynamic count) | `PatchesPage.tsx:227` → `getPatchBankCount(config)` | C-PATCH-05 | client-derived | implemented | — |
| D-PATCH-LIST-07 | Load All button | `PatchesPage.tsx:248` → `loadAll` | C-PATCH-05 | client-derived | implemented | — |
| D-PATCH-LIST-08 | Export patch button (per row) | `PatchList.tsx:112` → `onExportPatch` | C-LIB-04 | editor-derived | implemented | — |

---

## D-PATCH — Patch Common Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-PATCH-01 | Name — inline edit (12-char max) | `s-series-client.ts:240` → `setPatchName` | C-PATCH-07 | native | implemented | — |
| D-PATCH-02 | Key Mode — select | `s-series-client.ts:241` → `setPatchKeyMode` | C-PATCH-08 | native | implemented | — |
| D-PATCH-03 | Key Assign — select | `s-series-client.ts:248` → `setPatchKeyAssign` | C-PATCH-08 | native | implemented | — |
| D-PATCH-04 | Pitch Bender Range — select 0-12 | `s-series-client.ts:245` → `setPatchBenderRange` | C-PATCH-08 | native | implemented | — |
| D-PATCH-05 | Aftertouch Assign — select | `s-series-client.ts:247` → `setPatchAftertouchAssign` | C-PATCH-08 | native | implemented | — |
| D-PATCH-06 | Octave Shift — display only | `PatchEditor.tsx:373` → reads `common.octaveShift`, no write | C-PATCH-08 | native | partial (display only; editing blocked pending issue #10) | — |
| D-PATCH-07 | Output Assign — select (1-8 + TONE) | `s-series-client.ts:249` → `setPatchOutput` | C-PATCH-08 | native | implemented | — |
| D-PATCH-08 | Level — slider (0-127) | `s-series-client.ts:250` → `setPatchLevel` | C-PATCH-08 | native | implemented | — |
| D-PATCH-09 | Aftertouch Sensitivity — slider | `s-series-client.ts:246` → `setPatchAftertouchSens` | C-PATCH-08 | native | implemented | — |
| D-PATCH-10 | Unison Detune — slider (when keyMode=unison) | `s-series-client.ts:251` → `setPatchDetune` | C-PATCH-08 | native | implemented | — |
| D-PATCH-11 | V-Sw Threshold — slider (when keyMode=v-sw) | `s-series-client.ts:252` → `setPatchVelocityThreshold` | C-PATCH-08 | native | implemented | — |
| D-PATCH-12 | V-Mix Ratio — slider (when keyMode=v-mix) | `s-series-client.ts:253` → `setPatchVelocityMixRatio` | C-PATCH-08 | native | implemented | — |
| D-PATCH-13 | Copy Source — not rendered | `SSeriesBasePatchCommon.copySource` | C-PATCH-08 | native | missing | — |

---

## D-PATCH-ZONE — Tone Zones (within a patch)

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-PATCH-ZONE-01 | Visual zone bar (horizontal key range) | `ToneZoneEditor.tsx` → flex-bar render | C-PATCH-09 | editor-derived | implemented | — |
| D-PATCH-ZONE-02 | Add Zone | `ToneZoneEditor.tsx` → add-zone action | C-PATCH-09 | native | implemented | — |
| D-PATCH-ZONE-03 | Delete Zone | `ToneZoneEditor.tsx` → delete-zone action | C-PATCH-09 | native | implemented | — |
| D-PATCH-ZONE-04 | Tone reference — select | `ToneZoneEditor.tsx` → tone select per zone | C-PATCH-09 | native | implemented | — |
| D-PATCH-ZONE-05 | Start key — select | `ToneZoneEditor.tsx` → startKey select | C-PATCH-10 | native | implemented | — |
| D-PATCH-ZONE-06 | End key — select | `ToneZoneEditor.tsx` → endKey select | C-PATCH-10 | native | implemented | — |
| D-PATCH-ZONE-07 | MIDI Learn for start key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented | — |
| D-PATCH-ZONE-08 | MIDI Learn for end key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented | — |

---

## D-TONE-LIST — Tone List

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-LIST-01 | Slot enumeration (full address space) | `ToneList.tsx:44` → `tones.map(...)` | C-TONE-01 | editor-derived | implemented | `capabilities/tones.spec.ts :: C-TONE-01` |
| D-TONE-LIST-02 | Slot ID display (formatted) | `ToneList.tsx:93` → `memoryLayout.formatToneSlot` | C-TONE-02 | editor-derived | implemented | `capabilities/tones.spec.ts :: C-TONE-02` |
| D-TONE-LIST-03 | Tone name display | `ToneList.tsx:100` → `tone.name` | C-TONE-02 | native | implemented | `capabilities/tones.spec.ts :: C-TONE-02` |
| D-TONE-LIST-04 | Load-state indicator | `ToneList.tsx` → class-based states | C-TONE-03 | editor-derived | implemented | `capabilities/tones.spec.ts :: C-TONE-03` |
| D-TONE-LIST-05 | Click-to-load unloaded bank | `ToneList.tsx:55` → `onLoadBank(bankIndex)` | C-TONE-04 | client-derived | implemented | — |
| D-TONE-LIST-06 | Per-bank force-reload buttons | `TonesPage.tsx` → dynamic bank buttons | C-TONE-05 | client-derived | implemented | — |
| D-TONE-LIST-07 | Export-to-library button (per row) | `ToneList.tsx:115` → `onExportTone` | C-LIB-04 | editor-derived | implemented | — |

---

## D-TONE-WAVE — Wave Section Parameters

Tones are written as a whole structure via `sendToneData(toneIndex, tone)`. Each affordance below mutates a field on `SSeriesBaseTone` and the editor re-sends the whole structure — but each FIELD maps directly to a real device parameter, so origin is `native`.

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-WAVE-01 | Name — text input (8-char max) | `ToneEditor.tsx:100` → `tone.name` | C-TONE-06 | native | implemented | — |
| D-TONE-WAVE-02 | Original Key — number input + note name | `ToneEditor.tsx:228` → `tone.originalKey` | C-TONE-07 | native | implemented | — |
| D-TONE-WAVE-03 | Sample Rate — display only | `ToneEditor.tsx:248` → `<div>{tone.sampleRate}</div>` | C-TONE-07 | native | partial (display only; no select control) | — |
| D-TONE-WAVE-04 | Loop Mode — select | `ToneEditor.tsx:254` → `tone.loopMode` | C-TONE-07 | native | implemented | — |
| D-TONE-WAVE-05 | Output Assign — select (Mix + Out 1-8) | `ToneEditor.tsx:274` → `tone.outputAssign` | C-TONE-07 | native | implemented | — |
| D-TONE-WAVE-06 | Start Point — number (24-bit address) | `ToneEditor.tsx:301` → `tone.wave.startPoint` | C-TONE-13 | native | implemented | — |
| D-TONE-WAVE-07 | Loop Point — number | `ToneEditor.tsx:319` → `tone.wave.loopPoint` | C-TONE-13 | native | implemented | — |
| D-TONE-WAVE-08 | End Point — number | `ToneEditor.tsx:336` → `tone.wave.endPoint` | C-TONE-13 | native | implemented | — |
| D-TONE-WAVE-09 | Wave Bank — not rendered in tone editor | `SSeriesWaveParams.bank` (only in ImportSamplesDialog) | C-TONE-07 | native | missing | — |
| D-TONE-WAVE-10 | Segment Top — not rendered in tone editor | `SSeriesWaveParams.segmentTop` (only in ImportSamplesDialog) | C-TONE-07 | native | missing | — |
| D-TONE-WAVE-11 | Segment Length — not rendered in tone editor | `SSeriesWaveParams.segmentLength` (only in ImportSamplesDialog) | C-TONE-07 | native | missing | — |

---

## D-TONE-LOOP — Loop Editor (visual)

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-LOOP-01 | Load Wave Data button (explicit fetch) | `ToneEditor.tsx:360` → `onLoadWaveData` | C-TONE-13 | client-derived | implemented | — |
| D-TONE-LOOP-02 | Visual waveform display | `LoopEditor` from `@audiocontrol/loop-editor/ui` | C-TONE-13 | editor-derived | implemented | — |
| D-TONE-LOOP-03 | Draggable loop start marker | `LoopEditor` (`@audiocontrol/loop-editor/ui`) | C-TONE-13 | editor-derived | implemented | — |
| D-TONE-LOOP-04 | Draggable loop end marker | `LoopEditor` | C-TONE-13 | editor-derived | implemented | — |
| D-TONE-LOOP-05 | Auto-detect loop points | `LoopEditor` | C-TONE-13 | editor-derived | implemented | — |
| D-TONE-LOOP-06 | Audio preview / playback | `LoopEditor` | C-TONE-13 | editor-derived | implemented | — |

---

## D-TONE-PITCH — Pitch Section

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-PITCH-01 | Transpose — slider (disabled in current build) | `ToneEditor.tsx:611` → field exists; control disabled | C-TONE-08 | native | partial (slider visible, editing disabled) | — |
| D-TONE-PITCH-02 | Fine Tune — slider (-64..+63 cents) | `ToneEditor.tsx:623` → `tone.fineTune` | C-TONE-08 | native | implemented | — |
| D-TONE-PITCH-03 | Pitch Follow — checkbox | `ToneEditor.tsx:634` → `tone.pitchFollow` | C-TONE-08 | native | implemented | — |
| D-TONE-PITCH-04 | Pitch Bender enable — checkbox | `ToneEditor.tsx:653` → `tone.benderEnabled` | C-TONE-08 | native | implemented | — |
| D-TONE-PITCH-05 | Aftertouch enable — checkbox | `ToneEditor.tsx:670` → `tone.aftertouchEnabled` | C-TONE-08 | native | implemented | — |

---

## D-TONE-TVF — TVF (Filter) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-TVF-01 | TVF Enable — checkbox | `ToneEditor.tsx:396` → `tone.tvf.enabled` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-02 | Cutoff — slider | `ToneEditor.tsx:414` → `tone.tvf.cutoff` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-03 | Resonance — slider | `ToneEditor.tsx:425` → `tone.tvf.resonance` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-04 | Key Follow — slider | `ToneEditor.tsx:434` → `tone.tvf.keyFollow` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-05 | LFO Depth — slider | `ToneEditor.tsx:443` → `tone.tvf.lfoDepth` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-06 | EG Depth — slider | `ToneEditor.tsx:453` → `tone.tvf.egDepth` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-07 | Key Rate Follow — slider | `ToneEditor.tsx:462` → `tone.tvf.keyRateFollow` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-08 | Vel Rate Follow — slider | `ToneEditor.tsx:471` → `tone.tvf.velRateFollow` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-09 | EG Polarity — select | `ToneEditor.tsx:482` → `tone.tvf.egPolarity` | C-TONE-09 | native | implemented | — |
| D-TONE-TVF-10 | Level Curve — select (0-5) | `ToneEditor.tsx:501` → `tone.tvf.levelCurve` | C-TONE-09 | native | implemented | — |

---

## D-TONE-TVA — TVA (Amplifier) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-TVA-01 | Level — slider | `ToneEditor.tsx:697` → `tone.tva.level` | C-TONE-10 | native | implemented | — |
| D-TONE-TVA-02 | LFO Depth (tva.lfoDepth) — slider | `ToneEditor.tsx:704` → `tone.tva.lfoDepth` | C-TONE-10 | native | implemented | — |
| D-TONE-TVA-03 | Key Rate — slider | `ToneEditor.tsx:712` → `tone.tva.keyRate` | C-TONE-10 | native | implemented | — |
| D-TONE-TVA-04 | Vel Rate — slider | `ToneEditor.tsx:720` → `tone.tva.velRate` | C-TONE-10 | native | implemented | — |
| D-TONE-TVA-05 | Level Curve — select (0-5) | `ToneEditor.tsx:729` → `tone.tva.levelCurve` | C-TONE-10 | native | implemented | — |
| D-TONE-TVA-06 | Top-level tvaLfoDepth (distinct from tva.lfoDepth) | `SSeriesBaseTone.tvaLfoDepth` (s-series-types.ts:258) | C-TONE-10 | native | missing | — |

---

## D-TONE-LFO — LFO Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-LFO-01 | Rate — slider | `ToneEditor.tsx:535` → `tone.lfo.rate` | C-TONE-11 | native | implemented | — |
| D-TONE-LFO-02 | Delay — slider | `ToneEditor.tsx:543` → `tone.lfo.delay` | C-TONE-11 | native | implemented | — |
| D-TONE-LFO-03 | Offset — slider | `ToneEditor.tsx:551` → `tone.lfo.offset` | C-TONE-11 | native | implemented | — |
| D-TONE-LFO-04 | Key Sync — checkbox | `ToneEditor.tsx:561` → `tone.lfo.sync` | C-TONE-11 | native | implemented | — |
| D-TONE-LFO-05 | Mode — display only | `ToneEditor.tsx:580` → `<div>{tone.lfo.mode}</div>` | C-TONE-11 | native | partial (display only; no edit control) | — |
| D-TONE-LFO-06 | Peak Hold (polarity) — checkbox | `ToneEditor.tsx:586` → `tone.lfo.polarity` | C-TONE-11 | native | implemented | — |

---

## D-TONE-ENV — 8-segment Envelopes (TVF + TVA)

S-series envelopes are 8-segment (NOT ADSR). Each envelope has 8 levels + 8 rates + sustain point + end point.

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-ENV-01 | TVF env — draggable SVG visualization | `EnvelopeEditor.tsx` → SVG drag handlers | C-TONE-12 | editor-derived | implemented | — |
| D-TONE-ENV-02 | TVF env — 8 rate inputs (table) | `EnvelopeEditor.tsx` → rates inputs | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-03 | TVF env — 8 level inputs (table) | `EnvelopeEditor.tsx` → levels inputs | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-04 | TVF env — sustain point select (0-7) | `EnvelopeEditor.tsx` → sustainPoint | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-05 | TVF env — end point select (1-8) | `EnvelopeEditor.tsx` → endPoint | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-06 | TVF env — fullscreen expand | `EnvelopeEditor.tsx` → overlay | C-TONE-12 | editor-derived | implemented | — |
| D-TONE-ENV-07 | TVA env — draggable SVG visualization | `EnvelopeEditor.tsx` (reused) | C-TONE-12 | editor-derived | implemented | — |
| D-TONE-ENV-08 | TVA env — 8 rate inputs | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-09 | TVA env — 8 level inputs | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-10 | TVA env — sustain point select | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-11 | TVA env — end point select | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | — |
| D-TONE-ENV-12 | TVA env — fullscreen expand | `EnvelopeEditor.tsx` | C-TONE-12 | editor-derived | implemented | — |

---

## D-TONE-SAMPLE — Sample Import/Export Actions

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-SAMPLE-01 | Import Sample (WAV from disk → tone slot) | `ToneEditor.tsx:163` → `ImportSampleDialog` (composes WAV decode + `importTone`) | C-LIB-07 | editor-derived | implemented | — |
| D-TONE-SAMPLE-02 | Export Sample (tone wave data → WAV file) | `ToneEditor.tsx:138` → `useToneSampleExport` | C-LIB-08 | editor-derived | implemented | — |
| D-TONE-SAMPLE-03 | Export to Library (tone + sample → library set) | `ToneEditor.tsx:115` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented | — |
| D-TONE-SAMPLE-04 | Chop into Drum Kit (slice sample into multiple tones) | `ToneEditor.tsx:185` → `SampleChopperDialog` | n/a (unique to editor) | editor-derived | implemented | — |

---

## D-TONE-ADV — Advanced Tone Fields (not exposed)

`SSeriesBaseTone` has 7 fields the editor never renders. All would map to native protocol writes via `sendToneData`.

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-TONE-ADV-01 | Source Tone | `SSeriesBaseTone.sourceTone` (s-series-types.ts:251) | C-TONE-07 | native | missing | — |
| D-TONE-ADV-02 | Orig Sub Tone | `SSeriesBaseTone.origSubTone` (s-series-types.ts:252) | C-TONE-07 | native | missing | — |
| D-TONE-ADV-03 | Rec Threshold | `SSeriesBaseTone.recThreshold` (s-series-types.ts:266) | C-TONE-07 | native | missing | — |
| D-TONE-ADV-04 | Rec Pre-Trigger | `SSeriesBaseTone.recPreTrigger` (s-series-types.ts:267) | C-TONE-07 | native | missing | — |
| D-TONE-ADV-05 | Loop Tune | `SSeriesBaseTone.loopTune` (s-series-types.ts:268) | C-TONE-13 | native | missing | — |
| D-TONE-ADV-06 | Env Zoom | `SSeriesBaseTone.envZoom` (s-series-types.ts:269) | C-TONE-12 | native | missing | — |
| D-TONE-ADV-07 | Copy Source (tone) | `SSeriesBaseTone.copySource` (s-series-types.ts:270) | C-TONE-07 | native | missing | — |

---

## D-LIB — Library

The library is the editor's primary editor-derived layer. The device has no concept of a "library" — the editor adds OPFS-backed cross-session storage, set archives, import/export workflows, and sample editing on top of the raw protocol.

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-LIB-01 | OPFS / local-FS library backend | `LibraryPage.tsx:19` → `useLibraryConnection` | C-LIB-01 | editor-derived | implemented | `capabilities/library.spec.ts :: C-LIB-01` (partial — only presence) |
| D-LIB-02 | Google Drive backend | `LibraryPage.tsx` → conditional on `VITE_GOOGLE_CLIENT_ID` | C-LIB-01 | editor-derived | partial (only enabled when env var set) | — |
| D-LIB-03 | Library tree display | `PluginLibraryBrowser` from `editor-core` | C-LIB-01 | editor-derived | partial (presence asserted; node enumeration deferred) | — |
| D-LIB-04 | Sets section (expandable) | `LibraryPage.tsx:24` → `SetsSection` | C-LIB-01 | editor-derived | implemented | — |
| D-LIB-05 | Device memory panel (tones + patches on device) | `LibraryPage.tsx` → `DeviceMemoryPanel` | C-LIB-02 | editor-derived | partial (drop-target coverage incomplete) | — |
| D-LIB-06 | Drag device tone → library (export) | `DeviceMemoryPanel.tsx:68` → `handleToneDragStart` | C-LIB-04 | editor-derived | implemented | — |
| D-LIB-07 | Drag device patch → library (export) | `DeviceMemoryPanel.tsx` → `handlePatchDragStart` | C-LIB-04 | editor-derived | implemented | — |
| D-LIB-08 | Drop library tone → device tone slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryTone` | C-LIB-03 | editor-derived | implemented | — |
| D-LIB-09 | Drop library patch → device patch slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryPatch` | C-LIB-03 | editor-derived | implemented | — |
| D-LIB-10 | Save Set dialog (full device state → named set) | `LibraryPage.tsx:26` → `SaveSetDialog` | C-LIB-05 | editor-derived | implemented | — |
| D-LIB-11 | Load Set dialog (set → device, with MemoryMapPanel) | `LibraryPage.tsx:27` → `LoadSetDialog` | C-LIB-06 | editor-derived | implemented | — |
| D-LIB-12 | Import Library Tone dialog (slot + segment selection) | `LibraryPage.tsx:28` → `ImportLibraryToneDialog` | C-LIB-03 | editor-derived | implemented | — |
| D-LIB-13 | Import Library Patch dialog | `LibraryPage.tsx:29` → `ImportLibraryPatchDialog` | C-LIB-03 | editor-derived | implemented | — |
| D-LIB-14 | Import Samples dialog (sample bundle, MemoryMapPanel + BestFitPicker) | `LibraryPage.tsx:30` → `ImportSamplesDialog` | C-LIB-07 | editor-derived | implemented | — |
| D-LIB-15 | Export Tone dialog | `LibraryPage.tsx:33` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented | — |
| D-LIB-16 | Export Patch dialog | `LibraryPage.tsx:34` → `ExportPatchDialog` | C-LIB-04 | editor-derived | implemented | — |
| D-LIB-17 | Loop Editor dialog (from library) | `LibraryPage.tsx:31` → `LoopEditorDialog` | C-LIB-07 | editor-derived | implemented | — |
| D-LIB-18 | Sample Editor dialog | `LibraryPage.tsx:32` → `SampleEditorDialog` | C-LIB-07 | editor-derived | implemented | — |
| D-LIB-19 | Sample Chopper dialog | `SampleChopperDialog` from `@audiocontrol/sample-chopper/ui` | n/a (unique to editor) | editor-derived | implemented | — |
| D-LIB-20 | MemoryMapPanel — ToneSlotMap | `LoadSetDialog.tsx:17` → `ToneSlotMap` | C-LIB-10 | editor-derived | implemented | — |
| D-LIB-21 | MemoryMapPanel — WaveSegmentMap | `ImportSamplesDialog.tsx:18` → `WaveSegmentMap` | C-LIB-10 | editor-derived | implemented | — |
| D-LIB-22 | Refresh device button | `LibraryPage.tsx` → refresh callback | C-LIB-02 | client-derived | implemented | — |

---

## D-PLAY — Play (Multi Mode)

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-PLAY-01 | 8-part (A-H) grid | `PlayPage.tsx:321` → `parts.map(...)` | C-PLAY-01 | editor-derived | implemented | `capabilities/play.spec.ts :: C-PLAY-01` |
| D-PLAY-02 | Part label (A-H) | `PlayPage.tsx:329` → `part.id` | C-PLAY-01 | editor-derived | implemented | `capabilities/play.spec.ts :: C-PLAY-01` |
| D-PLAY-03 | VAL / active indicator | `PlayPage.tsx:333` → `part.active ? '*' : ''` | C-PLAY-01 | native | partial (always renders `*`; `active` field never updated from device) | — |
| D-PLAY-04 | MIDI channel — select (1-16) | `s-series-client.ts:231` → `setMultiChannel` | C-PLAY-04 | native | implemented | `capabilities/play-writes.spec.ts :: D-PLAY-04` |
| D-PLAY-05 | Patch — select | `s-series-client.ts:232` → `setMultiPatch` | C-PLAY-05 | native | implemented | `capabilities/play-writes.spec.ts :: D-PLAY-05` |
| D-PLAY-06 | Output — select (1-8) | `s-series-client.ts:233` → `setMultiOutput` | C-PLAY-06 | native | implemented | `capabilities/play-writes.spec.ts :: D-PLAY-06` |
| D-PLAY-07 | Level — slider (0-127) | `s-series-client.ts:234` → `setMultiLevel` | C-PLAY-07 | native | implemented | `capabilities/play-writes.spec.ts :: D-PLAY-07` |
| D-PLAY-08 | Load function parameters on connect | `s-series-client.ts:230` → `requestFunctionParameters` (client-composed of multiple reads) | C-PLAY-03 | client-derived | implemented | — |
| D-PLAY-09 | Patch name resolution from store | `PlayPage.tsx:163` → resolves `patches[part.patchIndex].common.name` | C-PLAY-03 | editor-derived | implemented | `capabilities/play.spec.ts :: C-PLAY-03` |
| D-PLAY-10 | Bank reload — P11-P18 button | `PlayPage.tsx:276` → `loadPatchBank(0, true)` | C-PLAY-04 | client-derived | partial (S-330 only — buttons hardcoded; S-550 has 4 banks) | — |
| D-PLAY-11 | Bank reload — P21-P28 button | `PlayPage.tsx:291` → `loadPatchBank(1, true)` | C-PLAY-04 | client-derived | partial (S-330 only) | — |
| D-PLAY-12 | Loading progress bar (header) | `PlayPage.tsx:263` → `loadingProgress` + `loadingMessage` | C-XX-02 | editor-derived | partial (% bar only; no bytes/elapsed/ETA per design system) | — |
| D-PLAY-13 | Error display region | `PlayPage.tsx:453` → `<div data-testid="error-message">` | C-XX-03 | editor-derived | implemented | — |

---

## D-SYS — System Parameters (none implemented)

`SSeriesBaseSystemParams` has 11 fields. None are exposed in the UI; no client interface methods exist for system-parameter read/write.

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-SYS-01 | Master Tune | `SSeriesBaseSystemParams.masterTune` | n/a | native | missing | — |
| D-SYS-02 | Master Level | `SSeriesBaseSystemParams.masterLevel` | n/a | native | missing | — |
| D-SYS-03 | MIDI Channel (system) | `SSeriesBaseSystemParams.midiChannel` | n/a | native | missing | — |
| D-SYS-04 | Device ID (system) | `SSeriesBaseSystemParams.deviceId` | n/a | native | missing | — |
| D-SYS-05 | Exclusive Enable | `SSeriesBaseSystemParams.exclusiveEnabled` | n/a | native | missing | — |
| D-SYS-06 | Prog Change Enable | `SSeriesBaseSystemParams.progChangeEnabled` | n/a | native | missing | — |
| D-SYS-07 | Ctrl Change Enable | `SSeriesBaseSystemParams.ctrlChangeEnabled` | n/a | native | missing | — |
| D-SYS-08 | Bender Enable (system-level) | `SSeriesBaseSystemParams.benderEnabled` | n/a | native | missing | — |
| D-SYS-09 | Mod Wheel Enable | `SSeriesBaseSystemParams.modWheelEnabled` | n/a | native | missing | — |
| D-SYS-10 | Aftertouch Enable (system-level) | `SSeriesBaseSystemParams.aftertouchEnabled` | n/a | native | missing | — |
| D-SYS-11 | Hold Pedal Enable | `SSeriesBaseSystemParams.holdPedalEnabled` | n/a | native | missing | — |

---

## D-XX — Cross-Cutting

| ID | Affordance | Source of truth | Parent | Origin | Status | Test |
|----|-----------|-----------------|--------|--------|--------|------|
| D-XX-01 | Virtual Front Panel — floating draggable panel | `VirtualFrontPanel.tsx` | C-XX-04 | editor-derived | implemented | — |
| D-XX-02 | VFP — Navigation buttons (DT1) | `VirtualFrontPanel.tsx` → `NavigationPad` → `useFrontPanel` | C-XX-04 | native | implemented | — |
| D-XX-03 | VFP — Value buttons (DT1) | `VirtualFrontPanel.tsx` → `ValueButtons` | C-XX-04 | native | implemented | — |
| D-XX-04 | VFP — Function buttons (MODE/MENU/SUB MENU/COM/Execute) | `VirtualFrontPanel.tsx` → `FunctionButtonRow` | C-XX-04 | native | implemented | — |
| D-XX-05 | VFP — Keyboard shortcuts | `VirtualFrontPanel.tsx:7` → `keydown` listener | C-XX-04 | editor-derived | implemented | — |
| D-XX-06 | VFP — Drag to reposition | `VirtualFrontPanel.tsx` → mouse drag + localStorage | C-XX-04 | editor-derived | implemented | — |
| D-XX-07 | VFP — Collapse/expand | `VirtualFrontPanel.tsx` → `STORAGE_KEY_EXPANDED` | C-XX-04 | editor-derived | implemented | — |
| D-XX-08 | VFP — Connection status indicator (green dot) | `VirtualFrontPanel.tsx` | C-XX-04 | editor-derived | implemented | — |
| D-XX-09 | Video capture drawer (USB / webcam) | `Layout.tsx` → `VideoCapture` | n/a (unique to editor) | editor-derived | implemented | — |
| D-XX-10 | Front-panel controls inside video drawer | `VideoCapture.tsx:15` → reuses VFP components | n/a (unique to editor) | editor-derived | implemented | — |
| D-XX-11 | MIDI Panic button (CC 120 + 123 on all channels) | `Layout.tsx` → `PanicButton` (client `panic()`) | n/a | client-derived | implemented | — |
| D-XX-12 | Progress indicators (cross-cutting) | Multiple pages → `loadingProgress` + `loadingMessage` | C-XX-02 | editor-derived | partial (% bar only; design system requires bytes/elapsed/ETA) | — |

---

## Punch list

The 124 untested rows above are the missing-test backlog. The 24 missing rows
are the missing-UI backlog. Both should drain over time; both should grow
when new affordances are added (each new feature lands with its test).

A redesign that wants to claim "no functional regression" must, at minimum,
keep every currently-tested row passing. A redesign that wants to claim "no
capability loss" must additionally either (a) keep every currently-implemented
affordance present in the new UI, or (b) explicitly strike rows in this
document with a PR explaining why the capability no longer applies.

### Test-coverage backlog → wave issues

The 124 untested rows are tracked across 7 test-wave issues, sequenced so each
wave can land independently:

| Wave | Issue | Scope | Hardware |
|------|-------|-------|----------|
| 2a | [#411](https://github.com/audiocontrol-org/audiocontrol/issues/411) | Patch parameter writes — D-PATCH-01..05, 07..12 | Yes (fixture capture) |
| 2b | [#412](https://github.com/audiocontrol-org/audiocontrol/issues/412) | Multi-mode parameter writes — D-PLAY-04..07 | Yes |
| 2c | [#413](https://github.com/audiocontrol-org/audiocontrol/issues/413) | Tone parameter writes (wave/pitch/TVF/TVA/LFO/envelope) | Yes |
| 3 | [#414](https://github.com/audiocontrol-org/audiocontrol/issues/414) | Display-assertion gaps (port pickers, bank buttons, zone editor, loop editor visual) | No |
| 4 | [#415](https://github.com/audiocontrol-org/audiocontrol/issues/415) | Library + dialog flows (save/load set, import/export, sample editor) | Yes |
| 5 | [#416](https://github.com/audiocontrol-org/audiocontrol/issues/416) | Drag-drop tests | Yes |
| 6 | [#417](https://github.com/audiocontrol-org/audiocontrol/issues/417) | Cross-cutting (front-panel DT1, panic, progress, live-edit guard) | Yes (front-panel fixture) |

When a wave lands, the relevant `Test` cells in the detail tables flip from `—` to citations of the new specs.

---

## Document maintenance

This document lives at the top level of the repository alongside [`ROLAND-S550-EDITOR-CAPABILITIES.md`](ROLAND-S550-EDITOR-CAPABILITIES.md). It is owned by the project, not by any feature branch — features may add, change, or strike affordances, but the document itself is a long-lived inventory.

- Each affordance change is part of a PR; the PR description references the `D-<AREA>-<NN>` id.
- The summary tables (by-area + by-origin + by-test-status) are updated in the same PR as the affordance change.
- Removed affordances stay in the document as `removed (<reason>, <PR link>)`. History is not deleted.
- New device editors get sibling docs (e.g., `AKAI-S3000XL-EDITOR-CAPABILITIES-DETAILED.md`).
- Origin classifications can shift over time (e.g., a `client-derived` op might be promoted to native if the device protocol grows; an `editor-derived` op might be moved into the client). Such reclassifications are part of the PR that motivates them.
- New tests added that cover existing affordances flip the Test column from `—` to a citation in the same PR.
