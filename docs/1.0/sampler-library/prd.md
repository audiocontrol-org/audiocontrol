# Sampler Library System - Product Requirements Document

**Created:** 2026-03-06
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Users of vintage samplers like the Roland S-330 need a way to store, organize, edit, and restore sampler data outside the hardware. Currently, sampler data only exists in the hardware's volatile memory or in device-specific backup formats that are not human-readable. There is no standard way to:

1. Save individual tones/patches to a library for later reuse
2. Edit sampler parameters in a human-readable format
3. Build complex instruments from templates (drum kits, velocity-layered patches)
4. Share sampler configurations between users

## User Stories

- As a musician, I want to export tones and patches from my sampler to a human-readable library so that I can version control, edit, and share my configurations
- As a musician, I want to import tones and patches from my library back to my sampler so that I can restore saved configurations
- As a musician, I want to create drum kits from a template so that I can quickly build standard kit layouts without manual key mapping
- As a musician, I want to create velocity-layered instruments from a template so that I can build expressive multi-sample patches without manual velocity splits
- As a developer, I want a device-agnostic library format so that the system can be extended to support other samplers beyond the S-330

## Success Criteria

- [ ] Tones can be exported from device to `~/.audiotools/library/{device}/tones/`
- [ ] Exported tones include both YAML parameters and WAV audio data
- [ ] YAML files are human-readable and editable with any text editor
- [ ] Edited YAML files can be imported back to the device
- [ ] Drum kit template creates correct key mappings on the device
- [ ] Velocity layer template creates correct velocity splits on the device
- [ ] Library format is extensible to support other samplers (not S-330 specific)
- [ ] All converters have 80%+ unit test coverage

## Scope

### In Scope

- **sampler-library module**: New monorepo module for library operations
- **YAML schemas**: Zod-validated schemas for tones, patches, and templates
- **Device converters**: S330Tone/S330Patch ↔ YAML bidirectional conversion
- **File storage**: Read/write YAML and WAV files to filesystem
- **Template engine**: Apply drum-kit and velocity-layer templates
- **Editor integration**: Export/Import dialogs in s330-editor
- **Library browser**: UI panel to view and manage library contents

### Out of Scope

- Cloud storage or sync (library is local filesystem only)
- Multi-device library sharing (each device type has its own subdirectory)
- Real-time library monitoring (manual refresh only)
- Batch export/import (single tone/patch at a time initially)

## Architecture Overview

```
~/.audiotools/library/
├── s330/                       # Device-specific directories
│   ├── tones/
│   │   ├── Kick_01.yaml        # Tone parameters
│   │   └── Kick_01.wav         # Associated wave data
│   ├── patches/
│   │   └── DrumKit_01.yaml     # Patch parameters (references tones)
│   └── templates/
│       ├── drum-kit.yaml       # Template definitions
│       └── velocity-layer.yaml
├── jv1080/                     # Future: JV-1080 support
│   └── ...
└── d110/                       # Future: D-110 support
    └── ...
```

### Extensibility Design

The library system uses a device-agnostic schema format with device-specific extensions:

```yaml
format: sampler-tone        # Generic format identifier
device: s330                # Device type discriminator
version: 1                  # Schema version

# Common fields (all devices)
name: "Kick_01"
wave:
  file: "Kick_01.wav"
  sampleRate: 30000
  loopMode: forward

# Device-specific fields (S-330)
s330:
  originalKey: 60
  outputAssign: 0
  tvf:
    cutoff: 127
    resonance: 0
  tva:
    level: 127
    envelope:
      levels: [127, 100, 80, 60, 40, 20, 10, 0]
      rates: [127, 100, 80, 60, 50, 40, 30, 20]
      sustainPoint: 3
      endPoint: 8
```

### Converter Registry Pattern

```typescript
interface ToneConverter<T> {
  deviceType: string;
  toYaml: (tone: T, wavFilename: string) => ToneYaml;
  fromYaml: (yaml: ToneYaml) => T;
}

// Register device-specific converters
const converters = new Map<string, ToneConverter<unknown>>();
converters.set('s330', s330ToneConverter);
// Future: converters.set('jv1080', jv1080ToneConverter);
```

## Dependencies

- `@audiocontrol/sampler-devices` - Device communication and type definitions
- `@audiocontrol/sampler-lib` - Shared sampler data structures (if needed)
- `zod` - Schema validation
- `yaml` - YAML parsing/serialization
- `wavefile` - WAV file read/write

## Open Questions

- [ ] Should patch YAML embed tone references by filename or by inline content?
  - **Proposal**: By filename reference to avoid duplication
- [ ] Should templates support variables/placeholders for sample names?
  - **Proposal**: Yes, templates reference library tones by name pattern

## Appendix

### YAML Schema Examples

See workplan.md for detailed schema definitions and implementation plan.
