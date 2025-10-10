# Changelog

## 1.0.0-alpha.42

### Patch Changes

- Fix GitHub release installer to use bootstrap script that downloads dependencies at runtime
- Updated dependencies
  - @oletizi/audiotools-config@1.0.0-alpha.42
  - @oletizi/sampler-lib@1.0.0-alpha.42
  - @oletizi/sampler-devices@1.0.0-alpha.42
  - @oletizi/lib-device-uuid@1.0.0-alpha.42

## 1.0.0-alpha.41

### Patch Changes

- Add automatic README version updates and one-click release workflow
- Updated dependencies
  - @oletizi/audiotools-config@1.0.0-alpha.41
  - @oletizi/sampler-lib@1.0.0-alpha.41
  - @oletizi/sampler-devices@1.0.0-alpha.41
  - @oletizi/lib-device-uuid@1.0.0-alpha.41

## 1.0.0-alpha.40

### Patch Changes

- Restructure monorepo to modules/ directory and add changesets workflow
- Updated dependencies
  - @oletizi/audiotools-config@1.0.0-alpha.40
  - @oletizi/sampler-lib@1.0.0-alpha.40
  - @oletizi/sampler-devices@1.0.0-alpha.40
  - @oletizi/lib-device-uuid@1.0.0-alpha.40

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-10-04

### Added

- **Comprehensive test suite** - 28 unit tests (29.85% overall coverage)
  - rsnapshot configuration module: 98.64% coverage
  - Configuration generation, writing, and path resolution
- **rsnapshot-based incremental backup** for Akai samplers
- **SSH/PiSCSI support** - Remote backup over SSH with rsync
- **Local media support** - SD cards and USB drives from floppy/SCSI emulators
- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae, 8b9ae6a)

### Changed

- **Expanded test coverage** - Comprehensive testing of rsnapshot config generation
- **Enhanced error handling** - Clear messages for SSH failures, missing dependencies
- **Improved configuration validation** - Whitespace handling, trailing slash normalization
- **Test framework** - Already using vitest, enhanced with more comprehensive tests

### Fixed

- **rsnapshot config format** - Corrected tab formatting (single vs double tabs)
- **SSH prefix handling** - Removed incorrect "root@" prefix expectations
- **Edge case handling** - Empty sampler lists, whitespace in paths, trailing slashes

### Security

- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **SSH key-based authentication** - Secure remote backup without passwords

## Package Features

### Backup System

- **rsnapshot wrapper** - Automated incremental backups with hard-linking
- **SSH/PiSCSI support** - Backup from PiSCSI devices over SSH
- **Local media support** - Direct backup from SD cards, USB drives
- **Incremental backups** - Space-efficient snapshots using hard links
- **Configurable retention** - Hourly, daily, weekly, monthly intervals

### Configuration Management

- **Default configuration** - Sensible defaults for Akai sampler backups
- **Custom configuration** - Flexible rsnapshot.conf generation
- **Path resolution** - Automatic config file path discovery
- **Validation** - Input validation and error checking

## Installation

```bash
npm install @oletizi/sampler-backup
```

### Prerequisites

- **rsnapshot** - Install via package manager
- **SSH access** (for remote backups) - Configure SSH keys for authentication

## Quick Start

```typescript
import { RsnapshotWrapper } from "@oletizi/sampler-backup";

// Create backup configuration
const wrapper = new RsnapshotWrapper({
  samplers: [{ name: "s3000xl", host: "piscsi.local", path: "/mnt/sampler" }],
  backupRoot: "/backups/samplers",
});

// Run backup
await wrapper.backup();
```

See the [README](./README.md) for comprehensive documentation and examples.

## Known Limitations

- **rsnapshot-wrapper.ts** (328 lines) - SSH/process testing not yet implemented
  - Core backup logic works but lacks comprehensive test coverage
  - Integration tests require SSH infrastructure
  - Functionality verified with real hardware

---

[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-backup-v1.0.0
