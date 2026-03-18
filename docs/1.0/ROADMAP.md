# Roadmap: audiocontrol 1.0

## Current State

The audiocontrol monorepo has working device communication, MIDI SysEx protocols, and web-based editors for the Roland S-330 (with S-550 support in progress). The core infrastructure is solid:

- **Library schemas** — Device-agnostic base types (`BaseTone`, `BasePatch`) with device-specific extensions for S-330 and S-550. YAML-based storage with browser and Node.js backends.
- **Loop detection & editing** — Full loop editor UI with canvas-based waveform rendering, zoom, and loop candidate visualization. Backend loop detection uses zero-crossing, NCC scoring, spectral analysis, and splice smoothing. The TODO notes that splice-point detection and crossfade are "pretty broken."
- **Sample chopping** — Transient detection, silence detection, fixed intervals, and manual regions. Outputs individual WAV slices or drum kit bundles. Chopping is slicing-only — no trim, normalize, or effects.
- **Key zone & patch editing** — Tone zone editor, patch editor, key modes (normal, v-sw, x-fade, v-mix, unison). Velocity zone schemas exist but lack a dedicated editor UI.
- **Device converters** — Tone/Patch YAML to device protocol converters for S-330 and S-550. No cross-device conversion (e.g., S-330 tone to S-550 tone).
- **Templates** — `DrumKitTemplate` and `VelocityLayerTemplate` with a handler registry. No UI for editing or creating templates.
- **MIDI transport abstraction** — `MidiTransport` interface with dependency-injected implementations (`WebMidiTransport`, `MockMidiTransport`, `RuntimeMidiTransport`). Device-layer code depends on `SSeriesMidiAdapter`, not on any transport directly.
- **midi-server** — Separate C++/JUCE repo (`audiocontrol-org/midi-server`) providing reliable SysEx over HTTP/JSON REST API. Exists specifically because Node.js MIDI libraries have unreliable SysEx handling. Runs on Linux ARM64 (RPi).

What does **not** exist: sample trim/normalize, effects processing, cross-device migration, velocity layer editor UI, drum kit editor UI (beyond library browsing), a formalized "common area" for device-agnostic samples, or a non-browser deployment target.

---

## Phase 1: Edit Workflow Architecture

Everything downstream depends on having a clear, non-modal pattern for edit workflows. The TODO explicitly states that edit operations "should not use modal dialogs" — they are "first-class workflows that deserve a well-thought-out UX."

A critical part of this phase is establishing that each workflow can be **developed and iterated on standalone**, outside the context of any device editor. The sample chopper already works this way: `modules/sample-chopper/dev/` has its own Vite config, HTML entry point, and React harness. You run `pnpm dev` in the chopper module and get a fully functional chopper with file loading, library browsing, and save — no sampler-editor, no MIDI, no device context. This pattern should be the standard for all first-class workflows.

Each workflow module should follow the same structure:
- **`src/`** — core algorithms and UI components, exported as a library for consumers to embed
- **`dev/`** — standalone dev harness with its own Vite config and entry point
- **Two-part export** — algorithms (`@audiocontrol/<module>`) and UI (`@audiocontrol/<module>/ui`) as separate entry points
- **No device dependencies** — the workflow operates on common-area data (audio buffers, YAML manifests) and knows nothing about S-330, S-550, or any specific device
- **No runtime-environment dependencies** — workflow code must not reach past its injected interfaces into browser-specific APIs (File System Access API, Web MIDI, `window.location`, etc.) or Node-specific APIs. All environment-specific capabilities (file I/O, MIDI, audio playback) are injected through interfaces that have browser and Node.js implementations. The dev harness wires up browser implementations; the Electron shell wires up Node.js implementations; the workflow code doesn't know or care which.

This is especially important given the hardware platform track. Every workflow we build will eventually run on an RPi in an Electron shell — no FSAA, no Web MIDI, no URL routing. If workflow code is coupled to browser APIs, the hardware track inherits a porting tax on every feature. Keeping workflows behind injected interfaces means they run in both contexts without modification.

This keeps workflow UX development fast (no editor boot, no MIDI connection), enables focused design iteration, and guarantees that workflows remain both device-agnostic and runtime-agnostic by construction.

### `edit-workflow-architecture`

Define the architectural pattern for non-modal edit workflows and the standalone dev harness convention. What does a "first-class workflow" look like? Route-based? Panel-based? This is a design spike that produces a PRD, the interface contracts for environment capabilities, the dev harness template (based on the sample-chopper pattern), and a reference implementation with one concrete workflow.

