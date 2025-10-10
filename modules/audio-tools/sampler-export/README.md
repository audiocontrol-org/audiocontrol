# @oletizi/sampler-export

**Extract and convert Akai sampler disk images to modern, open formats.**

## Installation

**Recommended: Use the installer (installs both backup and export packages)**

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.24/install.sh | bash
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

## Unified Configuration System

**NEW:** This package supports the unified audio-tools configuration system for zero-flag workflows.

### Using with Unified CLI

If you installed `@oletizi/audiotools`, you can use the unified CLI:

```bash
# Configure once
audiotools config

# Run extractions without flags
audiotools export                 # Export all enabled sources
audiotools export pi-scsi2        # Export specific source
```

See the [Unified CLI Guide](../audiotools-cli/README.md) for complete documentation.

### Using Config-Based Workflows

Even when using `akai-export` directly, you can use configuration:

```bash
# Create configuration
audiotools config
# Or use the export command's config wizard
akai-export config

# Run config-based extraction
akai-export extract               # Extract all enabled sources
akai-export extract pi-scsi2      # Extract specific source by name
```

### Configuration File

Configuration is stored in `~/.audiotools/config.json`:

```json
{
  "version": "1.0",
  "backup": {
    "backupRoot": "~/.audiotools/backup",
    "sources": [
      {
        "name": "pi-scsi2",
        "type": "remote",
        "source": "pi-scsi2.local:~/images/",
        "device": "images",
        "enabled": true
      }
    ]
  },
  "export": {
    "outputRoot": "~/.audiotools/sampler-export/extracted",
    "formats": ["sfz", "decentsampler"],
    "skipUnchanged": true,
    "enabledSources": ["pi-scsi2"]
  }
}
```

### Dual Workflow Support

Both workflows are supported:

**Flag-based (original):**
```bash
akai-export extract ~/disk.hds --format sfz --output ~/converted/
```

**Config-based (new):**
```bash
akai-export extract               # All enabled sources
akai-export extract pi-scsi2      # Specific source by name
```

**Benefits of config-based workflow:**
- No flags needed for regular extractions
- Automatic discovery of disk images in backup directories
- Change detection to skip unchanged disks
- Batch processing of multiple sources
- Shared configuration with backup tool
- Manage multiple sources with enable/disable

See [@oletizi/audiotools-config](../audiotools-config/README.md) for configuration API documentation.

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

Integrates with backup workflows to automatically:

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
- **NEW:** Config-based workflows with unified CLI

**Supported Platforms:**
- macOS Apple Silicon (darwin-arm64) - Fully bundled
- macOS Intel, Linux x64/ARM64, Windows - System mtools required

## CLI Commands

### `akai-export extract [source] [options]`

**NEW:** Config-based extraction command. Extracts disk images using configuration from `~/.audiotools/config.json`.

```bash
# Extract all enabled sources
akai-export extract

# Extract specific source by name
akai-export extract pi-scsi2
akai-export extract s5k-studio

# Override with flags (backward compatible)
akai-export extract --input ~/disk.hds --format sfz
```

**Arguments:**
- `[source]` - Optional: specific source name from configuration

**Options:**
- `-i, --input <path>`: Override: input disk image or directory (falls back to flag-based mode)
- `-f, --format <format>`: Override: output format (sfz, decentsampler, or both)
- `-o, --output <path>`: Override: output directory
- `--skip-unchanged`: Skip disk images that haven't changed
- `--force`: Force re-extraction of unchanged disks

**How it works:**
1. If no `--input` flag, loads configuration from `~/.audiotools/config.json`
2. Auto-discovers disk images in backup directories for each enabled source
3. Processes only changed disks (if `skipUnchanged: true` in config)
4. Converts to configured formats (SFZ, DecentSampler, or both)
5. Falls back to flag-based mode if `--input` provided

### Other Commands

The tool also provides specialized commands for specific tasks:

```bash
# Single disk extraction
akai-export disk ~/backup/HD0.hds --format sfz

# Batch extraction
akai-export batch ~/backup/ --format decentsampler

# Sample conversion only
akai-export converter sample ~/sample.a3s --output ~/converted/

# Program conversion only
akai-export converter program ~/program.a3p --format sfz
```

See [CLI Commands Documentation](./docs/1.0/cli-commands.md) for complete details.

## Related Packages

- **[@oletizi/audiotools](../audiotools-cli/README.md)** - Unified CLI for all audio-tools
- **[@oletizi/audiotools-config](../audiotools-config/README.md)** - Shared configuration system
- **[@oletizi/sampler-backup](../sampler-backup/README.md)** - Backup system for sampler disk images
- **[@oletizi/sampler-devices](../sampler-devices/README.md)** - Akai device abstraction and binary parsing
- **[@oletizi/sampler-lib](../sampler-lib/README.md)** - Akai file format utilities

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)
- 🔗 [Unified CLI Guide](../docs/1.0/unified-cli/README.md)

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
- [@oletizi/sampler-backup](https://www.npmjs.com/package/@oletizi/sampler-backup) - Backup system for sampler disk images
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
