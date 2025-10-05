## Quick Start

### Basic MIDI System Setup

```typescript
import {MidiSystem, EasyMidiBackend} from '@oletizi/sampler-midi';

// Create MIDI system with explicit backend injection
const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);

// Start the system (auto-selects first available ports)
await midiSystem.start({enableSysex: true, debug: true});

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
import {newDevice} from '@oletizi/sampler-midi';
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
