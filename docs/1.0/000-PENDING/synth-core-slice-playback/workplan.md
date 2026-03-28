# Synth-Core Slice Playback & Chopper Migration — Workplan

**Feature:** Synth-Core Slice Playback & Chopper Migration
**PRD:** [prd.md](./prd.md)

## Implementation Phases

### Phase 1: Extend synth-core interfaces and implementations
- Add createSliceOscillator to OscillatorFactory
- Add muteGroups and playbackMode to VoiceAllocator
- Add sliceOn/sliceOff to VoiceAllocator
- Implement in Web Audio factory and allocator

### Phase 2: Add playback position tracking
- PlaybackPositionTracker interface and Web Audio implementation
- useSlicePlayer React hook

### Phase 3: Migrate chopper hooks
- Replace useTriggerPlayback internals with synth-core
- Replace useAudioPreview internals with synth-core position tracker
- Add synth-core dependency to sample-chopper

### Phase 4: Add chopper test signals to mock library
- drum-pattern, silence-gaps, soft-loud, rapid-fire, fade-in-hits

### Phase 5: Comprehensive E2E tests
- Feature parity tests on both surfaces
- Transient detection, fixed slicing, keyboard shortcuts

### Phase 6: Build and verify

## Task Breakdown

1. Extend OscillatorFactory with createSliceOscillator
2. Implement slice oscillator in Web Audio factory
3. Add mute groups and one-shot/gate to VoiceAllocator
4. Implement PlaybackPositionTracker
5. Create useSlicePlayer hook
6. Migrate useTriggerPlayback to synth-core
7. Migrate useAudioPreview to synth-core
8. Add chopper test signals to mock library
9. Write comprehensive E2E tests
10. Full build and verify
