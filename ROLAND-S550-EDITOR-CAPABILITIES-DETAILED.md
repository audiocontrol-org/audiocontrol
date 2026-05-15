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

1. **Missing UI coverage** — affordances marked `implemented` with `Coverage: none` or `Coverage: partial` in the machine-generated column. The UI works but the four-tier evidence model (see below) is not yet complete against future redesign.
2. **Missing UI** — affordances marked `missing`. The protocol or storage layer supports the affordance but no editor surface exposes it. Each one represents a feature the editor *should* have.

## How to read this document

Each table row is one affordance. The Affordance cell is verb-led, names the value (with range / units where applicable), and distinguishes read-only from operator-driven. The widget noun (slider / select / checkbox) is suppressed — it belongs to the implementation, not the affordance. The columns are:

- **ID** — `D-<AREA>-<NN>`. Stable forever; never reused.
- **Affordance** — one-line, verb-led, value-named user-facing description (`Edit X` / `Read X` / `Assign X to Y` / `Trigger X` / `Toggle X` / `Add X` / `Drag X to Y` / `Show X` / `Navigate to X`).
- **Source of truth** — the canonical reference (component file, client method, or data-structure field). May reference widget code identifiers (e.g., `<select>`) when citing the implementation.
- **Parent** — the matching `C-<AREA>-<NN>` from the parent doc, or `n/a` for sub-affordances the parent doesn't enumerate.
- **Origin** — `native` / `client-derived` / `editor-derived` (see below).
- **Status** — `implemented` / `partial` / `missing`. Determined by reading actual TSX, not by parent test coverage.
- **Sign-off** — **operator-owned** column. Records the most recent operator hardware sign-off for the capability. Format per [`docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`](docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md) §7: `none` (default), `<YYYY-MM-DD> <signer> <sha>`, or `revoked <YYYY-MM-DD> <signer>`. The cell shows only the latest sign-off; history is recoverable via `git blame` and the coverage manifest's append-only iteration journal. Rows with status `removed` (or wrapped in `~~...~~` strikethrough) carry `n/a` for both Sign-off and Coverage — they describe capabilities that were removed and are not signable.
- **Coverage** — **machine-generated** column populated by `tools/generate-coverage-manifest.ts`. Values: `none` / `partial` / `confident` per the rules in reform spec §6. Any hand edit to this column is overwritten on the next manifest regeneration; the initial `—` is a placeholder that the generator overwrites on every run, including with `none` when the row has no Tier 2/3/4 evidence.

### The four-tier coverage model

Per [reform spec §2](docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md), each implemented affordance is exercised across up to four tiers of evidence:

| Tier | Source | What it proves |
|---|---|---|
| 1 | `modules/<editor>/test/wiring/` | The device-write seam fires with the right bytes when forced. Necessary for protocol correctness; does **not** satisfy any UI capability gate on its own. |
| 2 | `modules/<editor>/test/ui/contract/` | The interactive primitive works in isolation under real pointer events and accessibility queries, mounted against a stub consumer with a window-exposed spy. |
| 3 | `modules/<editor>/test/ui/in-context/` | The same primitive works on its real page with real fixtures — the rendered DOM is the production page, catching occlusion / parent-grid collapse / layering bugs. |
| 4 | Inventory `Sign-off` column | A human exercised the capability against real hardware and recorded a dated sign-off keyed to the production commit SHA. |

Tier 1 evidence is the migrated capability specs now living under `test/wiring/`; their D-ID test names are preserved. Tier 2 and Tier 3 specs are added per primitive and per page across later reform tasks. Tier 4 evidence is what the `Sign-off` column captures.

### Coverage-manifest generation flow

`tools/generate-coverage-manifest.ts` (reform Task A.1-T7) is the single source of truth for the `Coverage` column. Per [reform spec §6](docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md), the script:

1. Walks `test/wiring/`, `test/ui/contract/`, and `test/ui/in-context/` and extracts D-IDs from each test's name.
2. Tags each test by directory → tier (1 / 2 / 3).
3. Records pass/fail by running the suite and runs the credibility pass per spec (broken-variant fail-then-pass per §5).
4. Parses this document's `Sign-off` column per D-row to extract Tier 4 evidence (date, signer, SHA, revocation state).
5. Computes `coverage` per D-ID: `confident` iff Tier 2 + Tier 3 specs both have `credibleVerified: true` AND a non-revoked sign-off exists; `partial` if some but not all of those hold; `none` if nothing or only Tier 1 evidence.
6. Writes `coverage-manifest.{json,md}` and updates the `Coverage` column in this document.

`Sign-off` is operator-owned and is **read-only to the generator** — the generator never overwrites it; it warns if a cell's format is unparseable. `Coverage` is generator-owned — any hand edit is overwritten on the next run. Both columns live inline on the capability's own row so there is exactly one location for each fact. The generator parses each main D-row table by header name, not column position, so Sign-off and Coverage can be reordered without breaking the parser; only column-rename requires a generator update.

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

## Missing affordances roll-up (18)

These affordances *should* exist — the protocol supports them and/or sibling
affordances of the same shape are implemented — but no UI surface exists in
the current editor. Each is a feature the editor needs. Filed as four
GitHub issues grouped by feature coherence.

