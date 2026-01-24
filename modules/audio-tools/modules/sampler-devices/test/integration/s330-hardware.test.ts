/**
 * Roland S-330 Hardware Integration Test
 *
 * Tests real hardware communication using the S330Client and sampler-midi.
 * This test validates the complete fetch/modify/validate cycle for patch parameters.
 *
 * ## Requirements
 * - Physical Roland S-330 connected via MIDI
 * - MIDI interface available (default: "Volt 4")
 * - Environment variable MIDI_DEVICE_NAME can override default
 *
 * ## Test Flow
 * 1. Connect to S-330 via MIDI
 * 2. Fetch patches using RQD/DAT protocol
 * 3. Parse and validate patch structure
 * 4. Modify patch parameters
 * 5. Send changes back via WSD/DAT/EOD protocol
 * 6. Re-fetch and verify persistence
 * 7. Restore original values
 *
 * ## Protocol Notes
 * - S-330 does NOT support RQ1/DT1 commands
 * - Must use RQD/DAT for reads
 * - Must use WSD/DAT/EOD for writes
 * - DT1 commands are silently ignored for function parameters
 * - Patches at address bank 00 00, stride 4 (patch N at 00 00 N*4 00)
 *
 * ## Running
 * ```bash
 * pnpm test:hardware:s330
 * ```
 *
 * Or with custom MIDI device:
 * ```bash
 * MIDI_DEVICE_NAME="My Interface" pnpm test:hardware:s330
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import {
    createS330Client,
    createEasymidiAdapter,
    findMidiPort,
    type S330Client,
} from '@oletizi/sampler-midi';
import {
    type S330PatchCommon,
} from '@oletizi/sampler-devices/s330';

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


// =============================================================================
// Tests
// =============================================================================

describe('S-330 Hardware Integration', () => {
    // Skip all tests if SKIP_HARDWARE_TESTS is set
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(() => {
        if (shouldSkip) {
            console.log('⏭️  Skipping hardware tests (SKIP_HARDWARE_TESTS=true)');
            return;
        }

        try {
            setupMidi();
        } catch (error) {
            console.error('⚠️  MIDI setup failed:', error);
            console.log('⏭️  Skipping hardware tests (no MIDI device available)');
            throw error;
        }
    });

    afterAll(() => {
        if (!shouldSkip) {
            teardownMidi();
        }
    });

    describe('Connection', () => {
        it('should detect MIDI ports', { skip: shouldSkip }, () => {
            const inputs = easymidi.getInputs();
            const outputs = easymidi.getOutputs();

            expect(inputs.length).toBeGreaterThan(0);
            expect(outputs.length).toBeGreaterThan(0);

            console.log(`  ✓ Found ${inputs.length} input(s) and ${outputs.length} output(s)`);
        });

        it('should connect to S-330', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            const connected = await client!.connect();

            expect(connected).toBe(true);
            expect(client!.isConnected()).toBe(true);
            expect(client!.getDeviceId()).toBe(DEVICE_ID);

            console.log(`  ✓ Connected to S-330 (device ID: ${DEVICE_ID})`);
        });
    });

    describe('Patch Reading (RQD/DAT Protocol)', () => {
        it('should fetch patch using RQD/DAT with address/size', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            console.log(`  Requesting patch ${TEST_PATCH_INDEX}...`);
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);

            expect(patch).toBeDefined();
            expect(patch).not.toBeNull();
            expect(patch!.common).toBeDefined();

            console.log(`  ✓ Received patch data`);

            // Validate numeric fields are in range
            expect(patch!.common.level).toBeGreaterThanOrEqual(0);
            expect(patch!.common.level).toBeLessThanOrEqual(127);
            expect(patch!.common.benderRange).toBeGreaterThanOrEqual(0);
            expect(patch!.common.benderRange).toBeLessThanOrEqual(12);
            expect(patch!.common.aftertouchSens).toBeGreaterThanOrEqual(0);
            expect(patch!.common.aftertouchSens).toBeLessThanOrEqual(127);

            console.log(`  ✓ Patch ${TEST_PATCH_INDEX + 1}: "${patch!.common.name}"`);
            console.log(`    Level: ${patch!.common.level}, Bender: ${patch!.common.benderRange}, Aftertouch: ${patch!.common.aftertouchSens}`);

            // Store original patch for later restoration
            originalPatch = patch!.common;
        });

        it('should parse patch structure correctly', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            // Re-fetch patch to verify consistency
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);

            expect(patch).toBeDefined();
            expect(patch).not.toBeNull();
            expect(patch!.common).toBeDefined();
            expect(patch!.common.name).toBeDefined();
            expect(patch!.common.name.length).toBeLessThanOrEqual(12);

            // Validate numeric fields are in range
            expect(patch!.common.level).toBeGreaterThanOrEqual(0);
            expect(patch!.common.level).toBeLessThanOrEqual(127);
            expect(patch!.common.benderRange).toBeGreaterThanOrEqual(0);
            expect(patch!.common.benderRange).toBeLessThanOrEqual(12);
            expect(patch!.common.aftertouchSens).toBeGreaterThanOrEqual(0);
            expect(patch!.common.aftertouchSens).toBeLessThanOrEqual(127);

            console.log(`  ✓ Patch ${TEST_PATCH_INDEX + 1}: "${patch!.common.name}"`);
            console.log(`    Level: ${patch!.common.level}, Bender: ${patch!.common.benderRange}, Aftertouch: ${patch!.common.aftertouchSens}`);
        });
    });

    describe('Patch Modification (WSD/DAT/EOD Protocol)', () => {
        let originalLevel: number;
        let originalBenderRange: number;

        it('should modify patch parameters', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            // Fetch original patch
            const originalPatch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(originalPatch).not.toBeNull();

            originalLevel = originalPatch!.common.level;
            originalBenderRange = originalPatch!.common.benderRange;

            console.log(`  Original values - Level: ${originalLevel}, Bender: ${originalBenderRange}`);

            // Create modified patch (change level and bender range)
            const modifiedPatch: S330PatchCommon = {
                ...originalPatch!.common,
                level: Math.min(127, originalLevel + 10),
                benderRange: (originalBenderRange + 2) % 13, // Wrap around if > 12
            };

            console.log(`  Modified values - Level: ${modifiedPatch.level}, Bender: ${modifiedPatch.benderRange}`);

            // Send modified patch using the high-level API
            console.log(`  Sending modified patch via sendPatchData...`);

            await client!.sendPatchData(TEST_PATCH_INDEX, modifiedPatch);
            console.log('  ✓ Patch data sent successfully');
        });

        it('should verify changes persisted', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
            expect(client).toBeDefined();

            // Wait briefly for S-330 to process changes
            await new Promise(resolve => setTimeout(resolve, 500));

            // Re-fetch patch
            console.log('  Re-fetching patch to verify changes...');
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(patch).not.toBeNull();

            const readbackPatch = patch!.common;

            // Verify changes persisted
            const expectedLevel = Math.min(127, originalLevel + 10);
            const expectedBender = (originalBenderRange + 2) % 13;

            console.log(`  Readback values - Level: ${readbackPatch.level}, Bender: ${readbackPatch.benderRange}`);

            expect(readbackPatch.level).toBe(expectedLevel);
            expect(readbackPatch.benderRange).toBe(expectedBender);

            console.log('  ✓ Changes verified successfully');
        });

        it('should restore original values', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
            expect(client).toBeDefined();
            expect(originalPatch).toBeDefined();

            console.log('  Restoring original patch data...');

            // Send original patch back using the high-level API
            await client!.sendPatchData(TEST_PATCH_INDEX, originalPatch!);

            // Wait and verify restoration
            await new Promise(resolve => setTimeout(resolve, 500));

            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(patch).not.toBeNull();

            const restoredPatch = patch!.common;

            expect(restoredPatch.level).toBe(originalLevel);
            expect(restoredPatch.benderRange).toBe(originalBenderRange);

            console.log(`  ✓ Original values restored - Level: ${restoredPatch.level}, Bender: ${restoredPatch.benderRange}`);
        });
    });

    describe('Tone Name Reading', () => {
        it('should fetch all tone names', { skip: shouldSkip, timeout: TIMEOUT_MS * 10 }, async () => {
            expect(client).toBeDefined();

            console.log('  Fetching all tone names...');
            const toneNames = await client!.requestAllToneNames();

            expect(toneNames).toBeDefined();
            expect(toneNames.length).toBe(32); // S-330 has 32 tones

            console.log(`  Received ${toneNames.length} tones:`);

            for (const tone of toneNames) {
                const displayNum = `T${tone.index + 11}`;
                const status = tone.isEmpty ? '(empty)' : '';
                console.log(`    ${displayNum}: "${tone.name}" ${status}`);
            }

            const nonEmpty = toneNames.filter(t => !t.isEmpty);
            console.log(`  ✓ ${nonEmpty.length} non-empty tones found`);
        });
    });

    describe('Error Handling', () => {
        it('should handle request for invalid address gracefully', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            // Request with invalid address (beyond valid patch range)
            console.log('  Requesting invalid patch number...');

            try {
                await client!.requestPatchData(99); // Invalid: only 0-63 are valid
                console.log('  ✗ Expected error for invalid patch number');
            } catch (error) {
                // Expect validation error
                expect(error).toBeDefined();
                expect((error as Error).message).toMatch(/Invalid patch index/);
                console.log('  ✓ Invalid patch number rejected correctly');
            }
        });

        it('should return null for non-responsive device', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
            expect(client).toBeDefined();

            // Create a client with wrong device ID - S-330 won't respond
            const wrongIdClient = createS330Client(
                createEasymidiAdapter(input!, output!),
                { deviceId: 99, timeoutMs: 500 } // Wrong device ID
            );

            // With wrong device ID, the S-330 ignores requests.
            // The client returns null after timeout (graceful degradation)
            const result = await wrongIdClient.requestPatchData(0);
            expect(result).toBeNull();

            console.log('  ✓ Wrong device ID handled correctly (returned null)');
        });
    });
});
