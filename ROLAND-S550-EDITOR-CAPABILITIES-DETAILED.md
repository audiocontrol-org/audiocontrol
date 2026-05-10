---
companion-to: ROLAND-S550-EDITOR-CAPABILITIES.md
---

# Roland S-330/S-550 Editor — Detailed Affordance Inventory

This is the drill-down companion to [`ROLAND-S550-EDITOR-CAPABILITIES.md`](ROLAND-S550-EDITOR-CAPABILITIES.md).
The parent doc enumerates 51 high-level user capabilities (`C-<AREA>-<NN>`).
This doc itemizes every individual editor affordance that implements those capabilities — every parameter the user can read or edit, every list, every dialog, every navigation action — with stable `D-<AREA>-<NN>` ids.

The source of truth for native operations is `SSeriesClientInterface` (`modules/sampler-devices/src/devices/roland-s-series/s-series-client.ts`) and the data structures in `s-series-types.ts`. Every affordance must trace to either a real protocol op, a data field on the device, or a documented editor-side construct.

## How to read this document

Each table row is one affordance. The columns are:

- **ID** — `D-<AREA>-<NN>`. Stable forever; never reused.
- **Affordance** — one-line user-facing description.
- **Source of truth** — the canonical reference (component file, client method, or data-structure field).
- **Parent** — the matching `C-<AREA>-<NN>` from the parent doc, or `n/a` for sub-affordances the parent doesn't enumerate.
- **Origin** — see below.
- **Status** — `implemented` / `partial` / `missing`. Determined by reading actual TSX, not by parent test coverage.

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

## D-CONN — Connection

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-CONN-01 | MIDI input port selector | `HomePage.tsx` → `MidiConnectionPage` (`editor-core`) | C-CONN-01 | editor-derived | implemented |
| D-CONN-02 | MIDI output port selector | `HomePage.tsx` → `MidiConnectionPage` | C-CONN-01 | editor-derived | implemented |
| D-CONN-03 | Device ID entry field | `HomePage.tsx` → `MidiConnectionPageConfig.deviceIdLabel` | C-CONN-01 | editor-derived | implemented |
| D-CONN-04 | Connect / Continue action | `HomePage.tsx` → `MidiConnectionPageConfig.continueLabel` | C-CONN-01 | editor-derived | implemented |
| D-CONN-05 | Secure-context warning + help items | `HomePage.tsx` → `secureContextHelpItems` | C-CONN-01 | editor-derived | implemented |
| D-CONN-06 | Device-setup help items | `HomePage.tsx` → `MidiConnectionPageConfig.helpItems` | C-CONN-01 | editor-derived | implemented |
| D-CONN-07 | Connection status display (header) | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-02 | editor-derived | implemented |
| D-CONN-08 | Disconnect action | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-03 | editor-derived | implemented |
| D-CONN-09 | Navigate to Play | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented |
| D-CONN-10 | Navigate to Patches | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented |
| D-CONN-11 | Navigate to Tones | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented |
| D-CONN-12 | Navigate to Library | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented |

---

## D-PATCH-LIST — Patch List

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-PATCH-LIST-01 | Slot enumeration (sparse, full address space) | `PatchList.tsx` → `patches.map(...)` | C-PATCH-01 | editor-derived | implemented |
| D-PATCH-LIST-02 | Slot ID display (formatted per MemoryLayout) | `PatchList.tsx` → `<PatchLabel ... />` | C-PATCH-02 | editor-derived | implemented |
| D-PATCH-LIST-03 | Patch name display | `PatchList.tsx:100` → `patch.common.name` | C-PATCH-02 | native | implemented |
| D-PATCH-LIST-04 | Load-state indicator (loaded / loading / empty / not-loaded) | `PatchList.tsx` → class-based states | C-PATCH-03 | editor-derived | implemented |
| D-PATCH-LIST-05 | Click-to-load unloaded bank | `PatchList.tsx:51` → `onLoadBank(bankIndex)` | C-PATCH-04 | client-derived | implemented |
| D-PATCH-LIST-06 | Per-bank force-reload buttons (dynamic count) | `PatchesPage.tsx:227` → `getPatchBankCount(config)` | C-PATCH-05 | client-derived | implemented |
| D-PATCH-LIST-07 | Load All button | `PatchesPage.tsx:248` → `loadAll` | C-PATCH-05 | client-derived | implemented |
| D-PATCH-LIST-08 | Export patch button (per row) | `PatchList.tsx:112` → `onExportPatch` | C-LIB-04 | editor-derived | implemented |

