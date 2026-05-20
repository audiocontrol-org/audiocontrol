---
title: "Phase 0 Task 1 — SamplerClientInterface Contract Audit"
parent: "Phase 0: Frontend/Backend Decoupling"
date: 2026-05-09
---

# SamplerClientInterface Contract Audit

**Task:** Phase 0 Task 1
**Date:** 2026-05-09
**Status:** Complete

---

## 1. Method Inventory

`SamplerClientInterface` is a type alias for `S330ClientInterface`, defined at:

- Alias: `modules/roland-sxx0-editor/src/core/midi/SamplerClient.ts:17`
- Definition: `modules/sampler-devices/src/devices/s330/s330-client.ts:248-327`

Total methods: **35**

### Connection (4)
| Method | Signature |
|--------|-----------|
| `connect` | `(): Promise<boolean>` |
| `disconnect` | `(): void` |
| `isConnected` | `(): boolean` |
| `getDeviceId` | `(): number` |

### Patch Operations (5)
| Method | Signature |
|--------|-----------|
| `requestPatchData` | `(patchIndex: number): Promise<S330Patch | null>` |
| `sendPatchData` | `(patchIndex: number, patch: S330PatchCommon): Promise<void>` |
| `loadPatchRange` | `(startIndex, count, onProgress?, onPatchLoaded?, forceReload?): Promise<S330Patch[]>` |
| `getLoadedPatches` | `(): (S330Patch | undefined)[]` |
| `invalidatePatchCache` | `(): void` |

### Tone Operations (5)
| Method | Signature |
|--------|-----------|
| `requestToneData` | `(toneIndex: number): Promise<S330Tone | null>` |
| `sendToneData` | `(toneIndex: number, tone: S330Tone): Promise<void>` |
| `loadToneRange` | `(startIndex, count, onProgress?, onToneLoaded?, forceReload?): Promise<S330Tone[]>` |
| `getLoadedTones` | `(): (S330Tone | undefined)[]` |
| `invalidateToneCache` | `(): void` |

### Wave Data (3)
| Method | Signature |
|--------|-----------|
| `requestWaveData` | `(toneIndex, onProgress?): Promise<SSeriesWaveDataResponse>` |
| `sendWaveData` | `(input: S330WaveDataInput, onProgress?): Promise<void>` |
| `importTone` | `(input: S330ImportToneInput, onProgress?): Promise<void>` |

### Multi Mode (5)
| Method | Signature |
|--------|-----------|
| `requestFunctionParameters` | `(): Promise<MultiPartConfig[]>` |
| `setMultiChannel` | `(part, channel): Promise<void>` |
| `setMultiPatch` | `(part, patchIndex): Promise<void>` |
| `setMultiOutput` | `(part, output): Promise<void>` |
| `setMultiLevel` | `(part, level): Promise<void>` |

### Panic (1)
| Method | Signature |
|--------|-----------|
| `panic` | `(): void` |

### Individual Patch Setters (12)
| Method |
|--------|
| `setPatchName` |
| `setPatchKeyMode` |
| `setPatchBenderRange` |
| `setPatchAftertouchSens` |
| `setPatchAftertouchAssign` |
| `setPatchKeyAssign` |
| `setPatchOutput` |
| `setPatchLevel` |
| `setPatchDetune` |
| `setPatchVelocityThreshold` |
| `setPatchVelocityMixRatio` |
| `setPatchOctaveShift` |

---

## 2. Consumer Map

**27 of 35 methods have at least one UI consumer. 8 have zero UI consumers.**

### Active consumers

| Method | Call sites |
|--------|-----------|
| `connect` | `useBankLoader.ts:69,104`; `LibraryPage.tsx:155` |
| `loadPatchRange` | `useBankLoader.ts:70`; `LibraryPage.tsx:165` |
| `loadToneRange` | `useBankLoader.ts:105`; `LibraryPage.tsx:160` |
| `sendPatchData` | `PatchEditor.tsx:205,222`; `useImportSamples.ts:560,577`; `useLibraryImport.ts:240`; `useLibraryImportDialogs.ts:176,249` |
| `requestPatchData` | `useLibraryImportDialogs.ts:197` |
| `sendToneData` | `TonesPage.tsx:218` |
| `requestToneData` | `useLibraryImportDialogs.ts:196`; `useToneSampleExport.ts:101` |
| `requestWaveData` | `useWaveDataCache.ts:98`; `useLibraryExport.ts:222,363`; `useLibraryImportDialogs.ts:198` |
| `importTone` | `TonesPage.tsx:240`; `useLibraryImport.ts:131,205`; `useLibraryImportDialogs.ts:136,163,236`; `useImportSamples.ts:517` |
| `requestFunctionParameters` | `PlayPage.tsx:124` |
| `setMultiChannel` | `PlayPage.tsx:192` |
| `setMultiPatch` | `PlayPage.tsx:207` |
| `setMultiOutput` | `PlayPage.tsx:218` |
| `setMultiLevel` | `PlayPage.tsx:233` |
| `invalidatePatchCache` | `PatchesPage.tsx:123` |
| `invalidateToneCache` | `PatchesPage.tsx:124`; `TonesPage.tsx:194` |
| `setPatchName` | `PatchEditor.tsx:60` |
| `setPatchKeyMode` | `PatchEditor.tsx:75` |
| `setPatchBenderRange` | `PatchEditor.tsx:90` |
| `setPatchAftertouchSens` | `PatchEditor.tsx:105` |
| `setPatchAftertouchAssign` | `PatchEditor.tsx:120` |
| `setPatchKeyAssign` | `PatchEditor.tsx:135` |
| `setPatchOutput` | `PatchEditor.tsx:150` |
| `setPatchLevel` | `PatchEditor.tsx:160` |
| `setPatchDetune` | `PatchEditor.tsx:165` |
| `setPatchVelocityThreshold` | `PatchEditor.tsx:175` |
| `setPatchVelocityMixRatio` | `PatchEditor.tsx:187` |

