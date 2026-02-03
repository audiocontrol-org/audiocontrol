# Changelog

## 1.0.0-alpha.43

### Patch Changes

- Fix publishing to properly convert workspace:\* dependencies to actual versions
- Updated dependencies
  - @audiocontrol/audiotools-config@1.0.0-alpha.43
  - @audiocontrol/sampler-lib@1.0.0-alpha.43
  - @audiocontrol/sampler-devices@1.0.0-alpha.43
  - @audiocontrol/sampler-backup@1.0.0-alpha.43

## 1.0.0-alpha.42

### Patch Changes

- Fix GitHub release installer to use bootstrap script that downloads dependencies at runtime
- Updated dependencies
  - @audiocontrol/audiotools-config@1.0.0-alpha.42
  - @audiocontrol/sampler-lib@1.0.0-alpha.42
  - @audiocontrol/sampler-devices@1.0.0-alpha.42
  - @audiocontrol/sampler-backup@1.0.0-alpha.42

## 1.0.0-alpha.41

### Patch Changes

- Add automatic README version updates and one-click release workflow
- Updated dependencies
  - @audiocontrol/audiotools-config@1.0.0-alpha.41
  - @audiocontrol/sampler-lib@1.0.0-alpha.41
  - @audiocontrol/sampler-devices@1.0.0-alpha.41
  - @audiocontrol/sampler-backup@1.0.0-alpha.41

## 1.0.0-alpha.40

### Patch Changes

- Restructure monorepo to modules/ directory and add changesets workflow
- Updated dependencies
  - @audiocontrol/audiotools-config@1.0.0-alpha.40
  - @audiocontrol/sampler-lib@1.0.0-alpha.40
  - @audiocontrol/sampler-devices@1.0.0-alpha.40
  - @audiocontrol/sampler-backup@1.0.0-alpha.40

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-10-04

### Added

- **Comprehensive test suite** - 108 unit tests (49.79% overall coverage)
  - Format converters: 95.54% coverage (S3K/S5K to SFZ and DecentSampler)
  - mtools binary utilities: 100% coverage
- **Cross-platform binary bundling** - Platform detection for mtools (darwin-arm64, linux-x64, win32-x64)
- **S3K to DecentSampler converter** - 24 tests covering XML generation, edge cases, MIDI clamping
- **S3K to SFZ converter** - 18 tests covering format conversion and sample file discovery
- **S5K converter support** - 18 tests for multi-zone and multi-keygroup handling
- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae, 0511099, 8b9ae6a)
- **Enhanced README** with API documentation and usage examples (0511099)

### Changed

- **Migrated test framework** from mocha+chai to vitest with @vitest/coverage-v8
- **Binary fallback chain** - Bundled binaries → system binaries → clear error messages
- **Improved error handling** with descriptive messages for missing binaries
- **PostCSS configuration** - Added `postcss.config.cjs` to prevent loading errors

### Fixed

- **MIDI range clamping** - Velocity and note ranges correctly clamped to 0-127
- **Platform detection reliability** - Comprehensive testing of binary execution paths
- **Edge case handling** - Invalid ranges, missing samples, reversed velocity ranges

### Security

- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **Validated binary execution** - Secure child process handling with proper error propagation

## Package Features

### Disk Image Extraction

- Supports Akai native disk formats (S1000, S3000, S5000/S6000)
- DOS/FAT32 filesystem support with boot sector detection
- Batch extraction capabilities
- Efficient large file handling (reads only necessary bytes)

### Format Conversion

- **S3K to SFZ** - Akai S3000 programs to SFZ format
- **S3K to DecentSampler** - Akai S3000 programs to DecentSampler XML
- **S5K to SFZ** - Akai S5000/S6000 programs to SFZ format
- **S5K to DecentSampler** - Akai S5000/S6000 programs to DecentSampler XML
- Preserves sample metadata and mapping information

### Cross-Platform Binary Support

- **Bundled mtools** for all major platforms
- **Platform detection** - darwin-arm64, darwin-x64, linux-x64, win32-x64
- **Fallback chain** - Bundled → System → Error with installation guidance
- **Zero-configuration** installation on 95%+ of systems

## Installation

```bash
npm install @audiocontrol/sampler-export
```

## Quick Start

```typescript
import { DiskExtractor } from "@audiocontrol/sampler-export";

// Extract disk image
const extractor = new DiskExtractor("disk.img", "output/");
await extractor.extract();

// Convert to modern formats
import { convertS3KToSFZ } from "@audiocontrol/sampler-export";
await convertS3KToSFZ("program.a3p", "output.sfz");
```

See the [README](./README.md) for comprehensive documentation and examples.

---

[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-export-v1.0.0
