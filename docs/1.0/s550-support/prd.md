# Roland S-550 Editor Support - Product Requirements Document

**Created:** 2026-02-20
**Status:** Draft
**Owner:** audiocontrol-org

## Problem Statement

The audiocontrol ecosystem has a fully-featured web editor for the Roland S-330 sampler. The Roland S-550 is a closely related device from the same product family with a very similar architecture and MIDI SysEx implementation. Users who own an S-550 cannot use the existing editor, despite the significant overlap in functionality.

Additionally, the current S-330 editor implementation has device-specific code tightly coupled throughout. As we look toward supporting non-Roland samplers in the future, we need to establish patterns for code reuse that will scale across device families.

## User Stories

- As an S-550 owner, I want a web-based editor so that I can edit patches, tones, and samples without using the hardware's limited front panel.
- As a developer, I want clear separation between device-specific and reusable code so that adding new sampler support is efficient.
- As a maintainer, I want shared code to live in shared modules so that bug fixes and improvements benefit all editors.

## Success Criteria

- [ ] S-550 editor is functional for patch/tone editing via SysEx
- [ ] S-550 device module follows established patterns from S-330
- [ ] Shared code is extracted to appropriate modules (not duplicated)
- [ ] Architecture supports future non-Roland samplers
- [ ] Test coverage meets project standards (80%+)

## Scope

### In Scope

- Roland S-550 device module (sampler-devices/s550)
- Roland S-550 converters (sampler-library/converters/s550)
- Roland S-550 editor application (s550-editor)
- Extraction of shared Roland S-series code where appropriate
- Documentation of device differences and commonalities

### Out of Scope

- Non-Roland sampler support (future feature, but architecture should enable it)
- Hardware S-550 differences that don't affect MIDI editing (front panel, rack mount)
- S-550 HD (hard disk variant) specific features
- Sample transfer via SCSI (MIDI-based sample transfer only)

## Technical Context

### S-330 vs S-550 Comparison

| Aspect | S-330 | S-550 | Implication |
|--------|-------|-------|-------------|
| Form factor | Desktop | Rack mount | No code impact |
| Sample memory | 512KB-1.5MB | 512KB-2MB | Memory layout may differ |
| Model ID | 0x1E | TBD - verify | Device identification |
| SysEx protocol | Roland format | Same family | Likely identical or very similar |
| Tone structure | 8-point envelope | Likely same | Verify against S-550 docs |
| Patch structure | 8 tone zones | Likely same | Verify against S-550 docs |

### Existing Architecture

The exploration revealed these key patterns:

**Device-specific (sampler-devices/s330/)**:
- `s330-addresses.ts` - Memory layout, SysEx addresses
- `s330-types.ts` - Tone/Patch interfaces, device enums
- `s330-params.ts` - Parameter encoding/decoding
- `s330-client.ts` - MIDI SysEx communication
- `s330-wave-format.ts` - Audio encoding

**Reusable patterns (already abstracted)**:
- `MidiAdapter` interface - Device-agnostic MIDI I/O
- `ConverterRegistry` - Runtime device discovery
- `createMidiStore()` - Store factory pattern
- `editor-core` components - Connection UI, parameter controls

### Architecture Decision: Separate Editors

Create `s550-editor` as a separate module rather than a combined "roland-sampler-editor" because:

1. **Type safety** - Each editor binds to its device-specific types (S550Tone vs S330Tone)
2. **Independent deployment** - Editors can be versioned and deployed separately
3. **Focused scope** - Each editor is single-purpose, easier to maintain
4. **URL consistency** - `audiocontrol.org/roland/s550/editor` follows established pattern

Shared code lives in shared modules (`editor-core`, `sampler-devices`, `sampler-library`), not in editor modules.

## Dependencies

- S-550 Owner's Manual / MIDI Implementation documentation
- Physical S-550 for testing (or emulator)
- Understanding of S-330/S-550 protocol differences

## Open Questions

- [ ] What is the S-550 SysEx model ID? (S-330 is 0x1E)
- [ ] Are memory addresses identical to S-330?
- [ ] Are there S-550-specific parameters not present on S-330?
- [ ] What is the maximum sample memory configuration?
- [ ] Is wave data encoding identical (12-bit)?

## Appendix

### S-Series Family

The Roland S-series includes:
- S-10 (1987) - Entry-level
- S-220 (1987) - Basic rack
- **S-330** (1987) - Desktop, our reference implementation
- **S-550** (1987) - Professional rack mount
- S-770 (1989) - Next generation, different architecture

S-330 and S-550 share the same generation and likely have the most overlap in MIDI implementation.

### Related Modules

```
modules/
├── sampler-devices/src/devices/
│   ├── s330/          # Existing
│   └── s550/          # NEW
├── sampler-library/src/converters/
│   ├── s330/          # Existing
│   └── s550/          # NEW
├── s330-editor/       # Existing
└── s550-editor/       # NEW
```
