# @oletizi/sampler-export

**Extract and convert Akai sampler disk images to modern, open formats.**

## Installation

**Recommended: Use the installer (installs both backup and export packages)**

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.10/install.sh | bash
```

**Alternative: Install this package only**

```bash
npm install -g @oletizi/sampler-export
```

See the [Installation Guide](../docs/1.0/INSTALLATION.md) for more options, troubleshooting, and system requirements.

## Purpose

The `sampler-export` package bridges vintage Akai sampler hardware (S1000, S3000, S5000, S6000) with modern music production workflows. It provides automated extraction of disk images and intelligent conversion to contemporary sampler formats (SFZ, DecentSampler), enabling musicians to preserve and reuse decades of sampled instruments.

## Philosophy

**Preservation through automation.** Rather than manually copying files or using platform-specific GUI tools, this library provides:

- **Format-agnostic extraction**: Handles both native Akai disk formats and DOS/FAT32 partitioned media transparently
- **Zero-configuration design**: Bundles platform-specific binaries where possible, falls back gracefully to system tools
- **Batch intelligence**: Discovers disk images from backup directories, tracks changes, avoids redundant work
- **Conversion pipelines**: Transforms proprietary program files into open, well-documented formats

## Design Approach

### Efficient Disk Access

Disk images can be large (1-2GB for S5000/S6000 media). The library never loads entire disk images into memory:

- **Boot sector detection** (512 bytes) determines DOS vs. native Akai format
- **Partition offset calculation** reads only the MBR when needed
- **Streaming extraction** via mtools or akaitools processes files directly

### Cross-Platform Binary Management

Platform-specific tools (mtools) are bundled for supported platforms and discovered via a three-tier fallback chain:

1. **Bundled binary** - Package ships with pre-built binaries for common platforms
2. **System binary** - Falls back to user-installed tools (Homebrew, apt, yum)
3. **Clear error messages** - Provides platform-specific installation instructions

This ensures zero-configuration experience on primary platforms while supporting manual setup on others.

### Intelligent Batch Processing

Integrates with rsnapshot backup workflows to automatically:

- Discover disk images from structured backup directories
- Compare timestamps to detect changed disks
- Skip unchanged disks to avoid redundant processing
- Aggregate statistics across multiple extractions

## Architecture

```
┌─────────────────────┐
│ extractAkaiDisk()   │  High-level extraction API
└──────────┬──────────┘
           │
    ┌──────▼──────┐
    │ Format      │  Reads boot sector (512 bytes)
    │ Detection   │  Routes to appropriate extractor
    └──────┬──────┘
           │
     ┌─────▼─────┐
     │  Native   │  DOS/FAT32
     │  Akai     │  (mtools)
     └─────┬─────┘
           │
    ┌──────▼──────────┐
    │ Program         │  .a3p → SFZ / DecentSampler
    │ Converters      │  .akp → SFZ / DecentSampler
    └─────────────────┘  .a3s → WAV
```

## Version 1.0

Version 1.0 provides extraction and conversion with comprehensive format support and cross-platform compatibility.

**Key Features:**
- Extract S1000, S3000, S5000, S6000 disk images (native and DOS formats)
- Convert programs to SFZ and DecentSampler presets
- Convert Akai samples to WAV
- Batch processing with change detection
- Bundled mtools for macOS Apple Silicon (zero-config)
- System fallback for other platforms

**Supported Platforms:**
- macOS Apple Silicon (darwin-arm64) - Fully bundled
- macOS Intel, Linux x64/ARM64, Windows - System mtools required

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines, code quality standards, and pull request process.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-export
pnpm install
pnpm run build
pnpm test
```

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@oletizi/sampler-backup](https://www.npmjs.com/package/@oletizi/sampler-backup) - rsnapshot-based sampler backup
- [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices) - Akai device abstraction and binary parsing
- [@oletizi/sampler-lib](https://www.npmjs.com/package/@oletizi/sampler-lib) - Akai file format utilities

**External Dependencies:**
- [mtools](https://www.gnu.org/software/mtools/) - DOS/FAT disk image manipulation
- [xmlbuilder2](https://www.npmjs.com/package/xmlbuilder2) - DecentSampler XML generation

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
