/**
 * S-330 Wave Data Round-Trip Test
 *
 * Tests wave data integrity by:
 * 1. Generating a known sine wave
 * 2. Converting to S-330 format
 * 3. Sending to device
 * 4. Reading back
 * 5. Comparing sent vs received data
 *
 * Run with: npx tsx test/integration/s330-wave-roundtrip.ts
 */

import * as easymidi from 'easymidi';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { S330MidiAdapter } from '@audiocontrol/sampler-devices/s330';
import {
    wavToS330,
    s330ToWav,
    calculateSegmentsNeeded,
    type WavData,
} from '@audiocontrol/sampler-devices/s330';

const MIDI_DEVICE = 'Volt 4';
const TARGET_TONE = 16; // T27
const TARGET_SEGMENT = 10;
const SAMPLE_RATE = 15000;
const SINE_FREQUENCY = 440; // A4
const DURATION_SECONDS = 0.5;

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
 * Generate a sine wave as Int16Array (16-bit PCM)
 */
function generateSineWave(frequency: number, sampleRate: number, durationSec: number): Int16Array {
    const sampleCount = Math.floor(sampleRate * durationSec);
    const samples = new Int16Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
        // Generate sine wave with amplitude 0.8 to avoid clipping
        // Scale to 16-bit range (-32768 to 32767)
        samples[i] = Math.round(0.8 * 32767 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    }

    return samples;
}

/**
 * Compare two arrays and report differences
 */
function compareData(sent: Uint8Array, received: Uint8Array): { matches: boolean; report: string } {
    const lines: string[] = [];

    if (sent.length !== received.length) {
        return {
            matches: false,
            report: `Length mismatch: sent ${sent.length}, received ${received.length}`
        };
    }

    let mismatches = 0;
    let firstMismatchIdx = -1;

    for (let i = 0; i < sent.length; i++) {
        if (sent[i] !== received[i]) {
            mismatches++;
            if (firstMismatchIdx === -1) {
                firstMismatchIdx = i;
            }
        }
    }

    if (mismatches === 0) {
        return { matches: true, report: 'All bytes match!' };
    }

    lines.push(`Mismatches: ${mismatches} / ${sent.length} bytes (${(mismatches / sent.length * 100).toFixed(2)}%)`);
    lines.push(`First mismatch at byte ${firstMismatchIdx}`);

    // Show first few mismatches
    lines.push('\nFirst 10 mismatches (byte index, sent, received):');
    let shown = 0;
    for (let i = 0; i < sent.length && shown < 10; i++) {
        if (sent[i] !== received[i]) {
            lines.push(`  [${i}]: sent 0x${sent[i].toString(16).padStart(2, '0')}, received 0x${received[i].toString(16).padStart(2, '0')}`);
            shown++;
        }
    }

    // Analyze the pattern - using S-330 format (byte0=upper 7 bits, byte1=lower 5 bits << 2)
    lines.push('\nAnalyzing first few samples (S-330 format):');
    for (let i = 0; i < Math.min(10, sent.length / 2); i++) {
        const sentByte0 = sent[i * 2];
        const sentByte1 = sent[i * 2 + 1];
        const recvByte0 = received[i * 2];
        const recvByte1 = received[i * 2 + 1];

        const sent12bit = (sentByte0 << 5) | (sentByte1 >> 2);
        const recv12bit = (recvByte0 << 5) | (recvByte1 >> 2);
        const sentSigned = sent12bit >= 2048 ? sent12bit - 4096 : sent12bit;
        const recvSigned = recv12bit >= 2048 ? recv12bit - 4096 : recv12bit;

        lines.push(`  Sample ${i}: sent ${sentSigned} (0x${sent12bit.toString(16)}), recv ${recvSigned} (0x${recv12bit.toString(16)})`);
    }

    return { matches: false, report: lines.join('\n') };
}

