# sampler-devices v1.0 Documentation

Complete documentation for the `@audiocontrol/sampler-devices` package version 1.0.

## Getting Started

- [Installation Guide](./installation.md) - Installation and setup instructions
- [Quick Start](./quick-start.md) - Get up and running in minutes
- [Configuration](./configuration.md) - Local disk, remote SSH, and disk image configuration

## Core Documentation

- [API Reference](./api-reference.md) - Complete API documentation
  - Akaitools interface (disk operations)
  - S3000XL device interfaces (auto-generated)
  - S5000/S6000 chunk-based format
  - Factory functions and configuration

- [Code Generation Guide](./code-generation.md) - Understanding and extending auto-generated code
  - Why code generation?
  - YAML specification format
  - Running generators
  - Modifying device specs
  - Committing generated code

## Practical Guides

- [Examples](./examples.md) - Practical usage examples
  - Backup all programs from disk
  - Convert WAV to Akai sample
  - List remote volumes via SSH
  - Parse S5000/S6000 data
  - Modify and save programs

- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
  - akaitools not found
  - Permission denied accessing disk
  - Remote operations timeout
  - Generated code out of sync
  - Import errors

## Advanced Topics

- **Auto-Generated Files**: Do not manually edit `src/devices/s3000xl.ts` (4,868 lines) or files in `src/gen/`
- **Specification Files**: Edit `src/gen/akai-s3000xl.spec.yaml` to modify device interfaces
- **Generator Scripts**: See `src/gen-s3000xl.ts` for generator implementation

## Version Information

**Current Version:** 1.0.0
**Release Date:** 2025-10-04
**Compatibility:** Node.js 18+, TypeScript 5.7+

## Package Relationships

This package integrates with:
- `@audiocontrol/sampler-lib` - Core utilities (dependency)
- `@audiocontrol/sampler-midi` - MIDI communication (sibling)
- `@audiocontrol/sampler-export` - Disk extraction (sibling)
- `@audiocontrol/sampler-backup` - Backup workflows (sibling)

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/audio-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/audio-tools/discussions)
- **Source Code**: [GitHub Repository](https://github.com/yourusername/audio-tools/tree/main/sampler-devices)
