/**
 * Roland S-550 Wave Data Transfer Test
 *
 * Tests wave data upload and download using the S-550 client.
 * Generates a sine wave, uploads it, reads it back, and compares.
 *
 * Uses high tone/segment indices to avoid overwriting existing data.
 *
 * ## Running
 * ```bash
 * MIDI_DEVICE_NAME="828mk3" pnpm --filter @audiocontrol/sampler-devices test:hardware:s550:wave
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import {
    createEasymidiAdapter,
    findMidiPort,
} from '@audiocontrol/sampler-midi';
import {
    createS550Client,
    type S550ClientInterface,
    type S550Tone,
} from '@audiocontrol/sampler-devices/s550';
import {
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    type WavData,
} from '@audiocontrol/sampler-devices/roland-s-series';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3';
const DEVICE_ID = 0;
const TIMEOUT_MS = 10000;

// Use high indices to avoid overwriting existing data
const TEST_TONE_INDEX = 60;
const TEST_SEGMENT = 8;
const TEST_WAVE_BANK = 0;

const SAMPLE_RATE_HZ = 15000;
const SAMPLE_RATE_LABEL = '15kHz' as const;
const SINE_FREQUENCY = 440;
const DURATION_SEC = 0.3;

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S550ClientInterface | null = null;

/** Original tone data for restoration */
let originalTone: S550Tone | null = null;

function generateSineWave(frequency: number, sampleRate: number, durationSec: number): Int16Array {
    const sampleCount = Math.floor(sampleRate * durationSec);
    const samples = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        samples[i] = Math.round(0.8 * 32767 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    }
    return samples;
}

