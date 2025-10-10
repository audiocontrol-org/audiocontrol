# Changelog

## 1.0.0-alpha.40

### Patch Changes

- Restructure monorepo to modules/ directory and add changesets workflow
- Updated dependencies
  - @oletizi/sampler-lib@1.0.0-alpha.40

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-10-04

### Added

- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae)
- **Device specifications module** (`specs.ts`) with 100% test coverage
- **MIDI instrument support** - Migrated from deprecated code with dependency injection pattern
- **S56K format support** - Complete refactoring into focused modules
- **Test coverage expansion** - 58 unit/integration tests (40.59% overall, 88-100% on core modules)

### Changed

- **BREAKING: Refactored large files for maintainability**
  - `s56k.ts` (1,085 lines → 7 focused modules, max 397 lines each)
    - New modules: `s56k-types.ts`, `s56k-chunks.ts`, `s56k-parser.ts`, `s56k-writer.ts`, `s56k-program.ts`, `s56k-utils.ts`
    - Backward compatibility maintained via re-export layer
  - `akaitools.ts` (540 lines → 5 focused modules, max 253 lines each)
    - New modules: `akaitools-core.ts`, `akaitools-process.ts`, `akaitools-disk.ts`, `akaitools-remote.ts`, `akaitools-program.ts`
    - Backward compatibility maintained via re-export layer
- **Migrated test framework** from mocha+chai to vitest with @vitest/coverage-v8
- **Improved modular architecture** - Single Responsibility Principle enforced across all modules
- **Enhanced error handling** in SCSI LUN parsing and disk operations (c93bc24)

### Removed

- **BREAKING: Deleted deprecated code** - All files from `src-deprecated/` directory migrated or archived
- Removed mocha, chai, c8, and associated dependencies
- Removed `.mocharc.json` configuration file

### Fixed

- **SCSI LUN parsing** - Corrected device selection logic (c93bc24)
- **Test assertion format mismatches** - Fixed rsnapshot config output expectations
- **PostCSS loading errors** - Added `postcss.config.cjs` to prevent module errors

### Security

- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **Zero deprecated code** - Complete migration from legacy codebase

## Migration Guide

### Upgrading from 6.x to 7.0.0

#### File Refactoring Changes

**s56k Module**: If you were importing from `s56k.ts`, the API remains the same but the implementation is now split:

```typescript
// Still works (re-export layer maintains compatibility)
import { parseS56K, S56KChunk } from "@/devices/s56k.js";

// Or import from specific modules for tree-shaking
import { parseS56K } from "@/devices/s56k-parser.js";
import type { S56KChunk } from "@/devices/s56k-types.js";
```

**akaitools Module**: Similar backward compatibility for akaitools:

```typescript
// Still works (re-export layer)
import { newAkaitools } from "@/io/akaitools.js";

// Or import from specific modules
import { newAkaitools } from "@/io/akaitools-core.js";
```

#### Testing Changes

The package now uses **vitest** instead of mocha+chai. If you were using this package's test utilities:

```typescript
// Old (mocha+chai)
import { expect } from "chai";
describe("test", () => {
  /* ... */
});

// New (vitest)
import { describe, it, expect } from "vitest";
describe("test", () => {
  /* ... */
});
```

#### Code Generation

This package includes auto-generated device code. The following files are generated and should **NEVER** be manually edited:

- `src/devices/s3000xl.ts` (4,868 lines) - Generated from `src/gen/akai-s3000xl.spec.yaml`

To regenerate device code:

```bash
npm run generate
# or
node gen-s3000xl.ts
```

See the [README Code Generation section](./README.md#code-generation) for details.

---

[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-devices-v1.0.0
