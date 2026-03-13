# Roland S-550 Editor Support

**Status:** Planning
**Feature Branch:** `feature/s550-support`
**GitHub Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)

## Overview

Add web-based editor support for the Roland S-550 sampler, leveraging the existing S-330 editor architecture. The S-550 is a rack-mount sibling of the S-330 with similar architecture and MIDI SysEx protocol.

This feature establishes patterns for multi-device support that will scale to non-Roland samplers in the future.

## Documentation

- [PRD](./prd.md) - Product requirements and technical context
- [Workplan](./workplan.md) - Implementation phases and tasks
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## GitHub Tracking

- **Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)
- **Parent Issue:** [#53 - Roland S-550 Editor Support](https://github.com/audiocontrol-org/audiocontrol/issues/53)
- **Implementation Issues:** See [workplan.md](./workplan.md) for full list

## Modules Affected

| Module | Change Type | Description |
|--------|-------------|-------------|
| `sampler-devices` | Addition | New `devices/s550/` directory |
| `sampler-library` | Addition | New `converters/s550/` directory |
| `s550-editor` | New module | Complete editor application |

## Architecture

```
sampler-devices/src/devices/
├── s330/              # Existing
│   ├── s330-addresses.ts
│   ├── s330-types.ts
│   ├── s330-params.ts
│   ├── s330-client.ts
│   └── ...
└── s550/              # NEW - same structure
    ├── s550-addresses.ts
    ├── s550-types.ts
    ├── s550-params.ts
    ├── s550-client.ts
    └── ...

sampler-library/src/converters/
├── s330/              # Existing
└── s550/              # NEW - same structure

modules/
├── s330-editor/       # Existing
└── s550-editor/       # NEW - same structure, bound to S550 types
```

## Quick Links

- Repository: https://github.com/audiocontrol-org/audiocontrol
- S-330 Editor: https://audiocontrol.org/roland/s330/editor
- S-550 Editor (future): https://audiocontrol.org/roland/s550/editor
