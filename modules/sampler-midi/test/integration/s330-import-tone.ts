/**
 * S-330 Import Tone Test
 *
 * Tests importing a tone by:
 * 1. Reading wave data from an existing tone
 * 2. Importing it to a different tone slot
 *
 * Run with: npx tsx test/integration/s330-import-tone.ts
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
    const args = process.argv.slice(2);
    const sourceTone = parseInt(args[0] ?? '0', 10);
    const targetTone = parseInt(args[1] ?? '16', 10); // Default to T27 (index 16)
    const targetSegment = parseInt(args[2] ?? '10', 10);

    console.log('=== S-330 Import Tone Test ===\n');
    console.log(`Source: T${11 + sourceTone} (index ${sourceTone})`);
    console.log(`Target: T${11 + targetTone} (index ${targetTone})`);
    console.log(`Target segment: ${targetSegment}\n`);

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
        // Step 1: Read wave data from source tone
        console.log(`Step 1: Reading wave data from T${11 + sourceTone}...`);
        const waveData = await client.requestWaveData(sourceTone, (received, total) => {
            const pct = Math.floor((received / total) * 100);
            process.stdout.write(`\r  Progress: ${pct}%`);
        });
        console.log(`\n  Received ${waveData.data.length} bytes (${waveData.data.length / 2} samples)`);
        console.log(`  Sample rate: ${waveData.sampleRate}Hz`);
        console.log(`  Loop mode: ${waveData.loopMode}\n`);

        // Calculate segments needed
        const samplesPerSegment = 12000;
        const sampleCount = waveData.data.length / 2;
        const segmentsNeeded = Math.ceil(sampleCount / samplesPerSegment);
        console.log(`  Segments needed: ${segmentsNeeded}\n`);

        // Allow device time to recover after large wave read
        console.log('  Waiting for device to be ready...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 2: Import to target tone
        console.log(`Step 2: Importing to T${11 + targetTone}...`);
        await client.importTone(
            {
                toneIndex: targetTone,
                name: 'IMPORTED',
                waveData: waveData.data,
                waveBank: 0,
                segmentTop: targetSegment,
                segmentLength: segmentsNeeded,
                sampleRate: waveData.sampleRate === 30000 ? '30kHz' : '15kHz',
                loopMode: waveData.loopMode,
                loopPoint: waveData.loopPoint,
            },
            (sent, total) => {
                const pct = Math.floor((sent / total) * 100);
                process.stdout.write(`\r  Progress: ${pct}%`);
            }
        );
        console.log('\n');

        console.log('Import completed successfully!');
        console.log(`T${11 + targetTone} now contains a copy of T${11 + sourceTone}'s wave data.`);
        console.log('You can test by playing the target tone on the S-330.');

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
