# Changelog

## 1.0.0-alpha.41

### Patch Changes

- Add automatic README version updates and one-click release workflow
- Updated dependencies
  - @oletizi/sampler-devices@1.0.0-alpha.41

## 1.0.0-alpha.40

### Patch Changes

- Restructure monorepo to modules/ directory and add changesets workflow
- Updated dependencies
  - @oletizi/sampler-devices@1.0.0-alpha.40

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-10-04

### Added

- **Core library modules migrated** from deprecated code (Phase 2.1)
  - `model/akai.ts` (62 lines) - Akai data model with 100% test coverage
  - `model/sample.ts` (186 lines) - Sample manipulation with 96% test coverage
  - `lib-core.ts` (142 lines) - Core utilities with 100% test coverage
- **Comprehensive test suite** - 36 unit tests (71.42% overall coverage)
  - Core modules at 100% coverage
  - lib-io.ts at 100% coverage with 91.66% branch coverage
  - sample.ts at 92.13% coverage
- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae, 8b9ae6a)

### Changed

- **BREAKING: Migrated test framework** from mocha+chai to vitest with @vitest/coverage-v8
- **Improved type safety** - All modules in strict TypeScript mode
- **Enhanced error handling** - Descriptive error messages throughout
- **Better modularity** - Clear separation of concerns across modules

### Removed

- **BREAKING: Deleted deprecated code** - All files from `src-deprecated/` migrated
- Removed mocha, chai, c8, and associated dependencies
- Removed `.mocharc.json` configuration file

### Fixed

- **PostCSS loading errors** - Added `postcss.config.cjs` to prevent module errors
- **Test assertions** - Updated to vitest assertions from chai
- **Type definitions** - Improved type safety across all modules

### Security

- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **Input validation** - Proper validation of Akai binary format data

## Migration Guide

### Upgrading from 6.x to 7.0.0

#### Code Migration

Code previously in `src-deprecated/` is now in production-ready modules:

```typescript
// Old (deprecated)
// Files were in src-deprecated/model/

// New (v7.0.0)
import { AkaiDisk, AkaiPartition } from "@/model/akai.js";
import { Sample, SampleMetadata } from "@/model/sample.js";
import { parseAkaiHeader } from "@/lib-core.js";
```

#### Testing Changes

The package now uses **vitest** instead of mocha+chai:

```typescript
// Old (mocha+chai)
import { expect } from "chai";
describe("test", () => {
  it("should work", () => {
    expect(value).to.equal(expected);
  });
});

// New (vitest)
import { describe, it, expect } from "vitest";
describe("test", () => {
  it("should work", () => {
    expect(value).toBe(expected);
  });
});
```

#### API Changes

All public APIs are now fully documented with JSDoc/TSDoc:

```typescript
/**
 * Parses Akai sample header from binary data
 * @param buffer - Binary buffer containing Akai header
 * @returns Parsed sample metadata
 * @throws {Error} If header is invalid or corrupted
 */
export function parseAkaiHeader(buffer: Buffer): SampleMetadata;
```

## Package Features

### Akai Data Models

- **Disk structures** - Partition tables, volume headers, file systems
- **Sample formats** - S1000, S3000, S5000/S6000 sample parsing
- **Program formats** - Akai program file structures
- **Binary parsing** - Low-level format parsing with proper endianness

### Core Utilities

- **Format detection** - Automatic detection of Akai disk formats
- **Data conversion** - Binary to structured data conversion
- **Validation** - Input validation for Akai formats
- **Error handling** - Comprehensive error reporting

## Installation

```bash
npm install @oletizi/sampler-lib
```

## Quick Start

```typescript
import { parseAkaiHeader, Sample } from "@oletizi/sampler-lib";

// Parse Akai sample header
const metadata = parseAkaiHeader(buffer);
console.log(`Sample: ${metadata.name}, Rate: ${metadata.sampleRate}Hz`);

// Work with sample data
const sample = new Sample(metadata, audioData);
```

See the [README](./README.md) for comprehensive documentation and examples.

---

[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-lib-v1.0.0
