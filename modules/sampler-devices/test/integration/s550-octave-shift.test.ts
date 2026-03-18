/**
 * S-550 Octave Shift Hardware Integration Test
 *
 * Sends a patch with a non-zero octave shift to the attached S-550,
 * reads it back, and verifies the value survived the roundtrip.
 *
 * ## Requirements
 * - Physical Roland S-550 connected via MIDI
 * - MIDI interface available (default: "Volt 4")
 * - Environment variable MIDI_DEVICE_NAME can override default
 *
 * ## Running
 * ```bash
 * pnpm --filter sampler-devices vitest run test/integration/s550-octave-shift.test.ts
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
    type S550PatchCommon,
} from '@audiocontrol/sampler-devices/s550';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3 Hybrid';
const DEVICE_ID = 0;
const TIMEOUT_MS = 5000;
const TEST_PATCH_INDEX = 0;
const READBACK_DELAY_MS = 500;

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S550ClientInterface | null = null;
let originalPatch: S550PatchCommon | null = null;

function setupMidi(): void {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
    const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

    if (!inputPort || !outputPort) {
        throw new Error(
            `MIDI device "${MIDI_DEVICE_NAME}" not found.\n` +
            `Available inputs: ${inputs.join(', ')}\n` +
            `Available outputs: ${outputs.join(', ')}\n` +
            `Tip: Set MIDI_DEVICE_NAME environment variable to use a different device.`
        );
    }

    input = new easymidi.Input(inputPort);
    output = new easymidi.Output(outputPort);

    const midiIO = createEasymidiAdapter(input, output);
    client = createS550Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
}

function teardownMidi(): void {
    client?.disconnect();
    input?.close();
    output?.close();
    input = null;
    output = null;
    client = null;
}

describe('S-550 Octave Shift Hardware Roundtrip', () => {
    beforeAll(async () => {
        setupMidi();
        const connected = await client!.connect();
        expect(connected).toBe(true);

        // Save original patch for restoration
        const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
        expect(patch).not.toBeNull();
        originalPatch = patch!.common;
        console.log(`  Original patch "${originalPatch.name}" octaveShift=${originalPatch.octaveShift}`);
    });

    afterAll(async () => {
        // Restore original patch
        if (client && originalPatch) {
            console.log('  Restoring original patch...');
            await client.sendPatchData(TEST_PATCH_INDEX, originalPatch);
            await new Promise(resolve => setTimeout(resolve, READBACK_DELAY_MS));

            client.invalidatePatchCache();
            const readback = await client.requestPatchData(TEST_PATCH_INDEX);
            expect(readback).not.toBeNull();
            expect(readback!.common.octaveShift).toBe(originalPatch.octaveShift);
            console.log(`  Restored octaveShift=${readback!.common.octaveShift}`);
        }

        teardownMidi();
    });

    it.each([-2, -1, 1, 2])(
        'should write octave shift %d to hardware and read it back',
        async (shift) => {
            expect(client).toBeDefined();
            expect(originalPatch).toBeDefined();

            const modifiedPatch: S550PatchCommon = {
                ...originalPatch!,
                octaveShift: shift,
            };

            console.log(`  Writing octaveShift=${shift}...`);
            await client!.sendPatchData(TEST_PATCH_INDEX, modifiedPatch);

            await new Promise(resolve => setTimeout(resolve, READBACK_DELAY_MS));

            client!.invalidatePatchCache();
            const readback = await client!.requestPatchData(TEST_PATCH_INDEX);

            expect(readback).not.toBeNull();
            console.log(`  Readback octaveShift=${readback!.common.octaveShift}`);
            expect(readback!.common.octaveShift).toBe(shift);
        },
        TIMEOUT_MS + 2000
    );
});
