# Audio Control

Web-based editors for vintage synthesizers and samplers.

## Overview

Audio Control provides browser-based editors for programming vintage MIDI instruments. Each editor communicates directly with hardware via Web MIDI API and SysEx, enabling real-time parameter editing, backup, and sample management.

## Editors

| Editor | Device | Type | URL |
|--------|--------|------|-----|
| S-330 Editor | Roland S-330 | Sampler | [audiocontrol.org/roland/s330/editor](https://audiocontrol.org/roland/s330/editor) |
| D-110 Editor | Roland D-110 | Synthesizer | [audiocontrol.org/roland/d110/editor](https://audiocontrol.org/roland/d110/editor) |
| JV-1080 Editor | Roland JV-1080 | Synthesizer | [audiocontrol.org/roland/jv1080/editor](https://audiocontrol.org/roland/jv1080/editor) |

## Features

- **Real-time SysEx communication** - Direct parameter editing with instant hardware feedback
- **Backup & restore** - Save complete device states to disk
- **Sample export** - Extract audio samples from sampler memory
- **Cross-format translation** - Convert between sampler formats

## Modules

- `s330-editor` / `d110-editor` / `jv1080-editor` - Web-based device editors
- `editor-core` - Shared editor functionality
- `sampler-midi` - MIDI SysEx protocol implementations
- `sampler-lib` - Shared sampler data structures
- `sampler-devices` - Device communication layer
- `sampler-backup` - Backup and restore utilities
- `sampler-export` - Audio export from sampler data

## Technology

- TypeScript
- React
- Web MIDI API
- pnpm workspaces

## Development

```bash
# Install dependencies
pnpm install

# Build all modules
pnpm build

# Run tests
pnpm test

# Build and test a specific module
pnpm --filter s330-editor build
pnpm --filter s330-editor test
```

## License

MIT
