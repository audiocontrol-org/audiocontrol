## Examples

### Example 1: MIDI Monitor

```typescript
import {MidiSystem, EasyMidiBackend} from '@audiocontrol/sampler-midi';

const backend = new EasyMidiBackend();
const midiSystem = new MidiSystem(backend);
await midiSystem.start({debug: true});

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
import {MidiBackend, MidiPortInfo, RawMidiInput, RawMidiOutput} from '@audiocontrol/sampler-midi';

class MockMidiBackend implements MidiBackend {
    getInputs(): MidiPortInfo[] {
        return [{name: 'Mock Input 1'}, {name: 'Mock Input 2'}];
    }

    getOutputs(): MidiPortInfo[] {
        return [{name: 'Mock Output 1'}];
    }

    createInput(name: string): RawMidiInput {
        return {
            on: (event: string, callback: any) => {
            },
            removeListener: (event: string, callback: any) => {
            },
            close: () => {
            }
        };
    }

    createOutput(name: string): RawMidiOutput {
        return {
            send: (type: string, data: any) => {
                console.log(`Sending ${type}:`, data);
            },
            close: () => {
            }
        };
    }
}

// Use mock backend for testing
const mockBackend = new MockMidiBackend();
const midiSystem = new MidiSystem(mockBackend);
```

### Example 3: Multi-Channel Performance

```typescript
import {MidiSystem, EasyMidiBackend, createMidiInstrument} from '@audiocontrol/sampler-midi';

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
import {newDevice} from '@audiocontrol/sampler-midi';
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
