# S3000XL Editor - Product Requirements Document

**Created:** 2026-03-30
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The Akai S3000XL is a professional sampler with a deep program/keygroup/sample hierarchy — programs contain keygroups, each keygroup has up to 4 velocity zones with independent sample assignments, and each zone has its own tuning, loudness, filter, and playback parameters. Editing this hierarchy through the hardware's small LCD and button-driven menu system is slow and error-prone, especially for modulation routing (3 assignable sources per destination) and multi-point envelopes.

A web-based editor enables visual editing of all S3000XL parameters via MIDI SysEx, matching the UX standard established by the Roland S-330/S-550 editor (`roland-sxx0-editor`). The editor communicates with the sampler over Web MIDI using the Akai S3000XL SysEx protocol (manufacturer ID 0x47, device ID 0x48).

## User Stories

- As a musician, I want to connect to my S3000XL via Web MIDI so that I can edit programs from a browser without additional software
- As a musician, I want to browse resident programs and samples so that I can see what's loaded on the device at a glance
- As a sound designer, I want to edit program headers (name, polyphony, output routing, LFO settings, pitch controls) so that I can shape the overall program behavior visually
- As a sound designer, I want to manage keygroups within a program (note range, filter, envelopes, velocity sensitivity) so that I can build multi-layered instruments efficiently
- As a sound designer, I want to assign samples to velocity zones with per-zone tuning, loudness, and playback mode so that I can create velocity-switched and crossfaded layers
- As a sound designer, I want to configure modulation routing (3 sources each for pan, amplitude, filter, LFO, and pitch) so that I can build expressive performance controls without menu diving
- As a musician, I want to import and export programs and samples to a library so that I can organize and reuse sounds across sessions

## Success Criteria

- [ ] Connect to S3000XL via Web MIDI and verify communication (status request/response)
- [ ] List and display all resident program and sample names
- [ ] Edit all ProgramHeader parameters with real-time SysEx write-back
- [ ] Edit all KeygroupHeader parameters including filter and amplitude envelopes
- [ ] Assign samples to velocity zones with per-zone parameter editing
- [ ] Configure modulation routing with visual source/destination assignment
- [ ] Import/export programs to library storage (OPFS or filesystem)
- [ ] All shared UI primitives extracted from `roland-sxx0-editor` to `editor-core`
- [ ] `roland-sxx0-editor` continues to build and pass all tests after extraction
- [ ] S3000XL MIDI client modernized to match S-330 client maturity (adapter pattern, request queue, caching)

## Scope

### In Scope

- New module: `modules/akai-s3k-editor/` (Vite + React + TailwindCSS + Radix UI)
- Extract shared UI primitives from `roland-sxx0-editor` into `editor-core`
- Modernize S3000XL MIDI client (`client-akai-s3000xl.ts`) to use adapter pattern
- Web MIDI connection page (reuse `editor-core` MidiConnectionPage)
- Program list and header editing (all ~64 ProgramHeader parameters)
- Keygroup editing (all ~64 KeygroupHeader parameters, ADSR envelopes)
- Velocity zone editing (4 zones per keygroup, sample assignment, crossfade)
- Modulation routing editor (assignable sources for pan, amplitude, filter, LFO, pitch)
- Sample header viewing and parameter editing (loop points, tuning, bandwidth, playback mode)
- Library integration (import/export programs and samples)

### Out of Scope

- Sample waveform transfer (RSPACK/ASPACK opcodes — complex streaming protocol, separate feature)
- Sample waveform editing and visualization
- Disk operations (format, load from disk, save to disk)
- Drum input settings (RDDATA/DDATA opcodes)
- Miscellaneous device data (RMDATA/MDATA opcodes)
- Multi-program management (copy, move, delete programs)
- Effects bus configuration

## Architecture

### Module Structure

