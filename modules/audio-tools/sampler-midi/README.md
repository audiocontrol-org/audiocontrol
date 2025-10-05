# @oletizi/sampler-midi

MIDI communication library for hardware samplers with interface-first dependency injection architecture.

![sampler-midi](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-midi.yml/badge.svg)

## Overview

`@oletizi/sampler-midi` provides a clean, testable interface for MIDI communication with hardware samplers, particularly Akai S3000XL series devices. The package uses dependency injection to enable testing without hardware and supports multiple MIDI backends.

**Key Features**:
- Interface-first design with explicit dependency injection
- Multiple backend support (EasyMidi, Web MIDI API, custom backends)
- Akai S3000XL MIDI SysEx protocol implementation
- Channel-based instrument management
- Comprehensive MIDI port management
- Type-safe message handling

## Installation

```bash
# Using pnpm (recommended for monorepo)
pnpm add @oletizi/sampler-midi

# Using npm
npm install @oletizi/sampler-midi

# Using yarn
yarn add @oletizi/sampler-midi
```

### Dependencies

This package requires:
- `easymidi` - Default MIDI backend for Node.js
- `@oletizi/sampler-devices` - Akai device abstractions
- `@oletizi/sampler-lib` - Core utilities

## Quick Start

### Basic MIDI System Setup

```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

// Create MIDI system with explicit backend injection
const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);

// Start the system (auto-selects first available ports)
await midiSystem.start({ enableSysex: true, debug: true });

// List available ports
console.log('Inputs:', midiSystem.getInputs());
console.log('Outputs:', midiSystem.getOutputs());

// Send a note
const output = midiSystem.getCurrentOutput();
if (output) {
  output.sendNoteOn(60, 100, 0); // Middle C, velocity 100, channel 0
  setTimeout(() => output.sendNoteOff(60, 0, 0), 1000);
}

// Cleanup
await midiSystem.stop();
```

### Using MIDI Instruments

```typescript
import {
  MidiSystem,
  EasyMidiBackend,
  createMidiInstrument
} from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);
await midiSystem.start();

// Create an instrument on channel 0
const instrument = createMidiInstrument(midiSystem, 0);

// Play notes using the instrument
instrument.noteOn(60, 100);   // Middle C
setTimeout(() => instrument.noteOff(60, 0), 1000);

console.log(`Playing on MIDI channel ${instrument.getChannel()}`);
```

### Akai S3000XL Communication

```typescript
import {
  MidiSystem,
  EasyMidiBackend
} from '@oletizi/sampler-midi';
import { newDevice } from '@oletizi/sampler-midi';
import * as easymidi from 'easymidi';

// Setup MIDI system
const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);
await midiSystem.start();

// Get raw ports for device communication
const input = new easymidi.Input('S3000XL MIDI In');
const output = new easymidi.Output('S3000XL MIDI Out');

// Create S3000XL device interface
const device = newDevice(input, output);
await device.init();

// Fetch program names
const programNames: string[] = [];
await device.fetchProgramNames(programNames);
console.log('Available programs:', programNames);

// Get current program
const program = device.getCurrentProgram();
if (program) {
  console.log('Current program:', program.getProgramName());
}

// Fetch sample information
const sample = await device.getSample('MY_SAMPLE');
console.log('Sample name:', sample.getSampleName());
console.log('Sample pitch:', sample.getPitch());
```

## API Reference

### MidiSystem

The core MIDI system class with dependency injection.

#### Constructor

```typescript
constructor(backend: MidiBackend, out?: ProcessOutput)
```

**Parameters**:
- `backend` (required): `MidiBackend` - MIDI backend implementation
- `out` (optional): `ProcessOutput` - Output handler for logging

**BREAKING CHANGE**: As of v7.0.0, the backend parameter is **required**. Legacy factory functions have been removed.

#### Methods

##### `start(config?: MidiConfig): Promise<void>`

Initialize the MIDI system and auto-select first available ports.

```typescript
await midiSystem.start({
  enableSysex: true,  // Enable SysEx message handling
  debug: true         // Enable debug logging
});
```

##### `stop(): Promise<void>`

Shutdown the MIDI system, close all ports, and clear listeners.

##### `getInputs(): MidiPort[]`

