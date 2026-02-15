# Audio Control

A monorepo for programmatic MIDI controller mapping and audio plugin parameter management.

## Purpose

Audio Control provides tools and libraries for creating accurate, maintainable MIDI mappings between hardware controllers and audio plugins/DAWs. It solves the fundamental problem of controller mapping: ensuring that physical controls map to the correct plugin parameters with proper ranges and behaviors.

## Components

- **`canonical-midi-maps`** - Device-specific MIDI controller mappings with real plugin parameter indices
- **`ardour-midi-maps`** - TypeScript library for generating Ardour DAW MIDI configuration files
- **Plugin interrogation tools** - Extract accurate parameter information from VST/AU plugins using JUCE

## Key Features

- 🎛️ Accurate plugin parameter extraction via a custom plugin loader
- 🎹 Hardware controller abstraction layers
- 📄 DAW-specific format generation (currently Ardour, more coming)
- 🔧 Programmatic mapping creation with TypeScript
- 📊 Parameter categorization and semantic grouping

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed information about how plugin descriptors, canonical MIDI maps, and DAW-specific mappings work together.

## Quick Start

```bash
# Install dependencies
pnpm install

# Extract plugin parameters
cd modules/canonical-midi-maps
pnpm plugin:generate-batch

# Build libraries
pnpm build
```

## Quality Standard

- Project-wide minimum test coverage: **80%** for lines, functions, branches, and statements.

## License

MIT
