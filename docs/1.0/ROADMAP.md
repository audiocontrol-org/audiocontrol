# Roadmap: audiocontrol 1.0

## Current State

The audiocontrol monorepo has working device communication, MIDI SysEx protocols, and web-based editors for the Roland S-330 (with S-550 support in progress). The core infrastructure is solid:

- **Library schemas** — Device-agnostic base types (`BaseTone`, `BasePatch`) with device-specific extensions for S-330 and S-550. YAML-based storage with browser and Node.js backends.
- **Loop detection & editing** — Full loop editor UI with canvas-based waveform rendering, zoom, and loop candidate visualization. Backend loop detection uses zero-crossing, NCC scoring, spectral analysis, and splice smoothing. The TODO notes that splice-point detection and crossfade are "pretty broken."
- **Sample chopping** — Transient detection, silence detection, fixed intervals, and manual regions. Outputs individual WAV slices or drum kit bundles. Chopping is slicing-only — no trim, normalize, or effects.
- **Key zone & patch editing** — Tone zone editor, patch editor, key modes (normal, v-sw, x-fade, v-mix, unison). Velocity zone schemas exist but lack a dedicated editor UI.
- **Device converters** — Tone/Patch YAML to device protocol converters for S-330 and S-550. No cross-device conversion (e.g., S-330 tone to S-550 tone).
- **Templates** — `DrumKitTemplate` and `VelocityLayerTemplate` with a handler registry. No UI for editing or creating templates.

What does **not** exist: sample trim/normalize, effects processing, cross-device migration, velocity layer editor UI, drum kit editor UI (beyond library browsing), or a formalized "common area" for device-agnostic samples.

---

## Phase 1: Edit Workflow Architecture

Everything downstream depends on having a clear, non-modal pattern for edit workflows. The TODO explicitly states that edit operations "should not use modal dialogs" — they are "first-class workflows that deserve a well-thought-out UX."

### `edit-workflow-architecture`

Define the architectural pattern for non-modal edit workflows. What does a "first-class workflow" look like? Route-based? Panel-based? This is a design spike that produces a PRD and a reference implementation with one concrete workflow.

| Aspect | Detail |
|--------|--------|
| **Exists** | Dialog-based import/export workflows (`ImportSampleDialog`, `ExportToneDialog`, etc.) |
| **Needed** | Non-modal workflow pattern, routing/navigation model, state management for in-progress edits |
| **Depends on** | Nothing — this is the foundation |
| **Unblocks** | Every feature in Phases 2-5 |

### `library-common-area`

Formalize the "common" storage area for device-agnostic samples. The schemas support device-agnostic base types, but the library browser and storage layer need a clear common-area concept where samples live before being assigned to a device.

| Aspect | Detail |
|--------|--------|
| **Exists** | `BaseTone`/`BasePatch` schemas, file-based library storage |
| **Needed** | Common-area browsing in UI, storage conventions for unassigned samples, lifecycle rules for common-to-device promotion |
| **Depends on** | `edit-workflow-architecture` (common-area operations use the workflow pattern) |
| **Unblocks** | All Phase 2 operations (they operate on common-area samples) |

---

## Phase 2: Core Sample Operations

The bread-and-butter operations that make the library useful. Each builds on the edit workflow pattern from Phase 1. These three features are independent of each other and can be worked in parallel.

### `sample-trim-normalize`

Trim (crop start/end) and normalize (peak or RMS). The simplest DSP operations and a good proving ground for the edit workflow pattern. Uses existing Web Audio API — no WASM needed.

| Aspect | Detail |
|--------|--------|
| **Exists** | Audio utilities (RMS calculation, peak detection, silence detection) |
| **Needed** | Trim UI with waveform selection, normalize algorithm (peak/RMS modes), undo support |
| **Depends on** | `edit-workflow-architecture`, `library-common-area` |
| **Unblocks** | `effects-chain-editor` (effects build on the same DSP pipeline) |

### `loop-editor-fixes`

Fix splice-point detection and crossfade in the existing loop editor. The loop detector and smoothing code exists (~2000 LOC across 7 files) but is acknowledged as "pretty broken." This is a bug-fix feature, not new architecture.

| Aspect | Detail |
|--------|--------|
| **Exists** | Full loop editor UI (`LoopEditor.tsx`), loop detection (zero-crossing, NCC, spectral), splice smoothing (linear overlap-add, equal-power) |
| **Needed** | Improved splice-point scoring, better crossfade algorithm, regression tests for known-bad cases |
| **Depends on** | `edit-workflow-architecture` (if the loop editor moves to the new workflow pattern), `library-common-area` (common-area samples need looping) |
| **Unblocks** | `velocity-layer-editor` (looped samples are inputs to multi-sample instruments) |

### `common-area-chopping`

Make common-area samples choppable. The chopper exists in `sample-chopper` and the sampler-editor already imports it. This is about connecting the existing chopper to common-area samples via the edit workflow pattern.

| Aspect | Detail |
|--------|--------|
| **Exists** | `sample-chopper` module (19 files, ~1200 LOC): transient detection, silence detection, fixed intervals, manual regions |
| **Needed** | Route common-area samples into the chopper, output slices back to the common area, integrate with edit workflow pattern |
| **Depends on** | `edit-workflow-architecture`, `library-common-area` |
| **Unblocks** | `drum-kit-editor` (chops feed drum kit creation) |

---

## Phase 3: Multi-Sample Instruments

Depends on working samples, loops, and chops in the common area. These two features are independent of each other.

### `velocity-layer-editor`

