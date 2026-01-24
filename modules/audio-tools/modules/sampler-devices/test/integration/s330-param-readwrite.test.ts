/**
 * Roland S-330 Patch Parameter Read/Write Integration Test
 *
 * Validates that individual patch parameters can be correctly read and written
 * using the semantic PATCH_PARAMS API. Tests the complete cycle:
 *   1. Read original parameter value
 *   2. Write a new value
 *   3. Read back to verify persistence
 *   4. Restore original value
 *
 * ## Requirements
 * - Physical Roland S-330 connected via MIDI
 * - MIDI interface available (default: "Volt 4")
 * - Environment variable MIDI_DEVICE_NAME can override default
 *
 * ## Running
 * ```bash
 * pnpm test:integration test/integration/s330-param-readwrite.test.ts
 * ```
 *
 * Or with custom MIDI device:
 * ```bash
 * MIDI_DEVICE_NAME="My Interface" pnpm test:integration test/integration/s330-param-readwrite.test.ts
 * ```
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as easymidi from 'easymidi';
import {
    createS330Client,
    createEasymidiAdapter,
    findMidiPort,
    type S330Client,
} from '@oletizi/sampler-midi';
import { type S330PatchCommon } from '@oletizi/sampler-devices/s330';

// =============================================================================
// Configuration
// =============================================================================

/** MIDI device name - can be overridden with MIDI_DEVICE_NAME env var */
const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || 'Volt 4';

/** Device ID for S-330 (0-31) */
const DEVICE_ID = 0;

/** Timeout for MIDI operations */
const TIMEOUT_MS = 5000;

/** Patch to modify during tests (use patch 1, index 0) */
const TEST_PATCH_INDEX = 0;

/** Delay between write and read-back for hardware to process */
const READBACK_DELAY_MS = 200;

// =============================================================================
// Test State
// =============================================================================

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

/** Original patch data for restoration */
let originalPatch: S330PatchCommon | null = null;

// =============================================================================
// Setup/Teardown
// =============================================================================

/**
 * Setup MIDI connection and client
 */
function setupMidi(): void {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    console.log('Available MIDI inputs:', inputs);
    console.log('Available MIDI outputs:', outputs);

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

    console.log(`Opening MIDI input: ${inputPort}`);
    console.log(`Opening MIDI output: ${outputPort}`);

    input = new easymidi.Input(inputPort);
    output = new easymidi.Output(outputPort);

    const midiIO = createEasymidiAdapter(input, output);
    client = createS330Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
}

/**
 * Teardown MIDI connection
 */
function teardownMidi(): void {
    client?.disconnect();
    input?.close();
    output?.close();
    input = null;
    output = null;
    client = null;
}

/**
 * Helper: Read patch and return specific parameter value
 */
async function readPatchParam<K extends keyof S330PatchCommon>(
    paramName: K
): Promise<S330PatchCommon[K]> {
    const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
    if (!patch) {
        throw new Error('Failed to read patch data');
    }
    return patch.common[paramName];
}

/**
 * Helper: Wait for hardware to process write
 */
async function waitForHardware(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, READBACK_DELAY_MS));
}

// =============================================================================
// Tests
// =============================================================================

