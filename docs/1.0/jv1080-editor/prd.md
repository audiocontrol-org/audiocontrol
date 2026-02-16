# JV-1080 Editor - Product Requirements Document

**Created:** 2026-02-15
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The Roland JV-1080 implementation exists in this repository only as archived code in `modules/sampler-attic/src/midi/roland-jv-1080.ts` (331 lines). There is no active device module, no production editor module, and no test coverage for JV-1080 behavior.

`ol_dsp` tracked this as a feature with a parent issue and decomposed tasks (#49-53), but that scope was not completed in `audiocontrol`. We need to port and modernize the JV-1080 code into the current monorepo architecture.

## User Stories

- As a JV-1080 user, I want a browser-based editor so I can edit parameters without front-panel menu diving.
- As a sound designer, I want real-time SysEx control for system and effects parameters so I can iterate quickly.
- As a developer, I want JV-1080 support moved out of attic code and into maintained modules with tests and typed interfaces.

## Success Criteria

- [ ] JV-1080 protocol code is extracted from `sampler-attic` into `sampler-devices` with strict typing.
- [ ] `@audiocontrol/sampler-devices` exports a reusable JV-1080 client.
- [ ] New `@audiocontrol/jv1080-editor` module builds and runs.
- [ ] System parameters (panel mode, performance/patch selection, FX/reverb/chorus toggles, clock) are editable from UI.
- [ ] Effects workflow supports all 40 FX types listed in source code.
- [ ] Unit tests cover message encoding/decoding and key client operations.
- [ ] Integration/manual verification confirms bidirectional device sync on hardware.

## Scope

### In Scope

- Port and refactor `modules/sampler-attic/src/midi/roland-jv-1080.ts` into modular JV-1080 device code.
- Remove debug logging and normalize implementation to existing module patterns.
- Create a dedicated web editor module scaffold (`modules/jv1080-editor`).
- Implement system parameter controls and effects editor core flows.
- Add documentation and tests for ported functionality.

### Out of Scope

- Patch librarian/bulk dump management beyond minimal working control flows.
- Support for other Roland models (JV-880, XP-series, etc.).
- Advanced preset browser/import/export workflows.
- Migration of unrelated attic content.

## Source and Divergence Analysis

### Existing audiocontrol state

- Archived JV-1080 code is present in attic and not integrated.
- Parent tracking issue exists: `audiocontrol` issue #4.
- No dedicated `jv1080-editor` module currently exists.

### Source planning in ol_dsp

- Parent issue #49 defines feature-level scope.
- Child issues #50-53 define a six-phase sequence: extraction, app scaffold, system controls, effects, patch management, deployment.

### Porting strategy

Use `audiocontrol` module patterns as the baseline architecture. Port logic from attic/source issues while adapting naming, package boundaries, and test conventions to `@audiocontrol/*` standards.

## Dependencies

- `@audiocontrol/sampler-devices` for device-level protocol client
- `@audiocontrol/sampler-midi` for MIDI transport integration where needed
- Existing editor architecture patterns from `s330-editor` and `d110-editor`
- Physical JV-1080 hardware for empirical validation

## Constraints

- Must preserve or improve protocol correctness during refactor.
- Must maintain TypeScript strict compatibility.
- Must avoid adding new cyclic dependencies between sampler modules.
- Must keep GitHub tracking linked to weekly milestone and parent issue.

## Open Questions

- [ ] Should patch management be part of this initial feature, or a follow-up issue set?
- [ ] Should JV-1080 client live in `sampler-devices` only, or also expose a lightweight API from `sampler-midi`?
- [ ] Do we need a device ID selector in v1, or can default ID behavior ship first?
