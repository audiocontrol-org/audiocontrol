# Trigger Architecture Simplification - Product Requirements Document

**Created:** 2026-03-17
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The sample chopper's trigger system has grown organically through multiple features (trigger recording, MIDI learn, auto-map, cross-mode playback). The result is a monolithic `useTriggerRecording` hook that manages recording, trigger mappings, playback config, AND keyboard/MIDI playback listeners — all tangled with circular ref dependencies. This has caused:

1. **Save bug**: After adding a slice and saving, the new slice is lost on reload because the return value named `recordedSlices` actually returns the input slices (a passthrough), not the computed slices from trigger events. The injection effect writes the input back into itself — a no-op.
2. **Stale playback**: The playback engine sometimes uses stale slice boundaries after manual edits because multiple data paths compete.
3. **Confusing data flow**: Circular ref pattern (`triggerPlaybackRef`, `triggerRef`) makes hook composition fragile and hard to reason about.
4. **Mixed concerns**: One hook does four jobs, making any change risky.

## User Stories

- As a developer, I want a clear data flow so I can add features without introducing bugs
- As a user, I want trigger recording to reliably inject slices into the editor
- As a user, I want save to always persist the current state of my slices
- As a user, I want MIDI playback to always use the current slice boundaries

## Success Criteria

- [ ] Trigger recording produces slices that appear in the editor in real time
- [ ] Saving after any edit (add slice, delete, drag, strip silence, record) persists correctly
- [ ] MIDI/keyboard playback always uses current slice boundaries
- [ ] No circular ref dependencies between hooks
- [ ] All existing features work: trigger recording, MIDI learn, auto-map, mono/poly, one-shot/gate, mute groups, undo/redo

## Scope

### In Scope

- Decompose `useTriggerRecording` into three focused hooks
- Fix the slice injection bug (recorded slices never reaching the chopper)
- Eliminate circular ref dependencies
- Preserve all existing UI and functionality

### Out of Scope

- UI changes (all components keep their current appearance)
- New features
- Changes to `useSampleChopper`, `useTriggerInput`, `useTriggerPlayback`, or `useMidiLearn`

## Dependencies

- `useTriggerInput` (unchanged — clean state machine)
- `useTriggerPlayback` (unchanged — clean voice engine)
- `useMidiLearn` (unchanged — clean learn state)
- `useSampleChopper` (unchanged — source of truth for slices)