UI for creating and editing velocity-layered instruments. Schema support exists (`VelocityLayerTemplate`), but there is no editor. Pairs naturally with the existing key zone editor.

| Aspect | Detail |
|--------|--------|
| **Exists** | `VelocityLayerTemplate`, velocity zone schemas, key zone editor (`ToneZoneEditor`), patch key modes (v-sw, x-fade, v-mix) |
| **Needed** | Velocity layer editor UI, layer preview/audition, integration with common-area samples |
| **Depends on** | `library-common-area`, `loop-editor-fixes` (looped samples are typical layer sources) |
| **Unblocks** | `device-migration-framework` (multi-sample instruments are the hardest migration case) |

### `drum-kit-editor`

Full drum kit editing workflow beyond library browsing. Templates and chopper integration exist. This needs a dedicated non-modal editor that ties together chopping, mapping, and kit creation.

| Aspect | Detail |
|--------|--------|
| **Exists** | `DrumKitTemplate`, template handler registry, sample chopper integration, library browsing |
| **Needed** | Drum kit editor UI, pad-to-sample mapping, kit preview/audition, integration with common-area chopping |
| **Depends on** | `common-area-chopping` (chops feed drum kit creation), `edit-workflow-architecture` |
| **Unblocks** | `device-migration-framework` (drum kits are a key migration target) |

---

## Phase 4: Device Migration

Requires mature library schemas and a stable common area. Cross-device migration is meaningless without a solid common format to bridge through. Independent of Phase 3 — can be reordered based on priority.

### `device-migration-framework`

Define the transformation pipeline for converting library objects between devices. Start with S-330 to S-550 since they share ~95% of their parameter space (differences: tone slots 32 vs 64, wave banks 2 vs 4, parameter ranges), then generalize to cross-manufacturer migration (Roland to Akai).

| Aspect | Detail |
|--------|--------|
| **Exists** | Per-device YAML-to-protocol converters for S-330 and S-550, device-agnostic base schemas |
| **Needed** | Cross-device tone conversion, patch translation with parameter mapping, naming conventions for migrated objects, conflict resolution for incompatible parameters |
| **Depends on** | `library-common-area` (common area is the bridge format), Phase 2 operations (migrated samples may need trimming/re-looping) |
| **Unblocks** | Nothing downstream — this is a leaf feature |

---

## Phase 5: Built-In Effects

The most ambitious item. Requires either WebAssembly or AudioWorklet infrastructure. Effects are independently useful and don't block other features. Independent of Phases 3 and 4 — can be reordered based on priority.

### `dsp-engine`

Core offline DSP processing pipeline using Web Audio `OfflineAudioContext` or WASM. Start with compressor and filter as reference implementations to validate the architecture.

| Aspect | Detail |
|--------|--------|
| **Exists** | Loop splice smoothing, audio utilities (RMS, peak, silence detection), FFT spectral analysis, transient detection |
| **Needed** | Offline processing pipeline, compressor, limiter, gate, expander, saturation, filters, EQ — starting with compressor + filter |
| **Depends on** | `sample-trim-normalize` (shares the same DSP pipeline pattern) |
| **Unblocks** | `effects-chain-editor` |

### `effects-chain-editor`

UI for composing and applying effects chains to common-area samples. Built on the DSP engine and the edit workflow pattern. Later milestone: AU/VST3/CLAP plugin hosting.

| Aspect | Detail |
|--------|--------|
| **Exists** | Nothing — greenfield |
| **Needed** | Chain composition UI, per-effect parameter controls, wet/dry preview, apply-to-sample workflow |
| **Depends on** | `dsp-engine`, `edit-workflow-architecture`, `library-common-area` |
| **Unblocks** | Nothing downstream — this is a leaf feature |

---

## Dependency Graph

```
edit-workflow-architecture
├── library-common-area
│   ├── sample-trim-normalize ──────────────────┐
│   │   └── dsp-engine                          │
│   │       └── effects-chain-editor            │
│   ├── loop-editor-fixes                       │
│   │   └── velocity-layer-editor               │
│   │       └── device-migration-framework ◄────┘
│   └── common-area-chopping
│       └── drum-kit-editor
│           └── device-migration-framework
```

Key observations:
- `edit-workflow-architecture` is the single root dependency
- Phase 2 features are parallel once Phase 1 is complete
- Phases 4 and 5 are independent of each other and of Phase 3
- `device-migration-framework` benefits from all prior phases but only strictly requires Phases 1-2

---

## Feature Index

| Slug | Phase | Status | Summary |
|------|-------|--------|---------|
| `edit-workflow-architecture` | 1 | Not started | Non-modal edit workflow pattern |
| `library-common-area` | 1 | Not started | Device-agnostic sample storage and browsing |
| `sample-trim-normalize` | 2 | Not started | Crop and normalize common-area samples |
| `loop-editor-fixes` | 2 | Not started | Fix broken splice-point detection and crossfade |
| `common-area-chopping` | 2 | Not started | Connect existing chopper to common-area samples |
| `velocity-layer-editor` | 3 | Not started | Multi-sample velocity layer editing UI |
| `drum-kit-editor` | 3 | Not started | Full drum kit creation and editing workflow |
| `device-migration-framework` | 4 | Not started | Cross-device library object conversion |
| `dsp-engine` | 5 | Not started | Offline DSP processing pipeline |
| `effects-chain-editor` | 5 | Not started | Effects chain composition and application UI |

Each feature slug corresponds to a future `docs/1.0/<slug>/` directory containing a PRD and workplan.