Get list of available MIDI input ports.

##### `getOutputs(): MidiPort[]`

Get list of available MIDI output ports.

##### `getCurrentInput(): MidiInput | undefined`

Get the currently active input port.

##### `getCurrentOutput(): MidiOutput | undefined`

Get the currently active output port.

##### `setInput(input: MidiInput | string): void`

Set the active input port by name or instance.

```typescript
midiSystem.setInput('S3000XL MIDI In');
```

##### `setOutput(output: MidiOutput | string): void`

Set the active output port by name or instance.

##### `addListener(event: string, callback: (message: unknown) => void): void`

Add an event listener for MIDI messages.

```typescript
midiSystem.addListener('sysex', (msg) => {
  console.log('Received SysEx:', msg);
});
```

##### `removeListener(event: string, callback: (message: unknown) => void): void`

Remove a previously registered event listener.

### MidiOutput Interface

Represents a MIDI output port with message sending capabilities.

#### Methods

##### `send(eventType: string, message: unknown): void`

Send a generic MIDI message.

##### `sendSysex(data: number[]): void`

Send a SysEx message. Automatically wraps with 0xF0/0xF7 if needed.

```typescript
const sysexData = [0x47, 0x00, 0x00, 0x48]; // Akai message
output.sendSysex(sysexData);
```

##### `sendNoteOn(note: number, velocity: number, channel: number): void`

Send a Note On message.

```typescript
output.sendNoteOn(60, 100, 0); // Middle C, velocity 100, channel 0
```

##### `sendNoteOff(note: number, velocity: number, channel: number): void`

Send a Note Off message.

##### `close(): void`

Close the MIDI output port.

### MidiInput Interface

Represents a MIDI input port with event listening capabilities.

#### Methods

##### `addListener(event: string, callback: (message: unknown) => void): void`

Register a listener for incoming MIDI events.

##### `removeListener(event: string, callback: (message: unknown) => void): void`

Unregister a previously added listener.

##### `close(): void`

Close the MIDI input port.

### MidiBackend Interface

Backend abstraction for platform-specific MIDI implementations.

```typescript
interface MidiBackend {
  getInputs(): MidiPortInfo[];
  getOutputs(): MidiPortInfo[];
  createInput(name: string, virtual?: boolean): RawMidiInput;
  createOutput(name: string, virtual?: boolean): RawMidiOutput;
}
```

#### EasyMidiBackend

Default backend implementation using the `easymidi` library.

```typescript
import { EasyMidiBackend } from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend();
const inputs = backend.getInputs();
const outputs = backend.getOutputs();
```

### MidiInstrument Interface

Simplified interface for playing notes on a specific MIDI channel.

#### Factory Functions

##### `createMidiInstrument(midiSystem: MidiSystemInterface, channel: number): MidiInstrument`

Create a MIDI instrument on the specified channel (0-15).

```typescript
const piano = createMidiInstrument(midiSystem, 0);
const drums = createMidiInstrument(midiSystem, 9);
```

#### Methods

##### `noteOn(note: number, velocity: number): void`

Play a note on the instrument's channel.

##### `noteOff(note: number, velocity: number): void`

Stop a note on the instrument's channel.

##### `getChannel(): number`

Get the MIDI channel for this instrument (0-15).

### Device Interface (Akai S3000XL)

High-level interface for Akai S3000XL sampler communication.

#### Factory Function

```typescript
import { newDevice } from '@oletizi/sampler-midi';
import * as easymidi from 'easymidi';

const input = new easymidi.Input('S3000XL MIDI In');
const output = new easymidi.Output('S3000XL MIDI Out');
const device = newDevice(input, output);
```

#### Methods

##### `init(): Promise<void>`

Initialize device connection and fetch initial state.

##### `fetchProgramNames(names: string[]): Promise<string[]>`

Retrieve list of program names from the sampler.

##### `fetchSampleNames(names: string[]): Promise<string[]>`

Retrieve list of sample names from the sampler.

##### `getProgram(programNumber: number): Promise<Program>`

Fetch a complete program with all keygroups.

##### `getSample(sampleName: string): Promise<AkaiS3kSample>`

Fetch sample header information by name.

##### `fetchProgramHeader(programNumber: number, header: ProgramHeader): Promise<ProgramHeader>`

