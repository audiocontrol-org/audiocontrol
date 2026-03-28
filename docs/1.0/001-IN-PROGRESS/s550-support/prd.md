# Roland S-550 Editor Support - Product Requirements Document

**Created:** 2026-02-20
**Updated:** 2026-03-15
**Status:** Approved
**Owner:** audiocontrol-org

## Problem Statement

The audiocontrol ecosystem has a fully-featured web editor for the Roland S-330 sampler. The Roland S-550 is a closely related rack-mount device from the same product family sharing the same SysEx model ID (0x1E) and protocol. Users who own an S-550 cannot use the existing editor despite significant architectural overlap. Supporting the S-550 also establishes the pattern for multi-device support across the S-series family and beyond.

## User Stories

- As an S-550 owner, I want a web-based editor so that I can edit patches, tones, and samples without using the hardware's limited front panel
- As a developer, I want shared S-series code in a common base module so that device-specific modules only contain device-specific logic
- As a maintainer, I want a unified sampler editor application that adapts to the connected device rather than maintaining separate editor apps per device

## Success Criteria

- [ ] S-550 device module implemented with correct memory block layout
- [ ] S-550 library converters handle tone, patch, and set import/export
- [ ] Unified sampler editor serves both S-330 and S-550 via device config registry
- [ ] Shared S-series protocol code extracted to `roland-s-series` base module
- [ ] Test coverage meets project standards (80%+)
- [ ] Editor accessible at `audiocontrol.org/roland/s550/editor`

## Scope

### In Scope

- Roland S-550 device module (`sampler-devices/src/devices/s550/`)
- Roland S-series shared base (`sampler-devices/src/devices/roland-s-series/`)
- Roland S-550 library converters (`sampler-library/src/converters/s550/`)
- Unified sampler editor with device config registry (replacing separate `s330-editor`)
- S-550 schema support in sampler-library

### Out of Scope

- Non-Roland sampler support (architecture enables it but not implemented here)
- S-550 HD (hard disk variant) specific features
- Sample transfer via SCSI (MIDI-based sample transfer only)
- S-770 support (different architecture generation)

## Technical Context

### S-550 vs S-330 Memory Block Layout

Both devices share model ID `0x1E` and identical SysEx protocol commands (RQD, WSD, DAT, ACK, EOD, DT1). The key differences are in memory block allocation — the S-550 inverts the patch/tone ratio and doubles the wave bank capacity:

| Aspect | S-330 | S-550 | Notes |
|--------|-------|-------|-------|
| Model ID | 0x1E | 0x1E | Identical — same protocol family |
| Patches | 64 | 32 | S-550 has fewer patches |
| Tones | 32 | 64 | S-550 has more tones |
| Wave banks | 2 (A, B) | 4 (A, B, C, D) | S-550 has double the wave banks |
| Patch block size | 512 bytes (1024 nibbles) | 512 bytes (1024 nibbles) | Identical |
| Tone block size | 256 bytes (512 nibbles) | 256 bytes (512 nibbles) | Identical |
| Patch stride | 4 (byte 2) | 4 (byte 2) | Identical addressing |
| Tone stride | 2 (byte 2) | 2 (byte 2) | Identical addressing |
| Tone layer range | 0-31 | 0-63 | Patch tone maps can reference more tones |
| Wave bank range | 0-1 | 0-3 | Tone wave params can reference more banks |
| Source tone range | 0-31 | 0-63 | Tone source references wider range |
| Wave encoding | 12-bit, 7-bit SysEx | 12-bit, 7-bit SysEx | Identical |
| Polyphony | 16 voices | 24 voices | No protocol impact |

### Base Address Map (Shared)

Both devices use the same 4-byte address format:

| Block | Address | Notes |
|-------|---------|-------|
| System params | `[0x00, 0x00, 0x00, 0x00]` | 11 bytes |
| Patch base | `[0x00, 0x00, 0x00, 0x00]` | Patch N at byte2 = N*4 |
| Tone base | `[0x00, 0x03, 0x00, 0x00]` | Tone N at byte2 = N*2 |
| Wave data | `[0x01, 0x00, 0x00, 0x00]` | Sample data |

