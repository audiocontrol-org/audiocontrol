# Synth-Core Slice Playback & Chopper Migration - Product Requirements Document

**Created:** 2026-03-22
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The sample chopper has its own Web Audio playback engine (`useTriggerPlayback`, `useAudioPreview`) that duplicates synth-core's voice management but adds slice-based playback, mute groups, position tracking, and one-shot/gate modes. This duplication prevents:

1. **Shared testing infrastructure** — can't write E2E tests on code that must be refactored
2. **Consistent behavior** — two playback engines with different latency, gain, and cleanup characteristics
3. **Future reuse** — any new context needing slice playback would duplicate again

## User Stories

- As a developer, I want the chopper to use the same playback engine as the loop editor so behavior is consistent and testable.
- As a sound designer, I want the chopper's trigger recording to use deterministic infrastructure so E2E tests can validate it.
- As a developer, I want slice playback in synth-core so future instruments (drum machines, samplers) don't duplicate Web Audio code.

## Solution

Extend synth-core with slice-based oscillators, mute groups, playback position tracking, and one-shot/gate modes. Migrate the sample chopper to use synth-core instead of its own Web Audio code.

### New Synth-Core Capabilities

1. **Slice oscillators**: Play a sample region (startSample→endSample) at original pitch using `source.start(0, offsetSec, durationSec)`
2. **Mute groups**: Voices in the same non-zero group choke each other on noteOn
3. **One-shot vs gate**: One-shot ignores noteOff; gate stops on noteOff
4. **Position tracking**: `requestAnimationFrame`-based sample position for trigger recording
5. **`useSlicePlayer` hook**: Composes factory + allocator + tracker for React consumers

### Chopper Migration Scope

Replace internal Web Audio code in two hooks:
- `useTriggerPlayback` → delegates to synth-core's slice allocator
- `useAudioPreview` → delegates to synth-core's position tracker

Keep untouched (UI-layer concerns):
- `useTriggerInput` — keyboard/MIDI capture
- `useTriggerPlaybackListeners` — wires input to playback
- `useTriggerRecorder` — derives slices from trigger events
- `useTriggerMappings` — mapping management
- `useMidiLearn` — MIDI learn state

## Success Criteria

- [ ] Synth-core supports slice-based oscillators
- [ ] Synth-core supports mute groups
- [ ] Synth-core supports one-shot/gate playback modes
- [ ] Synth-core tracks playback position
- [ ] Sample chopper uses synth-core for all audio playback
- [ ] Existing chopper functionality unchanged (manual slicing, trigger recording, MIDI learn, etc.)
- [ ] E2E tests pass on both surfaces

## Scope

### In Scope

- Synth-core: slice oscillator factory, mute groups, position tracker, useSlicePlayer hook
- Chopper: migrate useTriggerPlayback and useAudioPreview
- Chopper test signals in mock library
- Comprehensive E2E tests

### Out of Scope

- Migrating the loop editor's `useAudioPreview` (already uses synth-core for MIDI)
- Adding envelope generators or filters
- Refactoring useTriggerInput or useTriggerRecorder
