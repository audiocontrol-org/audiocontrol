# Development Guide

Guide for developers working on the `@oletizi/launch-control-xl3` library.

## Setup

```bash
# Clone and install
git clone <repository>
cd launch-control-xl3
npm install
```

## Building

```bash
# Clean build
npm run clean
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run typecheck
```

## Testing

```bash
# Run all tests
npm test

# Fast tests (no coverage)
npm run test:fast

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Hardware Tests

Tests that require connected hardware:

```bash
# Device handshake
npm run test:handshake:node

# Fetch custom mode from device
npm run test:fetch-mode:node

# Full write/read round-trip
npm run test:round-trip:node

# Factory mode copy test
npm run test:factory-copy
```

### Web Automation Tests

Tests using Playwright to interact with Novation Components web editor:

```bash
# Basic automation
npm run web-automation:basic

# Device interaction
npm run web-automation:device

# Full test suite
npm run web-automation:full

# Help
npm run web-automation:help
```

## Protocol Development

### Documentation

Protocol implementation is documented in:

- `docs/PROTOCOL.md` - SysEx protocol specification (version 1.3)
- `docs/ARCHITECTURE.md` - Implementation architecture
- `docs/MAINTENANCE.md` - Development guidelines
- `formats/launch_control_xl3.ksy` - Kaitai Struct specification

### MIDI Spy

For protocol investigation:

```bash
cd ../../modules/coremidi/midi-snoop
make run
```

This passive MIDI monitor captures all traffic between the device and other software (like the web editor).

### Protocol Changes

When modifying the protocol implementation:

1. Update `formats/launch_control_xl3.ksy` FIRST (source of truth)
2. Update `docs/PROTOCOL.md` with examples and discovery methodology
3. Update parser code in `src/core/SysExParser.ts`
4. Add version history entry to both `.ksy` and `PROTOCOL.md`
5. Test with real device
6. Create backup fixture for regression testing

See `docs/MAINTENANCE.md` for detailed requirements.

## Project Structure

```
launch-control-xl3/
├── src/
│   ├── core/              # Core protocol implementation
│   │   ├── SysExParser.ts # SysEx message parsing/building
│   │   └── MidiInterface.ts # MIDI backend abstraction
│   ├── device/
│   │   └── DeviceManager.ts # Device connection & handshake
│   ├── modes/
│   │   └── CustomModeManager.ts # Custom mode operations
│   ├── builders/
│   │   └── CustomModeBuilder.ts # Fluent mode builder API
│   ├── types/             # TypeScript type definitions
│   └── LaunchControlXL3.ts # Main class
├── docs/                  # Protocol & architecture docs
├── formats/               # Protocol specifications
├── backup/                # Device mode backups (test fixtures)
└── utils/                 # Testing utilities
```

## Known Issues

### JUCE Backend

- Page 3 write acknowledgement has delayed delivery (2s timeout workaround in place)
- This is a backend issue, not a protocol issue
- MIDI spy confirms device sends ACK within 24-80ms
- TypeScript parser receives it late

## Publishing

```bash
# Pre-publish checks
npm run clean
npm run build
npm test

# Publish (handled by prepublishOnly script)
npm publish
```

The `prepublishOnly` script automatically runs `clean` and `build`.

## Debugging

### Enable Debug Logging

Uncomment debug logging in:
- `src/core/SysExParser.ts` - Protocol parsing
- `src/device/DeviceManager.ts` - Device communication

### MIDI Traffic Analysis

1. Start MIDI spy: `cd ../../modules/coremidi/midi-snoop && make run`
2. Run your test
3. Analyze hex dumps in spy output

### Common Issues

**Device not found:**
- Check USB connection
- Verify device name matches filter
- Check MIDI permissions (macOS: Privacy settings)

**SysEx parsing errors:**
- Enable debug logging in SysExParser
- Compare with MIDI spy output
- Verify against `.ksy` specification

**Write failures:**
- Check DAW port is initialized
- Verify slot byte is 0x00 for writes
- Check acknowledgement handling

## Code Style

- TypeScript strict mode enabled
- Interface-first design
- Dependency injection for testability
- No files over 500 lines
- Throw errors instead of fallbacks

See project-level `CLAUDE.md` for detailed guidelines.

## Testing Philosophy

- Test against real hardware when possible
- Use MIDI spy to validate protocol correctness
- Compare library output to web editor output
- No mock/stub modules - use dependency injection
- Empirical validation over speculation
