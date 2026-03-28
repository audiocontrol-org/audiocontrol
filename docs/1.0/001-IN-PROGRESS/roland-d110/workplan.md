# Roland D-110 Editor - Workplan

**GitHub Milestone:** [Week of Feb 10-14](https://github.com/audiocontrol-org/audiocontrol/milestone/2)
**GitHub Issues:**

- [Parent: Roland D-110 Editor (#13)](https://github.com/audiocontrol-org/audiocontrol/issues/13)
- [Implement D-110 core MIDI infrastructure (#14)](https://github.com/audiocontrol-org/audiocontrol/issues/14)
- [Implement D-110 tone editor - common parameters (#15)](https://github.com/audiocontrol-org/audiocontrol/issues/15)
- [Implement D-110 tone editor - partial parameters (#16)](https://github.com/audiocontrol-org/audiocontrol/issues/16)
- [Implement D-110 multi/patch editor (#17)](https://github.com/audiocontrol-org/audiocontrol/issues/17)
- [D-110 editor integration and polish (#18)](https://github.com/audiocontrol-org/audiocontrol/issues/18)
- [Standardize BrowserRouter placement (#37)](https://github.com/audiocontrol-org/audiocontrol/issues/37)

---

## Overview

Build a web-based editor for the Roland D-110 synthesizer, following the pattern established by the S-330 editor. The editor will provide visual editing of tones and multi/patch configurations with real-time hardware sync.

## Implementation Phases

### Phase 1: Core MIDI Infrastructure

**Goal:** Bidirectional SysEx communication with D-110

**Tasks:**
1. Create D-110 device module with constants (model ID 0x16, addresses)
2. Implement Roland checksum calculation
3. Implement SysEx message generation (DT1 for writes)
4. Implement SysEx message parsing and device identification
5. Add request/response handling (RQ1 for reads)

**Success Criteria:**
- Can send parameter changes to D-110
- Can request and receive current parameter values
- Device responds correctly to SysEx messages

### Phase 2: Tone Editor - Common Parameters

**Goal:** Edit tone-level settings that affect all partials

**Tasks:**
1. Create tone editor UI scaffold
2. Implement patch name editing
3. Implement structure selection (partial routing)
4. Implement partial mute controls
5. Add envelope mode toggle

**Success Criteria:**
- Can edit and sync tone common parameters
- UI reflects current hardware state

### Phase 3: Tone Editor - Partial Parameters

**Goal:** Full partial editing (the core of sound design)

**Tasks:**
1. Implement waveform/PCM wave selection
2. Implement pitch controls (coarse, fine, keyfollow)
3. Implement filter controls (cutoff, resonance, keyfollow)
4. Implement amplifier controls (level, velocity)
5. Implement envelope editors (pitch, filter, amp)

**Success Criteria:**
- Can edit all partial parameters
- Changes sync in real-time with hardware
- All 4 partials editable

### Phase 4: Multi/Patch Editor

**Goal:** Configure 8-part multi setups

**Tasks:**
1. Create multi editor UI
2. Implement system parameters (reverb, partial reserve)
3. Implement per-part configuration (tone selection, key range)
4. Implement output routing and levels
5. Add MIDI channel assignment

**Success Criteria:**
- Can configure all 8 parts
- Can set key splits and layers
- System parameters sync correctly

### Phase 5: Integration & Polish

**Goal:** Complete, polished editor experience

**Tasks:**
1. Add device connection UI (device ID selection)
2. Implement parameter request on connect (sync from hardware)
3. Add visual feedback for all interactions
4. Testing with physical hardware
5. Documentation

**Success Criteria:**
- Smooth user experience
- Reliable sync with hardware
- Ready for deployment to audiocontrol.org

## File Structure

```
packages/d110-editor/
├── src/
│   ├── lib/
│   │   ├── midi/
│   │   │   ├── d110.ts          # D-110 device class
│   │   │   ├── constants.ts     # Model ID, addresses
│   │   │   ├── sysex.ts         # SysEx generation/parsing
│   │   │   └── types.ts         # TypeScript interfaces
│   │   └── stores/
│   │       ├── tone.ts          # Tone parameter store
│   │       └── multi.ts         # Multi parameter store
│   ├── components/
│   │   ├── ToneEditor/
│   │   ├── MultiEditor/
│   │   └── common/
│   └── routes/
│       └── +page.svelte
├── static/
└── package.json
```

## Dependencies

- Reference Edisyn implementation for parameter details
- Existing audiocontrol infrastructure (SvelteKit, WebMIDI)
- S-330 editor as UI pattern reference

## Testing Strategy

- Unit tests for SysEx generation with known-good byte sequences
- Unit tests for checksum calculation
- Manual testing with physical D-110

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| No physical D-110 for testing | Use Edisyn as reference, compare byte sequences |
| Complex partial structure | Build incrementally, test each parameter type |
| WebMIDI browser support | Document supported browsers, test Chrome/Edge |

## Reference

- Edisyn D-110 source: https://github.com/eclab/edisyn/tree/master/edisyn/synth/rolandd110
- Key files: RolandD110Tone.java, RolandD110Multi.java