| Aspect | Detail |
|--------|--------|
| **Exists** | Dialog-based import/export workflows (`ImportSampleDialog`, `ExportToneDialog`, etc.); standalone dev harness pattern in `sample-chopper/dev/` (Vite config, React harness, library adapter); `sampler-library` already has browser and Node.js backends |
| **Needed** | Non-modal workflow pattern, routing/navigation model, state management for in-progress edits, **interface contracts for environment capabilities** (file I/O, audio playback, MIDI) with browser and Node.js implementations, dev harness template that new workflow modules copy, convention for two-part export (algorithms + UI) |
| **Depends on** | Nothing — this is the foundation |
| **Unblocks** | Every feature in Phases 2-5 (each uses the workflow pattern and standalone dev harness); hardware track `kiosk-display-profiles` and `electron-shell` (workflows run unmodified in Electron because they depend on interfaces, not browser APIs) |

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

## Hardware Platform (Parallel Track)

A dedicated hardware device (Raspberry Pi + touchscreen) that runs the audiocontrol editor suite in two modes:

- **Controller mode** — tactile front panel for vintage samplers (S-330, S-550, S3000XL) via SysEx/MIDI, replacing the laptop-in-the-studio workflow
- **Standalone mode** — self-contained sampler and chopper with own audio I/O, no external sampler required

The hardware track is largely independent of the library editing phases (1–5). Its only cross-track dependencies are that kiosk display profiles benefit from the edit workflow architecture, and the standalone chopper depends on `common-area-chopping` and `sample-chopper-extraction` being complete.

Key architectural decisions:
- **`HttpMidiTransport` over `NodeMidiTransport`** — uses the existing midi-server (C++/JUCE HTTP-to-MIDI bridge in `audiocontrol-org/midi-server`) instead of node-midi, avoiding Node.js SysEx reliability issues
- **Hybrid repo split** — interface implementations (`HttpMidiTransport`, `HardwareBootConfig`, kiosk profiles) live in the audiocontrol monorepo; deployment artifacts (Electron shell, GPIO bridge, RPi setup) live in a new `audiocontrol-org/hardware-deploy` repo
- **Boot config over URL routing** — a `HardwareBootConfig` JSON file replaces URL-based device resolution for headless/kiosk environments