---

## D-PATCH — Patch Common Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-PATCH-01 | Name — inline edit (12-char max) | `s-series-client.ts:240` → `setPatchName` | C-PATCH-07 | native | implemented |
| D-PATCH-02 | Key Mode — select | `s-series-client.ts:241` → `setPatchKeyMode` | C-PATCH-08 | native | implemented |
| D-PATCH-03 | Key Assign — select | `s-series-client.ts:248` → `setPatchKeyAssign` | C-PATCH-08 | native | implemented |
| D-PATCH-04 | Pitch Bender Range — select 0-12 | `s-series-client.ts:245` → `setPatchBenderRange` | C-PATCH-08 | native | implemented |
| D-PATCH-05 | Aftertouch Assign — select | `s-series-client.ts:247` → `setPatchAftertouchAssign` | C-PATCH-08 | native | implemented |
| D-PATCH-06 | Octave Shift — display only | `PatchEditor.tsx:373` → reads `common.octaveShift`, no write | C-PATCH-08 | native | partial (display only; editing blocked pending issue #10) |
| D-PATCH-07 | Output Assign — select (1-8 + TONE) | `s-series-client.ts:249` → `setPatchOutput` | C-PATCH-08 | native | implemented |
| D-PATCH-08 | Level — slider (0-127) | `s-series-client.ts:250` → `setPatchLevel` | C-PATCH-08 | native | implemented |
| D-PATCH-09 | Aftertouch Sensitivity — slider | `s-series-client.ts:246` → `setPatchAftertouchSens` | C-PATCH-08 | native | implemented |
| D-PATCH-10 | Unison Detune — slider (when keyMode=unison) | `s-series-client.ts:251` → `setPatchDetune` | C-PATCH-08 | native | implemented |
| D-PATCH-11 | V-Sw Threshold — slider (when keyMode=v-sw) | `s-series-client.ts:252` → `setPatchVelocityThreshold` | C-PATCH-08 | native | implemented |
| D-PATCH-12 | V-Mix Ratio — slider (when keyMode=v-mix) | `s-series-client.ts:253` → `setPatchVelocityMixRatio` | C-PATCH-08 | native | implemented |
| D-PATCH-13 | Copy Source — not rendered | `SSeriesBasePatchCommon.copySource` | C-PATCH-08 | native | missing |

---

## D-PATCH-ZONE — Tone Zones (within a patch)

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-PATCH-ZONE-01 | Visual zone bar (horizontal key range) | `ToneZoneEditor.tsx` → flex-bar render | C-PATCH-09 | editor-derived | implemented |
| D-PATCH-ZONE-02 | Add Zone | `ToneZoneEditor.tsx` → add-zone action | C-PATCH-09 | native | implemented |
| D-PATCH-ZONE-03 | Delete Zone | `ToneZoneEditor.tsx` → delete-zone action | C-PATCH-09 | native | implemented |
| D-PATCH-ZONE-04 | Tone reference — select | `ToneZoneEditor.tsx` → tone select per zone | C-PATCH-09 | native | implemented |
| D-PATCH-ZONE-05 | Start key — select | `ToneZoneEditor.tsx` → startKey select | C-PATCH-10 | native | implemented |
| D-PATCH-ZONE-06 | End key — select | `ToneZoneEditor.tsx` → endKey select | C-PATCH-10 | native | implemented |
| D-PATCH-ZONE-07 | MIDI Learn for start key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented |
| D-PATCH-ZONE-08 | MIDI Learn for end key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented |

---

## D-TONE-LIST — Tone List

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-LIST-01 | Slot enumeration (full address space) | `ToneList.tsx:44` → `tones.map(...)` | C-TONE-01 | editor-derived | implemented |
| D-TONE-LIST-02 | Slot ID display (formatted) | `ToneList.tsx:93` → `memoryLayout.formatToneSlot` | C-TONE-02 | editor-derived | implemented |
| D-TONE-LIST-03 | Tone name display | `ToneList.tsx:100` → `tone.name` | C-TONE-02 | native | implemented |
| D-TONE-LIST-04 | Load-state indicator | `ToneList.tsx` → class-based states | C-TONE-03 | editor-derived | implemented |
| D-TONE-LIST-05 | Click-to-load unloaded bank | `ToneList.tsx:55` → `onLoadBank(bankIndex)` | C-TONE-04 | client-derived | implemented |
| D-TONE-LIST-06 | Per-bank force-reload buttons | `TonesPage.tsx` → dynamic bank buttons | C-TONE-05 | client-derived | implemented |
| D-TONE-LIST-07 | Export-to-library button (per row) | `ToneList.tsx:115` → `onExportTone` | C-LIB-04 | editor-derived | implemented |

---

## D-TONE-WAVE — Wave Section Parameters

Tones are written as a whole structure via `sendToneData(toneIndex, tone)`. Each affordance below mutates a field on `SSeriesBaseTone` and the editor re-sends the whole structure — but each FIELD maps directly to a real device parameter, so origin is `native`.

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-WAVE-01 | Name — text input (8-char max) | `ToneEditor.tsx:100` → `tone.name` | C-TONE-06 | native | implemented |
| D-TONE-WAVE-02 | Original Key — number input + note name | `ToneEditor.tsx:228` → `tone.originalKey` | C-TONE-07 | native | implemented |
| D-TONE-WAVE-03 | Sample Rate — display only | `ToneEditor.tsx:248` → `<div>{tone.sampleRate}</div>` | C-TONE-07 | native | partial (display only; no select control) |
| D-TONE-WAVE-04 | Loop Mode — select | `ToneEditor.tsx:254` → `tone.loopMode` | C-TONE-07 | native | implemented |
| D-TONE-WAVE-05 | Output Assign — select (Mix + Out 1-8) | `ToneEditor.tsx:274` → `tone.outputAssign` | C-TONE-07 | native | implemented |
| D-TONE-WAVE-06 | Start Point — number (24-bit address) | `ToneEditor.tsx:301` → `tone.wave.startPoint` | C-TONE-13 | native | implemented |
| D-TONE-WAVE-07 | Loop Point — number | `ToneEditor.tsx:319` → `tone.wave.loopPoint` | C-TONE-13 | native | implemented |
| D-TONE-WAVE-08 | End Point — number | `ToneEditor.tsx:336` → `tone.wave.endPoint` | C-TONE-13 | native | implemented |
| D-TONE-WAVE-09 | Wave Bank — not rendered in tone editor | `SSeriesWaveParams.bank` (only in ImportSamplesDialog) | C-TONE-07 | native | missing |
| D-TONE-WAVE-10 | Segment Top — not rendered in tone editor | `SSeriesWaveParams.segmentTop` (only in ImportSamplesDialog) | C-TONE-07 | native | missing |
| D-TONE-WAVE-11 | Segment Length — not rendered in tone editor | `SSeriesWaveParams.segmentLength` (only in ImportSamplesDialog) | C-TONE-07 | native | missing |

---

## D-TONE-LOOP — Loop Editor (visual)

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-LOOP-01 | Load Wave Data button (explicit fetch) | `ToneEditor.tsx:360` → `onLoadWaveData` | C-TONE-13 | client-derived | implemented |
| D-TONE-LOOP-02 | Visual waveform display | `LoopEditor` from `@audiocontrol/loop-editor/ui` | C-TONE-13 | editor-derived | implemented |
| D-TONE-LOOP-03 | Draggable loop start marker | `LoopEditor` (`@audiocontrol/loop-editor/ui`) | C-TONE-13 | editor-derived | implemented |
| D-TONE-LOOP-04 | Draggable loop end marker | `LoopEditor` | C-TONE-13 | editor-derived | implemented |
| D-TONE-LOOP-05 | Auto-detect loop points | `LoopEditor` | C-TONE-13 | editor-derived | implemented |
| D-TONE-LOOP-06 | Audio preview / playback | `LoopEditor` | C-TONE-13 | editor-derived | implemented |

---

## D-TONE-PITCH — Pitch Section

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-PITCH-01 | Transpose — slider (disabled in current build) | `ToneEditor.tsx:611` → field exists; control disabled | C-TONE-08 | native | partial (slider visible, editing disabled) |
| D-TONE-PITCH-02 | Fine Tune — slider (-64..+63 cents) | `ToneEditor.tsx:623` → `tone.fineTune` | C-TONE-08 | native | implemented |
| D-TONE-PITCH-03 | Pitch Follow — checkbox | `ToneEditor.tsx:634` → `tone.pitchFollow` | C-TONE-08 | native | implemented |
| D-TONE-PITCH-04 | Pitch Bender enable — checkbox | `ToneEditor.tsx:653` → `tone.benderEnabled` | C-TONE-08 | native | implemented |
| D-TONE-PITCH-05 | Aftertouch enable — checkbox | `ToneEditor.tsx:670` → `tone.aftertouchEnabled` | C-TONE-08 | native | implemented |

---

## D-TONE-TVF — TVF (Filter) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-TVF-01 | TVF Enable — checkbox | `ToneEditor.tsx:396` → `tone.tvf.enabled` | C-TONE-09 | native | implemented |
| D-TONE-TVF-02 | Cutoff — slider | `ToneEditor.tsx:414` → `tone.tvf.cutoff` | C-TONE-09 | native | implemented |
| D-TONE-TVF-03 | Resonance — slider | `ToneEditor.tsx:425` → `tone.tvf.resonance` | C-TONE-09 | native | implemented |
| D-TONE-TVF-04 | Key Follow — slider | `ToneEditor.tsx:434` → `tone.tvf.keyFollow` | C-TONE-09 | native | implemented |
| D-TONE-TVF-05 | LFO Depth — slider | `ToneEditor.tsx:443` → `tone.tvf.lfoDepth` | C-TONE-09 | native | implemented |
| D-TONE-TVF-06 | EG Depth — slider | `ToneEditor.tsx:453` → `tone.tvf.egDepth` | C-TONE-09 | native | implemented |
| D-TONE-TVF-07 | Key Rate Follow — slider | `ToneEditor.tsx:462` → `tone.tvf.keyRateFollow` | C-TONE-09 | native | implemented |
| D-TONE-TVF-08 | Vel Rate Follow — slider | `ToneEditor.tsx:471` → `tone.tvf.velRateFollow` | C-TONE-09 | native | implemented |
| D-TONE-TVF-09 | EG Polarity — select | `ToneEditor.tsx:482` → `tone.tvf.egPolarity` | C-TONE-09 | native | implemented |
| D-TONE-TVF-10 | Level Curve — select (0-5) | `ToneEditor.tsx:501` → `tone.tvf.levelCurve` | C-TONE-09 | native | implemented |

---

## D-TONE-TVA — TVA (Amplifier) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-TVA-01 | Level — slider | `ToneEditor.tsx:697` → `tone.tva.level` | C-TONE-10 | native | implemented |
| D-TONE-TVA-02 | LFO Depth (tva.lfoDepth) — slider | `ToneEditor.tsx:704` → `tone.tva.lfoDepth` | C-TONE-10 | native | implemented |
| D-TONE-TVA-03 | Key Rate — slider | `ToneEditor.tsx:712` → `tone.tva.keyRate` | C-TONE-10 | native | implemented |
| D-TONE-TVA-04 | Vel Rate — slider | `ToneEditor.tsx:720` → `tone.tva.velRate` | C-TONE-10 | native | implemented |
| D-TONE-TVA-05 | Level Curve — select (0-5) | `ToneEditor.tsx:729` → `tone.tva.levelCurve` | C-TONE-10 | native | implemented |
| D-TONE-TVA-06 | Top-level tvaLfoDepth (distinct from tva.lfoDepth) | `SSeriesBaseTone.tvaLfoDepth` (s-series-types.ts:258) | C-TONE-10 | native | missing |

---

## D-TONE-LFO — LFO Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-LFO-01 | Rate — slider | `ToneEditor.tsx:535` → `tone.lfo.rate` | C-TONE-11 | native | implemented |
| D-TONE-LFO-02 | Delay — slider | `ToneEditor.tsx:543` → `tone.lfo.delay` | C-TONE-11 | native | implemented |
| D-TONE-LFO-03 | Offset — slider | `ToneEditor.tsx:551` → `tone.lfo.offset` | C-TONE-11 | native | implemented |
| D-TONE-LFO-04 | Key Sync — checkbox | `ToneEditor.tsx:561` → `tone.lfo.sync` | C-TONE-11 | native | implemented |
| D-TONE-LFO-05 | Mode — display only | `ToneEditor.tsx:580` → `<div>{tone.lfo.mode}</div>` | C-TONE-11 | native | partial (display only; no edit control) |
| D-TONE-LFO-06 | Peak Hold (polarity) — checkbox | `ToneEditor.tsx:586` → `tone.lfo.polarity` | C-TONE-11 | native | implemented |

---

## D-TONE-ENV — 8-segment Envelopes (TVF + TVA)

S-series envelopes are 8-segment (NOT ADSR). Each envelope has 8 levels + 8 rates + sustain point + end point.

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-ENV-01 | TVF env — draggable SVG visualization | `EnvelopeEditor.tsx` → SVG drag handlers | C-TONE-12 | editor-derived | implemented |
| D-TONE-ENV-02 | TVF env — 8 rate inputs (table) | `EnvelopeEditor.tsx` → rates inputs | C-TONE-12 | native | implemented |
| D-TONE-ENV-03 | TVF env — 8 level inputs (table) | `EnvelopeEditor.tsx` → levels inputs | C-TONE-12 | native | implemented |
| D-TONE-ENV-04 | TVF env — sustain point select (0-7) | `EnvelopeEditor.tsx` → sustainPoint | C-TONE-12 | native | implemented |
| D-TONE-ENV-05 | TVF env — end point select (1-8) | `EnvelopeEditor.tsx` → endPoint | C-TONE-12 | native | implemented |
| D-TONE-ENV-06 | TVF env — fullscreen expand | `EnvelopeEditor.tsx` → overlay | C-TONE-12 | editor-derived | implemented |
| D-TONE-ENV-07 | TVA env — draggable SVG visualization | `EnvelopeEditor.tsx` (reused) | C-TONE-12 | editor-derived | implemented |
| D-TONE-ENV-08 | TVA env — 8 rate inputs | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented |
| D-TONE-ENV-09 | TVA env — 8 level inputs | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented |
| D-TONE-ENV-10 | TVA env — sustain point select | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented |
| D-TONE-ENV-11 | TVA env — end point select | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented |
| D-TONE-ENV-12 | TVA env — fullscreen expand | `EnvelopeEditor.tsx` | C-TONE-12 | editor-derived | implemented |

---

## D-TONE-SAMPLE — Sample Import/Export Actions

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-SAMPLE-01 | Import Sample (WAV from disk → tone slot) | `ToneEditor.tsx:163` → `ImportSampleDialog` (composes WAV decode + `importTone`) | C-LIB-07 | editor-derived | implemented |
| D-TONE-SAMPLE-02 | Export Sample (tone wave data → WAV file) | `ToneEditor.tsx:138` → `useToneSampleExport` | C-LIB-08 | editor-derived | implemented |
| D-TONE-SAMPLE-03 | Export to Library (tone + sample → library set) | `ToneEditor.tsx:115` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented |
| D-TONE-SAMPLE-04 | Chop into Drum Kit (slice sample into multiple tones) | `ToneEditor.tsx:185` → `SampleChopperDialog` | n/a (unique to editor) | editor-derived | implemented |

---

## D-TONE-ADV — Advanced Tone Fields (not exposed)

`SSeriesBaseTone` has 7 fields the editor never renders. All would map to native protocol writes via `sendToneData`.

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-TONE-ADV-01 | Source Tone | `SSeriesBaseTone.sourceTone` (s-series-types.ts:251) | C-TONE-07 | native | missing |
| D-TONE-ADV-02 | Orig Sub Tone | `SSeriesBaseTone.origSubTone` (s-series-types.ts:252) | C-TONE-07 | native | missing |
| D-TONE-ADV-03 | Rec Threshold | `SSeriesBaseTone.recThreshold` (s-series-types.ts:266) | C-TONE-07 | native | missing |
| D-TONE-ADV-04 | Rec Pre-Trigger | `SSeriesBaseTone.recPreTrigger` (s-series-types.ts:267) | C-TONE-07 | native | missing |
| D-TONE-ADV-05 | Loop Tune | `SSeriesBaseTone.loopTune` (s-series-types.ts:268) | C-TONE-13 | native | missing |
| D-TONE-ADV-06 | Env Zoom | `SSeriesBaseTone.envZoom` (s-series-types.ts:269) | C-TONE-12 | native | missing |
| D-TONE-ADV-07 | Copy Source (tone) | `SSeriesBaseTone.copySource` (s-series-types.ts:270) | C-TONE-07 | native | missing |

---

## D-LIB — Library

The library is the editor's primary editor-derived layer. The device has no concept of a "library" — the editor adds OPFS-backed cross-session storage, set archives, import/export workflows, and sample editing on top of the raw protocol.

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-LIB-01 | OPFS / local-FS library backend | `LibraryPage.tsx:19` → `useLibraryConnection` | C-LIB-01 | editor-derived | implemented |
| D-LIB-02 | Google Drive backend | `LibraryPage.tsx` → conditional on `VITE_GOOGLE_CLIENT_ID` | C-LIB-01 | editor-derived | partial (only enabled when env var set) |
| D-LIB-03 | Library tree display | `PluginLibraryBrowser` from `editor-core` | C-LIB-01 | editor-derived | partial (presence asserted; node enumeration deferred) |
| D-LIB-04 | Sets section (expandable) | `LibraryPage.tsx:24` → `SetsSection` | C-LIB-01 | editor-derived | implemented |
| D-LIB-05 | Device memory panel (tones + patches on device) | `LibraryPage.tsx` → `DeviceMemoryPanel` | C-LIB-02 | editor-derived | partial (drop-target coverage incomplete) |
| D-LIB-06 | Drag device tone → library (export) | `DeviceMemoryPanel.tsx:68` → `handleToneDragStart` | C-LIB-04 | editor-derived | implemented |
| D-LIB-07 | Drag device patch → library (export) | `DeviceMemoryPanel.tsx` → `handlePatchDragStart` | C-LIB-04 | editor-derived | implemented |
| D-LIB-08 | Drop library tone → device tone slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryTone` | C-LIB-03 | editor-derived | implemented |
| D-LIB-09 | Drop library patch → device patch slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryPatch` | C-LIB-03 | editor-derived | implemented |
| D-LIB-10 | Save Set dialog (full device state → named set) | `LibraryPage.tsx:26` → `SaveSetDialog` | C-LIB-05 | editor-derived | implemented |
| D-LIB-11 | Load Set dialog (set → device, with MemoryMapPanel) | `LibraryPage.tsx:27` → `LoadSetDialog` | C-LIB-06 | editor-derived | implemented |
| D-LIB-12 | Import Library Tone dialog (slot + segment selection) | `LibraryPage.tsx:28` → `ImportLibraryToneDialog` | C-LIB-03 | editor-derived | implemented |
| D-LIB-13 | Import Library Patch dialog | `LibraryPage.tsx:29` → `ImportLibraryPatchDialog` | C-LIB-03 | editor-derived | implemented |
| D-LIB-14 | Import Samples dialog (sample bundle, MemoryMapPanel + BestFitPicker) | `LibraryPage.tsx:30` → `ImportSamplesDialog` | C-LIB-07 | editor-derived | implemented |
| D-LIB-15 | Export Tone dialog | `LibraryPage.tsx:33` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented |
| D-LIB-16 | Export Patch dialog | `LibraryPage.tsx:34` → `ExportPatchDialog` | C-LIB-04 | editor-derived | implemented |
| D-LIB-17 | Loop Editor dialog (from library) | `LibraryPage.tsx:31` → `LoopEditorDialog` | C-LIB-07 | editor-derived | implemented |
| D-LIB-18 | Sample Editor dialog | `LibraryPage.tsx:32` → `SampleEditorDialog` | C-LIB-07 | editor-derived | implemented |
| D-LIB-19 | Sample Chopper dialog | `SampleChopperDialog` from `@audiocontrol/sample-chopper/ui` | n/a (unique to editor) | editor-derived | implemented |
| D-LIB-20 | MemoryMapPanel — ToneSlotMap | `LoadSetDialog.tsx:17` → `ToneSlotMap` | C-LIB-10 | editor-derived | implemented |
| D-LIB-21 | MemoryMapPanel — WaveSegmentMap | `ImportSamplesDialog.tsx:18` → `WaveSegmentMap` | C-LIB-10 | editor-derived | implemented |
| D-LIB-22 | Refresh device button | `LibraryPage.tsx` → refresh callback | C-LIB-02 | client-derived | implemented |

---

## D-PLAY — Play (Multi Mode)

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-PLAY-01 | 8-part (A-H) grid | `PlayPage.tsx:321` → `parts.map(...)` | C-PLAY-01 | editor-derived | implemented |
| D-PLAY-02 | Part label (A-H) | `PlayPage.tsx:329` → `part.id` | C-PLAY-01 | editor-derived | implemented |
| D-PLAY-03 | VAL / active indicator | `PlayPage.tsx:333` → `part.active ? '*' : ''` | C-PLAY-01 | native | partial (always renders `*`; `active` field never updated from device) |
| D-PLAY-04 | MIDI channel — select (1-16) | `s-series-client.ts:231` → `setMultiChannel` | C-PLAY-04 | native | implemented |
| D-PLAY-05 | Patch — select | `s-series-client.ts:232` → `setMultiPatch` | C-PLAY-05 | native | implemented |
| D-PLAY-06 | Output — select (1-8) | `s-series-client.ts:233` → `setMultiOutput` | C-PLAY-06 | native | implemented |
| D-PLAY-07 | Level — slider (0-127) | `s-series-client.ts:234` → `setMultiLevel` | C-PLAY-07 | native | implemented |
| D-PLAY-08 | Load function parameters on connect | `s-series-client.ts:230` → `requestFunctionParameters` (client-composed of multiple reads) | C-PLAY-03 | client-derived | implemented |
| D-PLAY-09 | Patch name resolution from store | `PlayPage.tsx:163` → resolves `patches[part.patchIndex].common.name` | C-PLAY-03 | editor-derived | implemented |
| D-PLAY-10 | Bank reload — P11-P18 button | `PlayPage.tsx:276` → `loadPatchBank(0, true)` | C-PLAY-04 | client-derived | partial (S-330 only — buttons hardcoded; S-550 has 4 banks) |
| D-PLAY-11 | Bank reload — P21-P28 button | `PlayPage.tsx:291` → `loadPatchBank(1, true)` | C-PLAY-04 | client-derived | partial (S-330 only) |
| D-PLAY-12 | Loading progress bar (header) | `PlayPage.tsx:263` → `loadingProgress` + `loadingMessage` | C-XX-02 | editor-derived | partial (% bar only; no bytes/elapsed/ETA per design system) |
| D-PLAY-13 | Error display region | `PlayPage.tsx:453` → `<div data-testid="error-message">` | C-XX-03 | editor-derived | implemented |

---

## D-SYS — System Parameters (none implemented)

`SSeriesBaseSystemParams` has 11 fields. None are exposed in the UI; no client interface methods exist for system-parameter read/write.

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-SYS-01 | Master Tune | `SSeriesBaseSystemParams.masterTune` | n/a | native | missing |
| D-SYS-02 | Master Level | `SSeriesBaseSystemParams.masterLevel` | n/a | native | missing |
| D-SYS-03 | MIDI Channel (system) | `SSeriesBaseSystemParams.midiChannel` | n/a | native | missing |
| D-SYS-04 | Device ID (system) | `SSeriesBaseSystemParams.deviceId` | n/a | native | missing |
| D-SYS-05 | Exclusive Enable | `SSeriesBaseSystemParams.exclusiveEnabled` | n/a | native | missing |
| D-SYS-06 | Prog Change Enable | `SSeriesBaseSystemParams.progChangeEnabled` | n/a | native | missing |
| D-SYS-07 | Ctrl Change Enable | `SSeriesBaseSystemParams.ctrlChangeEnabled` | n/a | native | missing |
| D-SYS-08 | Bender Enable (system-level) | `SSeriesBaseSystemParams.benderEnabled` | n/a | native | missing |
| D-SYS-09 | Mod Wheel Enable | `SSeriesBaseSystemParams.modWheelEnabled` | n/a | native | missing |
| D-SYS-10 | Aftertouch Enable (system-level) | `SSeriesBaseSystemParams.aftertouchEnabled` | n/a | native | missing |
| D-SYS-11 | Hold Pedal Enable | `SSeriesBaseSystemParams.holdPedalEnabled` | n/a | native | missing |

---

## D-XX — Cross-Cutting

| ID | Affordance | Source of truth | Parent | Origin | Status |
|----|-----------|-----------------|--------|--------|--------|
| D-XX-01 | Virtual Front Panel — floating draggable panel | `VirtualFrontPanel.tsx` | C-XX-04 | editor-derived | implemented |
| D-XX-02 | VFP — Navigation buttons (DT1) | `VirtualFrontPanel.tsx` → `NavigationPad` → `useFrontPanel` | C-XX-04 | native | implemented |
| D-XX-03 | VFP — Value buttons (DT1) | `VirtualFrontPanel.tsx` → `ValueButtons` | C-XX-04 | native | implemented |
| D-XX-04 | VFP — Function buttons (MODE/MENU/SUB MENU/COM/Execute) | `VirtualFrontPanel.tsx` → `FunctionButtonRow` | C-XX-04 | native | implemented |
| D-XX-05 | VFP — Keyboard shortcuts | `VirtualFrontPanel.tsx:7` → `keydown` listener | C-XX-04 | editor-derived | implemented |
| D-XX-06 | VFP — Drag to reposition | `VirtualFrontPanel.tsx` → mouse drag + localStorage | C-XX-04 | editor-derived | implemented |
| D-XX-07 | VFP — Collapse/expand | `VirtualFrontPanel.tsx` → `STORAGE_KEY_EXPANDED` | C-XX-04 | editor-derived | implemented |
| D-XX-08 | VFP — Connection status indicator (green dot) | `VirtualFrontPanel.tsx` | C-XX-04 | editor-derived | implemented |
| D-XX-09 | Video capture drawer (USB / webcam) | `Layout.tsx` → `VideoCapture` | n/a (unique to editor) | editor-derived | implemented |
| D-XX-10 | Front-panel controls inside video drawer | `VideoCapture.tsx:15` → reuses VFP components | n/a (unique to editor) | editor-derived | implemented |
| D-XX-11 | MIDI Panic button (CC 120 + 123 on all channels) | `Layout.tsx` → `PanicButton` (client `panic()`) | n/a | client-derived | implemented |
| D-XX-12 | Progress indicators (cross-cutting) | Multiple pages → `loadingProgress` + `loadingMessage` | C-XX-02 | editor-derived | partial (% bar only; design system requires bytes/elapsed/ETA) |

---

## Summary

### By area

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

The editor-derived count (77 of 183, ~42%) shows how much of the editor's user-facing value lives above the protocol. A redesign that preserves the protocol contract but reshapes editor-derived surfaces is exactly what Phase 9 visual polish targets.

### Missing → action items

- **D-SYS (11 missing).** No system-parameter affordances at all. Adding these would be a meaningful Phase 11+ scope.
- **D-TONE-ADV (7 missing).** Advanced tone fields (sourceTone, origSubTone, recThreshold, etc.) — likely lower priority but should be tracked.
- **D-TONE-WAVE-09..11 (3 missing).** Wave bank/segment editing on the tone editor itself (currently only available in import dialog).
- **D-TONE-TVA-06.** Top-level `tvaLfoDepth` is silently dropped. Either render it or document the divergence.
- **D-PATCH-13.** Patch `copySource` field never rendered.

---

## Document maintenance

This document lives at the top level of the repository alongside [`ROLAND-S550-EDITOR-CAPABILITIES.md`](ROLAND-S550-EDITOR-CAPABILITIES.md). It is owned by the project, not by any feature branch — features may add, change, or strike affordances, but the document itself is a long-lived inventory.

- Each affordance change is part of a PR; the PR description references the `D-<AREA>-<NN>` id.
- The summary tables (by-area + by-origin) are updated in the same PR as the affordance change.
- Removed affordances stay in the document as `removed (<reason>, <PR link>)`. History is not deleted.
- New device editors get sibling docs (e.g., `AKAI-S3000XL-EDITOR-CAPABILITIES-DETAILED.md`).
- Origin classifications can shift over time (e.g., a `client-derived` op might be promoted to native if the device protocol grows; an `editor-derived` op might be moved into the client). Such reclassifications are part of the PR that motivates them.