### Zero-consumer methods (8)

These are not gaps — they are infrastructure (`disconnect`, `isConnected`, `getDeviceId`) or capabilities not yet wired to UI (`panic`, `setPatchOctaveShift`, `sendWaveData`, `getLoadedPatches`, `getLoadedTones`).

| Method | Notes |
|--------|-------|
| `disconnect` | Infrastructure; connection lifecycle managed by MidiStore |
| `isConnected` | Status polled from MidiStore, not the client |
| `getDeviceId` | Used internally by the client; not needed by UI directly |
| `getLoadedPatches` | Cache accessor; UI reads from hook-managed state instead |
| `getLoadedTones` | Same as above |
| `sendWaveData` | Low-level wave send; UI uses `importTone` which wraps it |
| `panic` | No panic button wired in UI yet |
| `setPatchOctaveShift` | No UI control wired yet |

---

## 3. Gap Analysis — Direct Device Access

### BLOCKER 1 — useFrontPanel.ts creates FrontPanelController from raw adapter

**File:** `modules/roland-sxx0-editor/src/hooks/useFrontPanel.ts:103-106`

```typescript
const controller: FrontPanelController | null = useMemo(() => {
    if (!adapter) return null;
    return createFrontPanelController(adapter, { deviceId });
}, [adapter, deviceId]);
```

`adapter` is `SSeriesMidiAdapter` from `useMidiStore()`. `FrontPanelController` sends DT1 SysEx at address `00 04 00 00` through the raw adapter, bypassing `SamplerClientInterface` entirely. A recording proxy at the interface boundary cannot capture or replay these messages.

**Impact:** All front-panel virtual button presses are invisible to an interface-level proxy.

### BLOCKER 2 — useParameterListener.ts subscribes to inbound device messages via adapter.onSysEx

**File:** `modules/roland-sxx0-editor/src/hooks/useParameterListener.ts:54-58`

```typescript
adapter.onSysEx(handleSysEx);
// cleanup:
adapter.removeSysExListener(handleSysEx);
```

This is the inbound device-to-UI path. When the device broadcasts a parameter change (DT1), the UI receives it via `adapter.onSysEx`. `SamplerClientInterface` has no method for inbound subscriptions — this path does not exist on the interface at all. An interface-level proxy cannot inject simulated device responses for replay.

**Impact:** Inbound device messages (parameter broadcasts) cannot be recorded or replayed without adapter-level coverage.

### INFO 1 — Dev diagnostic instantiates raw MIDI access

**File:** `modules/roland-sxx0-editor/src/core/midi/index.ts:23-28,91`

`testS330MidiDiagnostic()` calls `navigator.requestMIDIAccess({ sysex: true })` directly. Dev diagnostic exposed as `window.testS330Midi`. Not a UI feature; not reachable from normal app flows. Not a proxy blocker.

### INFO 2 — Protocol constants re-exported from editor module

**File:** `modules/roland-sxx0-editor/src/core/midi/S330Client.ts:57-64`

Re-exports `ROLAND_ID`, `S330_MODEL_ID`, `DEFAULT_DEVICE_ID`, `S330_COMMANDS`, `TIMING`, `calculateChecksum`. No UI component imports these.

### INFO 3 — Type cast at S330 factory boundary

**File:** `modules/roland-sxx0-editor/src/configs/s330.ts:44`

```typescript
return createS330Client(adapter, options) as unknown as SamplerClientInterface;
```

`S330ClientInterface` IS `SamplerClientInterface` by type alias — the cast is dead weight. Remove during cleanup.

### INFO 4 — Type cast at S550 factory boundary

**File:** `modules/roland-sxx0-editor/src/configs/s550.ts:43`

```typescript
return createS550Client(adapter, options) as unknown as SamplerClientInterface;
```

`S550ClientInterface` is structurally compatible with `S330ClientInterface` but not a nominal subtype. The cast hides potential structural divergence — track separately.

### INFO 5 — Data-structure constants imported from sampler-devices in ToneZoneEditor

