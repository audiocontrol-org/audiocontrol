# JV-1080 Editor - Workplan

**GitHub Milestone:** [Week of Feb 3-7](https://github.com/audiocontrol-org/audiocontrol/milestone/1)
**GitHub Issues:**

- [Parent: [sampler-devices] JV-1080 Editor (#4)](https://github.com/audiocontrol-org/audiocontrol/issues/4)
- [Extract JV-1080 protocol client into sampler-devices (#20)](https://github.com/audiocontrol-org/audiocontrol/issues/20)
- [Add JV-1080 protocol/unit test coverage (#21)](https://github.com/audiocontrol-org/audiocontrol/issues/21)
- [Scaffold jv1080-editor module and MIDI connection UI (#22)](https://github.com/audiocontrol-org/audiocontrol/issues/22)
- [Implement JV-1080 system parameter controls (#23)](https://github.com/audiocontrol-org/audiocontrol/issues/23)
- [Implement JV-1080 effects editor (type selection + core params) (#24)](https://github.com/audiocontrol-org/audiocontrol/issues/24)
- [Add JV-1080 docs, validation notes, and integration polish (#25)](https://github.com/audiocontrol-org/audiocontrol/issues/25)
- [Source parent in ol_dsp: [audio-tools] JV-1080 Editor (#49)](https://github.com/oletizi/ol_dsp/issues/49)
- [Source task: Extract JV-1080 client from sampler-attic (#50)](https://github.com/oletizi/ol_dsp/issues/50)
- [Source task: Create jv1080-editor web application scaffold (#51)](https://github.com/oletizi/ol_dsp/issues/51)
- [Source task: Implement JV-1080 system parameter controls (#52)](https://github.com/oletizi/ol_dsp/issues/52)
- [Source task: Implement JV-1080 effects editor (#53)](https://github.com/oletizi/ol_dsp/issues/53)

## Technical Approach

Port proven behavior from attic/source assets into current monorepo patterns in small phases, validating protocol logic first, then UI. Keep extraction and refactor in `sampler-devices`, then layer editor functionality in a dedicated `jv1080-editor` module.

**Source of truth for legacy code:**
- `modules/sampler-attic/src/midi/roland-jv-1080.ts`
- `oletizi/ol_dsp` issues #49-53

**Target path mapping:**
- attic: `modules/sampler-attic/src/midi/roland-jv-1080.ts`
- target device code: `modules/sampler-devices/src/devices/jv1080/*`
- target editor app: `modules/jv1080-editor/*`

## Implementation Phases

### Phase 1: Extract and modularize JV-1080 protocol client

- Create `modules/sampler-devices/src/devices/jv1080/` structure.
- Split concerns into files such as:
  - `jv1080-types.ts`
  - `jv1080-addresses.ts`
  - `jv1080-messages.ts`
  - `jv1080-client.ts`
- Remove debug `console.log` usage from ported code.
- Export from `modules/sampler-devices/src/index.ts`.

**Success criteria:**
- JV-1080 client compiles under strict TypeScript.
- Existing behavior from attic implementation is preserved for system and FX writes.

### Phase 2: Add JV-1080 unit tests

- Add tests for Roland checksum and message framing.
- Add tests for address/value encoding for key operations.
- Add tests for event subscription and parsed inbound SysEx handling.

**Success criteria:**
- `pnpm --filter @audiocontrol/sampler-devices test` passes with new JV-1080 coverage.

### Phase 3: Scaffold `jv1080-editor` module

- Create app package structure based on current editor conventions.
- Add MIDI device selection and connection flow.
- Wire basic routing/pages for home/editor states.

**Success criteria:**
- `pnpm --filter @audiocontrol/jv1080-editor build` succeeds.
- Development server runs and can enumerate MIDI ports.

### Phase 4: Implement system parameter controls

Implement controls matching source issue #52:
- Panel mode selector (Performance/Patch/GM)
- Performance number
- Patch group and patch selection
- Insert/chorus/reverb toggles
- Patch remain
- Clock source

**Success criteria:**
- UI sends correct SysEx writes for all listed controls.
- Hardware updates are reflected in UI state where supported.

### Phase 5: Implement effects editor

- Add FX type selector for all 40 FX types from source code.
- Implement parameter controls for selected FX type.
- Bind parameter writes and inbound updates.

**Success criteria:**
- All FX types selectable.
- Core FX parameter editing flow is functional with hardware.

### Phase 6: Documentation and integration polish

- Add module README and protocol notes.
- Ensure docs reflect final architecture and limitations.
- Capture manual validation notes with hardware.

**Success criteria:**
- Feature docs and module docs are synchronized.
- Known limitations are documented explicitly.

## audiocontrol issue decomposition

Child issues created under parent #4:

1. [#20 Extract JV-1080 protocol client into sampler-devices](https://github.com/audiocontrol-org/audiocontrol/issues/20)
2. [#21 Add JV-1080 protocol/unit test coverage](https://github.com/audiocontrol-org/audiocontrol/issues/21)
3. [#22 Scaffold jv1080-editor module and MIDI connection UI](https://github.com/audiocontrol-org/audiocontrol/issues/22)
4. [#23 Implement JV-1080 system parameter controls](https://github.com/audiocontrol-org/audiocontrol/issues/23)
5. [#24 Implement JV-1080 effects editor (type selection + core params)](https://github.com/audiocontrol-org/audiocontrol/issues/24)
6. [#25 Add JV-1080 docs, validation notes, and integration polish](https://github.com/audiocontrol-org/audiocontrol/issues/25)

## Verification Checklist

- [ ] `pnpm --filter @audiocontrol/sampler-devices test`
- [ ] `pnpm --filter @audiocontrol/jv1080-editor test`
- [ ] `pnpm --filter @audiocontrol/jv1080-editor build`
- [ ] Manual hardware validation of system parameter writes
- [ ] Manual hardware validation of FX type/parameter writes
- [ ] Feature docs updated with any implementation deviations
