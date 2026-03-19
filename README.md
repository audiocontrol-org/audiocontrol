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

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- GNU Make

### Building

```bash
make                                               # install deps + build everything
make clean && make                                 # full rebuild from scratch
make modules/sampler-devices/.build-stamp          # build one module and its deps
make clean                                         # remove all build artifacts
```

The Makefile installs dependencies automatically (via `pnpm install`) and builds all 24 modules in topological order. Builds are incremental — only modules whose dependencies have changed will rebuild.

#### Why Make?

pnpm workspaces don't enforce build order, so `pnpm -r build` can fail when a downstream module builds before its upstream dependencies. The Makefile encodes the dependency graph with stamp files (`modules/<name>/.build-stamp`) so Make's resolver builds modules in the correct order.

#### Dependency layers

```
Layer 0  shared-midi, sampler-lib, audiotools-config, canonical-midi-maps,
         ardour-midi-maps, launch-control-xl3, launch-control-xl3-editor,
         lib-runtime, sampler-attic, sample-chopper

Layer 1  editor-core, lib-device-uuid, sampler-devices, live-max-cc-router

Layer 2  sampler-midi, sampler-library, sampler-translate, sampler-backup

Layer 3  sampler-export, loop-editor, d110-editor, jv1080-editor

Layer 4  sampler-editor, audiotools-cli
```

### Testing

```bash
pnpm test                            # run all tests
pnpm --filter <module> test          # test a specific module
```

## License

MIT