### Architecture Decision: Shared Base + Unified Editor

The implementation chose shared infrastructure over code duplication:

1. **Shared `roland-s-series` base module** — Protocol code (SysEx messages, parameter parsing, wave format, type definitions) lives in `devices/roland-s-series/`. Device-specific modules provide configuration constants and re-export shared types.

2. **Unified `sampler-editor`** replaces the separate `s330-editor` — A `DeviceConfig` registry and `DeviceConfigContext` allow a single React application to serve any S-series device. The editor resolves device type from the URL path and injects the correct configuration at runtime.

This approach was chosen because:
- S-330 and S-550 share >90% of protocol code (identical commands, message formats, parameter structure)
- Only memory layout constants differ (patch/tone counts, wave bank range, value ranges)
- A single editor codebase eliminates duplication of UI components, stores, and routing logic
- The `DeviceConfig` interface is extensible to future devices

## Dependencies

- S-550 Owner's Manual / MIDI Implementation documentation (confirmed compatible)
- Physical S-550 or community tester for hardware validation
- Existing S-330 implementation as reference

## Resolved Questions

| Question | Answer |
|----------|--------|
| S-550 SysEx model ID | 0x1E (same as S-330) |
| Memory addresses identical? | Yes — same base addresses, same stride values |
| S-550-specific parameters? | No new parameters; same tone/patch fields with wider value ranges |
| Wave data encoding | Identical 12-bit encoding |
| Maximum sample memory | Up to 2MB (vs 1.5MB S-330) — no protocol impact |

## Open Questions

- [ ] Hardware validation with physical S-550 unit (protocol verified from documentation)
- [ ] S-550 front panel virtual layout (cosmetic — does not block core editor functionality)

## Appendix

### S-Series Family

| Device | Year | Form | Voices | Patches | Tones | Wave Banks | Status |
|--------|------|------|--------|---------|-------|------------|--------|
| S-10 | 1987 | Desktop | 4 | — | — | — | Not planned |
| S-220 | 1987 | Rack | 16 | — | — | — | Not planned |
| **S-330** | 1987 | Desktop | 16 | 64 | 32 | 2 | **Supported** |
| **S-550** | 1987 | Rack | 24 | 32 | 64 | 4 | **This feature** |
| S-770 | 1989 | Rack | 24 | — | — | — | Different architecture |

### Module Layout

```
modules/sampler-devices/src/devices/
├── roland-s-series/          # Shared protocol base
│   ├── s-series-config.ts    # SSeriesDeviceConfig interface
│   ├── s-series-types.ts     # Shared types (envelopes, params, adapters)
│   ├── s-series-constants.ts # Protocol constants (commands, timing)
│   ├── s-series-messages.ts  # SysEx message builders
│   ├── s-series-params.ts    # Parameter parsing/encoding
│   ├── s-series-client.ts    # Client factory
│   └── s-series-wave-format.ts # Wave format conversion
├── s330/                     # S-330 specific
│   ├── s330-config.ts        # 64 patches, 32 tones, 2 wave banks
│   ├── s330-addresses.ts     # Address builders with S-330 ranges
│   ├── s330-params.ts        # S-330 parsing (delegates to shared)
│   └── ...
└── s550/                     # S-550 specific
    ├── s550-config.ts        # 32 patches, 64 tones, 4 wave banks
    ├── s550-addresses.ts     # Address builders with S-550 ranges
    ├── s550-params.ts        # S-550 parsing (delegates to shared)
    └── ...

modules/sampler-library/src/converters/
├── s330/                     # S-330 ↔ library format
└── s550/                     # S-550 ↔ library format

modules/sampler-editor/       # Unified editor (was s330-editor)
├── src/configs/              # Device config registry
│   ├── types.ts              # DeviceConfig interface
│   ├── registry.ts           # Config lookup by device type
│   ├── s330.ts               # S-330 config
│   └── s550.ts               # S-550 config
└── src/context/              # React context for device config
    └── DeviceConfigContext.tsx
```
