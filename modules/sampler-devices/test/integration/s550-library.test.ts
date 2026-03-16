/**
 * Roland S-550 Library Import/Export Integration Test
 *
 * Tests the full library round-trip against a physical S-550:
 * 1. Upload a known test tone with wave data
 * 2. Read it back from device
 * 3. Export to library set format (deviceStateToSet)
 * 4. Convert back to device format (setToDeviceState)
 * 5. Upload to a different slot
 * 6. Read back and compare tone params + wave data
 *
 * ## Running
 * ```bash
 * MIDI_DEVICE_NAME="828mk3" pnpm --filter @audiocontrol/sampler-devices test:hardware:s550:library
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
    type S550Patch,
} from '@audiocontrol/sampler-devices/s550';
import {
    wavToSeries,
    calculateSegmentsNeeded,
    type WavData,
} from '@audiocontrol/sampler-devices/roland-s-series';
import {
    s550DeviceStateToSet,
    s550SetToDeviceState,
    s550ValidateSetAllocations,
    s550ToneConverter,
    s550PatchConverter,
} from '@audiocontrol/sampler-library';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3';
const DEVICE_ID = 0;
const TIMEOUT_MS = 10000;

// Slot/segment assignments for test tones (high indices to avoid conflicts)
const SOURCE_TONE = 50;
const SOURCE_SEGMENT = 6;
const TARGET_TONE = 51;
const TARGET_SEGMENT = 7;

const SAMPLE_RATE_HZ = 15000;
const SAMPLE_RATE_LABEL = '15kHz' as const;

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S550ClientInterface | null = null;

/** Wave data uploaded in setup, used for comparison */
let uploadedWaveData: Uint8Array;
let uploadedSampleCount: number;

function generateSineWave(frequency: number, sampleRate: number, durationSec: number): Int16Array {
    const sampleCount = Math.floor(sampleRate * durationSec);
    const samples = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        samples[i] = Math.round(0.8 * 32767 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    }
    return samples;
}

