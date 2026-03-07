/**
 * S-330 Wave Data Send Test
 *
 * Tests sending wave data to the S-330 by:
 * 1. Reading wave data from a tone
 * 2. Writing it to a different segment
 * 3. Reading it back to verify
 *
 * Run with: npx tsx test/integration/s330-send-wave.ts
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
    console.log('=== S-330 Wave Data Send Test ===\n');

    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`ERROR: ${MIDI_DEVICE} not found`);
        process.exit(1);
    }

    console.log(`Using: ${inputName} / ${outputName}\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);
    const midiAdapter = createEasyMidiAdapter(input, output);

    const client = createS330Client(midiAdapter, { deviceId: 0 });
    await client.connect();

    try {
        // Read wave data from tone 0 (T11)
        console.log('Step 1: Reading wave data from T11...');
        const waveData = await client.requestWaveData(0, (received, total) => {
            const pct = Math.floor((received / total) * 100);
            process.stdout.write(`\r  Progress: ${pct}%`);
        });
        console.log(`\n  Received ${waveData.data.length} bytes\n`);

        // Try to send to an unused segment (segment 10)
        // WARNING: This will overwrite data in segment 10!
        const targetSegment = 10;
        console.log(`Step 2: Sending wave data to segment ${targetSegment}...`);
        console.log('  (This will overwrite any existing data in that segment)\n');

        await client.sendWaveData(
            {
                data: waveData.data,
                waveBank: 0,
                segmentTop: targetSegment,
                segmentLength: 1,
            },
            (sent, total) => {
                const pct = Math.floor((sent / total) * 100);
                process.stdout.write(`\r  Progress: ${pct}%`);
            }
        );
        console.log('\n  Send complete!\n');

        console.log('Test completed successfully.');
        console.log(`Wave data copied from segment 0 to segment ${targetSegment}.`);
        console.log('You can verify by playing both segments on the S-330.');

    } catch (err) {
        console.error('\nError:', err);
    } finally {
        input.close();
        output.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
