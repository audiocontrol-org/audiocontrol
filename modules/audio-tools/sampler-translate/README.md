# @oletizi/sampler-translate

**Format translation engine for hardware sampler program and sample conversion across DecentSampler, MPC, and Akai formats.**

## Purpose

The `sampler-translate` package bridges incompatible hardware sampler formats, enabling musicians to move programs and samples between DecentSampler, Akai MPC, Akai S3000, and Akai S5000/S6000 platforms. It automates complex conversions—velocity layer mapping, sample chopping, keyboard layout generation—that would otherwise require manual programming on vintage hardware.

Musicians gain freedom to use modern sample libraries (DecentSampler) on vintage hardware (Akai S5000), chop breakbeats from MPC exports for S3000, or build multi-sampled instruments from audio file collections. The package handles format-specific encoding, sample rate conversion, and parameter mapping automatically.

## Philosophy

**Abstract programs, concrete conversions.** Rather than implementing N×M converters (DecentSampler→S3K, MPC→S5K, DecentSampler→S5K, etc.), this library defines:

- **Abstract program model**: `AbstractProgram`, `AbstractKeygroup`, `AbstractZone` represent sampler programs independently of format
- **Format-specific parsers**: DecentSampler→Abstract, MPC→Abstract
- **Format-specific writers**: Abstract→S3K, Abstract→S5K
- **Composable converters**: Chain transformations through abstract representation

Adding a new source format requires one parser (to abstract). Adding a new target format requires one writer (from abstract). The matrix collapses to N+M instead of N×M.

## Design Approach

### Audio Format Independence

Samplers require specific formats (44.1kHz, 16-bit), but source material comes in all formats (48kHz, 24-bit, FLAC, MP3). The `AudioSource` abstraction provides:

- **Lazy sample loading**: Metadata parsed immediately, audio loaded on demand
- **Automatic conversion**: FFmpeg-based transcoding to required formats
- **Format detection**: `music-metadata` library identifies source format
- **Sample pipeline**: Chain operations (trim → resample → convert bit depth → write)

Applications specify target format requirements; the library handles conversion transparently.

### Mapping Function Abstraction

Different workflows require different keyboard mappings:

- **Multi-sampled instruments**: Map samples by root note (C3, D3, E3...) with overlap
- **Drum machines**: Map samples chromatically starting at specific note
- **Velocity layers**: Group samples by note and velocity range
- **Breakbeat chopping**: Slice audio into equal segments, map sequentially

The `MapFunction` type enables custom mapping logic:

```typescript
type MapFunction = (sources: AudioSource[]) => AbstractKeygroup[];
```

Built-in mappers (`mapLogicAutoSampler`) provide common patterns; applications can implement custom logic for specialized workflows.

### Incremental Translation Context

Translation operations require external tools (akaitools), file I/O, and audio conversion. The `TranslateContext` interface bundles dependencies:

```typescript
interface TranslateContext {
  akaiTools: Akaitools;
  fs: fileio;
  audioFactory: AudioFactory;
  audioTranslate: AudioTranslate;
}
```

Applications customize behavior by providing alternative implementations (mock file I/O for testing, custom audio factory for streaming).

## Architecture

```
┌─────────────────────────────────┐
│      Source Formats             │
│  DecentSampler, MPC, Audio Dir  │
└───────────┬─────────────────────┘
            │ parse
    ┌───────▼─────────┐
    │  AbstractProgram│  Format-independent representation
    │  - keygroups[]  │
    │  - zones[]      │
    │  - AudioSource  │
    └───────┬─────────┘
            │ convert
    ┌───────▼─────────┐
    │ Target Formats  │
    │  S3K, S5K, SFZ  │
    └─────────────────┘
```

Translation pipeline:

```
Audio Files → AudioSource[] → MapFunction → AbstractKeygroup[]
                                                   ↓
                                            AudioTranslate
                                                   ↓
                                            Akai Program Files
```

## Version 1.0

Version 1.0 provides format translation with support for DecentSampler, MPC, and Akai S3K/S5K formats.

**Key Features:**
- DecentSampler → Akai S5K/S6K conversion
- MPC → Akai S5K/S6K conversion with slice extraction
- Audio directory → Akai S3K with auto-mapping
- Sample chopping for S3K (breakbeats, loops)
- Velocity layer support (up to 4 layers per keygroup)
- Automatic sample format conversion (FFmpeg)
- Filename-based note detection (`Piano-C3.wav`)
- Custom mapping function support

**Supported Formats:**
- **Source**: DecentSampler (.dspreset), MPC (.xpm), Audio files (WAV, AIFF, FLAC, MP3)
- **Target**: Akai S3000 (.a3p), Akai S5000/S6000 (.akp)
- **Sample Formats**: WAV (output), all FFmpeg-supported (input)

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 🎼 [Format Support](./docs/1.0/format-support.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-translate
pnpm install
pnpm run build
pnpm test
```

**Adding New Format Support:**
1. Create parser in `lib-[format].ts`
2. Define format interfaces
3. Implement conversion to `AbstractProgram`
4. Add tests with sample files
5. Document in format-support.md

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@oletizi/sampler-lib](https://www.npmjs.com/package/@oletizi/sampler-lib) - Sample manipulation (dependency)
- [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices) - Hardware device abstraction (dependency)
- [@oletizi/sampler-export](https://www.npmjs.com/package/@oletizi/sampler-export) - Disk extraction

**External Dependencies:**
- [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg) - Audio format conversion
- [music-metadata](https://www.npmjs.com/package/music-metadata) - Audio file metadata parsing
- [wavefile](https://www.npmjs.com/package/wavefile) - WAV file manipulation

**Requirements:**
- FFmpeg must be installed on your system

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
