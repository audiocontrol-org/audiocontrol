# sampler-translate v1.0 Documentation

Complete documentation for the `@oletizi/sampler-translate` package version 1.0.

## Getting Started

- [Installation Guide](./installation.md) - Installation and FFmpeg setup
- [Quick Start](./quick-start.md) - Get up and running in minutes
- [Configuration](./configuration.md) - Translation context and custom factories

## Core Documentation

- [API Reference](./api-reference.md) - Complete API documentation
  - Format converters (`decent2Sxk`, `mpc2Sxk`)
  - S3K translation (`map`, `chop`)
  - Mapping functions (`mapLogicAutoSampler`, custom mappers)
  - Abstract types (`AbstractProgram`, `AbstractKeygroup`, `AbstractZone`)
  - Translation context (`newDefaultTranslateContext`)
  - Sample manipulation (`Sample` interface)

- [Format Support](./format-support.md) - Detailed format documentation
  - DecentSampler (.dspreset) - Features and limitations
  - Akai MPC (.xpm) - Slice extraction and conversion
  - Akai S3000 (.a3p) - Auto-mapping and chopping
  - Akai S5000/S6000 (.akp) - Velocity layer support

## Practical Guides

- [Examples](./examples.md) - Practical usage examples
  - Convert multi-sampled instrument
  - Chop breakbeat into slices
  - DecentSampler with progress tracking
  - Custom velocity layer mapping
  - MPC program conversion

- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
  - FFmpeg not found
  - Audio format conversion fails
  - S3K program generation fails
  - Filename pattern not recognized
  - Sample rate/bit depth issues
  - Memory issues with large files
  - Partition number invalid

## Translation Workflows

### DecentSampler → Akai S5K/S6K

1. Parse DecentSampler XML preset
2. Extract velocity layers and note ranges
3. Load and trim referenced samples
4. Convert to 16-bit, 44.1kHz
5. Map to S5K keygroups (max 4 velocity layers)
6. Generate .akp program file + .WAV samples

### MPC → Akai S5K/S6K

1. Parse MPC XML program
2. Extract slice data from WAV 'atem' chunks
3. Trim samples to slice boundaries
4. Map slices chromatically from C3
5. Apply detuning for pitch shift effect
6. Generate .akp program file + chopped .WAV files

### Audio Directory → Akai S3K

1. Scan directory for audio files
2. Parse note information from filenames (`-C3-`, `-F#4-`)
3. Load audio via FFmpeg
4. Apply mapping function (auto-sampler, custom)
5. Convert to S3K format (16-bit, 44.1kHz)
6. Generate .a3p program + .a3s samples

### Sample Chopping

1. Load long audio file (breakbeat, loop)
2. Calculate chop size (samples per beat × beats per chop)
3. Slice audio into equal segments
4. Map chops sequentially across keyboard
5. Generate S3K program with all chops

## Architecture Concepts

### Abstract Program Model

Format-independent representation enables N+M converters instead of N×M:

```
DecentSampler ──┐
MPC ────────────┼──→ AbstractProgram ──┬──→ S3K
Audio Files ────┘                      └──→ S5K
```

### Translation Context

Dependency injection for testability and flexibility:

```typescript
interface TranslateContext {
  akaiTools: Akaitools;        // Disk operations
  fs: fileio;                  // File I/O
  audioFactory: AudioFactory;  // Audio loading
  audioTranslate: AudioTranslate; // Format conversion
}
```

Customize by providing alternative implementations.

### Mapping Functions

Custom keyboard layout logic:

```typescript
type MapFunction = (sources: AudioSource[]) => AbstractKeygroup[];
```

Built-in: `mapLogicAutoSampler` (filename-based note detection)
Custom: Implement your own for specialized workflows

## Version Information

**Current Version:** 1.0.0
**Release Date:** 2025-10-04
**Compatibility:** Node.js 18+, TypeScript 5.7+

**Requirements:**
- FFmpeg installed on system (for audio conversion)
- `@oletizi/sampler-lib` (sample manipulation)
- `@oletizi/sampler-devices` (Akai format handling)

## Package Relationships

Depends on:
- `@oletizi/sampler-lib` - Sample processing, MIDI utilities
- `@oletizi/sampler-devices` - Akai device abstractions
- `fluent-ffmpeg` - Audio format conversion (requires FFmpeg)
- `music-metadata` - Audio file metadata parsing

Used by:
- Audio production workflows
- Sample library migration tools
- Hardware sampler automation

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/audio-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/audio-tools/discussions)
- **Source Code**: [GitHub Repository](https://github.com/yourusername/audio-tools/tree/main/sampler-translate)