**File:** `modules/roland-sxx0-editor/src/components/patches/ToneZoneEditor.tsx:12-16`

Imports `TONE_LAYER_MIN_MIDI_NOTE`, `TONE_LAYER_MAX_MIDI_NOTE`, `TONE_LAYER_SIZE`, `TONE_LAYER_OFF`. Compile-time constants describing data structure bounds, not wire-protocol functions.

### INFO 6 — Math utility imported from sampler-devices in ImportLibraryToneDialog

**File:** `modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx:22`

Imports `calculateSegmentsNeeded`. Pure arithmetic, no device communication.

### INFO 7 — Data construction helpers imported in useImportSamples

**File:** `modules/roland-sxx0-editor/src/hooks/useImportSamples.ts:14-21`

Imports `createEmptyToneLayer`, `setToneAtMidiNote`, `createDrumTone`, `createDrumKitPatch`, `importMonolithicDrumKit`, `resample`. These construct in-memory data structures; device send goes through `clientRef.current.importTone(...)` (correctly routed through interface).

---

## 4. Front Panel Controller Assessment

`FrontPanelController` is a separate device communication path. It sends DT1 messages to the device's front-panel parameter address space (`00 04 00 00`), which is distinct from patch/tone/wave parameter space.

**Option A — Add front-panel methods to SamplerClientInterface.**
Couples two abstractions. The front panel is a navigation surface, not a data editor. Forces every non-Roland sampler client to implement irrelevant methods.

**Option B — Adapter-level proxy (recommended).**
Place the proxy at `SSeriesMidiAdapter`. All paths converge there:
- `SamplerClientInterface` calls → adapter send methods
- `FrontPanelController` calls → adapter send methods
- `useParameterListener` inbound → adapter `onSysEx`

A single proxy wrapping the adapter captures and replays all three paths without modifying any interface.

**Option C — Separate recording proxy for FrontPanelController.**
Workable but doubles maintenance burden.

**Recommendation: Option B.**

---

## 5. MIDI Transport Instantiation

`SSeriesMidiAdapter` is instantiated only in `useMidiStore.ts` (the Zustand store). UI components and hooks receive the adapter through the store; they do not instantiate it directly.

Exception: `testS330MidiDiagnostic()` in `core/midi/index.ts` — dev diagnostic, not a UI feature.

The adapter instantiation chokepoint in `useMidiStore.ts` is the correct injection point for an adapter-level proxy. A single `wrapAdapterWithProxy(adapter)` call at store initialization covers the full device communication surface.

---

## 6. Recommendations for Phase 0 Task 3+

### Adopt adapter-level proxy architecture

Implement the recording proxy as a wrapper around `SSeriesMidiAdapter`, not around `SamplerClientInterface`. The proxy wraps the adapter before it's written to the MidiStore. This resolves both BLOCKERs with a single architectural change:

- **BLOCKER 1 resolved:** `FrontPanelController` receives the proxy-wrapped adapter from the store; its DT1 sends are captured.
- **BLOCKER 2 resolved:** `useParameterListener` subscribes to `onSysEx` on the proxy-wrapped adapter; the proxy can inject replay events.

The proxy interface should mirror `SSeriesMidiAdapter` so it's a drop-in substitute.

### Fix the unnecessary double cast in configs/s330.ts

Remove the dead `as unknown as SamplerClientInterface` cast.

### Track S550 structural divergence

The cast in `s550.ts` hides whether `S550ClientInterface` fully satisfies `S330ClientInterface`. File as a follow-up issue to make this explicit at the type level.

### Leave FrontPanelController as a separate path

Do not add front-panel methods to `SamplerClientInterface`. The adapter-level proxy covers it without interface contamination.

### The 8 zero-consumer methods do not need action now

Legitimate interface surface that happens to have no UI consumers yet (`panic`, `setPatchOctaveShift`) or that's used internally (`disconnect`, `getDeviceId`). Do not remove them.

---

## 7. Summary

`SamplerClientInterface` (= `S330ClientInterface`, 35 methods) covers the primary device communication surface. 27 of 35 methods have active UI consumers. The interface itself is clean.

**Two BLOCKERs prevent a naive interface-level recording proxy from working:**

1. `useFrontPanel.ts` creates `FrontPanelController` from the raw adapter — DT1 messages bypass the interface.
2. `useParameterListener.ts` subscribes to inbound device messages via `adapter.onSysEx` — a path that doesn't exist on the interface at all.

**Both BLOCKERs share the same root cause:** the raw `SSeriesMidiAdapter` leaks out of the MidiStore into UI hooks. The correct fix is an adapter-level proxy — wrapping `SSeriesMidiAdapter` in `useMidiStore` before it's stored. This covers the full device communication surface (outbound + inbound + front-panel) with one architectural change and no interface modifications.

Seven additional INFO findings (dev diagnostics, type casts, data-structure imports) are not blockers and do not require action for Phase 0.

**BLOCKER count: 2** — both resolved by adopting adapter-level proxying.