async function main() {
    console.log('=== S-330 Wave Round-Trip Test ===\n');

    console.log('Test parameters:');
    console.log(`  Target tone: T${11 + TARGET_TONE} (index ${TARGET_TONE})`);
    console.log(`  Target segment: ${TARGET_SEGMENT}`);
    console.log(`  Sample rate: ${SAMPLE_RATE} Hz`);
    console.log(`  Sine frequency: ${SINE_FREQUENCY} Hz`);
    console.log(`  Duration: ${DURATION_SECONDS} seconds`);
    console.log();

    // Generate test data
    console.log('Step 1: Generating sine wave...');
    const sineWave = generateSineWave(SINE_FREQUENCY, SAMPLE_RATE, DURATION_SECONDS);
    console.log(`  Generated ${sineWave.length} samples (16-bit PCM)`);
    console.log(`  First 5 samples: ${Array.from(sineWave.slice(0, 5)).join(', ')}`);

    // Convert to S-330 format using library
    console.log('\nStep 2: Converting to S-330 format...');
    const wavData: WavData = {
        sampleRate: SAMPLE_RATE,
        channels: 1,
        bitsPerSample: 16,
        samples: sineWave,
    };
    const s330Result = wavToS330(wavData, SAMPLE_RATE as 15000 | 30000);
    const s330Data = s330Result.data;
    console.log(`  Converted to ${s330Data.length} bytes`);
    console.log(`  First 10 bytes: ${Array.from(s330Data.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

    // Verify our conversion is reversible using library
    console.log('\nStep 3: Verifying local conversion round-trip...');
    const localRoundTrip = s330ToWav(s330Data, SAMPLE_RATE as 15000 | 30000);
    let localError = 0;
    for (let i = 0; i < sineWave.length; i++) {
        localError += Math.abs(sineWave[i] - localRoundTrip[i]);
    }
    console.log(`  Total error: ${localError}`);
    console.log(`  Average error per sample: ${(localError / sineWave.length).toFixed(2)}`);
    // 12-bit samples have ~16 LSB quantization error when converting from 16-bit
    if (localError / sineWave.length > 20) {
        console.log('  WARNING: Local conversion has significant error!');
    } else {
        console.log('  Local conversion OK (expected ~16 LSB quantization error)');
    }

    // Connect to device
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`\nERROR: ${MIDI_DEVICE} not found`);
        process.exit(1);
    }

    console.log(`\nUsing MIDI: ${inputName} / ${outputName}`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);
    const midiAdapter = createEasyMidiAdapter(input, output);
    const client = createS330Client(midiAdapter, { deviceId: 0 });

    await client.connect();

    const segmentsNeeded = calculateSegmentsNeeded(sineWave.length);
    console.log(`  Segments needed: ${segmentsNeeded}`);

    try {
        // Send to device
        console.log('\nStep 4: Sending to S-330...');
        await client.importTone(
            {
                toneIndex: TARGET_TONE,
                name: 'SINE440',
                waveData: s330Data,
                waveBank: 0,
                segmentTop: TARGET_SEGMENT,
                segmentLength: segmentsNeeded,
                sampleRate: '15kHz',
                loopMode: 'one-shot',
                loopPoint: 0,
            },
            (sent, total) => {
                process.stdout.write(`\r  Progress: ${Math.floor(sent / total * 100)}%`);
            }
        );
        console.log('\n  Upload complete');

        // Wait for device to settle
        console.log('\nStep 5: Waiting for device to settle...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Read back from device
        console.log('\nStep 6: Reading back from S-330...');
        const readBack = await client.requestWaveData(
            TARGET_TONE,
            (received, total) => {
                process.stdout.write(`\r  Progress: ${Math.floor(received / total * 100)}%`);
            }
        );
        console.log(`\n  Received ${readBack.data.length} bytes`);
        console.log(`  First 10 bytes: ${Array.from(readBack.data.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

        // Compare
        console.log('\nStep 7: Comparing sent vs received...');

        // Trim received data to match sent length (device may return more)
        const receivedTrimmed = readBack.data.slice(0, s330Data.length);
        const comparison = compareData(s330Data, receivedTrimmed);

        console.log(comparison.report);

        if (comparison.matches) {
            console.log('\n✓ Round-trip test PASSED!');
        } else {
            console.log('\n✗ Round-trip test FAILED!');

            // Additional analysis using library
            console.log('\nAdditional analysis:');
            const sentSamples = s330ToWav(s330Data, SAMPLE_RATE as 15000 | 30000);
            const recvSamples = s330ToWav(receivedTrimmed, SAMPLE_RATE as 15000 | 30000);

            console.log('\nFirst 10 samples as 16-bit values:');
            for (let i = 0; i < 10; i++) {
                console.log(`  [${i}]: sent ${sentSamples[i]}, recv ${recvSamples[i]}`);
            }

            // Check if all received values are positive
            let allPositive = true;
            let allNegative = true;
            for (let i = 0; i < recvSamples.length; i++) {
                if (recvSamples[i] < 0) allPositive = false;
                if (recvSamples[i] > 0) allNegative = false;
            }
            if (allPositive) {
                console.log('\nWARNING: All received samples are positive (>= 0)!');
                console.log('This suggests a sign bit or offset issue.');
            }
            if (allNegative) {
                console.log('\nWARNING: All received samples are negative (<= 0)!');
            }
        }

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
