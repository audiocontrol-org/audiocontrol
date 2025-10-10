# sampler-export v1.0 Documentation

## Overview

Version 1.0 provides comprehensive disk image extraction and format conversion for Akai S1000, S3000, S5000, and S6000 samplers. This release includes zero-configuration installation on macOS Apple Silicon with automatic fallback for other platforms.

## Key Capabilities

- **Disk Image Extraction**: Native Akai and DOS/FAT32 disk formats
- **Format Conversion**: Convert .a3p (S3K) and .akp (S5K/S6K) programs to SFZ and DecentSampler
- **Sample Conversion**: Akai .a3s samples to standard WAV format
- **Batch Processing**: Intelligent discovery and change detection for multiple disk images
- **Cross-Platform**: Bundled mtools for darwin-arm64, system fallback for other platforms

## Documentation

1. **[Installation](./installation.md)** - Package installation and platform requirements
2. **[Quick Start](./quick-start.md)** - Get started in 5 minutes
3. **[API Reference](./api-reference.md)** - Complete API documentation
4. **[Configuration](./configuration.md)** - Environment variables and defaults
5. **[Examples](./examples.md)** - Detailed usage examples
6. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Platform Support

| Platform      | Binary Status | Installation Required |
|---------------|---------------|-----------------------|
| darwin-arm64  | ✅ Bundled    | None                  |
| darwin-x64    | ⚠️ Fallback   | `brew install mtools` |
| linux-x64     | ⚠️ Fallback   | `apt/yum install mtools` |
| linux-arm64   | ⚠️ Fallback   | `apt install mtools`  |
| win32-x64     | ⚠️ Fallback   | Manual or WSL2        |

## Getting Started

```bash
npm install @oletizi/sampler-export
```

See [Quick Start](./quick-start.md) for your first extraction.

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

Apache-2.0