describe('S-550 Wave Data Transfer', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(async () => {
        if (shouldSkip) return;

        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

        if (!inputPort || !outputPort) {
            throw new Error(`MIDI device "${MIDI_DEVICE_NAME}" not found`);
        }

        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        const midiIO = createEasymidiAdapter(input, output);
        client = createS550Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
        await client.connect();

        // Save original tone for restoration
        originalTone = await client.requestToneData(TEST_TONE_INDEX);
        console.log(`  Saved original tone ${TEST_TONE_INDEX}: "${originalTone?.name ?? '(empty)'}"`);
    });

    afterAll(async () => {
        if (!shouldSkip && client && originalTone) {
            console.log(`  Restoring original tone ${TEST_TONE_INDEX}...`);
            await client.sendToneData(TEST_TONE_INDEX, originalTone);
        }
        client?.disconnect();
        input?.close();
        output?.close();
    });

    describe('Local Encoding Round-trip', () => {
        it('should round-trip 16-bit -> 12-bit -> 16-bit with minimal loss', { skip: shouldSkip }, () => {
            const sine = generateSineWave(SINE_FREQUENCY, SAMPLE_RATE_HZ, DURATION_SEC);
            const wavData: WavData = {
                sampleRate: SAMPLE_RATE_HZ,
                channels: 1,
                bitsPerSample: 16,
                samples: sine,
            };

            const encoded = wavToSeries(wavData, SAMPLE_RATE_HZ);
            const decoded = seriesToWav(encoded.data, SAMPLE_RATE_HZ);

            expect(decoded.length).toBe(sine.length);

            // 12-bit quantization loses 4 LSBs -> max error of ~16 per sample
            let maxError = 0;
            let totalError = 0;
            for (let i = 0; i < sine.length; i++) {
                const err = Math.abs(sine[i] - decoded[i]);
                maxError = Math.max(maxError, err);
                totalError += err;
            }

            const avgError = totalError / sine.length;
            console.log(`  Samples: ${sine.length}, avg error: ${avgError.toFixed(1)}, max error: ${maxError}`);

            expect(avgError).toBeLessThan(20);
            expect(maxError).toBeLessThan(32);
        });
    });

    describe('Wave Upload (importTone)', () => {
        let sentData: Uint8Array;
        let sampleCount: number;
        let segmentsNeeded: number;

        it('should upload a sine wave to the device', { skip: shouldSkip, timeout: 30000 }, async () => {
            expect(client).toBeDefined();

            const sine = generateSineWave(SINE_FREQUENCY, SAMPLE_RATE_HZ, DURATION_SEC);
            const wavData: WavData = {
                sampleRate: SAMPLE_RATE_HZ,
                channels: 1,
                bitsPerSample: 16,
                samples: sine,
            };

            const encoded = wavToSeries(wavData, SAMPLE_RATE_HZ);
            sentData = encoded.data;
            sampleCount = encoded.sampleCount;
            segmentsNeeded = calculateSegmentsNeeded(sampleCount);

            console.log(`  Sine: ${SINE_FREQUENCY}Hz, ${sampleCount} samples, ${segmentsNeeded} segment(s)`);
            console.log(`  Target: tone ${TEST_TONE_INDEX}, bank ${TEST_WAVE_BANK}, segment ${TEST_SEGMENT}`);
            console.log(`  Uploading ${sentData.length} bytes...`);

            await client!.importTone(
                {
                    toneIndex: TEST_TONE_INDEX,
                    name: 'SINE440',
                    waveData: sentData,
                    waveBank: TEST_WAVE_BANK,
                    segmentTop: TEST_SEGMENT,
                    segmentLength: segmentsNeeded,
                    sampleRate: SAMPLE_RATE_LABEL,
                    loopMode: 'one-shot',
                    loopPoint: 0,
                    originalKey: 60,
                },
                (bytesSent, totalBytes) => {
                    if (bytesSent === totalBytes || bytesSent % 1024 === 0) {
                        console.log(`    Progress: ${Math.floor(bytesSent / totalBytes * 100)}%`);
                    }
                }
            );

            console.log('  Upload complete');
        });

        it('should verify tone parameters were set', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            // Wait for device to settle after wave upload
            await new Promise(r => setTimeout(r, 2000));

            client!.invalidateToneCache();
            const tone = await client!.requestToneData(TEST_TONE_INDEX);
            expect(tone).not.toBeNull();

            console.log(`  Tone ${TEST_TONE_INDEX}: "${tone!.name}"`);
            console.log(`    sampleRate: ${tone!.sampleRate}`);
            console.log(`    wave.bank: ${tone!.wave.bank}`);
            console.log(`    wave.segmentTop: ${tone!.wave.segmentTop}`);
            console.log(`    wave.segmentLength: ${tone!.wave.segmentLength}`);
            console.log(`    wave.startPoint: ${tone!.wave.startPoint}`);
            console.log(`    wave.endPoint: ${tone!.wave.endPoint}`);
            console.log(`    loopMode: ${tone!.loopMode}`);

            expect(tone!.name.trim()).toBe('SINE440');
            expect(tone!.sampleRate).toBe(SAMPLE_RATE_LABEL);
            expect(tone!.wave.bank).toBe(TEST_WAVE_BANK);
            expect(tone!.wave.segmentTop).toBe(TEST_SEGMENT);
            expect(tone!.wave.segmentLength).toBe(segmentsNeeded);
            expect(tone!.loopMode).toBe('one-shot');
        });

        it('should read back wave data matching what was sent', { skip: shouldSkip, timeout: 60000 }, async () => {
            expect(client).toBeDefined();
            expect(sentData).toBeDefined();

            console.log('  Reading wave data back from device...');

            const readBack = await client!.requestWaveData(
                TEST_TONE_INDEX,
                (received, total) => {
                    if (received === total || received % 2048 === 0) {
                        console.log(`    Progress: ${Math.floor(received / total * 100)}%`);
                    }
                }
            );

            console.log(`  Received ${readBack.data.length} bytes`);

            // Trim to match sent length (device returns full segment)
            const receivedTrimmed = readBack.data.slice(0, sentData.length);

            // Compare byte-for-byte
            let mismatches = 0;
            let firstMismatchIdx = -1;
            for (let i = 0; i < sentData.length; i++) {
                if (sentData[i] !== receivedTrimmed[i]) {
                    mismatches++;
                    if (firstMismatchIdx === -1) firstMismatchIdx = i;
                }
            }

            if (mismatches === 0) {
                console.log('  Wave data matches perfectly!');
            } else {
                console.log(`  Mismatches: ${mismatches} / ${sentData.length} bytes`);
                console.log(`  First mismatch at byte ${firstMismatchIdx}`);

                // Show first few mismatches as decoded samples
                console.log('  First 5 sample comparisons:');
                for (let i = 0; i < Math.min(5, sentData.length / 2); i++) {
                    const sentSample = (sentData[i * 2] << 5) | (sentData[i * 2 + 1] >> 2);
                    const recvSample = (receivedTrimmed[i * 2] << 5) | (receivedTrimmed[i * 2 + 1] >> 2);
                    console.log(`    [${i}]: sent=${sentSample}, recv=${recvSample}`);
                }
            }

            expect(mismatches).toBe(0);
        });
    });
});
