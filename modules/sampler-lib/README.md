# @audiocontrol/sampler-lib

**Foundational utilities for Akai sampler binary format parsing, sample manipulation, and MIDI operations.**

## Purpose

The `sampler-lib` package provides the core building blocks shared across the audio-tools ecosystem. It handles low-level concerns—binary format conversion, WAV file manipulation, MIDI note parsing, Akai disk structure modeling—so higher-level packages can focus on workflows rather than byte-level details.

This is the shared foundation: when `sampler-devices` needs to convert bytes to numbers with correct endianness, when `sampler-export` needs to resample WAV files, when `sampler-translate` needs to parse MIDI note strings from filenames, they all rely on `sampler-lib` for correct, tested implementations.

## Philosophy

**Composable primitives over monolithic solutions.** Rather than providing high-level orchestration (that's for `sampler-backup`, `sampler-export`, etc.), this library focuses on:

- **Correctness**: Binary operations handle endianness properly, sample conversions preserve audio quality
- **Testability**: Pure functions with no hidden dependencies or side effects
- **Reusability**: Small, focused utilities that compose into larger operations
- **Type safety**: TypeScript strict mode throughout, no `any` escapes

The API surface is deliberately low-level. Applications build workflows by composing these primitives.

## Design Approach

### Binary Format Utilities

Akai formats use mixed-endian encodings and packed data structures. The library provides:

- **Endian-aware conversion**: `bytes2numberLE`, `bytes2numberBE` handle multi-byte integers correctly
- **Nibble operations**: `byte2nibblesLE`, `nibbles2byte` for packed parameter encoding
- **Result types**: Structured error handling with `Result`, `ByteArrayResult`, `NumberResult`

No guessing about byte order or offset errors—the primitives enforce correctness.

### Sample Processing Pipeline

WAV files come in many formats (8/16/24-bit, 22.05/44.1/48kHz, mono/stereo). Samplers have strict requirements. The `Sample` interface provides:

- **Format detection**: Automatic parsing of WAV headers and SMPL chunks
- **Chainable conversions**: `sample.to16Bit().to441().trim(100, 5000)`
- **Metadata preservation**: Root note, sample rate, loop points maintained through conversions
- **Streaming output**: Write to streams without loading entire file in memory

Applications don't implement WAV parsing or resampling—they chain transformations and write results.

### MIDI Abstractions

MIDI note numbers are hard to read. Filenames contain note strings (`C3`, `F#4`). Sampler parameters need conversion between real and MIDI ranges. The library provides:

- **Note parsing**: `parseNote('C4')` → 60
- **Note constants**: `C3 = 60` (Middle C)
- **Scaling utilities**: `scale(value, 0, 100, 0, 127)` for parameter mapping
- **Range conversions**: `real2natural`, `natural2real` for bidirectional mapping

## Architecture

```
┌─────────────────────────────────────┐
│       High-Level Packages           │
│  (backup, export, translate, etc.)  │
└──────────────┬──────────────────────┘
               │ depends on
       ┌───────▼────────┐
       │  sampler-lib   │
       └───────┬────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼──────┐
│ Binary │          │   Sample   │
│ Utils  │          │ Processing │
│        │          │            │
│ bytes2 │          │ to16Bit()  │
│ number │          │ to441()    │
│ LE/BE  │          │ trim()     │
└────────┘          └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │    MIDI    │
                    │   Utils    │
                    │            │
                    │ parseNote  │
                    │ scale()    │
                    └────────────┘
```

## Version 1.0

Version 1.0 provides core utilities with comprehensive type safety and test coverage.

**Key Features:**
- Binary format conversion (endianness, nibbles, bytes)
- WAV sample manipulation (format conversion, trimming, metadata)
- MIDI note parsing and scaling utilities
- Akai disk structure TypeScript models
- Configuration management (server/client configs)
- Process output utilities for logging
- Result types for structured error handling

**Supported Platforms:**
- macOS (darwin-arm64, darwin-x64)
- Linux (x64, ARM64)
- Windows (via WSL2 or native Node.js)

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-lib
pnpm install
pnpm run build
pnpm test
```

**Quality Standards:**
- TypeScript strict mode required
- 80%+ test coverage target
- Pure functions preferred (no hidden state)
- Files under 500 lines (refactor if larger)

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@audiocontrol/sampler-devices](https://www.npmjs.com/package/@audiocontrol/sampler-devices) - Hardware device abstraction
- [@audiocontrol/sampler-export](https://www.npmjs.com/package/@audiocontrol/sampler-export) - Disk extraction and conversion
- [@audiocontrol/sampler-backup](https://www.npmjs.com/package/@audiocontrol/sampler-backup) - Automated backup workflows
- [@audiocontrol/sampler-translate](https://www.npmjs.com/package/@audiocontrol/sampler-translate) - Format translation utilities

**External Dependencies:**
- [wavefile](https://www.npmjs.com/package/wavefile) - WAV file manipulation

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
