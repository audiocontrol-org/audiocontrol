/**
 * S-330 Wave Data Dump Test
 *
 * Reads wave data from an existing tone and dumps diagnostic info.
 * Use this to analyze corrupted exports.
 *
 * Run with: npx tsx test/integration/s330-wave-dump.ts [toneIndex]
 */

import * as easymidi from 'easymidi';
import * as fs from 'fs';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { S330MidiAdapter } from '@audiocontrol/sampler-devices/s330';
import { s330ToWav, createWav } from '@audiocontrol/sampler-devices/s330';

const MIDI_DEVICE = 'Volt 4';
const TARGET_TONE = parseInt(process.argv[2] ?? '0', 10);

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

/**
 * Analyze wave data for patterns that indicate corruption
 */
function analyzeWaveData(data: Uint8Array, samples: Int16Array): void {
    console.log('\n=== WAVE DATA ANALYSIS ===\n');

    // 1. Raw bytes analysis
    console.log('RAW BYTES (first 100):');
    for (let i = 0; i < Math.min(100, data.length); i += 10) {
        const bytes = Array.from(data.slice(i, i + 10))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
        console.log(`  [${i.toString().padStart(5)}]: ${bytes}`);
    }

    // 2. Check for MIDI-unsafe bytes (>= 0x80) in the raw data
    let unsafeBytes = 0;
    let firstUnsafe = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] >= 0x80) {
            unsafeBytes++;
            if (firstUnsafe === -1) firstUnsafe = i;
        }
    }
    console.log(`\nMIDI-UNSAFE BYTES (>=0x80): ${unsafeBytes}`);
    if (firstUnsafe >= 0) {
        console.log(`  First unsafe byte at index ${firstUnsafe}: 0x${data[firstUnsafe].toString(16)}`);
    }

    // 3. Sample value distribution
    console.log('\nSAMPLE STATISTICS:');
    let min = Infinity, max = -Infinity, sum = 0;
    let zeroCount = 0, positiveCount = 0, negativeCount = 0;

    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        sum += s;
        if (s < min) min = s;
        if (s > max) max = s;
        if (s === 0) zeroCount++;
        else if (s > 0) positiveCount++;
        else negativeCount++;
    }

    console.log(`  Total samples: ${samples.length}`);
    console.log(`  Min: ${min}, Max: ${max}`);
    console.log(`  Mean: ${(sum / samples.length).toFixed(2)}`);
    console.log(`  Zero: ${zeroCount}, Positive: ${positiveCount}, Negative: ${negativeCount}`);

    // 4. Find where the "noise" stops
    console.log('\nLOOKING FOR TRANSITION FROM NOISE TO CLEAN AUDIO:');

    // Calculate RMS in windows
    const windowSize = 1000;
    const rmsValues: number[] = [];

    for (let i = 0; i < samples.length - windowSize; i += windowSize) {
        let sumSquares = 0;
        for (let j = 0; j < windowSize; j++) {
            sumSquares += samples[i + j] * samples[i + j];
        }
        rmsValues.push(Math.sqrt(sumSquares / windowSize));
    }

    // Find significant drops in RMS (indicating silence/transition)
    console.log('  RMS per window:');
    for (let i = 0; i < Math.min(20, rmsValues.length); i++) {
        const sampleStart = i * windowSize;
        console.log(`    Window ${i} [samples ${sampleStart}-${sampleStart + windowSize}]: RMS = ${rmsValues[i].toFixed(2)}`);
    }

    // 5. Check first vs last samples
    console.log('\nFIRST 20 SAMPLES:');
    for (let i = 0; i < Math.min(20, samples.length); i++) {
        const byte0 = data[i * 2];
        const byte1 = data[i * 2 + 1];
        console.log(`  [${i}]: raw=(0x${byte0.toString(16).padStart(2, '0')}, 0x${byte1.toString(16).padStart(2, '0')}) => ${samples[i]}`);
    }

    console.log('\nLAST 20 SAMPLES:');
    const start = Math.max(0, samples.length - 20);
    for (let i = start; i < samples.length; i++) {
        const byte0 = data[i * 2];
        const byte1 = data[i * 2 + 1];
        console.log(`  [${i}]: raw=(0x${byte0.toString(16).padStart(2, '0')}, 0x${byte1.toString(16).padStart(2, '0')}) => ${samples[i]}`);
    }

    // 6. Check for runs of zeros (which would indicate actual silence)
    let longestZeroRun = 0;
    let currentZeroRun = 0;
    let longestZeroStart = -1;
    let currentZeroStart = -1;

    for (let i = 0; i < samples.length; i++) {
        if (Math.abs(samples[i]) < 100) {  // Near-zero
            if (currentZeroRun === 0) currentZeroStart = i;
            currentZeroRun++;
            if (currentZeroRun > longestZeroRun) {
                longestZeroRun = currentZeroRun;
                longestZeroStart = currentZeroStart;
            }
        } else {
            currentZeroRun = 0;
        }
    }

    console.log(`\nLONGEST NEAR-SILENCE RUN: ${longestZeroRun} samples starting at ${longestZeroStart}`);
}