Full PRD and workplan: [`audiocontrol-hardware-device-platform/docs/1.0/hardware-device-platform/`](https://github.com/audiocontrol-org/audiocontrol-hardware-device-platform/tree/main/docs/1.0/hardware-device-platform)

### `http-midi-transport`

Implement `MidiTransport` backed by HTTP calls to midi-server's REST API. Send via `POST /port/:id/send`, receive SysEx via polling `GET /port/:id/messages`. Lives in `modules/http-midi-transport/` in the audiocontrol monorepo.

| Aspect | Detail |
|--------|--------|
| **Exists** | `MidiTransport` interface, `WebMidiTransport`, `MockMidiTransport`, `RuntimeMidiTransport`; midi-server with HTTP/JSON REST API |
| **Needed** | `HttpMidiTransport` implementation, `HttpMidiAdapter`, polling-based SysEx receive, integration tests against midi-server |
| **Depends on** | Nothing — midi-server and `MidiTransport` interface already exist |
| **Unblocks** | `hardware-boot-config`, and any non-browser environment needing reliable SysEx |

### `hardware-boot-config`

JSON config file and React context provider for resolving device type, MIDI port names, transport kind, display profile, and library path — replacing URL-based device resolution. Lives in `modules/hardware-config/` in the audiocontrol monorepo.

| Aspect | Detail |
|--------|--------|
| **Exists** | `DeviceConfigContext`, URL-based device resolution in sampler-editor |
| **Needed** | `HardwareBootConfig` schema, `HardwareConfigProvider` reading from JSON (`AUDIOCONTROL_BOOT_CONFIG` env var), sampler-editor main.tsx hardware-mode detection |
| **Depends on** | `http-midi-transport` (boot config specifies transport kind) |
| **Unblocks** | `kiosk-display-profiles`, `electron-shell` |

### `kiosk-display-profiles`

Touch-optimized Tailwind CSS profiles for 800×480 and 1024×600 displays. 44px minimum touch targets, +20% font scale, no hover states, scrollbar suppression, viewport lock. Extends `editor-core/tailwind.preset.ts`.

| Aspect | Detail |
|--------|--------|
| **Exists** | editor-core Tailwind preset, responsive layout in sampler-editor |
| **Needed** | Kiosk Tailwind variant, `kiosk-800x480` and `kiosk-1024x600` CSS profiles, `display.profile` wired to `<html>` class, Playwright viewport tests |
| **Depends on** | `hardware-boot-config` (display profile comes from boot config); benefits from `edit-workflow-architecture` (workflow UX informs touch layout) |
| **Unblocks** | `electron-shell`, `standalone-chopper-app` |

### `electron-shell`

Package sampler-editor as an Electron app for RPi deployment. Main process loads `/etc/audiocontrol/boot.json`, injects as `window.__BOOT_CONFIG__`. Includes systemd units, dependency installer, and `electron-builder` pipeline for `linux-arm64`. Lives in `audiocontrol-org/hardware-deploy`.

| Aspect | Detail |
|--------|--------|
| **Exists** | sampler-editor as static web assets, midi-server ARM64 build |
| **Needed** | Electron main process with boot config injection, RPi deployment scripts, `electron-builder` for `linux-arm64`, systemd service |
| **Depends on** | `http-midi-transport`, `hardware-boot-config`, `kiosk-display-profiles` |
| **Unblocks** | `gpio-input-bridge`, `standalone-chopper-app` |

### `gpio-input-bridge`

Node.js service translating physical rotary encoders and buttons to MIDI CC messages (via virtual MIDI port) or HTTP navigation actions. Configurable via `gpio-map.json`. Lives in `audiocontrol-org/hardware-deploy`.

| Aspect | Detail |
|--------|--------|
| **Exists** | Nothing — greenfield |
| **Needed** | GPIO reader (A/B phase encoder decoding, button debouncing), MIDI CC emitter (virtual port), HTTP action emitter, pin mapping config, systemd service |
| **Depends on** | `electron-shell` (needs a running app to control), midi-server virtual port support |
| **Unblocks** | Nothing downstream — this is a leaf feature |

### `standalone-chopper-app`

Self-contained sample chopper running on RPi without an external sampler. Wraps `@audiocontrol/sample-chopper` in an Electron app with audio preview via USB audio interface. Lives in `audiocontrol-org/hardware-deploy`.

| Aspect | Detail |
|--------|--------|
| **Exists** | `sample-chopper` module (transient detection, silence detection, fixed intervals, manual regions), `sampler-library` Node.js path backend |
| **Needed** | Chopper Electron app, audio routing via audio-server on RPi, library management, touch-optimized chopper UI |
| **Depends on** | `kiosk-display-profiles`, `electron-shell`, `common-area-chopping` (library track Phase 2), `sample-chopper-extraction` being complete |
| **Unblocks** | Nothing downstream — this is a leaf feature |

---

## Dependency Graph

```
LIBRARY TRACK                              HARDWARE TRACK

edit-workflow-architecture                 http-midi-transport
├── library-common-area                    └── hardware-boot-config
│   ├── sample-trim-normalize ────────┐        ├── kiosk-display-profiles ◄╌╌ edit-workflow-architecture
│   │   └── dsp-engine                │        │   ├── electron-shell
│   │       └── effects-chain-editor  │        │   │   ├── gpio-input-bridge
│   ├── loop-editor-fixes             │        │   │   └── standalone-chopper-app ◄╌╌ common-area-chopping
│   │   └── velocity-layer-editor     │        │   └── standalone-chopper-app
│   │       └── device-migration ◄────┘
│   └── common-area-chopping ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
│       └── drum-kit-editor
│           └── device-migration

╌╌╌ = cross-track dependency
```

Key observations:
- The two tracks are largely independent — they can be worked in parallel
- `edit-workflow-architecture` is the root of the library track; `http-midi-transport` is the root of the hardware track
- Cross-track dependencies: `kiosk-display-profiles` benefits from `edit-workflow-architecture`; `standalone-chopper-app` depends on `common-area-chopping`
- Hardware phases H1–H3 live in the audiocontrol monorepo; H4–H6 live in `audiocontrol-org/hardware-deploy`

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
| `http-midi-transport` | H1 | Not started | MidiTransport via midi-server HTTP API |
| `hardware-boot-config` | H2 | Not started | JSON boot config replacing URL-based device resolution |
| `kiosk-display-profiles` | H3 | Not started | Touch-optimized CSS for 800×480 and 1024×600 displays |
| `electron-shell` | H4 | Not started | Electron app packaging for RPi deployment |
| `gpio-input-bridge` | H5 | Not started | Physical encoder/button to MIDI CC/HTTP bridge |
| `standalone-chopper-app` | H6 | Not started | Self-contained RPi sample chopper |

Each feature slug corresponds to a `docs/1.0/<slug>/` directory containing a PRD and workplan. Hardware platform docs are in [`audiocontrol-hardware-device-platform/docs/1.0/hardware-device-platform/`](https://github.com/audiocontrol-org/audiocontrol-hardware-device-platform/tree/main/docs/1.0/hardware-device-platform).
