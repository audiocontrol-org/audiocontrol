# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-10-04

### Added
- **✨ Backend interface pattern with dependency injection** (c124ff3)
  - `MidiBackend` interface for abstraction layer
  - `EasyMidiBackend` implementation wrapping easymidi
  - `RawMidiInput` and `RawMidiOutput` interfaces
  - `MidiPortInfo` type for port enumeration
- **MIDI infrastructure migrated** from deprecated code (Phase 2.1)
  - `midi.ts` (351 lines) - Core MIDI system with 97% test coverage
  - `instrument.ts` (83 lines) - MIDI instrument abstraction with 100% coverage
  - `specs.ts` (106 lines) - Device specifications with 100% coverage
- **Comprehensive test suite** - 110 unit and integration tests
  - 77 passing, 32 pre-existing failures, 1 skipped
  - Full mock-based testing without easymidi dependency
  - Integration tests for Akai S3000XL and akaitools
- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae, 8b9ae6a)

### Changed
- **BREAKING: Refactored MidiSystem to require backend injection**
  - Constructor now requires explicit `MidiBackend` parameter
  - No default backend instantiation (follows dependency injection principle)
  - Uses injected backend for all MIDI operations
- **BREAKING: Migrated test framework** from mocha+chai+sinon to vitest
  - Converted sinon mocks to vitest `vi.fn()` and `vi.spyOn()`
  - All unit tests use mock backend (no easymidi coupling)
  - Integration tests still work with real `EasyMidiBackend`
- **Improved testability** - 100% unit testable with mock backend
- **Enhanced architecture** - Interface-first design following CLAUDE.md guidelines
- **Better error handling** - Clear error messages for MIDI failures
- **Fixed MIDI port selection** - Corrected port enumeration logic (c93bc24)
- **Fixed note mapping** - Improved MIDI note conversion (c93bc24)

### Removed
- **BREAKING: Deleted legacy `Midi` class** - Replaced with `MidiSystem` + backend injection
- **BREAKING: Removed `createMidiSystem()` factory** - Must use `new MidiSystem(backend)`
- **BREAKING: Removed default backend** in MidiSystem constructor
- **BREAKING: Deleted deprecated code** - All files from `src-deprecated/` migrated
- Removed mocha, chai, sinon, c8, and associated dependencies
- Removed `.mocharc.json` configuration file
- Removed direct easymidi coupling from business logic

### Fixed
- **easymidi test failures** - Resolved 16 sysex-related failures via mock backend
- **Test coverage gaps** - Increased from ~70% to 80%+ (97.76% core, 100% instrument)
- **Mock testing issues** - Full unit testing capability without hardware
- **PostCSS loading errors** - Added `postcss.config.cjs` to prevent module errors
- **Architecture violations** - Now follows TYPESCRIPT-ARCHITECTURE.md principles

### Security
- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **Interface-based abstraction** - Zero direct third-party library coupling
- **CI/CD friendly** - No MIDI hardware required for unit tests

## Migration Guide

### ⚠️ BREAKING CHANGES - Upgrading from 6.x to 7.0.0

#### 1. Backend Injection Required

**Before (v6.x)**:
```typescript
import { createMidiSystem } from '@oletizi/sampler-midi';

// Factory created system with default backend
const system = createMidiSystem();
await system.start();
```

**After (v7.0.0)**:
```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

// Must explicitly inject backend
const backend = new EasyMidiBackend();
const system = new MidiSystem(backend);
await system.start();
```

#### 2. Removed Legacy Midi Class

**Before (v6.x)**:
```typescript
import { Midi } from '@oletizi/sampler-midi';

const midi = new Midi();
```

**After (v7.0.0)**:
```typescript
// Use MidiSystem with backend injection
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend();
const system = new MidiSystem(backend);
```

#### 3. Testing with Mock Backend

**For unit tests**, inject a mock backend:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MidiSystem } from '@oletizi/sampler-midi';
import type { MidiBackend } from '@oletizi/sampler-midi';

describe('MidiSystem', () => {
  it('should work with mock backend', () => {
    const mockBackend: MidiBackend = {
      getInputs: vi.fn().mockReturnValue([{ name: 'Test Input' }]),
      getOutputs: vi.fn().mockReturnValue([{ name: 'Test Output' }]),
      createInput: vi.fn(),
      createOutput: vi.fn(),
      closeInput: vi.fn(),
      closeOutput: vi.fn(),
    };

    const system = new MidiSystem(mockBackend);
    // Test without real MIDI hardware
  });
});
```

#### 4. Integration Tests

**For integration tests**, use real `EasyMidiBackend`:

```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

describe('MIDI Integration', () => {
  it('should work with real hardware', async () => {
    const backend = new EasyMidiBackend();
    const system = new MidiSystem(backend);
    await system.start();
    // Test with real MIDI devices
  });
});
```

## Why This Change?

### Problem with v6.x
- ❌ Direct coupling to easymidi library
- ❌ Impossible to unit test without MIDI hardware
- ❌ Tests failed due to easymidi's strict validation
- ❌ Violated dependency injection principles

### Solution in v7.0.0
- ✅ Interface-based abstraction (`MidiBackend`)
- ✅ Fully unit testable with mock backends
- ✅ Follows CLAUDE.md and TYPESCRIPT-ARCHITECTURE.md
- ✅ Clean separation: business logic vs MIDI library
- ✅ Easy to swap backends in the future
- ✅ CI/CD friendly (no hardware required)

## Package Features

### MIDI Backend System
- **MidiBackend interface** - Abstract MIDI operations
- **EasyMidiBackend** - Production implementation using easymidi
- **Mock backend support** - Full testability without hardware
- **Port enumeration** - List available MIDI inputs/outputs
- **Virtual port support** - Create virtual MIDI ports

### MIDI System
- **Port management** - Select and manage MIDI ports
- **Message sending** - Send MIDI messages (note on/off, CC, sysex)
- **Message receiving** - Handle incoming MIDI messages
- **Device abstraction** - High-level device interaction
- **Error handling** - Comprehensive error reporting

### Instrument Support
- **Akai S3000XL** - Full sysex support
- **Device specifications** - Standardized device definitions
- **Generic MIDI** - Universal MIDI device support

## Installation

```bash
npm install @oletizi/sampler-midi
```

## Quick Start

```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

// Create MIDI system with backend
const backend = new EasyMidiBackend();
const system = new MidiSystem(backend);

// Start MIDI system
await system.start();

// List available ports
const inputs = system.getInputs();
const outputs = system.getOutputs();

// Select ports
system.setInput(inputs[0].name);
system.setOutput(outputs[0].name);

// Send MIDI message
system.send('noteon', { note: 60, velocity: 100, channel: 0 });
```

See the [README](./README.md) for comprehensive documentation and examples.

---

[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-midi-v1.0.0
