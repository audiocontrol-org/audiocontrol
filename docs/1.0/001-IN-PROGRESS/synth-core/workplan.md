# Synth Core — Implementation Workplan

**Feature:** Synth Core — Sample Playback Engine
**PRD:** [prd.md](./prd.md)

## Technical Approach

Create a new `synth-core` workspace module with interface-driven architecture. The Web Audio and Web MIDI implementations are the default browser backend, but the interfaces allow swapping for AudioWorklet, WASM, or native backends.

The module has no UI components — only interfaces, implementations, and React hooks. It depends on nothing except React (peer dep for hooks).

## Implementation Phases

### Phase 1: Module scaffolding and interfaces

- Create `modules/synth-core/` with package.json, tsconfig.json
- Add to pnpm-workspace.yaml and Makefile
- Define core interfaces in `src/types.ts`: `SampleOscillator`, `OscillatorFactory`, `VoiceAllocator`, `NoteInput`
- Create barrel export `src/index.ts`

### Phase 2: Web Audio oscillator factory

- Implement `createWebAudioOscillatorFactory()` in `src/web-audio-oscillator-factory.ts`
- Lazy AudioContext creation
- BufferSourceNode + GainNode per voice
- Pitch via `playbackRate = 2^((note - rootKey) / 12)`
- Loop region via source.loop/loopStart/loopEnd
- Velocity to gain: `velocity / 127`
- Live loop region updates on active oscillators
- Unit tests for pitch calculation

### Phase 3: Voice allocator

- Implement `createVoiceAllocator(factory)` in `src/voice-allocator.ts`
- Map<number, SampleOscillator> keyed by MIDI note
- noteOn: create + start oscillator, track in map
- noteOff: fade out (10ms ramp), remove from map
- stopAll: immediate stop of all voices
- getActiveNotes: return key set for UI

### Phase 4: Web MIDI input

- Implement `createWebMidiNoteInput()` in `src/web-midi-note-input.ts`
- navigator.requestMIDIAccess() on creation
- Listen on all inputs for note-on/note-off
- Proper cleanup on dispose

### Phase 5: useSamplePlayer hook

- Implement in `src/hooks/useSamplePlayer.ts`
- Creates factory, allocator, input on mount
- Wires input events to allocator
- Updates factory when samples/rootKey/loop params change
- Tracks activeNotes in React state
- Disposes all on unmount

### Phase 6: Loop editor integration

- Add `rootKey` and `enableMidiPlayback` props to LoopEditor
- Call useSamplePlayer when enabled
- Thread rootKey from sample/tone metadata through LoopEditorDialog
- Update LibraryPage to pass rootKey when opening loop editor

### Phase 7: Build system integration

- Add SYNTH_CORE to Makefile with correct dependency ordering
- Verify full clean build
- Run all tests

## Task Breakdown

1. Create synth-core module scaffolding
2. Define core interfaces (types.ts)
3. Implement Web Audio oscillator factory
4. Implement voice allocator
5. Implement Web MIDI note input
6. Implement useSamplePlayer hook
7. Wire into loop editor (LoopEditor props + LoopEditorDialog)
8. Thread rootKey from LibraryPage to LoopEditorDialog
9. Build system integration (Makefile, workspace)
10. Verification and testing
