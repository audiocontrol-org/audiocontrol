# Drum Kit Template System

**Status:** Planning
**Branch:** `feature/s330-editor` (existing feature branch)
**Milestone:** TBD

## Overview

A template system for importing drum kit sample bundles directly to the S-330 device. Users place WAV samples and an optional YAML config in a named directory under `library/s330/drum-kits/`. The web editor scans these directories, auto-detects kits from filename conventions, and imports them directly to the device (creating tones + patch).

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Quick Links

- **Repository:** [audiocontrol-org/audiocontrol](https://github.com/audiocontrol-org/audiocontrol)
- **Feature Branch:** `feature/s330-editor`
- **Editor Module:** `modules/s330-editor/`
- **Library Module:** `modules/sampler-library/`

## Key Features

1. **Auto-detection from filenames** - `KICK 01.wav`, `SNARE 01.wav` auto-detected
2. **Multiple kits per directory** - Kit 01, 02, 03... with consecutive MIDI ranges
3. **Optional YAML config** - Override auto-detection with `kit.yaml`
4. **Preview before import** - See samples and MIDI mappings
5. **One-click import** - Creates tones + patch on device
6. **Progress feedback** - See import progress and status

## Directory Structure

```
library/s330/drum-kits/
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

## MIDI Note Mapping

| Kit | Notes | MIDI Numbers |
|-----|-------|--------------|
| 01 | C2, C#2, D2, D#2 | 36-39 |
| 02 | E2, F2, F#2, G2 | 40-43 |
| 03 | G#2, A2, A#2, B2 | 44-47 |

Sample order: Kick, Snare, Closed HH, Open HH

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Drum Kit Schema | Pending |
| 2 | Drum Kit Parser | Pending |
| 3 | Module Exports | Pending |
| 4 | Library Service Extensions | Pending |
| 5 | LibraryTreePanel Update | Pending |
| 6 | DrumKitPreviewPanel | Pending |
| 7 | ImportDrumKitDialog | Pending |
| 8 | useImportDrumKit Hook | Pending |
| 9 | LibraryPage Integration | Pending |
