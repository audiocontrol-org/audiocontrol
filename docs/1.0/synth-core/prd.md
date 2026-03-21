# Synth Core — Sample Playback Engine - Product Requirements Document

**Created:** 2026-03-21
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Audio playback in the audiocontrol project is fragmented across multiple ad-hoc implementations:

- **Loop editor**: Single-voice `AudioPlayback` interface that plays one buffer at a time. No MIDI input, no pitch control, no polyphony.
- **Sample chopper**: Custom polyphonic voice engine (`useTriggerPlayback`) tightly coupled to slice-based playback. Supports mono/poly modes and mute groups but can't play pitched samples.
- **Editor-core `AudioPlayback`**: Thin wrapper around a single `BufferSourceNode`. Recently extended with `loop` and `setLoopRegion`, but fundamentally single-voice.

None of these implementations can serve as a general-purpose sampler instrument. Each time a new context needs audio playback (loop editor preview, chopper triggers, future standalone sampler), the same patterns are reimplemented with slight variations.

### Key Issues

1. **No pitched polyphonic playback**: Can't play the same sample at different pitches simultaneously — essential for evaluating loop quality in musical context.
2. **No MIDI input abstraction**: The chopper's `useTriggerInput` directly uses Web MIDI API with no interface for swapping input sources.
3. **No synthesis model**: Playback code treats audio as "play a buffer" rather than "synthesize a voice." There's no concept of oscillators, envelopes, or voice lifecycle.
4. **Tight coupling to Web Audio**: Every playback implementation directly creates `BufferSourceNode` and `GainNode`. No path to alternative backends (e.g., AudioWorklet, native engine, WASM DSP).
5. **Code duplication**: The chopper's voice management, MIDI listening, and gain ramping patterns would need to be copied and modified for the loop editor.

## User Stories

- As a sound designer, I want to play a sample at different pitches via a MIDI controller while editing loop points, so I can hear how the loop sounds across the keyboard range.
- As a sound designer, I want to play chords with the sample so I can evaluate loop quality in a musical context.
- As a sound designer, I want loop point changes to take effect immediately on currently-sounding notes so I can fine-tune loops by ear without stopping and restarting playback.
- As a developer, I want a reusable sample playback engine so I don't duplicate voice management code in every context that needs audio.
- As a developer, I want the playback engine behind interfaces so I can swap the Web Audio implementation for an AudioWorklet or native engine in the future.

## Solution

Create a new `synth-core` module that models a sampler as a synthesizer with sample-based oscillators. The module provides:

1. **Interfaces** for oscillators, voice allocation, and note input — implementation-agnostic
2. **Web Audio implementation** of those interfaces — the default browser backend
3. **Web MIDI input** implementation — listens for note events from MIDI controllers
4. **React hook** (`useSamplePlayer`) that composes the pieces for easy integration

### Conceptual Model

A sampler is a synthesizer where:
- **Oscillator** = sample playback at a pitch (determined by `playbackRate` relative to root key)
- **Voice** = oscillator + gain (velocity-scaled) + loop region
- **Voice allocator** = polyphonic note management (note-on creates voice, note-off releases)
- **Note input** = MIDI controller or keyboard events

```
NoteInput (MIDI/keyboard)
    │
    ├── noteOn(note, velocity)
    │       │
    │       ▼
    │   VoiceAllocator
    │       │
    │       ├── creates SampleOscillator via OscillatorFactory
    │       │       │
    │       │       ├── BufferSourceNode (pitched by playbackRate)
    │       │       ├── GainNode (velocity-scaled)
    │       │       └── loop region (loopStart, loopEnd in seconds)
    │       │
    │       └── tracks active voices by MIDI note number
    │
    └── noteOff(note)
            │
            ▼
        VoiceAllocator.noteOff
            │
            └── fades out + stops the voice for that note
```

### Interface Design

```typescript
/** Single voice — sample playback with pitch and gain control. */
interface SampleOscillator {
  readonly note: number;
  setLoopRegion(enabled: boolean, startSec: number, endSec: number): void;
  stop(fadeTimeSec?: number): void;
  readonly isPlaying: boolean;
}

/** Creates oscillators from sample data. */
interface OscillatorFactory {
  setBuffer(samples: Int16Array | Float32Array, sampleRate: number): void;
  setRootKey(rootKey: number): void;
  setLoopRegion(enabled: boolean, loopStart: number, loopEnd: number): void;
  createOscillator(note: number, velocity: number): SampleOscillator;
  dispose(): void;
}

/** Polyphonic voice allocator. */
interface VoiceAllocator {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  stopAll(): void;
  getActiveNotes(): Set<number>;
  dispose(): void;
}

/** Note event source — MIDI controller, keyboard, sequencer, etc. */
interface NoteInput {
  onNoteOn(handler: ((note: number, velocity: number) => void) | null): void;
  onNoteOff(handler: ((note: number) => void) | null): void;
  dispose(): void;
}
```

## Success Criteria

- [ ] MIDI controller plays sample at correct pitches in the loop editor
- [ ] Polyphonic — chords work (at least 8 simultaneous voices)
- [ ] Loop region changes apply to currently-sounding voices in real time
- [ ] All Web Audio and Web MIDI details are behind interfaces
- [ ] `useSamplePlayer` hook is a single-call integration for React consumers
- [ ] Module has no dependencies on editor-core, sampler-editor, or any UI module
- [ ] Clean separation: synth-core has zero React component exports (only hooks and plain classes)

## Scope

### In Scope

- Polyphonic sample playback engine with pitch control
- Web Audio API implementation (BufferSourceNode + GainNode per voice)
- Web MIDI API input (note-on/note-off from all connected controllers)
- Live loop region updates on active voices
- React hook for easy integration (`useSamplePlayer`)
- Velocity-to-gain mapping
- Voice allocation (polyphonic, keyed by MIDI note)

### Out of Scope

- Envelope generators (ADSR) — future enhancement
- Filters (TVF) — future enhancement
- LFO modulation — future enhancement
- Sample zone mapping (multi-sample across key/velocity ranges) — future, needed for full sampler
- Audio effects (reverb, chorus) — future
- MIDI CC handling (mod wheel, pitch bend) — future
- Sequencer/arpeggiator — future
- Migration of sample-chopper to use synth-core — separate task
- AudioWorklet or WASM backend — future (interfaces enable this)

## Dependencies

- Web Audio API (browser-native)
- Web MIDI API (browser-native, requires HTTPS or localhost)
- React ^18.2.0 (peer dependency, for hooks only)

## Open Questions

- [ ] Should the voice allocator support voice stealing (max polyphony limit)?
- [ ] Should noteOff use a configurable release time or fixed 10ms fade?
- [ ] Should the module export factory functions or classes for the implementations?