| ID | Affordance | Source of truth | Tracked in |
|----|-----------|-----------------|------------|
| D-PATCH-13 | Patch copy source | `SSeriesBasePatchCommon.copySource` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-WAVE-09 | Wave bank assignment (in tone editor) | `SSeriesWaveParams.bank` | implemented in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase B |
| D-TONE-WAVE-10 | Segment top (in tone editor) | `SSeriesWaveParams.segmentTop` | implemented in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase B |
| D-TONE-WAVE-11 | Segment length (in tone editor) | `SSeriesWaveParams.segmentLength` | implemented in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase B |
| D-TONE-TVA-06 | ~~Top-level tvaLfoDepth (distinct from tva.lfoDepth)~~ removed: data-model duplicate of TVA-02 | dedup commit 447a7dfd (#408 Phase A) | removed in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase A |
| D-TONE-ADV-01 | Source tone reference | `SSeriesBaseTone.sourceTone` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-ADV-02 | Original sub-tone | `SSeriesBaseTone.origSubTone` | [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) |
| D-TONE-ADV-03 | Recording threshold | `SSeriesBaseTone.recThreshold` | [#410](https://github.com/audiocontrol-org/audiocontrol/issues/410) |
| D-TONE-ADV-04 | Recording pre-trigger | `SSeriesBaseTone.recPreTrigger` | [#410](https://github.com/audiocontrol-org/audiocontrol/issues/410) |
| D-TONE-ADV-05 | Loop tune | `SSeriesBaseTone.loopTune` | implemented in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase B |
| D-TONE-ADV-06 | Envelope zoom | `SSeriesBaseTone.envZoom` | implemented in [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Phase B |
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
| D-TONE-WAVE | 11 | 9 | 1 | 1 |
| D-TONE-LOOP | 6 | 6 | 0 | 0 |
| D-TONE-PITCH | 5 | 4 | 1 | 0 |
| D-TONE-TVF | 10 | 10 | 0 | 0 |
| D-TONE-TVA | 5 | 5 | 0 | 0 |
| D-TONE-LFO | 6 | 5 | 1 | 0 |
| D-TONE-ENV | 12 | 12 | 0 | 0 |
| D-TONE-SAMPLE | 4 | 4 | 0 | 0 |
| D-TONE-ADV | 7 | 2 | 0 | 5 |
| D-LIB | 22 | 19 | 3 | 0 |
| D-PLAY | 13 | 9 | 4 | 0 |
| D-SYS | 11 | 0 | 0 | 11 |
| D-XX | 13 | 7 | 6 | 0 |
| **Total** | **183** | **138** | **17** | **18** |

### By origin

| Origin | Count | Notes |
|--------|-------|-------|
| native | 95 | Direct device protocol ops + per-field tone writes via `sendToneData`. Includes 18 missing items where the field exists but no UI affordance does. |
| client-derived | 11 | `loadPatchRange`, `loadToneRange`, `requestFunctionParameters`, `panic`, etc. — composed in `SSeriesClientInterface`. |
| editor-derived | 77 | Library / OPFS / sample chopper / loop editor / sample editor / drag-drop / virtual-panel UI / video drawer — the value the editor adds beyond a transparent protocol bridge. |

### By coverage (live, regenerated by manifest)

The summary counts above are status, not coverage. The `Coverage` column on every D-row carries the live machine-generated state. To audit coverage in aggregate, regenerate the manifest (`pnpm run generate-coverage-manifest`) and read its summary output — counts of `none` / `partial` / `confident` rows are authoritative there, not here.

---

## D-CONN — Connection

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-CONN-01 | Select MIDI input port | `HomePage.tsx` → `MidiConnectionPage` (`editor-core`) | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-02 | Select MIDI output port | `HomePage.tsx` → `MidiConnectionPage` | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-03 | Edit device ID (0–127) | `HomePage.tsx` → `MidiConnectionPageConfig.deviceIdLabel` | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-04 | Trigger Connect / Continue action | `HomePage.tsx` → `MidiConnectionPageConfig.continueLabel` | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-05 | Show secure-context warning with help items | `HomePage.tsx` → `secureContextHelpItems` | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-06 | Show device-setup help items | `HomePage.tsx` → `MidiConnectionPageConfig.helpItems` | C-CONN-01 | editor-derived | implemented | none | none |
| D-CONN-07 | Read connection status (header) | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-02 | editor-derived | implemented | none | none |
| D-CONN-08 | Trigger Disconnect action | `Layout.tsx` → `MidiStatusDisplay` | C-CONN-03 | editor-derived | implemented | none | none |
| D-CONN-09 | Navigate to Play | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | none | none |
| D-CONN-10 | Navigate to Patches | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | none | none |
| D-CONN-11 | Navigate to Tones | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | none | none |
| D-CONN-12 | Navigate to Library | `Layout.tsx` → nav item | C-CONN-04 | editor-derived | implemented | none | none |

---

## D-PATCH-LIST — Patch List

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-PATCH-LIST-01 | Enumerate patch slots across the full address space (sparse) | `PatchList.tsx` → `patches.map(...)` | C-PATCH-01 | editor-derived | implemented | none | none |
| D-PATCH-LIST-02 | Read patch slot ID (formatted per MemoryLayout) | `PatchList.tsx` → `<PatchLabel ... />` | C-PATCH-02 | editor-derived | implemented | none | none |
| D-PATCH-LIST-03 | Read patch name | `PatchList.tsx:100` → `patch.common.name` | C-PATCH-02 | native | implemented | none | none |
| D-PATCH-LIST-04 | Read per-slot load state (loaded / loading / empty / not-loaded) | `PatchList.tsx` → class-based states | C-PATCH-03 | editor-derived | implemented | none | none |
| D-PATCH-LIST-05 | Load an unloaded patch bank by clicking its row | `PatchList.tsx:101` → `onLoadBank(slotBank)` | C-PATCH-04 | client-derived | implemented | none | none |
| D-PATCH-LIST-06 | Refresh all patch banks from the device (Phase 9 consolidated per-bank toolbar into one icon affordance) | `PatchesPage.tsx:243-261` → `refreshAll` | C-PATCH-05 | client-derived | implemented | none | none |
| D-PATCH-LIST-07 | Refresh all patch banks from the device (Phase 9 subsumed the legacy "Load All" action under the same icon affordance) | `PatchesPage.tsx:243-261` → `refreshAll` | C-PATCH-05 | client-derived | implemented | none | none |
| D-PATCH-LIST-08 | Export a patch to the library (per row) | `PatchList.tsx:167` → `onExportPatch` | C-LIB-04 | editor-derived | implemented | none | none |

---

## D-PATCH — Patch Common Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-PATCH-01 | Edit patch name (12 ASCII chars, max length 12) | `s-series-client.ts:240` → `setPatchName` | C-PATCH-07 | native | implemented | none | none |
| D-PATCH-02 | Assign patch key mode (poly / unison / v-sw / v-mix) | `s-series-client.ts:241` → `setPatchKeyMode` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-03 | Assign patch key-assign policy | `s-series-client.ts:248` → `setPatchKeyAssign` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-04 | Edit patch pitch-bender range (0–12 semitones) | `s-series-client.ts:245` → `setPatchBenderRange` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-05 | Assign patch aftertouch target | `s-series-client.ts:247` → `setPatchAftertouchAssign` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-06 | Read patch octave shift | `PatchEditor.tsx:389-403` → reads `common.octaveShift`, no write | C-PATCH-08 | native | partial (display only; editing blocked pending issue #10) | none | none |
| D-PATCH-07 | Assign patch output (Out 1–8 or TONE) | `s-series-client.ts:249` → `setPatchOutput` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-08 | Edit patch level (0–127) | `s-series-client.ts:250` → `setPatchLevel` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-09 | Edit patch aftertouch sensitivity (0–127) | `s-series-client.ts:246` → `setPatchAftertouchSens` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-10 | Edit patch unison detune (-64..+63; active in unison key mode) | `s-series-client.ts:251` → `setPatchDetune` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-11 | Edit patch velocity-switch threshold (0–127; active in v-sw key mode) | `s-series-client.ts:252` → `setPatchVelocityThreshold` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-12 | Edit patch velocity-mix ratio (0–127; active in v-mix key mode) | `s-series-client.ts:253` → `setPatchVelocityMixRatio` | C-PATCH-08 | native | implemented | none | none |
| D-PATCH-13 | Edit patch copy source (not rendered) | `SSeriesBasePatchCommon.copySource` | C-PATCH-08 | native | missing | none | none |

---

## D-PATCH-ZONE — Tone Zones (within a patch)

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-PATCH-ZONE-01 | Read a tone-zone's key range as a horizontal bar | `ToneZoneEditor.tsx` → flex-bar render | C-PATCH-09 | editor-derived | implemented | none | none |
| D-PATCH-ZONE-02 | Add a tone zone to the patch | `ToneZoneEditor.tsx` → add-zone action | C-PATCH-09 | native | implemented | none | none |
| D-PATCH-ZONE-03 | Remove a tone zone from the patch | `ToneZoneEditor.tsx` → delete-zone action | C-PATCH-09 | native | implemented | none | none |
| D-PATCH-ZONE-04 | Assign a tone to a zone | `ToneZoneEditor.tsx` → tone select per zone | C-PATCH-09 | native | implemented | none | none |
| D-PATCH-ZONE-05 | Assign a zone's start key | `ToneZoneEditor.tsx` → startKey select | C-PATCH-10 | native | implemented | none | none |
| D-PATCH-ZONE-06 | Assign a zone's end key | `ToneZoneEditor.tsx` → endKey select | C-PATCH-10 | native | implemented | none | none |
| D-PATCH-ZONE-07 | Trigger MIDI Learn for a zone's start key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented | none | none |
| D-PATCH-ZONE-08 | Trigger MIDI Learn for a zone's end key | `ToneZoneEditor.tsx` → `useMidiLearn` | C-PATCH-10 | editor-derived | implemented | none | none |

---

## D-TONE-LIST — Tone List

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-LIST-01 | Enumerate tone slots across the full address space | `ToneList.tsx:44` → `tones.map(...)` | C-TONE-01 | editor-derived | implemented | none | none |
| D-TONE-LIST-02 | Read tone slot ID (formatted per MemoryLayout) | `ToneList.tsx:93` → `memoryLayout.formatToneSlot` | C-TONE-02 | editor-derived | implemented | none | none |
| D-TONE-LIST-03 | Read tone name | `ToneList.tsx:100` → `tone.name` | C-TONE-02 | native | implemented | none | none |
| D-TONE-LIST-04 | Read per-slot load state (loaded / loading / empty / not-loaded) | `ToneList.tsx` → class-based states | C-TONE-03 | editor-derived | implemented | none | none |
| D-TONE-LIST-05 | Load an unloaded tone bank by clicking its row | `ToneList.tsx:95-100` → `onLoadBank(slotBank)` | C-TONE-04 | client-derived | implemented | none | none |
| D-TONE-LIST-06 | Refresh all tone banks from the device (Phase 9 consolidated per-bank toolbar into one icon affordance) | `TonesPage.tsx:335-352` → `refreshAll` | C-TONE-05 | client-derived | implemented | none | none |
| D-TONE-LIST-07 | Export a tone to the library (per row; gated on library connection) | `ToneList.tsx:158-171` → `onExportTone` (gate: `canExportToLibrary && hasSampleData`) | C-LIB-04 | editor-derived | implemented | none | none |

---

## D-TONE-WAVE — Wave Section Parameters

Tones are written as a whole structure via `sendToneData(toneIndex, tone)`. Each affordance below mutates a field on `SSeriesBaseTone` and the editor re-sends the whole structure — but each FIELD maps directly to a real device parameter, so origin is `native`.

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-WAVE-01 | Edit tone name (8 ASCII chars, max length 8) | `ToneEditor.tsx:100` → `tone.name` | C-TONE-06 | native | implemented | none | none |
| D-TONE-WAVE-02 | Edit tone original key (0–127, MIDI note) | `ToneEditor.tsx:228` → `tone.originalKey` | C-TONE-07 | native | implemented | none | none |
| D-TONE-WAVE-03 | Read tone sample rate | `ToneWavePanel.tsx:71-76` → `<div>{tone.sampleRate}</div>` | C-TONE-07 | native | partial (display only; no edit control) | none | none |
| D-TONE-WAVE-04 | Assign tone loop mode (forward / alternating / one-shot / reverse) | `ToneEditor.tsx:254` → `tone.loopMode` | C-TONE-07 | native | implemented | none | none |
| D-TONE-WAVE-05 | Assign tone output (Mix or Out 1–8) | `ToneEditor.tsx:274` → `tone.outputAssign` | C-TONE-07 | native | implemented | none | none |
| D-TONE-WAVE-06 | Edit tone wave start point (24-bit sample address) | `ToneEditor.tsx:301` → `tone.wave.startPoint` | C-TONE-13 | native | implemented | none | none |
| D-TONE-WAVE-07 | Edit tone wave loop point (24-bit sample address) | `ToneEditor.tsx:319` → `tone.wave.loopPoint` | C-TONE-13 | native | implemented | none | none |
| D-TONE-WAVE-08 | Edit tone wave end point (24-bit sample address) | `ToneEditor.tsx:336` → `tone.wave.endPoint` | C-TONE-13 | native | implemented | none | none |
| D-TONE-WAVE-09 | Assign tone to a wave bank (A/B on S-330; A/B/C/D on S-550) | `ToneWavePanel.tsx` → `tone.wave.bank` | C-TONE-07 | native | implemented | none | none |
| D-TONE-WAVE-10 | Edit tone segment top (0–17) | `ToneWavePanel.tsx` → `tone.wave.segmentTop` | C-TONE-07 | native | implemented | none | none |
| D-TONE-WAVE-11 | Edit tone segment length (0–18) | `ToneWavePanel.tsx` → `tone.wave.segmentLength` | C-TONE-07 | native | implemented | none | none |

---

## D-TONE-LOOP — Loop Editor (visual)

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-LOOP-01 | Load wave data for a tone (explicit fetch; gated on `hasSampleData && !waveData && !isLoadingWaveData`) | `ToneWavePanel.tsx:186-198` → `onLoadWaveData` | C-TONE-13 | client-derived | implemented | none | none |
| D-TONE-LOOP-02 | Show visual waveform for the loaded tone | `LoopEditor` from `@audiocontrol/loop-editor/ui` | C-TONE-13 | editor-derived | implemented | none | none |
| D-TONE-LOOP-03 | Drag the loop-start marker | `LoopEditor` (`@audiocontrol/loop-editor/ui`) | C-TONE-13 | editor-derived | implemented | none | none |
| D-TONE-LOOP-04 | Drag the loop-end marker | `LoopEditor` | C-TONE-13 | editor-derived | implemented | none | none |
| D-TONE-LOOP-05 | Trigger auto-detect loop points | `LoopEditor` | C-TONE-13 | editor-derived | implemented | none | none |
| D-TONE-LOOP-06 | Trigger audio preview / playback of the loop | `LoopEditor` | C-TONE-13 | editor-derived | implemented | none | none |

---

## D-TONE-PITCH — Pitch Section

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-PITCH-01 | Edit tone transpose (-24..+24 semitones; control disabled in current build) | `TonePitchPanel.tsx:29-39` → field exists; control disabled | C-TONE-08 | native | partial (slider visible, editing disabled) | none | none |
| D-TONE-PITCH-02 | Edit tone fine tune (-64..+63 cents) | `ToneEditor.tsx:623` → `tone.fineTune` | C-TONE-08 | native | implemented | none | none |
| D-TONE-PITCH-03 | Toggle tone pitch follow | `ToneEditor.tsx:634` → `tone.pitchFollow` | C-TONE-08 | native | implemented | none | none |
| D-TONE-PITCH-04 | Toggle tone pitch-bender enable | `ToneEditor.tsx:653` → `tone.benderEnabled` | C-TONE-08 | native | implemented | none | none |
| D-TONE-PITCH-05 | Toggle tone aftertouch enable | `ToneEditor.tsx:670` → `tone.aftertouchEnabled` | C-TONE-08 | native | implemented | none | none |

---

## D-TONE-TVF — TVF (Filter) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-TVF-01 | Toggle TVF section enable | `ToneEditor.tsx:396` → `tone.tvf.enabled` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-02 | Edit TVF cutoff (0–127) | `ToneEditor.tsx:414` → `tone.tvf.cutoff` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-03 | Edit TVF resonance (0–127) | `ToneEditor.tsx:425` → `tone.tvf.resonance` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-04 | Edit TVF key follow (0–127) | `ToneEditor.tsx:434` → `tone.tvf.keyFollow` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-05 | Edit TVF LFO depth (0–127) | `ToneEditor.tsx:443` → `tone.tvf.lfoDepth` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-06 | Edit TVF envelope depth (0–127) | `ToneEditor.tsx:453` → `tone.tvf.egDepth` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-07 | Edit TVF key-rate follow (0–127) | `ToneEditor.tsx:462` → `tone.tvf.keyRateFollow` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-08 | Edit TVF velocity-rate follow (0–127) | `ToneEditor.tsx:471` → `tone.tvf.velRateFollow` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-09 | Assign TVF envelope polarity (normal / reverse) | `ToneEditor.tsx:482` → `tone.tvf.egPolarity` | C-TONE-09 | native | implemented | none | none |
| D-TONE-TVF-10 | Assign TVF level curve (0–5) | `ToneEditor.tsx:501` → `tone.tvf.levelCurve` | C-TONE-09 | native | implemented | none | none |

---

## D-TONE-TVA — TVA (Amplifier) Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-TVA-01 | Edit TVA level (0–127) | `ToneEditor.tsx:697` → `tone.tva.level` | C-TONE-10 | native | implemented | none | none |
| D-TONE-TVA-02 | Edit TVA LFO depth (0–127) | `ToneEditor.tsx:704` → `tone.tva.lfoDepth` | C-TONE-10 | native | implemented | none | none |
| D-TONE-TVA-03 | Edit TVA key rate (0–127) | `ToneEditor.tsx:712` → `tone.tva.keyRate` | C-TONE-10 | native | implemented | none | none |
| D-TONE-TVA-04 | Edit TVA velocity rate (0–127) | `ToneEditor.tsx:720` → `tone.tva.velRate` | C-TONE-10 | native | implemented | none | none |
| D-TONE-TVA-05 | Assign TVA level curve (0–5) | `ToneEditor.tsx:729` → `tone.tva.levelCurve` | C-TONE-10 | native | implemented | none | none |
| D-TONE-TVA-06 | ~~Edit top-level tvaLfoDepth~~ removed: data-model duplicate of TVA-02 at the same encoded offset | dedup commit 447a7dfd (#408 Phase A) | C-TONE-10 | native | removed | n/a | n/a |

---

## D-TONE-LFO — LFO Parameters

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-LFO-01 | Edit LFO rate (0–127) | `ToneEditor.tsx:535` → `tone.lfo.rate` | C-TONE-11 | native | implemented | none | none |
| D-TONE-LFO-02 | Edit LFO delay (0–127) | `ToneEditor.tsx:543` → `tone.lfo.delay` | C-TONE-11 | native | implemented | none | none |
| D-TONE-LFO-03 | Edit LFO offset (0–127) | `ToneEditor.tsx:551` → `tone.lfo.offset` | C-TONE-11 | native | implemented | none | none |
| D-TONE-LFO-04 | Toggle LFO key sync | `ToneEditor.tsx:561` → `tone.lfo.sync` | C-TONE-11 | native | implemented | none | none |
| D-TONE-LFO-05 | Read LFO mode | `ToneLfoPanel.tsx:53-58` → `<div>{tone.lfo.mode}</div>` | C-TONE-11 | native | partial (display only; no edit control) | none | none |
| D-TONE-LFO-06 | Toggle LFO peak-hold (polarity) | `ToneEditor.tsx:586` → `tone.lfo.polarity` | C-TONE-11 | native | implemented | none | none |

---

## D-TONE-ENV — 8-segment Envelopes (TVF + TVA)

S-series envelopes are 8-segment (NOT ADSR). Each envelope has 8 levels + 8 rates + sustain point + end point.

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-ENV-01 | Drag TVF envelope handles on the SVG visualization | `EnvelopeEditor.tsx` → SVG drag handlers | C-TONE-12 | editor-derived | implemented | none | none |
| D-TONE-ENV-02 | Edit TVF envelope per-segment rate (8 rates; 1–127 each) | `EnvelopeEditor.tsx` → rates inputs | C-TONE-12 | native | implemented | none | partial |
| D-TONE-ENV-03 | Edit TVF envelope per-segment level (8 levels; 0–127 each) | `EnvelopeEditor.tsx` → levels inputs | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-04 | Assign TVF envelope sustain point (0–7) | `EnvelopeEditor.tsx` → sustainPoint | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-05 | Assign TVF envelope end point (1–8) | `EnvelopeEditor.tsx` → endPoint | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-06 | Open TVF envelope fullscreen overlay | `EnvelopeEditor.tsx:94-99` → overlay | C-TONE-12 | editor-derived | implemented | none | none |
| D-TONE-ENV-07 | Drag TVA envelope handles on the SVG visualization | `EnvelopeEditor.tsx` (reused) | C-TONE-12 | editor-derived | implemented | none | none |
| D-TONE-ENV-08 | Edit TVA envelope per-segment rate (8 rates; 1–127 each) | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-09 | Edit TVA envelope per-segment level (8 levels; 0–127 each) | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-10 | Assign TVA envelope sustain point (0–7) | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-11 | Assign TVA envelope end point (1–8) | `EnvelopeEditor.tsx` | C-TONE-12 | native | implemented | none | none |
| D-TONE-ENV-12 | Open TVA envelope fullscreen overlay | `EnvelopeEditor.tsx:94-99` | C-TONE-12 | editor-derived | implemented | none | none |

---

## D-TONE-SAMPLE — Sample Import/Export Actions

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-SAMPLE-01 | Import a WAV file from disk into a tone slot (opens a dialog) | `ToneEditor.tsx:163` → `ImportSampleDialog` (composes WAV decode + `importTone`) | C-LIB-07 | editor-derived | implemented | none | none |
| D-TONE-SAMPLE-02 | Export a tone's wave data to a WAV file | `ToneEditor.tsx:138` → `useToneSampleExport` | C-LIB-08 | editor-derived | implemented | none | none |
| D-TONE-SAMPLE-03 | Export a tone + its sample to a library set | `ToneEditor.tsx:115` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented | none | none |
| D-TONE-SAMPLE-04 | Chop a sample into a drum kit (slice into multiple tones via a dialog) | `ToneEditor.tsx:185` → `SampleChopperDialog` | n/a (unique to editor) | editor-derived | implemented | none | none |

---

## D-TONE-ADV — Advanced Tone Fields (not exposed)

`SSeriesBaseTone` has 7 fields the editor never renders. All would map to native protocol writes via `sendToneData`.

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-TONE-ADV-01 | Edit tone source-tone reference | `SSeriesBaseTone.sourceTone` (s-series-types.ts:251) | C-TONE-07 | native | missing | none | none |
| D-TONE-ADV-02 | Edit tone original sub-tone | `SSeriesBaseTone.origSubTone` (s-series-types.ts:252) | C-TONE-07 | native | missing | none | none |
| D-TONE-ADV-03 | Edit recording threshold | `SSeriesBaseTone.recThreshold` (s-series-types.ts:266) | C-TONE-07 | native | missing | none | none |
| D-TONE-ADV-04 | Edit recording pre-trigger | `SSeriesBaseTone.recPreTrigger` (s-series-types.ts:267) | C-TONE-07 | native | missing | none | none |
| D-TONE-ADV-05 | Edit tone loop tune (-127..+127) | `ToneWavePanel.tsx` → `tone.loopTune` | C-TONE-13 | native | implemented | none | none |
| D-TONE-ADV-06 | Edit tone envelope zoom (0–7) | `ToneAmpPanel.tsx` → `tone.envZoom` | C-TONE-12 | native | implemented | none | none |
| D-TONE-ADV-07 | Edit tone copy source | `SSeriesBaseTone.copySource` (s-series-types.ts:270) | C-TONE-07 | native | missing | none | none |

---

## D-LIB — Library

The library is the editor's primary editor-derived layer. The device has no concept of a "library" — the editor adds OPFS-backed cross-session storage, set archives, import/export workflows, and sample editing on top of the raw protocol.

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-LIB-01 | Connect to the OPFS / local-FS library backend | `LibraryPage.tsx:19` → `useLibraryConnection` | C-LIB-01 | editor-derived | implemented | none | none |
| D-LIB-02 | Connect to the Google Drive library backend (only enabled when `VITE_GOOGLE_CLIENT_ID` is set) | `LibraryPage.tsx` → conditional on `VITE_GOOGLE_CLIENT_ID` | C-LIB-01 | editor-derived | partial (only enabled when env var set) | none | none |
| D-LIB-03 | Show the library tree (Tones / Patches / Samples / Programs category sections) | `PluginLibraryBrowser` from `editor-core` | C-LIB-01 | editor-derived | implemented | none | none |
| D-LIB-04 | Expand and browse the Sets section (gated on `libraryHandle`) | `LibraryPage.tsx:282` → `SetsSection` (gated on `libraryHandle`) | C-LIB-01 | editor-derived | implemented | none | none |
| D-LIB-05 | Show the device memory panel (tones + patches on device) | `LibraryPage.tsx` → `DeviceMemoryPanel` | C-LIB-02 | editor-derived | partial (drop-target coverage incomplete) | none | none |
| D-LIB-06 | Drag a device tone to the library (export) | `DeviceMemoryPanel.tsx:68` → `handleToneDragStart`; `LibraryPage.tsx` `handleExternalDrop` → `useLibraryExport.handleDropDeviceTone` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented | none | none |
| D-LIB-07 | Drag a device patch to the library (export) | `DeviceMemoryPanel.tsx` → `handlePatchDragStart`; `LibraryPage.tsx` `handleExternalDrop` → `useLibraryExport.handleDropDevicePatch` → `ExportPatchDialog` | C-LIB-04 | editor-derived | implemented | none | none |
| D-LIB-08 | Drop a library tone onto a device tone slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryTone` | C-LIB-03 | editor-derived | implemented | none | none |
| D-LIB-09 | Drop a library patch onto a device patch slot (import) | `DeviceMemoryPanel.tsx:44` → `onDropLibraryPatch` | C-LIB-03 | editor-derived | implemented | none | none |
| D-LIB-10 | Save full device state to a named library set (opens a dialog) | `LibraryPage.tsx:26` → `SaveSetDialog` | C-LIB-05 | editor-derived | implemented | none | none |
| D-LIB-11 | Load a library set onto the device (opens a dialog with memory map) | `LibraryPage.tsx:27` → `LoadSetDialog` | C-LIB-06 | editor-derived | implemented | none | none |
| D-LIB-12 | Import a library tone to a device tone slot (opens a dialog with slot + segment selection) | `LibraryPage.tsx:28` → `ImportLibraryToneDialog` | C-LIB-03 | editor-derived | implemented | none | none |
| D-LIB-13 | Import a library patch to a device patch slot (opens a dialog) | `LibraryPage.tsx:29` → `ImportLibraryPatchDialog` | C-LIB-03 | editor-derived | implemented | none | none |
| D-LIB-14 | Import a sample bundle to device memory (opens a dialog with memory map + best-fit picker) | `LibraryPage.tsx:30` → `ImportSamplesDialog`; opens via panel-level DnD on `DeviceMemoryPanel` (`onDropLibrarySample` → `LibraryPage.handleDropLibrarySample` → `useImportSamples.openImportSamplesDialog`) | C-LIB-07 | editor-derived | implemented | none | none |
| D-LIB-15 | Export a tone to the library (opens a dialog) | `LibraryPage.tsx:33` → `ExportToneDialog` | C-LIB-04 | editor-derived | implemented | none | none |
| D-LIB-16 | Export a patch to the library (opens a dialog) | `LibraryPage.tsx:34` → `ExportPatchDialog` | C-LIB-04 | editor-derived | implemented | none | none |
| D-LIB-17 | Open a library sample in the Loop Editor (dialog) | `LibraryPage.tsx:31` → `LoopEditorDialog` | C-LIB-07 | editor-derived | implemented | none | none |
| D-LIB-18 | Open a library sample in the Sample Editor (dialog) | `LibraryPage.tsx:32` → `SampleEditorDialog` | C-LIB-07 | editor-derived | implemented | none | none |
| D-LIB-19 | Open a library sample in the Sample Chopper (dialog) | `SampleChopperDialog` from `@audiocontrol/sample-chopper/ui` | n/a (unique to editor) | editor-derived | implemented | none | none |
| D-LIB-20 | Show the tone-slot memory map (MemoryMapPanel) | `LoadSetDialog.tsx:17` → `ToneSlotMap` | C-LIB-10 | editor-derived | implemented | none | none |
| D-LIB-21 | Show the wave-segment memory map (MemoryMapPanel) | `ImportSamplesDialog.tsx:18` → `WaveSegmentMap` | C-LIB-10 | editor-derived | implemented | none | none |
| D-LIB-22 | Refresh device state into the library view | `LibraryPage.tsx:249` → `handleLoadDeviceData` | C-LIB-02 | client-derived | implemented | none | none |

---

## D-PLAY — Play (Multi Mode)

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-PLAY-01 | Show the 8-part (A–H) Multi Mode grid | `PlayPage.tsx:321` → `parts.map(...)` | C-PLAY-01 | editor-derived | implemented | none | none |
| D-PLAY-02 | Read a Multi Mode part label (A–H) | `PlayPage.tsx:329` → `part.id` | C-PLAY-01 | editor-derived | implemented | none | none |
| D-PLAY-03 | Read a Multi Mode part's VAL / active indicator | `PlayPage.tsx:333` → `part.active ? '*' : ''` | C-PLAY-01 | native | partial (always renders `*`; `active` field never updated from device) | none | none |
| D-PLAY-04 | Assign a Multi Mode part's MIDI channel (1–16) | `s-series-client.ts:231` → `setMultiChannel` | C-PLAY-04 | native | implemented | none | none |
| D-PLAY-05 | Assign a Multi Mode part's patch | `s-series-client.ts:232` → `setMultiPatch` | C-PLAY-05 | native | implemented | none | none |
| D-PLAY-06 | Assign a Multi Mode part's output (1–8) | `s-series-client.ts:233` → `setMultiOutput` | C-PLAY-06 | native | implemented | none | none |
| D-PLAY-07 | Edit a Multi Mode part's level (0–127) | `s-series-client.ts:234` → `setMultiLevel` | C-PLAY-07 | native | implemented | none | none |
| D-PLAY-08 | Load Multi Mode function parameters on connect | `s-series-client.ts:230` → `requestFunctionParameters` (client-composed of multiple reads) | C-PLAY-03 | client-derived | implemented | none | none |
| D-PLAY-09 | Read the resolved patch name for each Multi Mode part | `PlayPage.tsx:163` → resolves `patches[part.patchIndex].common.name` | C-PLAY-03 | editor-derived | implemented | none | none |
| D-PLAY-10 | Trigger reload of patch bank P11–P18 | `PlayPage.tsx:276` → `loadPatchBank(0, true)` | C-PLAY-04 | client-derived | partial (S-330 only — buttons hardcoded; S-550 has 4 banks) | none | none |
| D-PLAY-11 | Trigger reload of patch bank P21–P28 | `PlayPage.tsx:291` → `loadPatchBank(1, true)` | C-PLAY-04 | client-derived | partial (S-330 only) | none | none |
| D-PLAY-12 | Show loading progress in the page header | `PlayPage.tsx:263` → `loadingProgress` + `loadingMessage` | C-XX-02 | editor-derived | partial (% bar only; no bytes/elapsed/ETA per design system) | none | none |
| D-PLAY-13 | Display the page-level error region | `PlayPage.tsx:453-458` → `<div data-testid="error-message">` (gated on `error`) | C-XX-03 | editor-derived | implemented | none | none |

---

## D-SYS — System Parameters (none implemented)

`SSeriesBaseSystemParams` has 11 fields. None are exposed in the UI; no client interface methods exist for system-parameter read/write.

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| D-SYS-01 | Edit system master tune | `SSeriesBaseSystemParams.masterTune` | n/a | native | missing | none | none |
| D-SYS-02 | Edit system master level | `SSeriesBaseSystemParams.masterLevel` | n/a | native | missing | none | none |
| D-SYS-03 | Assign system MIDI channel | `SSeriesBaseSystemParams.midiChannel` | n/a | native | missing | none | none |
| D-SYS-04 | Edit system device ID | `SSeriesBaseSystemParams.deviceId` | n/a | native | missing | none | none |
| D-SYS-05 | Toggle system exclusive enable | `SSeriesBaseSystemParams.exclusiveEnabled` | n/a | native | missing | none | none |
| D-SYS-06 | Toggle system program-change enable | `SSeriesBaseSystemParams.progChangeEnabled` | n/a | native | missing | none | none |
| D-SYS-07 | Toggle system control-change enable | `SSeriesBaseSystemParams.ctrlChangeEnabled` | n/a | native | missing | none | none |
| D-SYS-08 | Toggle system bender enable | `SSeriesBaseSystemParams.benderEnabled` | n/a | native | missing | none | none |
| D-SYS-09 | Toggle system mod-wheel enable | `SSeriesBaseSystemParams.modWheelEnabled` | n/a | native | missing | none | none |
| D-SYS-10 | Toggle system aftertouch enable | `SSeriesBaseSystemParams.aftertouchEnabled` | n/a | native | missing | none | none |
| D-SYS-11 | Toggle system hold-pedal enable | `SSeriesBaseSystemParams.holdPedalEnabled` | n/a | native | missing | none | none |

---

## D-XX — Cross-Cutting

| ID | Affordance | Source of truth | Parent | Origin | Status | Sign-off | Coverage |
|----|-----------|-----------------|--------|--------|--------|----------|----------|
| ~~D-XX-01~~ | ~~Mount a virtual front panel as a floating draggable surface~~ | `VirtualFrontPanel.tsx` (unmounted) | — | — | **removed** (decisions-2026-05-11 D-1: drawer-embedded controls D-XX-10 declared canonical; CRT + front-panel must remain co-located per `feedback_virtual_front_panel`) | n/a | n/a |
| D-XX-02 | Trigger front-panel navigation events (DT1) | `VideoCapture.tsx:363-380` → `NavigationPad` → `useFrontPanel` | C-XX-04 | native | implemented (inside the video drawer) | none | none |
| D-XX-03 | Trigger front-panel value events (DT1) | `VideoCapture.tsx:363-380` → `ValueButtons` | C-XX-04 | native | implemented (inside the video drawer) | none | none |
| D-XX-04 | Trigger front-panel function events (MODE / MENU / SUB MENU / COM / Execute) | `VideoCapture.tsx:363-380` → `FunctionButtonRow` | C-XX-04 | native | implemented (inside the video drawer) | none | none |
| ~~D-XX-05~~ | ~~Trigger virtual-front-panel keyboard shortcuts (floating-panel keydown listener)~~ | `VirtualFrontPanel.tsx:7` (unmounted) | — | — | **removed** (decisions-2026-05-11 D-1: drawer has its own keyboard handler — D-XX-10 covers it) | n/a | n/a |
| ~~D-XX-06~~ | ~~Drag the virtual front panel to reposition it~~ | `VirtualFrontPanel.tsx` (unmounted) | — | — | **removed** (decisions-2026-05-11 D-1: drag-to-reposition only meaningful for a floating panel; superseded by drawer mount) | n/a | n/a |
| ~~D-XX-07~~ | ~~Toggle virtual-front-panel collapse / expand~~ | `VirtualFrontPanel.tsx` (unmounted) | — | — | **removed** (decisions-2026-05-11 D-1: drawer has its own open/close toggle — D-XX-09 covers it) | n/a | n/a |
| ~~D-XX-08~~ | ~~Show virtual-front-panel connection status (floating-panel green dot)~~ | `VirtualFrontPanel.tsx` (unmounted) | — | — | **removed** (decisions-2026-05-11 D-1: status indicator lives in the Layout header — D-CONN-07 covers it) | n/a | n/a |
| D-XX-09 | Open the video-capture drawer (USB / webcam) | `Layout.tsx` → `VideoCapture` | n/a (unique to editor) | editor-derived | implemented | none | none |
| D-XX-10 | Trigger front-panel controls inside the video drawer | `VideoCapture.tsx:363-380` → reuses VFP components | n/a (unique to editor) | editor-derived | implemented | none | none |
| D-XX-11 | Trigger MIDI Panic (CC 120 + 123 on all channels) | `Layout.tsx` → `PanicButton` (client `panic()`) | n/a | client-derived | implemented | none | none |
| D-XX-12 | Show cross-cutting progress indicators (per-row placeholder + page-title counter) | PatchList row placeholder + page-title counter (the percent-bar region in `PatchesPage.tsx:266` is wired but does not render during a real load — see partial-status note) | C-XX-02 | editor-derived | partial — shipped: per-row `(loading...)` placeholder + page-title `N of 16 loaded` counter advance mid-flight. Wired-but-suppressed: the percent-bar `<div role="status">` region (PatchesPage.tsx:266); during a real load, `useBankLoader.loadPatchBank` calls `setError(null)` right after `setLoading(true, msg)`, and `editorStoreBase.setError` is contracted to reset `isLoading: false` + `loadingProgress: null` regardless of whether `error` is null. The percent bar's render guard (`isLoading && loadingProgress !== null`) is therefore never satisfied during a real load. Verified via direct store inspection during Wave 6 (#417). Missing: design system requires bytes-transferred / elapsed / ETA — none of these are wired into any current progress affordance. | none | none |
| D-XX-13 | Enforce the live-edit guard — no save/cancel/undo in parameter-edit panes | PatchEditor / ToneEditor / multi-mode panes — absence-of-affordance (per `feedback_live_editing_no_save`) | n/a | editor-derived | implemented (design contract — edits stream live to the device, so save/cancel/undo would lie about persistence) | none | none |

---

## Wave 3 notes (test-coverage gap pass)

Wave 3 (issue [#414](https://github.com/audiocontrol-org/audiocontrol/issues/414))
bound 42 display affordance tests across the existing spec suite + four new
spec files (`patch-display.spec.ts`, `patch-zones.spec.ts`,
`tone-display.spec.ts`, `tone-loop.spec.ts`, `video-drawer.spec.ts`).

Two structural findings surfaced during the binding pass:

### Phase 9 redesign — per-bank reload toolbar consolidated

`D-PATCH-LIST-06`, `D-PATCH-LIST-07`, `D-TONE-LIST-06` originally cited a
multi-button per-bank reload toolbar inside `PatchesPage` / `TonesPage`.
Phase 9 Task 4 (the Patches + Tones redesign, see DEVELOPMENT-NOTES.md
2026-05-11 entry) collapsed the toolbar into a single "Refresh all …
from device" icon-button on the page-title row, per project memory
`feedback_lean_page_header`. The inventory descriptions + source-of-truth
citations have been updated to point at the icon button; the affordance
the user needs ("force-reload from device") is still present and the test
bindings pin the consolidated control.

### VFP — RESOLVED 2026-05-11 (decisions-2026-05-11 Decision 1)

The `VirtualFrontPanel` component (`modules/roland-sxx0-editor/src/
components/front-panel/VirtualFrontPanel.tsx`) is exported from the
module barrel but is **never instantiated** anywhere in the editor —
verified by grep across the source tree.

The same VFP components (`FunctionButtonRow`, `NavigationPad`,
`ValueButtons`) ARE mounted inside the video drawer (`VideoCapture.tsx:
363-380`); that's the surface the user actually interacts with today.
`D-XX-09` (drawer mount) and `D-XX-10` (front-panel controls inside drawer)
cover the affordance.

**Operator decision (2026-05-11):** the drawer-embedded panel is canonical.
Conditional on `VideoCapture` being mounted on every editor page — verified:
`App.tsx:21` wraps every route in `<Layout>`, `Layout.tsx:153` mounts
`<VideoCapture />` unconditionally. Constraint satisfied.

Coupling constraint (operator-clarified): the CRT video-out and front-panel
controls are ONE bound concern — *"The front panel controls don't make sense
unless you can see the CRT display."* Memory rule `feedback_virtual_front_panel`
updated to record this; Phase 9 redesign MUST keep them co-located.

**Affordances struck:** D-XX-01, 05, 06, 07, 08 (5 rows) marked `removed` in
the table above with strikethrough text. History preserved per the
discipline rule's "do not delete history" provision.

**Affordances renamed:** D-XX-02, 03, 04 had their Source-of-Truth columns
re-pointed from the unmounted `VirtualFrontPanel.tsx` to the actually-mounted
`VideoCapture.tsx:363-380`. Status flipped from `implemented (inside the
video drawer)` to plain `implemented`.

---

## Punch list

The remaining-coverage backlog and the missing-UI backlog both live on the
D-rows directly — the `Coverage` column carries the live machine-generated
state for the first, the `Status: missing` rows carry the second. Both should
drain over time; both should grow when new affordances are added (each new
feature lands with its test).

A redesign that wants to claim "no functional regression" must, at minimum,
keep every currently-`confident` row passing. A redesign that wants to claim
"no capability loss" must additionally either (a) keep every currently-implemented
affordance present in the new UI, or (b) explicitly strike rows in this
document with a PR explaining why the capability no longer applies.

### Test-coverage backlog → wave issues

The untested rows are tracked across the remaining test-wave issues, sequenced so each
wave can land independently:

| Wave | Issue | Scope | Hardware |
|------|-------|-------|----------|
| 2a | [#411](https://github.com/audiocontrol-org/audiocontrol/issues/411) | Patch parameter writes — D-PATCH-01..05, 07..12 | Yes (fixture capture) |
| 2b | [#412](https://github.com/audiocontrol-org/audiocontrol/issues/412) | Multi-mode parameter writes — D-PLAY-04..07 | Yes |
| 2c | [#413](https://github.com/audiocontrol-org/audiocontrol/issues/413) | Tone parameter writes (wave/pitch/TVF/TVA/LFO/envelope) | Yes |
| 3 | [#414](https://github.com/audiocontrol-org/audiocontrol/issues/414) | Display-assertion gaps (port pickers, bank buttons, zone editor, loop editor visual) — **LANDED**: 37 bindings (see Wave 3 notes for the 5 D-XX rows that couldn't be bound until the VFP is mounted) | No |
| 4 | [#415](https://github.com/audiocontrol-org/audiocontrol/issues/415) | Library + dialog flows (save/load set, import/export, sample editor) — **PARTIAL LANDED**: 8 bindings for D-LIB-{03,04,05,10,11,15,16,20}. Remaining D-LIB-{12,13,14,17,18,19,21} require seeded library content infrastructure (yaml + WAV per tone/patch/sample bundle parseable by `convertYamlToS330Tone()` / sample loaders) OR DnD harness coverage (D-LIB-14, 21 only open via DnD — that belongs to Wave 5). | Yes |
| 5 | [#416](https://github.com/audiocontrol-org/audiocontrol/issues/416) | Drag-drop tests | Yes |
| 6 | [#417](https://github.com/audiocontrol-org/audiocontrol/issues/417) | Cross-cutting (front-panel DT1, panic, progress, live-edit guard) — **PARTIAL LANDED**: 3 bindings for D-XX-{11, 12 (partial), 13 (new)} via `capabilities/cross-cutting.spec.ts`; panic-flow fixture captured against real S-550. VFP DT1-emit bindings (D-XX-02..05) remain blocked on operator decision about mounting the floating `VirtualFrontPanel` (see "VFP unmounted" note in Wave 3 notes). | Yes (panic-flow captured; VFP fixture blocked) |

When a wave lands, the relevant rows' `Coverage` column flips upward (most often `none` → `partial`) on the next manifest run, and the spec citations live in the Tier-1 wiring suite (`modules/roland-sxx0-editor/test/wiring/`).

---

## Document maintenance

This document lives at the top level of the repository alongside [`ROLAND-S550-EDITOR-CAPABILITIES.md`](ROLAND-S550-EDITOR-CAPABILITIES.md). It is owned by the project, not by any feature branch — features may add, change, or strike affordances, but the document itself is a long-lived inventory.

- Each affordance change is part of a PR; the PR description references the `D-<AREA>-<NN>` id.
- The summary tables (by-area + by-origin) are updated in the same PR as the affordance change.
- Removed affordances stay in the document as `removed (<reason>, <PR link>)`. History is not deleted.
- New device editors get sibling docs (e.g., `AKAI-S3000XL-EDITOR-CAPABILITIES-DETAILED.md`).
- Origin classifications can shift over time (e.g., a `client-derived` op might be promoted to native if the device protocol grows; an `editor-derived` op might be moved into the client). Such reclassifications are part of the PR that motivates them.
- New tests added that cover existing affordances change the row's `Coverage` value via the next manifest regeneration; no hand edit is required.
