# sampler-midi v1.0 Documentation

Complete documentation for the `@audiocontrol/sampler-midi` package version 1.0 (v7.x series).

## Getting Started

- [Installation Guide](./installation.md) - Installation and setup instructions
- [Quick Start](./quick-start.md) - Get up and running in minutes
- [Migration Guide](./migration-guide.md) - Migrating from v6.x to v7.x (BREAKING CHANGES)

## Core Documentation

- [API Reference](./api-reference.md) - Complete API documentation
  - `MidiSystem` - Main MIDI system class
  - `MidiBackend` interface - Platform abstraction
  - `EasyMidiBackend` - Node.js easymidi implementation
  - `MidiInstrument` - Channel-based instrument abstraction
  - `Device` interface - Akai S3000XL communication
  - `MidiInput` / `MidiOutput` - Port interfaces

## Practical Guides

- [Examples](./examples.md) - Practical usage examples
  - MIDI monitor
  - Custom MIDI backend (mock for testing)
  - Multi-channel performance
  - Akai S3000XL program browser
  - SysEx communication

- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
  - No MIDI ports found
  - SysEx messages not received
  - Port already in use
  - Akai S3000XL not responding
  - TypeScript errors after migration
  - Virtual ports not working

## Architecture and Design

### Interface-First Dependency Injection

Version 7.x introduces a complete architectural shift:

**Before (v6.x):**
```typescript
const midi = createMidiSystem(); // Backend hidden
```

**After (v7.x):**
```typescript
const backend = new EasyMidiBackend(); // Explicit injection
const midi = new MidiSystem(backend);
```

**Benefits:**
- Testability: Inject mock backends for testing
- Flexibility: Swap backends (easymidi, Web MIDI, custom)
- Explicit dependencies: No hidden coupling
- Type safety: Full TypeScript interface contracts

### Backend Abstraction

The `MidiBackend` interface separates what (MIDI operations) from how (platform implementation):

```
Application Code
       ↓
  MidiSystem (orchestration)
       ↓
  MidiBackend (interface)
       ↓
  ┌─────────┬─────────┐
  ↓         ↓         ↓
EasyMidi   WebMIDI   MockMidi
(prod)     (browser) (testing)
```

### Testing Strategy

Interface-first design enables testing without hardware:

```typescript
class TestBackend implements MidiBackend {
  getInputs() { return [{ name: 'Test Input' }]; }
  getOutputs() { return [{ name: 'Test Output' }]; }
  createInput() { return mockInput; }
  createOutput() { return mockOutput; }
}

// Test without real MIDI ports
const backend = new TestBackend();
const system = new MidiSystem(backend);
```

## Version Information

**Current Version:** 1.0.0 (v7.0.0)
**Release Date:** 2025-10-04
**Compatibility:** Node.js 18+, TypeScript 5.7+

**Breaking Changes in v7.0.0:**
- Backend injection **required** (no implicit creation)
- Removed legacy `Midi` class
- Removed `createMidiSystem()` factory
- Constructor signature changed: `new MidiSystem(backend)`

See [Migration Guide](./migration-guide.md) for complete upgrade instructions.

## Package Relationships

This package is used by:
- `@audiocontrol/sampler-devices` - For MIDI SysEx communication with Akai hardware

Depends on:
- `@audiocontrol/sampler-lib` - Core utilities (optional, for some device operations)
- `easymidi` - Default MIDI backend implementation

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

All tests use mock backends—no hardware required.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/audio-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/audio-tools/discussions)
- **Source Code**: [GitHub Repository](https://github.com/yourusername/audio-tools/tree/main/sampler-midi)