async function main() {
    console.log('=== S-330 Wave Data Dump ===\n');
    console.log(`Target tone index: ${TARGET_TONE}`);

    // Connect to device
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`\nERROR: ${MIDI_DEVICE} not found`);
        console.log('Available inputs:', inputs);
        console.log('Available outputs:', outputs);
        process.exit(1);
    }

    console.log(`Using MIDI: ${inputName} / ${outputName}\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);
    const midiAdapter = createEasyMidiAdapter(input, output);
    const client = createS330Client(midiAdapter, { deviceId: 0 });

    await client.connect();

    try {
        // First get tone parameters
        console.log('Fetching tone parameters...');
        const tone = await client.requestToneData(TARGET_TONE);

        if (!tone) {
            console.log('No tone data at this slot');
            return;
        }

        console.log('\nTONE PARAMETERS:');
        console.log(`  Name: "${tone.name}"`);
        console.log(`  Sample Rate: ${tone.sampleRate}`);
        console.log(`  Loop Mode: ${tone.loopMode}`);
        console.log(`  Wave Bank: ${tone.wave.bank}`);
        console.log(`  Segment Top: ${tone.wave.segmentTop}`);
        console.log(`  Segment Length: ${tone.wave.segmentLength}`);
        console.log(`  Start Point: ${tone.wave.startPoint}`);
        console.log(`  End Point: ${tone.wave.endPoint}`);
        console.log(`  Loop Point: ${tone.wave.loopPoint}`);

        // Now get wave data
        console.log('\nFetching wave data...');
        const waveResponse = await client.requestWaveData(
            TARGET_TONE,
            (received, total) => {
                process.stdout.write(`\r  Progress: ${Math.floor(received / total * 100)}%`);
            }
        );
        console.log('\n');

        console.log('WAVE DATA RESPONSE:');
        console.log(`  Data length: ${waveResponse.data.length} bytes`);
        console.log(`  Sample count (calculated): ${waveResponse.data.length / 2}`);
        console.log(`  Sample rate: ${waveResponse.sampleRate}`);
        console.log(`  Loop mode: ${waveResponse.loopMode}`);
        console.log(`  Start point: ${waveResponse.startPoint}`);
        console.log(`  End point: ${waveResponse.endPoint}`);
        console.log(`  Loop point: ${waveResponse.loopPoint}`);

        // Convert to 16-bit samples
        const samples = s330ToWav(waveResponse.data, waveResponse.sampleRate as 15000 | 30000);

        // Analyze
        analyzeWaveData(waveResponse.data, samples);

        // Save raw data for offline analysis
        const rawFilename = `tone_${TARGET_TONE}_raw.bin`;
        fs.writeFileSync(rawFilename, waveResponse.data);
        console.log(`\nSaved raw data to ${rawFilename}`);

        // Save as WAV
        const wavFilename = `tone_${TARGET_TONE}_dump.wav`;
        const wavBuffer = createWav(samples, waveResponse.sampleRate);
        fs.writeFileSync(wavFilename, Buffer.from(wavBuffer));
        console.log(`Saved WAV to ${wavFilename}`);

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
