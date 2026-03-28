# Trigger Chopping - Product Requirements Document

**Created:** 2026-03-16
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The sample chopper currently offers four slice methods (manual, transient, silence, fixed count). All are "offline" — they analyze or configure slices before playback. Musicians who chop samples on hardware (MPC, SP-404mkII, Maschine, NI Battery) expect a real-time trigger workflow: audio plays back and the user marks slice points by hitting keys or pads as they listen. This is the most intuitive way to chop samples by ear and is missing from the current tool.

## User Stories

- As a musician, I want to play back my sample and tap a key in time with the hits so I can chop it by ear
- As a musician, I want to use my MIDI controller pads to mark slice points in real time
- As a musician, I want to switch to manual mode after trigger chopping to fine-tune slice boundaries
- As a musician, I want to re-record if my timing was off without losing the original audio

## Success Criteria

- [ ] New "Trigger" tab appears in the sample chopper dialog
- [ ] Pressing any key or MIDI Note On starts playback and begins marking slices
- [ ] Each trigger marks a slice boundary at the current playback position
- [ ] Slices appear on the waveform in real time as triggers are captured
- [ ] When playback ends, slices are finalized and editable
- [ ] Switching to Manual tab preserves trigger-captured slices
- [ ] "Record Again" clears slices and restarts
- [ ] Works without MIDI (keyboard-only) — MIDI is optional enhancement
- [ ] Existing slice methods (manual, transient, fixed, silence) work unchanged

## Scope

### In Scope

- Real-time trigger capture via keyboard events
- Real-time trigger capture via Web MIDI API Note On messages
- Trigger state machine (idle → armed → recording → complete)
- Low-latency playback position tracking for trigger accuracy
- UI for trigger recording states (arm, recording indicator, stop, reset)
- MIDI availability detection with graceful degradation

### Out of Scope

- Pad assignment mode (mapping specific keys/notes to specific slice slots) — future enhancement
- MIDI CC triggers (only Note On)
- Quantize-to-grid for trigger positions
- Multi-take comparison (keeping multiple recording attempts)
- MIDI output (playing slices back via MIDI)

## Dependencies

- `@audiocontrol/sample-chopper` — the module being extended
- Web MIDI API — optional, for MIDI trigger support
- Web Audio API — existing, for playback and position tracking