Fetch program header data via SysEx.

##### `fetchSampleHeader(sampleNumber: number, header: SampleHeader): Promise<SampleHeader>`

Fetch sample header data via SysEx.

##### `writeProgramName(header: ProgramHeader, name: string): Promise<void>`

Update a program's name.

##### `writeProgramPolyphony(header: ProgramHeader, polyphony: number): Promise<void>`

Update a program's polyphony setting.

## Configuration

### MidiConfig

Configuration options for the MIDI system.

```typescript
interface MidiConfig {
  enableSysex?: boolean;  // Enable SysEx message handling (default: true)
  debug?: boolean;        // Enable debug logging (default: false)
}
```

### Port Selection

By default, `start()` auto-selects the first available input and output ports. To use specific ports:

```typescript
await midiSystem.start();

// Manually select specific ports
midiSystem.setInput('My MIDI Controller');
midiSystem.setOutput('Hardware Synth');
```

### Virtual Ports

Create virtual MIDI ports (macOS/Linux):

```typescript
const backend = new EasyMidiBackend();
const virtualInput = backend.createInput('My Virtual Input', true);
const virtualOutput = backend.createOutput('My Virtual Output', true);
```

## Examples

### Example 1: MIDI Monitor

```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);
await midiSystem.start({ debug: true });

// Monitor all MIDI events
midiSystem.addListener('noteon', (msg) => {
  console.log('Note On:', msg);
});

midiSystem.addListener('noteoff', (msg) => {
  console.log('Note Off:', msg);
});

midiSystem.addListener('sysex', (msg) => {
  console.log('SysEx:', msg);
});
```

### Example 2: Custom MIDI Backend

Implement your own backend for testing or alternative MIDI libraries:

```typescript
import { MidiBackend, MidiPortInfo, RawMidiInput, RawMidiOutput } from '@oletizi/sampler-midi';

class MockMidiBackend implements MidiBackend {
  getInputs(): MidiPortInfo[] {
    return [{ name: 'Mock Input 1' }, { name: 'Mock Input 2' }];
  }

  getOutputs(): MidiPortInfo[] {
    return [{ name: 'Mock Output 1' }];
  }

  createInput(name: string): RawMidiInput {
    return {
      on: (event: string, callback: any) => {},
      removeListener: (event: string, callback: any) => {},
      close: () => {}
    };
  }

  createOutput(name: string): RawMidiOutput {
    return {
      send: (type: string, data: any) => {
        console.log(`Sending ${type}:`, data);
      },
      close: () => {}
    };
  }
}

// Use mock backend for testing
const mockBackend = new MockMidiBackend();
const midiSystem = new MidiSystem(mockBackend);
```

### Example 3: Multi-Channel Performance

```typescript
import { MidiSystem, EasyMidiBackend, createMidiInstrument } from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);
await midiSystem.start();

// Create instruments on different channels
const bass = createMidiInstrument(midiSystem, 0);
const piano = createMidiInstrument(midiSystem, 1);
const strings = createMidiInstrument(midiSystem, 2);

// Play chord
bass.noteOn(36, 100);      // C1
piano.noteOn(48, 80);      // C2
piano.noteOn(52, 80);      // E2
piano.noteOn(55, 80);      // G2
strings.noteOn(60, 60);    // C3

// Release after 2 seconds
setTimeout(() => {
  bass.noteOff(36, 0);
  piano.noteOff(48, 0);
  piano.noteOff(52, 0);
  piano.noteOff(55, 0);
  strings.noteOff(60, 0);
}, 2000);
```

### Example 4: Akai S3000XL Program Browser

```typescript
import { newDevice } from '@oletizi/sampler-midi';
import * as easymidi from 'easymidi';

const input = new easymidi.Input('S3000XL MIDI In');
const output = new easymidi.Output('S3000XL MIDI Out');
const device = newDevice(input, output);

await device.init();

// Browse all programs
const programNames: string[] = [];
await device.fetchProgramNames(programNames);

console.log('Available Programs:');
programNames.forEach((name, index) => {
  console.log(`  ${index}: ${name}`);
});

// Get details for first program
const program = await device.getProgram(0);
const header = program.getHeader();

console.log('\nProgram Details:');
console.log(`  Name: ${header.PRNAME}`);
console.log(`  Polyphony: ${header.POLYPH}`);
console.log(`  MIDI Channel: ${header.PMCHAN}`);

// List samples used by this program
const sampleNames: string[] = [];
await device.fetchSampleNames(sampleNames);

console.log('\nAvailable Samples:');
sampleNames.forEach((name, index) => {
  console.log(`  ${index}: ${name}`);
});
```

