/**
 * S-330 Bank A Wave Data Dump
 *
 * Fetches all wave data from Bank A using the s330-client.
 * Saves raw data and WAV for analysis of segment boundaries.
 *
 * Run with: npx tsx test/integration/s330-dump-bank.ts
 */

import * as easymidi from 'easymidi';
import * as fs from 'fs';
import * as path from 'path';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { S330MidiAdapter } from '@audiocontrol/sampler-devices/s330';

const MIDI_DEVICE = 'Volt 4';

// Fetch entire bank - 216,000 samples at 2 bytes each = 432,000 bytes
const TOTAL_BYTES = 432000;

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

function unpack12BitTo16Bit(data: Uint8Array): Int16Array {
    const numSamples = Math.floor(data.length / 2);
    const samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const byte0 = data[i * 2];
        const byte1 = data[i * 2 + 1];
        const sample12bit = (byte0 << 5) | (byte1 >> 2);

        let signedSample: number;
        if (sample12bit & 0x800) {
            signedSample = sample12bit - 0x1000;
        } else {
            signedSample = sample12bit;
        }

        samples[i] = signedSample << 4;
    }

    return samples;
}

function createWavBuffer(samples: Int16Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const buffer = Buffer.alloc(fileSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < samples.length; i++) {
        buffer.writeInt16LE(samples[i], 44 + i * 2);
    }

    return buffer;
}

async function main() {
    console.log('=== S-330 Bank A Wave Dump ===\n');

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

    // We need to request wave data directly using the client's internal method
    // For now, let's request wave data for tone 0 which should be at the start of bank A
    // Then we can analyze where the data actually is

    console.log('Fetching wave data starting from address 0...');
    console.log(`Requesting ${TOTAL_BYTES} bytes\n`);

    const startTime = performance.now();
    let lastProgress = 0;

    try {
        // Use requestWaveData with a dummy tone that has segmentTop=0 and large segmentLength
        // Actually, let's just fetch tone by tone to build up the picture

        // First, get info about all tones to understand the layout
        console.log('Loading tone parameters to understand memory layout...\n');

        const toneInfo: Array<{index: number, name: string, segmentTop: number, segmentLength: number, endPoint: number}> = [];

        for (let i = 0; i < 8; i++) {
            const tone = await client.requestToneData(i);
            if (tone && tone.wave.segmentLength > 0) {
                toneInfo.push({
                    index: i,
                    name: tone.name,
                    segmentTop: tone.wave.segmentTop,
                    segmentLength: tone.wave.segmentLength,
                    endPoint: tone.wave.endPoint,
                });
                console.log(`T1${i+1}: "${tone.name}" - segmentTop=${tone.wave.segmentTop}, segmentLength=${tone.wave.segmentLength}, endPoint=${tone.wave.endPoint}`);
            }
        }

        console.log('\n--- Fetching wave data for each tone ---\n');

        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const info of toneInfo) {
            console.log(`\nFetching T1${info.index + 1} "${info.name}"...`);

            const waveData = await client.requestWaveData(info.index, (received, total) => {
                const pct = Math.floor((received / total) * 100);
                if (pct >= lastProgress + 20) {
                    process.stdout.write(` ${pct}%`);
                    lastProgress = pct;
                }
            });
            lastProgress = 0;

            console.log(` done (${waveData.data.length} bytes)`);

            // Save each tone's wave data
            const safeName = info.name.trim().replace(/[^a-zA-Z0-9]/g, '_') || `tone_${info.index}`;
            fs.writeFileSync(path.join(outputDir, `tone_${info.index}_${safeName}.raw`), waveData.data);

            const samples = unpack12BitTo16Bit(waveData.data);
            const wavBuffer = createWavBuffer(samples, waveData.sampleRate);
            fs.writeFileSync(path.join(outputDir, `tone_${info.index}_${safeName}.wav`), wavBuffer);
        }

        const duration = (performance.now() - startTime) / 1000;
        console.log(`\n\nCompleted in ${duration.toFixed(1)}s`);
        console.log(`Files saved to: ${outputDir}`);

    } finally {
        input.close();
        output.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
