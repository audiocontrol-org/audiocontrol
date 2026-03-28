# Roland D-110 Editor - Product Requirements Document

**Created:** 2026-02-10
**Status:** Draft
**Owner:** oletizi

## Problem Statement

The Roland D-110 is a classic LA (Linear Arithmetic) synthesis module from 1988 that remains popular among musicians and producers. While the hardware is excellent, editing patches via the front panel is tedious. A web-based editor would enable intuitive sound design and patch management.

## User Stories

- As a musician with a Roland D-110, I want a visual editor so that I can design sounds without menu diving
- As a sound designer, I want to edit tone parameters (partials, envelopes, filters) graphically so that I can work more efficiently
- As a performer, I want to manage multi/patch configurations so that I can organize my performance setups

## Success Criteria

- [ ] Bidirectional SysEx communication with D-110
- [ ] Edit temporary tone parameters with real-time sync
- [ ] Edit multi/patch configuration (8 parts)
- [ ] Visual feedback for all parameter changes
- [ ] Runs in browser via WebMIDI

## Scope

### In Scope

- Web-based editor UI (similar to existing S-330 editor)
- Tone editing (partials, envelopes, filters, waveforms)
- Multi/Patch editing (part configuration, key ranges, output routing)
- System parameters (reverb, partial reserve, MIDI channels)
- Real-time parameter sync with hardware

### Out of Scope

- Bulk dump/library management (future enhancement)
- Rhythm part editing (lower priority)
- D-10/D-20 support (different model, separate feature)

## Dependencies

- WebMIDI API for browser-based MIDI
- Existing audiocontrol editor infrastructure
- Reference: Edisyn D-110 implementation (https://github.com/eclab/edisyn)

## Technical Notes

### D-110 SysEx Format

```
F0 41 [dev] 16 [cmd] [addr-h] [addr-m] [addr-l] [data...] [checksum] F7
```

| Byte | Description |
|------|-------------|
| F0 | Start SysEx |
| 41 | Roland Manufacturer ID |
| dev | Device ID (10-1F, default 10) |
| 16 | D-110 Model ID |
| cmd | Command (11=RQ1 request, 12=DT1 data) |
| addr | 3-byte address |
| data | Parameter data |
| checksum | Roland checksum: (128 - (sum & 0x7F)) & 0xFF |
| F7 | End SysEx |

### Memory Map

| Address | Description | Size |
|---------|-------------|------|
| 03 00 00 | Temporary Timbre (Part 1) | 16 bytes |
| 03 01 00 | Temporary Timbre (Part 2-8) | 16 bytes each |
| 04 00 00 | Temporary Tone (Part 1) | 246 bytes |
| 04 01 00 | Temporary Tone (Part 2-8) | 246 bytes each |
| 06 00 00 | Patch Memory | Multi structure |
| 08 00 00 | Tone RAM (64 tones) | 256 bytes each |
| 10 00 00 | System Parameters | Reverb, reserve, etc. |

### Tone Structure (246 bytes)

**Common Parameters (8 bytes):**
- Patch name (10 bytes ASCII)
- Structure settings (partial routing)
- Partial mute flags
- Envelope mode

**Per-Partial Parameters (4 partials × ~60 params each):**
- Waveform selection and PCM wave number
- Pitch: coarse, fine, keyfollow
- Filter: cutoff, resonance, keyfollow
- Amplifier: level, velocity sensitivity
- Envelopes: pitch, filter, amplifier (multi-stage)

### Multi/Patch Structure

**System Parameters:**
- Reverb mode/time/level
- Partial reserve (32 total across 8 parts + rhythm)
- MIDI channels per part

**Per-Part Parameters (8 parts × 12 params):**
- Tone group and number
- Key shift, fine tune
- Bender range, assign mode
- Output assign, level, pan
- Key range (lower/upper)

## Open Questions

- [ ] Should we support card tones (if card is present)?
- [ ] Priority: Tone editor vs Multi editor first?

## Appendix

### Reference Materials

- Roland D-110 Owner's Manual
- Edisyn D-110 implementation: https://github.com/eclab/edisyn/tree/master/edisyn/synth/rolandd110
- Existing audiocontrol S-330 editor as UI pattern reference