## Migration Guide

### Migrating from v6.x to v7.x (BREAKING CHANGES)

**v7.0.0** introduces a complete refactoring to interface-first dependency injection architecture. This is a **breaking change**.

#### Removed APIs

The following legacy APIs have been **REMOVED**:

```typescript
// ❌ REMOVED: Legacy Midi class
import { Midi } from '@oletizi/sampler-midi';

// ❌ REMOVED: createMidiSystem factory
import { createMidiSystem } from '@oletizi/sampler-midi';
```

#### Migration Path

**Before (v6.x)**:
```typescript
import { createMidiSystem } from '@oletizi/sampler-midi';

const midi = createMidiSystem(); // Backend created implicitly
await midi.start();
```

**After (v7.x)**:
```typescript
import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';

const backend = new EasyMidiBackend(); // Backend injection required
const midiSystem = new MidiSystem(backend);
await midiSystem.start();
```

#### Why the Change?

The v7.x architecture provides:

1. **Testability**: Inject mock backends for testing without hardware
2. **Flexibility**: Support multiple MIDI backends (easymidi, Web MIDI API, custom)
3. **Explicit Dependencies**: No hidden backend creation
4. **Type Safety**: Full TypeScript interface contracts
5. **Best Practices**: Follows dependency injection patterns

#### Step-by-Step Migration

1. **Update imports**:
   ```typescript
   // Add EasyMidiBackend to imports
   import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';
   ```

2. **Create backend instance**:
   ```typescript
   const backend = new EasyMidiBackend();
   ```

3. **Inject backend into MidiSystem**:
   ```typescript
   const midiSystem = new MidiSystem(backend);
   ```

4. **Replace factory calls**:
   - Replace `createMidiSystem()` with `new MidiSystem(backend)`
   - Replace `newMidiInstrument()` with `createMidiInstrument()`

5. **Update tests**:
   ```typescript
   // Before: Hard to test without hardware
   const midi = createMidiSystem();

   // After: Easy to test with mock backend
   const mockBackend = new MockMidiBackend();
   const midiSystem = new MidiSystem(mockBackend);
   ```

## Troubleshooting

### No MIDI Ports Found

**Problem**: `getInputs()` or `getOutputs()` returns empty arrays.

**Solutions**:
1. Ensure MIDI devices are connected and powered on
2. Check operating system MIDI settings
3. On macOS, verify Audio MIDI Setup recognizes devices
4. On Linux, check ALSA MIDI connections: `aconnect -l`
5. Try running with elevated permissions (some systems require it)

### SysEx Messages Not Received

**Problem**: SysEx listener not firing.

**Solutions**:
1. Enable SysEx in config: `await midiSystem.start({ enableSysex: true })`
2. Check if device sends SysEx (some devices need configuration)
3. Verify device is on correct MIDI channel
4. Enable debug mode: `await midiSystem.start({ debug: true })`

### Port Already in Use

**Problem**: Error when opening MIDI port.

**Solutions**:
1. Close other applications using the MIDI port
2. Call `stop()` on previous MidiSystem instance
3. Check for zombie processes holding the port
4. Restart the MIDI device

### Akai S3000XL Not Responding

**Problem**: Device methods timeout or fail.

**Solutions**:
1. Verify MIDI cables (In/Out correctly connected)
2. Check Akai's MIDI channel setting (default: channel 0)
3. Enable SysEx transmission in Akai's MIDI settings
4. Verify device ID (default: 0x48)
5. Try sending simple status request: `device.send(0x00, [])`

### TypeScript Errors After Migration

**Problem**: Type errors after upgrading to v7.x.

**Solutions**:
1. Import `EasyMidiBackend` explicitly
2. Remove `createMidiSystem` imports (no longer exists)
3. Update to TypeScript 5.7+ for best compatibility
4. Check that `@types/node` is installed
5. Run `pnpm install` to update dependencies

