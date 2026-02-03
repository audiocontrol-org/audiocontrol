# @audiocontrol/sampler-devices

**Hardware abstraction layer for Akai sampler communication via MIDI SysEx and disk operations.**

## Purpose

The `sampler-devices` package provides programmatic access to vintage Akai hardware samplers (S3000XL, S5000, S6000) through a unified TypeScript interface. It bridges the gap between modern development workflows and decades-old hardware protocols, enabling disk manipulation, program editing, and remote control without manual hardware interaction.

Musicians and developers can automate complex sampler workflows—bulk program editing, sample library management, remote disk operations—that would otherwise require tedious manual button-pressing on vintage hardware. The package handles the intricacies of MIDI SysEx communication, binary format parsing, and disk image manipulation so applications can focus on high-level operations.

## Philosophy

**Generated correctness over hand-written fragility.** Akai sampler formats contain hundreds of parameters across nested data structures (programs, keygroups, zones, samples). Hand-writing parsers and serializers invites offset errors, endianness bugs, and maintenance nightmares.

This library embraces code generation from YAML specifications as the single source of truth:

- **Specification-driven development**: Device parameters defined in human-readable YAML
- **Automatic parser generation**: Binary layout to TypeScript conversion handled by generators
- **Consistency guarantees**: Parsers and serializers generated from identical specs
- **Maintainable evolution**: Add parameters by editing specs, not scattered code

The result: 4,868 lines of generated S3000XL interfaces that are provably correct and trivially updatable.

## Design Approach

### Interface Abstraction Over Implementation Details

Hardware communication requires external tools (akaitools binary, SSH clients, MIDI libraries), but application code shouldn't care. The `Akaitools` interface provides:

- **Local disk operations**: Direct disk/image file access via akaitools
- **Remote operations**: SSH/PiSCSI integration for networked samplers
- **MIDI SysEx communication**: Program and sample manipulation via SysEx
- **Format conversion**: WAV ↔ Akai sample format bidirectional conversion

Applications depend on interfaces, not concrete implementations, enabling testing without hardware.

### Dual-Backend Format Support

Different Akai generations use incompatible formats:

- **S3000XL**: Fixed-offset binary structures, well-documented, mature tooling
- **S5000/S6000**: Chunk-based format, less documentation, partial support

The package provides separate modules (`@audiocontrol/sampler-devices/s3k`, `@audiocontrol/sampler-devices/s5k`) with appropriate abstractions for each generation while sharing common patterns.

### Code Generation Architecture

```
YAML Specification
        ↓
  Generator Script
        ↓
TypeScript Interfaces
        +
  Parser Functions
        +
  Writer Functions
        +
   Client Classes
```

Modification workflow:
1. Edit `akai-s3000xl.spec.yaml`
2. Run `npm run gen`
3. Commit spec + generated code together
4. Generated headers prevent accidental manual editing

## Architecture

```
┌─────────────────────────────────────┐
│          Application Code           │
└──────────────┬──────────────────────┘
               │ uses
       ┌───────▼────────┐
       │   Akaitools    │  Interface (disk ops, conversions)
       │   Interface    │
       └───────┬────────┘
               │ implemented by
       ┌───────▼────────┐
       │ AkaitoolsCore  │  Concrete implementation
       │  - akaitools   │  (calls external binary)
       │  - SSH client  │
       │  - File I/O    │
       └───────┬────────┘
               │
    ┌──────────▼──────────┐
    │  S3000XL Interfaces │  Generated from YAML
    │  - ProgramHeader    │  (4,868 lines)
    │  - KeyGroup         │
    │  - Zone             │
    │  - SampleHeader     │
    └─────────────────────┘
```

## Version 1.0

Version 1.0 provides S3000XL support with auto-generated device interfaces and comprehensive disk operations.

**Key Features:**
- Complete S3000XL MIDI SysEx protocol (auto-generated from spec)
- Disk operations (read, write, format, list)
- Program/sample manipulation (read, write, convert)
- Remote control via SSH/PiSCSI
- WAV ↔ Akai sample format conversion
- Partial S5000/S6000 chunk-based format support
- Code generation tooling for format evolution

**Supported Devices:**
- Akai S3000XL (full support)
- Akai S5000/S6000 (partial support, contributions welcome)

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 🔧 [Code Generation Guide](./docs/1.0/code-generation.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🛠️ [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-devices
pnpm install
pnpm run build
pnpm test
```

**Code Generation:**
```bash
# After modifying src/gen/akai-s3000xl.spec.yaml
npm run gen
# Commit both spec changes AND generated code
```

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@audiocontrol/sampler-lib](https://www.npmjs.com/package/@audiocontrol/sampler-lib) - Core Akai format utilities
- [@audiocontrol/sampler-midi](https://www.npmjs.com/package/@audiocontrol/sampler-midi) - MIDI communication layer
- [@audiocontrol/sampler-export](https://www.npmjs.com/package/@audiocontrol/sampler-export) - Disk extraction and conversion

**External Dependencies:**
- [akaitools](https://www.lsnl.jp/~ohsaki/software/akaitools/) - Hiroyuki Ohsaki's essential disk operation tools
- [Akai S5000/S6000 format documentation](https://burnit.co.uk/AKPspec/) - Seb Francis's reverse engineering work

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
