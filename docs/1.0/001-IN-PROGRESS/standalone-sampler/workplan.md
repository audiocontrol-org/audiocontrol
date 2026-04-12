# Workplan: standalone-sampler

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | #226 |
| Milestone | TBD |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | #227 | Extend synth-core with multi-keygroup program playback engine |
| Phase 2 | #228 | Create standalone-sampler module with library and synth-core integration |
| Phase 3 | #229 | Build program editor with keygroups, zone mapping, and real-time parameter control |
| Phase 4 | #230 | Add effects chain, multi-timbral support, and performance polish |

## Technical Approach

### Modules Affected

| Module | Change |
|--------|--------|
| `standalone-sampler` (new) | The editor/player web app -- Vite + React |
| `synth-core` | Extend with keygroup/zone-aware multi-sample playback, per-zone filter/amp/pitch |
| `editor-core` | Reuse library browser, parameter sections, shared UI components |
| `sampler-library` | Reuse common-area storage for programs and samples |

### Strategy

Extend synth-core first (engine), then build the app module, then the program editor UI, then performance features. The synth-core engine IS the "device" -- there is no hardware protocol layer. Reuse editor-core patterns and the `program.yaml` format from program-based-slicing.

### Dependencies

- synth-core extension must be complete before Phase 2 (app module needs the engine)
- akai-ux-improvement patterns should be available before Phase 3 (program editor UI reuse)
- program-based-slicing schema defines the program format
- library-ux browser patterns provide the sample/program browsing UI

## Phase 1: Synth-Core Program Engine

Extend synth-core from single-sample playback to multi-keygroup program playback.

### Tasks

- [x] Define program playback interface (program, keygroup, zone types consumed by the engine)
- [x] Implement multi-keygroup voice allocation -- route incoming MIDI note-on to the correct keygroup(s) by key range and velocity range
- [x] Add per-zone pitch parameters: root key, transpose, fine tune
- [x] Add per-zone amplitude envelope: ADSR with configurable attack, decay, sustain, release
- [x] Add per-zone filter: type selection (lowpass, highpass, bandpass), cutoff, resonance, envelope amount
- [x] Create `useProgramPlayer` React hook (replaces `useSlicePlayer` integration -- program engine is its own architecture)
- [x] Unit tests for voice allocation, zone matching, parameter application (27 new tests)

### Acceptance Criteria

- A program with multiple keygroups plays the correct sample for each key/velocity combination
- Per-zone pitch, amp envelope, and filter parameters audibly affect playback
- Voice allocation handles polyphony (multiple simultaneous notes across keygroups)
- All public interfaces have unit test coverage

## Phase 2: Sampler Module Scaffold

Create the standalone-sampler web app module and wire it to the synth-core engine.

### Tasks

- [x] Create `standalone-sampler` module (Vite + React, standard monorepo structure)
- [x] Set up page routing (program editor, library browser, performance view)
- [x] Wire synth-core as the "device" -- no hardware protocol, direct engine calls
- [x] Integrate library browser via editor-core plugins for sample and program browsing
- [x] Implement program load from common area (deserialize program.yaml, load samples into engine)
- [x] Build on-screen keyboard component with note-on/note-off events
- [x] Wire MIDI input routing -- Web MIDI API for external controllers, on-screen keyboard for mouse/touch

### Acceptance Criteria

- App loads in browser with working navigation between pages
- Programs load from common-area library and play through synth-core
- On-screen keyboard triggers notes that play through the loaded program
- External MIDI controller input triggers notes that play through the loaded program
- Library browser shows available programs and samples from common area

## Phase 3: Program Editor

Build the program editor UI for creating and modifying programs.

### Tasks

- [x] Program editor page with zone list and parameter sections
- [x] Zone CRUD -- add, remove, reorder zones within a program (via Zustand store)
- [x] Zone mapping UI -- key range and velocity range selection via ParameterSlider
- [x] Zone overview visualization -- keyboard-style bar view showing all zone key mappings
- [x] Per-zone parameter sections: filter (type, cutoff, resonance, envelope), amp (ADSR), pitch (root, transpose, fine tune)
- [x] Real-time parameter updates -- editing a parameter rebuilds ProgramPlayback for synth-core
- [x] Program save to common-area library (serialize to program.yaml + WAV files)
- [x] Reuse editor-core shared components (ParameterSlider, CollapsibleSection, formatPitch, formatSigned)

### Acceptance Criteria

- Users can create a program from scratch: add keygroups, assign samples, set key/velocity ranges
- Editing a zone parameter (e.g., filter cutoff) is immediately audible during playback
- Programs round-trip through save/load without data loss
- UI follows the same visual patterns as the Akai and Roland editors
- Zone overview visualization accurately reflects all keygroup mappings

## Phase 4: Performance Features

Add effects, multi-timbral support, and performance polish.

### Tasks

- [x] Effects chain using Web Audio nodes: reverb (ConvolverNode), delay (DelayNode+feedback), chorus (LFO-modulated delay)
- [x] Effects routing -- per-program effects chain (source → chorus → delay → reverb → destination)
- [x] Multi-timbral support -- createMultiTimbralEngine routes MIDI channels to independent program engines
- [x] On-screen keyboard with velocity sensitivity (vertical click position)
- [x] MIDI learn store -- CC-to-parameter mapping with learning mode, CC routing in Web MIDI hook
- [x] Performance optimization -- voice stealing at polyphony limit, configurable max voices, mute groups

### Acceptance Criteria

- Effects (reverb, delay, chorus) are audible and configurable per program
- Multiple programs can play simultaneously on different MIDI channels
- On-screen keyboard supports velocity via vertical click position
- MIDI learn allows mapping any CC to any exposed parameter
- Playback remains glitch-free with 16+ simultaneous voices
