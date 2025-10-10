## API Reference

### MidiSystem

The core MIDI system class with dependency injection.

#### Constructor

```typescript
constructor(backend
:
MidiBackend, out ? : ProcessOutput
)
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
import {EasyMidiBackend} from '@oletizi/sampler-midi';

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
import {newDevice} from '@oletizi/sampler-midi';
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