```
modules/akai-s3k-editor/         # New module
├── src/
│   ├── App.tsx                  # Router: /akai/s3000xl/editor/*
│   ├── configs/                 # S3000XL DeviceConfig, memory layout
│   ├── pages/                   # Device-specific pages
│   │   ├── ProgramsPage.tsx     # Program list + header editing
│   │   ├── KeygroupsPage.tsx    # Keygroup editing with envelopes
│   │   ├── SampleZonesPage.tsx  # Velocity zone + sample assignment
│   │   └── LibraryPage.tsx      # Library browser with Akai plugin
│   ├── components/              # Akai-specific components
│   │   ├── programs/            # Program editor, modulation routing
│   │   ├── keygroups/           # Keygroup editor, envelope config
│   │   └── zones/               # Velocity zone editor
│   ├── stores/                  # Zustand stores for S3000XL state
│   ├── plugins/                 # S3000XL library plugin
│   └── core/midi/              # S3000XL client wrapper
└── package.json
```

### Shared Primitives (extracted to editor-core)

Components to extract from `roland-sxx0-editor`:
- `EnvelopeEditor` — Multi-stage envelope editing (ADSR and beyond)
- `EnvelopeDisplay` — Envelope visualization
- `ParameterSlider` — Labeled slider with value display and MIDI range
- `MemoryMapPanel` — Visual memory slot layout
- `Tooltip` — Parameter tooltip with description
- `BestFitPicker` — Slot allocation picker

Store patterns to generalize:
- `deviceDataStore` — Sparse-array data cache with bank tracking
- `editorStore` — Selection state and loading progress

Config patterns to share:
- `DeviceConfig` interface and registry pattern
- `MemoryLayout` interface

### URL Convention

```
https://audiocontrol.org/akai/s3000xl/editor
```

### Data Model Mapping

| S3000XL Concept | Roland S-330 Equivalent | UI Page |
|-----------------|------------------------|---------|
| Program | Patch | ProgramsPage |
| Keygroup | Tone | KeygroupsPage |
| Velocity Zone (x4) | Wave slot (x2) | SampleZonesPage |
| Sample Header | Wave data metadata | SampleZonesPage |
| Modulation Routing | (no equivalent) | ProgramsPage |

## Dependencies

- `@audiocontrol/editor-core` — Shared UI components, transports, stores, library connection
- `@audiocontrol/sampler-devices` — S3000XL types (ProgramHeader, KeygroupHeader, SampleHeader) from auto-generated `s3000xl.ts`
- `@audiocontrol/sampler-midi` — S3000XL MIDI client (`client-akai-s3000xl.ts`)
- `@audiocontrol/sampler-library` — Library I/O abstraction
- `@audiocontrol/shared-midi` — Web MIDI adapter creation, retry utilities
- `@audiocontrol/sample-editor` — Sample editing integration (future)
- `@audiocontrol/loop-editor` — Loop editing workflow (future)

## Open Questions

- [ ] Should the S3000XL editor support the S1000/S1100 (same SysEx protocol, fewer features)?
- [ ] What level of sample header editing is useful without waveform visualization?
- [ ] Should modulation routing use a visual node-graph or a simpler table/grid layout?

## Future Scope

- **Pi-SCSI integration** — The S3000XL has a Pi-SCSI device attached. Explore reading/writing sampler data via Pi-SCSI for disk-level access beyond SysEx. The library plugin and data format work should accommodate both SysEx and disk-level data paths.

## Testing Approach

- **Unit tests** — Vitest for all public functions, 80%+ code coverage target, dependency injection for testability (no module stubbing)
- **E2E tests** — Same tooling and approach as `roland-sxx0-editor`: Playwright with heartbeat/watchdog system, make targets, and real hardware when available. The existing `roland-sxx0-editor` E2E infrastructure is being expanded and will serve as the template.

## Auto-Generated Types

`ProgramHeader`, `KeygroupHeader`, and `SampleHeader` types in `sampler-devices` are auto-generated. The generation code was ported from [@oletizi/ol-dsp](https://github.com/oletizi/ol-dsp) on GitHub.

## Existing Akai Data Format Code

The repo already contains significant code for reading and writing Akai data formats. The library plugin will need to expand on this existing code to support full program/sample serialization for library storage.