### Virtual Ports Not Working

**Problem**: Virtual ports fail to create.

**Solutions**:
1. Virtual ports only work on macOS and Linux (not Windows)
2. Check if another app already has a virtual port with same name
3. Use unique names for virtual ports
4. Verify permissions for creating virtual MIDI devices

## Testing

This package uses Vitest for testing with comprehensive test coverage.

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Run unit tests only
pnpm test:unit
```

### Writing Tests with Mock Backend

```typescript
import { describe, it, expect } from 'vitest';
import { MidiSystem, MidiBackend, MidiPortInfo, RawMidiInput, RawMidiOutput } from '@oletizi/sampler-midi';

class TestMidiBackend implements MidiBackend {
  getInputs(): MidiPortInfo[] {
    return [{ name: 'Test Input' }];
  }

  getOutputs(): MidiPortInfo[] {
    return [{ name: 'Test Output' }];
  }

  createInput(name: string): RawMidiInput {
    return {
      on: vi.fn(),
      removeListener: vi.fn(),
      close: vi.fn()
    };
  }

  createOutput(name: string): RawMidiOutput {
    return {
      send: vi.fn(),
      close: vi.fn()
    };
  }
}

describe('MidiSystem', () => {
  it('should list available ports', async () => {
    const backend = new TestMidiBackend();
    const system = new MidiSystem(backend);

    await system.start();

    expect(system.getInputs()).toHaveLength(1);
    expect(system.getOutputs()).toHaveLength(1);
  });
});
```

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Code Style**: Follow existing TypeScript patterns and ESLint rules
2. **Tests**: All new features require tests (target: 80%+ coverage)
3. **Documentation**: Update JSDoc comments and README
4. **Dependency Injection**: Use interface-first design patterns
5. **No Mocking Modules**: Use dependency injection instead of `jest.mock()`
6. **File Size**: Keep files under 300-500 lines
7. **Import Pattern**: Use `@/` for internal imports

### Development Workflow

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Type check
pnpm typecheck

# Clean build artifacts
pnpm clean
```

### Reporting Issues

When reporting issues, please include:
- Operating system and version
- Node.js version
- MIDI device make/model
- Minimal code example reproducing the issue
- Error messages and stack traces

## Architecture

This package follows interface-first design with explicit dependency injection:

```
┌─────────────────────────────────────┐
│         MidiSystem                  │
│  (Orchestrates MIDI operations)     │
└──────────────┬──────────────────────┘
               │ depends on
               ↓
┌─────────────────────────────────────┐
│         MidiBackend                 │
│  (Platform abstraction interface)   │
└──────────────┬──────────────────────┘
               │ implemented by
               ↓
┌─────────────────────────────────────┐
│       EasyMidiBackend               │
│  (Node.js easymidi implementation)  │
└─────────────────────────────────────┘
```

**Key Design Principles**:
- **Interface-first**: All dependencies defined as interfaces
- **Explicit injection**: No hidden dependencies or singletons
- **Testability**: Easy to inject mocks for testing
- **Flexibility**: Support multiple backends without code changes

## License

Apache-2.0

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

**Current Version**: 7.0.0

**Major Changes in 7.0.0**:
- Interface-first dependency injection architecture
- Removed legacy `Midi` class
- Removed `createMidiSystem()` factory
- Required explicit backend injection
- Improved testability and flexibility
- Full TypeScript strict mode compliance

## Related Packages

- **@oletizi/sampler-devices**: Akai device abstractions and protocol handlers
- **@oletizi/sampler-lib**: Core utilities and shared types
- **@oletizi/sampler-export**: Disk image extraction and format conversion
- **@oletizi/sampler-backup**: Backup utilities for hardware samplers

## Support

- **Issues**: https://github.com/oletizi/audio-tools/issues
- **Discussions**: https://github.com/oletizi/audio-tools/discussions
- **Documentation**: https://github.com/oletizi/audio-tools/tree/main/sampler-midi

## Acknowledgments

This package is part of the audio-tools monorepo, focused on providing modern tooling for vintage hardware samplers. Special thanks to the easymidi library maintainers for providing cross-platform MIDI support.
