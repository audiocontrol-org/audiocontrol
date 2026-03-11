/**
 * S-330 Transpose Value Reader
 *
 * Reads T11 and T12 to check their transpose values.
 * Run with: npx tsx test/integration/s330-read-transpose.ts
 */

import * as easymidi from 'easymidi';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { S330MidiAdapter } from '@audiocontrol/sampler-devices/s330';

const MIDI_DEVICE = 'Volt 4';

function createEasyMidiAdapter(
    input: easymidi.Input,
    output: easymidi.Output
): S330MidiAdapter {
    type SysExCallback = (message: number[]) => void;
    const listeners = new Map<SysExCallback, (data: { bytes: number[] }) => void>();

    return {
        send(message: number[]): void {
            output.send('sysex', message as Parameters<typeof output.send>[1]);
        },
        onSysEx(callback: SysExCallback): void {
            const listener = (data: { bytes: number[] }) => {
                if (data.bytes[0] === 0xf0) {
                    callback(data.bytes);
                }
            };
            listeners.set(callback, listener);
            input.on('sysex', listener);
        },
        removeSysExListener(callback: SysExCallback): void {
            const listener = listeners.get(callback);
            if (listener) {
                input.removeListener('sysex', listener);
                listeners.delete(callback);
            }
        },
    };
}

async function main() {
    console.log('=== S-330 Transpose Value Reader ===\n');

    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`ERROR: ${MIDI_DEVICE} not found`);
        console.log('Available inputs:', inputs);
        console.log('Available outputs:', outputs);
        process.exit(1);
    }

    console.log(`Using: ${inputName} / ${outputName}\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);
    const midiAdapter = createEasyMidiAdapter(input, output);

    const client = createS330Client(midiAdapter, { deviceId: 0 });
    await client.connect();

    try {
        // Read T11 (index 0) - user set to -24
        console.log('Reading T11 (expected: -24 semitones)...');
        const tone11 = await client.requestToneData(0);
        if (tone11) {
            console.log(`  T11 "${tone11.name}":`);
            console.log(`    transpose (decoded value): ${tone11.transpose}`);
        } else {
            console.log('  T11: No data received');
        }

        // Read T12 (index 1) - user set to +24
        console.log('\nReading T12 (expected: +24 semitones)...');
        const tone12 = await client.requestToneData(1);
        if (tone12) {
            console.log(`  T12 "${tone12.name}":`);
            console.log(`    transpose (decoded value): ${tone12.transpose}`);
        } else {
            console.log('  T12: No data received');
        }

        console.log('\n=== Summary ===');
        console.log('If T11 shows 0 and T12 shows 48, encoding should be: raw - 24');
        console.log('If T11 shows -24 and T12 shows 24, no conversion needed');
        console.log('If T11 shows 40 and T12 shows 88, encoding should be: raw - 64');

    } finally {
        input.close();
        output.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