describe('S-330 Parameter Read/Write', () => {
    // Skip all tests if SKIP_HARDWARE_TESTS is set
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(async () => {
        if (shouldSkip) {
            console.log('Skipping hardware tests (SKIP_HARDWARE_TESTS=true)');
            return;
        }

        try {
            setupMidi();
            await client!.connect();

            // Read and store original patch for restoration
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            if (patch) {
                originalPatch = { ...patch.common };
                console.log(`Original patch "${originalPatch.name}" loaded for test`);
                console.log(
                    `  Level: ${originalPatch.level}, Bender: ${originalPatch.benderRange}, Output: ${originalPatch.outputAssign}`
                );
            }
        } catch (error) {
            console.error('MIDI setup failed:', error);
            throw error;
        }
    });

    afterAll(async () => {
        if (shouldSkip || !client || !originalPatch) return;

        // Restore original patch values
        console.log('Restoring original patch values...');
        try {
            await client.setPatchLevel(TEST_PATCH_INDEX, originalPatch.level);
            await client.setPatchBenderRange(TEST_PATCH_INDEX, originalPatch.benderRange);
            await client.setPatchAftertouchSens(TEST_PATCH_INDEX, originalPatch.aftertouchSens);
            await client.setPatchOutput(TEST_PATCH_INDEX, originalPatch.outputAssign);
            await client.setPatchOctaveShift(TEST_PATCH_INDEX, originalPatch.octaveShift);
            await client.setPatchDetune(TEST_PATCH_INDEX, originalPatch.detune);
            await client.setPatchVelocityThreshold(TEST_PATCH_INDEX, originalPatch.velocityThreshold);
            await client.setPatchVelocityMixRatio(TEST_PATCH_INDEX, originalPatch.velocityMixRatio);
            await client.setPatchKeyMode(TEST_PATCH_INDEX, originalPatch.keyMode);
            await client.setPatchAftertouchAssign(TEST_PATCH_INDEX, originalPatch.aftertouchAssign);
            await client.setPatchKeyAssign(TEST_PATCH_INDEX, originalPatch.keyAssign);
            console.log('Original values restored');
        } catch (error) {
            console.error('Failed to restore original values:', error);
        }

        teardownMidi();
    });

    describe('Level Parameter', () => {
        let originalLevel: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalLevel = await readPatchParam('level');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            // Restore original value
            await client!.setPatchLevel(TEST_PATCH_INDEX, originalLevel);
            await waitForHardware();
        });

        it(
            'should read and write level parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original level: ${originalLevel}`);

                // Calculate new value (toggle between high and low)
                const newLevel = originalLevel > 64 ? 32 : 96;
                console.log(`  Writing level: ${newLevel}`);

                // Write new value
                await client!.setPatchLevel(TEST_PATCH_INDEX, newLevel);
                await waitForHardware();

                // Read back and verify
                const readbackLevel = await readPatchParam('level');
                console.log(`  Readback level: ${readbackLevel}`);

                expect(readbackLevel).toBe(newLevel);
            }
        );

        it(
            'should handle level edge values (0 and 127)',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 3 },
            async () => {
                // Test minimum
                await client!.setPatchLevel(TEST_PATCH_INDEX, 0);
                await waitForHardware();
                expect(await readPatchParam('level')).toBe(0);
                console.log('  Level 0: OK');

                // Test maximum
                await client!.setPatchLevel(TEST_PATCH_INDEX, 127);
                await waitForHardware();
                expect(await readPatchParam('level')).toBe(127);
                console.log('  Level 127: OK');
            }
        );
    });

    describe('Bender Range Parameter', () => {
        let originalBenderRange: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalBenderRange = await readPatchParam('benderRange');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchBenderRange(TEST_PATCH_INDEX, originalBenderRange);
            await waitForHardware();
        });

        it(
            'should read and write bender range parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original bender range: ${originalBenderRange}`);

                // Calculate new value
                const newRange = (originalBenderRange + 6) % 13; // 0-12 range
                console.log(`  Writing bender range: ${newRange}`);

                await client!.setPatchBenderRange(TEST_PATCH_INDEX, newRange);
                await waitForHardware();

                const readback = await readPatchParam('benderRange');
                console.log(`  Readback bender range: ${readback}`);

                expect(readback).toBe(newRange);
            }
        );
    });

    describe('Output Assign Parameter', () => {
        let originalOutput: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalOutput = await readPatchParam('outputAssign');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchOutput(TEST_PATCH_INDEX, originalOutput);
            await waitForHardware();
        });

        it(
            'should read and write output assign parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original output: ${originalOutput}`);

                // Calculate new value (0-8 range: 0=TONE, 1-8=outputs)
                const newOutput = (originalOutput + 4) % 9;
                console.log(`  Writing output: ${newOutput}`);

                await client!.setPatchOutput(TEST_PATCH_INDEX, newOutput);
                await waitForHardware();

                const readback = await readPatchParam('outputAssign');
                console.log(`  Readback output: ${readback}`);

                expect(readback).toBe(newOutput);
            }
        );
    });

    describe('Octave Shift Parameter', () => {
        let originalOctaveShift: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalOctaveShift = await readPatchParam('octaveShift');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchOctaveShift(TEST_PATCH_INDEX, originalOctaveShift);
            await waitForHardware();
        });

        it(
            'should read and write octave shift parameter (signed)',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original octave shift: ${originalOctaveShift}`);

                // Test different signed value
                const newShift = originalOctaveShift === 0 ? 2 : originalOctaveShift === 2 ? -2 : 0;
                console.log(`  Writing octave shift: ${newShift}`);

                await client!.setPatchOctaveShift(TEST_PATCH_INDEX, newShift);
                await waitForHardware();

                const readback = await readPatchParam('octaveShift');
                console.log(`  Readback octave shift: ${readback}`);

                expect(readback).toBe(newShift);
            }
        );
    });

    describe('Detune Parameter', () => {
        let originalDetune: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalDetune = await readPatchParam('detune');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchDetune(TEST_PATCH_INDEX, originalDetune);
            await waitForHardware();
        });

        it(
            'should read and write detune parameter (signed -64 to +63)',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original detune: ${originalDetune}`);

                // Test different signed value
                const newDetune = originalDetune >= 0 ? -32 : 32;
                console.log(`  Writing detune: ${newDetune}`);

                await client!.setPatchDetune(TEST_PATCH_INDEX, newDetune);
                await waitForHardware();

                const readback = await readPatchParam('detune');
                console.log(`  Readback detune: ${readback}`);

                expect(readback).toBe(newDetune);
            }
        );
    });

    describe('Key Mode Parameter', () => {
        let originalKeyMode: S330PatchCommon['keyMode'];

        beforeEach(async () => {
            if (shouldSkip) return;
            originalKeyMode = await readPatchParam('keyMode');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchKeyMode(TEST_PATCH_INDEX, originalKeyMode);
            await waitForHardware();
        });

        it(
            'should read and write key mode parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original key mode: ${originalKeyMode}`);

                // Toggle to a different mode
                const newMode: S330PatchCommon['keyMode'] =
                    originalKeyMode === 'normal' ? 'unison' : 'normal';
                console.log(`  Writing key mode: ${newMode}`);

                await client!.setPatchKeyMode(TEST_PATCH_INDEX, newMode);
                await waitForHardware();

                const readback = await readPatchParam('keyMode');
                console.log(`  Readback key mode: ${readback}`);

                expect(readback).toBe(newMode);
            }
        );
    });

    describe('Aftertouch Assign Parameter', () => {
        let originalAssign: S330PatchCommon['aftertouchAssign'];

        beforeEach(async () => {
            if (shouldSkip) return;
            originalAssign = await readPatchParam('aftertouchAssign');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchAftertouchAssign(TEST_PATCH_INDEX, originalAssign);
            await waitForHardware();
        });

        it(
            'should read and write aftertouch assign parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original A.T. assign: ${originalAssign}`);

                // Toggle to a different assignment
                const newAssign: S330PatchCommon['aftertouchAssign'] =
                    originalAssign === 'modulation' ? 'filter' : 'modulation';
                console.log(`  Writing A.T. assign: ${newAssign}`);

                await client!.setPatchAftertouchAssign(TEST_PATCH_INDEX, newAssign);
                await waitForHardware();

                const readback = await readPatchParam('aftertouchAssign');
                console.log(`  Readback A.T. assign: ${readback}`);

                expect(readback).toBe(newAssign);
            }
        );
    });

    describe('Key Assign Parameter', () => {
        let originalKeyAssign: S330PatchCommon['keyAssign'];

        beforeEach(async () => {
            if (shouldSkip) return;
            originalKeyAssign = await readPatchParam('keyAssign');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchKeyAssign(TEST_PATCH_INDEX, originalKeyAssign);
            await waitForHardware();
        });

        it(
            'should read and write key assign parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original key assign: ${originalKeyAssign}`);

                // Toggle between rotary and fix
                const newAssign: S330PatchCommon['keyAssign'] =
                    originalKeyAssign === 'rotary' ? 'fix' : 'rotary';
                console.log(`  Writing key assign: ${newAssign}`);

                await client!.setPatchKeyAssign(TEST_PATCH_INDEX, newAssign);
                await waitForHardware();

                const readback = await readPatchParam('keyAssign');
                console.log(`  Readback key assign: ${readback}`);

                expect(readback).toBe(newAssign);
            }
        );
    });

    describe('Velocity Threshold Parameter', () => {
        let originalThreshold: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalThreshold = await readPatchParam('velocityThreshold');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchVelocityThreshold(TEST_PATCH_INDEX, originalThreshold);
            await waitForHardware();
        });

        it(
            'should read and write velocity threshold parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original velocity threshold: ${originalThreshold}`);

                const newThreshold = originalThreshold > 64 ? 32 : 96;
                console.log(`  Writing velocity threshold: ${newThreshold}`);

                await client!.setPatchVelocityThreshold(TEST_PATCH_INDEX, newThreshold);
                await waitForHardware();

                const readback = await readPatchParam('velocityThreshold');
                console.log(`  Readback velocity threshold: ${readback}`);

                expect(readback).toBe(newThreshold);
            }
        );
    });

    describe('Velocity Mix Ratio Parameter', () => {
        let originalRatio: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalRatio = await readPatchParam('velocityMixRatio');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchVelocityMixRatio(TEST_PATCH_INDEX, originalRatio);
            await waitForHardware();
        });

        it(
            'should read and write velocity mix ratio parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original V-Mix ratio: ${originalRatio}`);

                const newRatio = originalRatio > 64 ? 32 : 96;
                console.log(`  Writing V-Mix ratio: ${newRatio}`);

                await client!.setPatchVelocityMixRatio(TEST_PATCH_INDEX, newRatio);
                await waitForHardware();

                const readback = await readPatchParam('velocityMixRatio');
                console.log(`  Readback V-Mix ratio: ${readback}`);

                expect(readback).toBe(newRatio);
            }
        );
    });

    describe('Aftertouch Sensitivity Parameter', () => {
        let originalSens: number;

        beforeEach(async () => {
            if (shouldSkip) return;
            originalSens = await readPatchParam('aftertouchSens');
        });

        afterEach(async () => {
            if (shouldSkip) return;
            await client!.setPatchAftertouchSens(TEST_PATCH_INDEX, originalSens);
            await waitForHardware();
        });

        it(
            'should read and write aftertouch sensitivity parameter',
            { skip: shouldSkip, timeout: TIMEOUT_MS * 2 },
            async () => {
                console.log(`  Original A.T. sensitivity: ${originalSens}`);

                const newSens = originalSens > 64 ? 32 : 96;
                console.log(`  Writing A.T. sensitivity: ${newSens}`);

                await client!.setPatchAftertouchSens(TEST_PATCH_INDEX, newSens);
                await waitForHardware();

                const readback = await readPatchParam('aftertouchSens');
                console.log(`  Readback A.T. sensitivity: ${readback}`);

                expect(readback).toBe(newSens);
            }
        );
    });
});