describe('S-550 Library Import/Export', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(async () => {
        if (shouldSkip) return;

        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);
        if (!inputPort || !outputPort) throw new Error(`MIDI device not found`);

        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        const midiIO = createEasymidiAdapter(input, output);
        client = createS550Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
        await client.connect();

        // Upload a known test tone with wave data to SOURCE_TONE
        const sine = generateSineWave(440, SAMPLE_RATE_HZ, 0.3);
        const encoded = wavToSeries(
            { sampleRate: SAMPLE_RATE_HZ, channels: 1, bitsPerSample: 16, samples: sine } as WavData,
            SAMPLE_RATE_HZ
        );
        uploadedWaveData = encoded.data;
        uploadedSampleCount = encoded.sampleCount;
        const segLen = calculateSegmentsNeeded(uploadedSampleCount);

        console.log(`  Setup: uploading test tone to slot ${SOURCE_TONE}, segment ${SOURCE_SEGMENT}...`);
        await client.importTone({
            toneIndex: SOURCE_TONE,
            name: 'LIBTEST',
            waveData: uploadedWaveData,
            waveBank: 0,
            segmentTop: SOURCE_SEGMENT,
            segmentLength: segLen,
            sampleRate: SAMPLE_RATE_LABEL,
            loopMode: 'forward',
            loopPoint: 100,
            originalKey: 60,
        });
        await new Promise(r => setTimeout(r, 1000));
        console.log('  Setup complete');
    }, 60000);

    afterAll(() => {
        client?.disconnect();
        input?.close();
        output?.close();
    });

    describe('Tone Converter Round-trip', () => {
        it('should convert tone to YAML and back losslessly', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            client!.invalidateToneCache();
            const tone = await client!.requestToneData(SOURCE_TONE);
            expect(tone).not.toBeNull();

            console.log(`  Source tone: "${tone!.name}" bank=${tone!.wave.bank} rate=${tone!.sampleRate}`);

            const yaml = s550ToneConverter.toYaml(tone!, 'test.wav');
            expect(yaml.format).toBe('sampler-tone');
            expect(yaml.device).toBe('s550');

            const roundTripped = s550ToneConverter.fromYaml(yaml);

            expect(roundTripped.name).toBe(tone!.name);
            expect(roundTripped.sampleRate).toBe(tone!.sampleRate);
            expect(roundTripped.loopMode).toBe(tone!.loopMode);
            expect(roundTripped.originalKey).toBe(tone!.originalKey);
            expect(roundTripped.transpose).toBe(tone!.transpose);
            expect(roundTripped.tvf.cutoff).toBe(tone!.tvf.cutoff);
            expect(roundTripped.tva.level).toBe(tone!.tva.level);

            console.log('  Tone converter round-trip: synthesis fields match');
        });
    });

    describe('Patch Converter Round-trip', () => {
        it('should convert patch to YAML and back losslessly', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            const patch = await client!.requestPatchData(0);
            expect(patch).not.toBeNull();

            console.log(`  Source patch: "${patch!.common.name}" level=${patch!.common.level}`);

            const yaml = s550PatchConverter.toYaml(patch!);
            expect(yaml.format).toBe('sampler-patch');
            expect(yaml.device).toBe('s550');

            const roundTripped = s550PatchConverter.fromYaml(yaml);

            expect(roundTripped.common.name).toBe(patch!.common.name);
            expect(roundTripped.common.level).toBe(patch!.common.level);
            expect(roundTripped.common.benderRange).toBe(patch!.common.benderRange);
            expect(roundTripped.common.keyMode).toBe(patch!.common.keyMode);
            expect(roundTripped.common.toneLayer1).toEqual(patch!.common.toneLayer1);
            expect(roundTripped.common.toneLayer2).toEqual(patch!.common.toneLayer2);

            console.log('  Patch converter round-trip: all fields match');
        });
    });

    describe('Set Export (deviceStateToSet)', () => {
        it('should export tone + patch to set format', { skip: shouldSkip, timeout: 60000 }, async () => {
            client!.invalidateToneCache();
            const tone = await client!.requestToneData(SOURCE_TONE);
            expect(tone).not.toBeNull();

            console.log(`  Reading wave data for tone ${SOURCE_TONE}...`);
            const waveResponse = await client!.requestWaveData(SOURCE_TONE);
            expect(waveResponse.data.length).toBeGreaterThan(0);
            console.log(`  Got ${waveResponse.data.length} wave bytes`);

            const patch = await client!.requestPatchData(0);

            const tones: (S550Tone | null)[] = new Array(64).fill(null);
            tones[SOURCE_TONE] = tone!;

            const patches: (S550Patch | null)[] = new Array(32).fill(null);
            patches[0] = patch!;

            const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();
            waveData.set(SOURCE_TONE, { data: waveResponse.data, sampleRate: waveResponse.sampleRate });

            const result = s550DeviceStateToSet('Test Export', 'Hardware validation', { tones, patches, waveData });

            expect(result.manifest.format).toBe('sampler-set');
            expect(result.manifest.device).toBe('s550');
            expect(result.manifest.tones.length).toBe(1);
            expect(result.manifest.patches.length).toBe(1);

            const toneEntry = result.manifest.tones[0];
            expect(toneEntry.slot).toBe(SOURCE_TONE);
            expect(toneEntry.waveAllocation.bank).toBe(0);
            expect(toneEntry.waveAllocation.segmentTop).toBe(SOURCE_SEGMENT);

            const errors = s550ValidateSetAllocations(result.manifest);
            expect(errors).toEqual([]);

            console.log(`  Exported: ${result.manifest.tones.length} tone, ${result.manifest.patches.length} patch`);
            console.log(`  Allocation: bank=${toneEntry.waveAllocation.bank}, seg=${toneEntry.waveAllocation.segmentTop}, len=${toneEntry.waveAllocation.segmentLength}`);
        });
    });

    describe('Full Library Round-trip', () => {
        it('should export, convert, re-import, and verify wave data match', { skip: shouldSkip, timeout: 120000 }, async () => {
            // Step 1: Read source tone + wave
            client!.invalidateToneCache();
            const tone = await client!.requestToneData(SOURCE_TONE);
            expect(tone).not.toBeNull();
            console.log(`  Source: "${tone!.name}" seg=${tone!.wave.segmentTop} len=${tone!.wave.segmentLength}`);

            const waveResponse = await client!.requestWaveData(SOURCE_TONE);
            console.log(`  Wave: ${waveResponse.data.length} bytes`);

            // Step 2: Export to set format
            const tones: (S550Tone | null)[] = new Array(64).fill(null);
            tones[SOURCE_TONE] = tone!;
            const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();
            waveData.set(SOURCE_TONE, { data: waveResponse.data, sampleRate: waveResponse.sampleRate });

            const exported = s550DeviceStateToSet('Roundtrip', undefined, {
                tones, patches: new Array(32).fill(null), waveData,
            });

            // Step 3: Convert back to device format
            const toneYamlMap = new Map<number, { yaml: any; wavData: Uint8Array }>();
            for (const [slot, data] of exported.tones) {
                toneYamlMap.set(slot, { yaml: data.yaml, wavData: data.wavData });
            }

            const imported = s550SetToDeviceState({
                manifest: exported.manifest,
                tones: toneYamlMap,
                patches: new Map(),
            });

            const importedTone = imported.tones.get(SOURCE_TONE);
            expect(importedTone).toBeDefined();

            // Step 4: Re-target to different slot/segment
            const reTargetedTone: S550Tone = {
                ...importedTone!.tone,
                wave: { ...importedTone!.tone.wave, bank: 0, segmentTop: TARGET_SEGMENT },
            };

            // Step 5: Upload to device
            console.log(`  Uploading to tone ${TARGET_TONE}, segment ${TARGET_SEGMENT}...`);
            await client!.importTone({
                toneIndex: TARGET_TONE,
                tone: reTargetedTone,
                waveData: importedTone!.wavData,
                waveBank: 0,
                segmentTop: TARGET_SEGMENT,
                segmentLength: reTargetedTone.wave.segmentLength,
            });

            await new Promise(r => setTimeout(r, 2000));

            // Step 6: Read back and compare tone params
            client!.invalidateToneCache();
            const readBack = await client!.requestToneData(TARGET_TONE);
            expect(readBack).not.toBeNull();
            console.log(`  Readback: "${readBack!.name}" seg=${readBack!.wave.segmentTop}`);

            expect(readBack!.name).toBe(tone!.name);
            expect(readBack!.sampleRate).toBe(tone!.sampleRate);
            expect(readBack!.loopMode).toBe(tone!.loopMode);
            expect(readBack!.wave.segmentTop).toBe(TARGET_SEGMENT);

            // Step 7: Compare wave data
            console.log('  Reading wave data from target slot...');
            const readBackWave = await client!.requestWaveData(TARGET_TONE);

            const srcTrimmed = waveResponse.data.slice(0, importedTone!.wavData.length);
            const dstTrimmed = readBackWave.data.slice(0, importedTone!.wavData.length);

            let mismatches = 0;
            for (let i = 0; i < srcTrimmed.length; i++) {
                if (srcTrimmed[i] !== dstTrimmed[i]) mismatches++;
            }

            console.log(`  Wave: ${mismatches} mismatches / ${srcTrimmed.length} bytes`);
            expect(mismatches).toBe(0);
            console.log('  Library round-trip verified');
        });
    });
});
