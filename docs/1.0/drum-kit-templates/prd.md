# Drum Kit Template System - Product Requirements Document

**Created:** 2026-03-07
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Creating drum kits on the S-330 sampler requires manual creation of individual tones and careful patch configuration to map samples to MIDI notes. This is time-consuming and error-prone:

1. **Manual sample import** - Each drum sound must be imported individually as a tone
2. **Repetitive patch configuration** - Mapping each tone to the correct MIDI note requires understanding S-330 patch structure
3. **No standard layout** - Users must remember or document their key mappings
4. **No batch operations** - Building an 8-sample kit requires 8 separate tone imports plus patch editing

## User Stories

- As a musician, I want to drop a folder of drum samples into a standard location so that I can import them as a complete kit with one click
- As a musician, I want samples to auto-assign to standard drum MIDI notes (kick=C2, snare=C#2, etc.) so that I can start playing immediately
- As a musician, I want to import multiple kits at once (e.g., 4-piece kits 01, 02, 03) so that I can layer or switch between them
- As a musician, I want the option to customize my kit configuration via YAML so that I can override auto-detection
- As a musician, I want to see a preview of detected samples and their MIDI mappings before importing so that I can verify the configuration

## Success Criteria

- [ ] Drum kit directories scanned from `library/s330/drum-kits/`
- [ ] Filename convention auto-detects kits: `KICK 01.wav`, `SNARE 01.wav`, `HHC 01.wav`, `HHO 01.wav`
- [ ] Multiple numbered kits supported (01, 02, 03...) with consecutive MIDI ranges
- [ ] Optional `kit.yaml` config overrides auto-detection
- [ ] Preview panel shows detected kits, samples, and MIDI note assignments
- [ ] Import dialog allows selection of starting tone slot, wave bank, and patch slot
- [ ] Import creates tones with one-shot loop mode
- [ ] Import creates patch with correct MIDI note → tone mappings
- [ ] Progress feedback during import
- [ ] Imported kits play correctly when MIDI notes triggered

## Scope

### In Scope

- **Drum kit directory structure** - Standard location under `library/s330/drum-kits/`
- **Filename parsing** - Auto-detect drum type and kit number from filenames
- **kit.yaml schema** - Optional config for custom mappings
- **UI integration** - "Drum Kits" section in LibraryTreePanel
- **Preview panel** - Show detected kits and MIDI mappings
- **Import dialog** - Slot selection and progress
- **Device upload** - Create tones and patch on device

### Out of Scope

- Velocity layers within a single drum hit (separate feature)
- Round-robin sample selection
- Mute groups (S-330 doesn't support this natively)
- Audio preview/playback before import
- Editing kit.yaml from the web UI

## Dependencies

- `@audiocontrol/sampler-library` - Schema and parser (new code)
- Library page infrastructure - LibraryTreePanel, preview panel pattern
- Existing import infrastructure - `wavToS330`, tone upload, patch upload

## Open Questions

- [x] What filename patterns to support?
  - **Decision:** `{TYPE} {##}.wav` where TYPE is KICK, SNARE, HHC (closed hat), HHO (open hat), ## is kit number
- [x] What is the MIDI note mapping per kit?
  - **Decision:** 4 notes per kit starting at C2 (MIDI 36). Kit 01 = C2-D#2, Kit 02 = E2-G#2, etc.
- [x] How are tones ordered within a kit?
  - **Decision:** Kick, Snare, Closed HH, Open HH (lowest to highest note)

## Appendix

### Directory Structure

```
library/
└── s330/
    └── drum-kits/
        └── my-kit-name/
            ├── kit.yaml           # Optional config
            ├── KICK 01.wav
            ├── SNARE 01.wav
            ├── HHC 01.wav
            ├── HHO 01.wav
            ├── KICK 02.wav        # Second kit
            ├── SNARE 02.wav
            ├── HHC 02.wav
            └── HHO 02.wav
```

### MIDI Note Mapping

| Kit | Notes | MIDI Numbers |
|-----|-------|--------------|
| 01 | C2, C#2, D2, D#2 | 36-39 |
| 02 | E1, F1, F#1, G1 | 28-31 |
| 03 | G#1, A1, A#1, B1 | 32-35 |
| 04 | C2, C#2, D2, D#2 | 36-39 |
| ... | ... | ... |

### Sample Order Within Kit

| Position | Type | Description |
|----------|------|-------------|
| 1 | KICK | Kick drum |
| 2 | SNARE | Snare drum |
| 3 | HHC | Closed hi-hat |
| 4 | HHO | Open hi-hat |

### kit.yaml Schema

```yaml
format: drum-kit-bundle
version: 1
name: "My Custom Kit"
description: "Optional description"
sampleRate: 30000          # 15000 or 30000 (default: 30000)
baseNote: C2               # Starting MIDI note (default: C2)

# Optional: explicit mapping overrides filename convention
kits:
  - samples:
      kick: "kick_custom.wav"
      snare: "snare_808.wav"
      hhClosed: "hat_closed.wav"
      hhOpen: "hat_open.wav"
  - samples:
      kick: "KICK 02.wav"
      snare: "SNARE 02.wav"
      hhClosed: "HHC 02.wav"
      hhOpen: "HHO 02.wav"
```
