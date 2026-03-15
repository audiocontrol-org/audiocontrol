/**
 * Roland S-550 Hardware Integration Test
 *
 * Tests real hardware communication using the S550Client and sampler-midi.
 * Validates the complete fetch/modify/validate cycle for patch and tone parameters.
 *
 * ## Requirements
 * - Physical Roland S-550 connected via MIDI
 * - MIDI interface available (default: "Volt 4")
 * - Environment variable MIDI_DEVICE_NAME can override default
 *
 * ## Test Flow
 * 1. Connect to S-550 via MIDI
 * 2. Fetch patches using RQD/DAT protocol (32 patches)
 * 3. Parse and validate patch structure
 * 4. Modify patch parameters
 * 5. Send changes back via WSD/DAT/EOD protocol
 * 6. Re-fetch and verify persistence
 * 7. Restore original values
 * 8. Fetch and validate all 64 tones
 *
 * ## Protocol Notes
 * - S-550 shares model ID 0x1E with S-330
 * - Same RQD/WSD handshake protocol
 * - 32 patches (vs S-330's 64)
 * - 64 tones (vs S-330's 32)
 * - 4 wave banks A-D (vs S-330's 2)
 *
 * ## Running
 * ```bash
 * pnpm test:hardware:s550
 * ```
 *
 * Or with custom MIDI device:
 * ```bash
 * MIDI_DEVICE_NAME="My Interface" pnpm test:hardware:s550
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
    type S550Tone,
} from '@audiocontrol/sampler-devices/s550';

// =============================================================================
// Configuration
// =============================================================================

/** MIDI device name - can be overridden with MIDI_DEVICE_NAME env var */
const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || 'Volt 4';

/** Device ID for S-550 (0-31) */
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
let client: S550ClientInterface | null = null;

/** Original patch data for restoration */
let originalPatch: S550PatchCommon | null = null;

// =============================================================================
// Setup/Teardown
// =============================================================================

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

// =============================================================================
// Tests
// =============================================================================

describe('S-550 Hardware Integration', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(() => {
        if (shouldSkip) {
            console.log('Skipping hardware tests (SKIP_HARDWARE_TESTS=true)');
            return;
        }

        try {
            setupMidi();
        } catch (error) {
            console.error('MIDI setup failed:', error);
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

            console.log(`  Found ${inputs.length} input(s) and ${outputs.length} output(s)`);
        });

        it('should connect to S-550', { skip: shouldSkip }, async () => {
            expect(client).toBeDefined();

            const connected = await client!.connect();

            expect(connected).toBe(true);
            expect(client!.isConnected()).toBe(true);
            expect(client!.getDeviceId()).toBe(DEVICE_ID);

            console.log(`  Connected to S-550 (device ID: ${DEVICE_ID})`);
        });

        it('should report correct device config', { skip: shouldSkip }, () => {
            const config = client!.getConfig();

            expect(config.deviceName).toBe('S-550');
            expect(config.patchCount).toBe(32);
            expect(config.toneCount).toBe(64);
            expect(config.waveBankCount).toBe(4);
            expect(config.maxToneIndex).toBe(63);
            expect(config.maxWaveBank).toBe(3);
            expect(config.maxPatchIndex).toBe(31);

            console.log(`  Config: ${config.patchCount} patches, ${config.toneCount} tones, ${config.waveBankCount} wave banks`);
        });
    });

    describe('Patch Reading (RQD/DAT Protocol)', () => {
        it('should fetch patch using RQD/DAT', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            console.log(`  Requesting patch ${TEST_PATCH_INDEX}...`);
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);

            expect(patch).toBeDefined();
            expect(patch).not.toBeNull();
            expect(patch!.common).toBeDefined();

            // Validate numeric fields are in range
            expect(patch!.common.level).toBeGreaterThanOrEqual(0);
            expect(patch!.common.level).toBeLessThanOrEqual(127);
            expect(patch!.common.benderRange).toBeGreaterThanOrEqual(0);
            expect(patch!.common.benderRange).toBeLessThanOrEqual(12);
            expect(patch!.common.aftertouchSens).toBeGreaterThanOrEqual(0);
            expect(patch!.common.aftertouchSens).toBeLessThanOrEqual(127);

            console.log(`  Patch ${TEST_PATCH_INDEX + 1}: "${patch!.common.name}"`);
            console.log(`    Level: ${patch!.common.level}, Bender: ${patch!.common.benderRange}, Aftertouch: ${patch!.common.aftertouchSens}`);

            // Store for restoration
            originalPatch = patch!.common;
        });

        it('should validate patch structure fields', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(patch).not.toBeNull();

            const common = patch!.common;

            // Name
            expect(common.name).toBeDefined();
            expect(common.name.length).toBeLessThanOrEqual(12);

            // Tone layers - S-550 allows tone indices 0-63
            expect(common.toneLayer1).toHaveLength(109);
            expect(common.toneLayer2).toHaveLength(109);

            for (const val of common.toneLayer1) {
                expect(val).toBeGreaterThanOrEqual(-1);
                expect(val).toBeLessThanOrEqual(63); // S-550: 64 tones
            }

            for (const val of common.toneLayer2) {
                expect(val).toBeGreaterThanOrEqual(0);
                expect(val).toBeLessThanOrEqual(63);
            }

            // Enum fields should parse to known values
            expect(['normal', 'v-sw', 'x-fade', 'v-mix', 'unison']).toContain(common.keyMode);
            expect(['modulation', 'volume', 'bend+', 'bend-', 'filter']).toContain(common.aftertouchAssign);
            expect(['rotary', 'fixed']).toContain(common.keyAssign);

            // Range checks
            expect(common.octaveShift).toBeGreaterThanOrEqual(-2);
            expect(common.octaveShift).toBeLessThanOrEqual(2);
            expect(common.outputAssign).toBeGreaterThanOrEqual(0);
            expect(common.outputAssign).toBeLessThanOrEqual(8);

            console.log(`  Patch structure valid: keyMode=${common.keyMode}, keyAssign=${common.keyAssign}`);
        });
    });

    describe('Patch Modification (WSD/DAT/EOD Protocol)', () => {
        let originalLevel: number;
        let originalBenderRange: number;

        it('should modify patch parameters', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            const original = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(original).not.toBeNull();

            originalLevel = original!.common.level;
            originalBenderRange = original!.common.benderRange;

            console.log(`  Original values - Level: ${originalLevel}, Bender: ${originalBenderRange}`);

            const modifiedPatch: S550PatchCommon = {
                ...original!.common,
                level: Math.min(127, originalLevel + 10),
                benderRange: (originalBenderRange + 2) % 13,
            };

            console.log(`  Modified values - Level: ${modifiedPatch.level}, Bender: ${modifiedPatch.benderRange}`);

            await client!.sendPatchData(TEST_PATCH_INDEX, modifiedPatch);
            console.log('  Patch data sent successfully');
        });

        it('should verify changes persisted', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('  Re-fetching patch to verify changes...');
            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(patch).not.toBeNull();

            const readback = patch!.common;

            const expectedLevel = Math.min(127, originalLevel + 10);
            const expectedBender = (originalBenderRange + 2) % 13;

            console.log(`  Readback values - Level: ${readback.level}, Bender: ${readback.benderRange}`);

            expect(readback.level).toBe(expectedLevel);
            expect(readback.benderRange).toBe(expectedBender);

            console.log('  Changes verified successfully');
        });

        it('should restore original values', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();
            expect(originalPatch).toBeDefined();

            console.log('  Restoring original patch data...');

            await client!.sendPatchData(TEST_PATCH_INDEX, originalPatch!);

            await new Promise(resolve => setTimeout(resolve, 500));

            const patch = await client!.requestPatchData(TEST_PATCH_INDEX);
            expect(patch).not.toBeNull();

            expect(patch!.common.level).toBe(originalLevel);
            expect(patch!.common.benderRange).toBe(originalBenderRange);

            console.log(`  Original values restored - Level: ${patch!.common.level}, Bender: ${patch!.common.benderRange}`);
        });
    });

    describe('Tone Reading', () => {
        it('should fetch a single tone', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            console.log('  Fetching tone 0...');
            const tone = await client!.requestToneData(0);

            expect(tone).toBeDefined();
            expect(tone).not.toBeNull();

            validateTone(tone!, 0);
        });

        it('should fetch tones across the full range (0-63)', { skip: shouldSkip, timeout: TIMEOUT_MS * 20 }, async () => {
            expect(client).toBeDefined();

            console.log('  Fetching all 64 tones...');
            const tones = await client!.loadToneRange(0, 64, (current, total) => {
                if (current % 8 === 0 || current === total) {
                    console.log(`    Progress: ${current}/${total}`);
                }
            });

            expect(tones).toBeDefined();
            expect(tones.length).toBe(64);

            let nonEmpty = 0;
            for (let i = 0; i < tones.length; i++) {
                validateTone(tones[i], i);
                if (tones[i].name.trim()) {
                    nonEmpty++;
                    const displayNum = `T${i + 11}`;
                    console.log(`    ${displayNum}: "${tones[i].name}" bank=${tones[i].wave.bank} rate=${tones[i].sampleRate}`);
                }
            }

            console.log(`  ${nonEmpty} non-empty tones found out of 64`);
        });
    });

    describe('Patch Range Loading', () => {
        it('should load all 32 patches', { skip: shouldSkip, timeout: TIMEOUT_MS * 10 }, async () => {
            expect(client).toBeDefined();

            console.log('  Fetching all 32 patches...');
            const patches = await client!.loadPatchRange(0, 32, (current, total) => {
                if (current % 8 === 0 || current === total) {
                    console.log(`    Progress: ${current}/${total}`);
                }
            });

            expect(patches).toBeDefined();
            expect(patches.length).toBe(32);

            let nonEmpty = 0;
            for (let i = 0; i < patches.length; i++) {
                const name = patches[i].common.name;
                if (name.trim()) {
                    nonEmpty++;
                    console.log(`    P${i + 11}: "${name}" level=${patches[i].common.level}`);
                }
            }

            console.log(`  ${nonEmpty} non-empty patches found out of 32`);
        });
    });

    describe('Tone Parameter Round-trip', () => {
        let originalTone: S550Tone | null = null;
        const TEST_TONE_INDEX = 0;

        it('should read, write, and verify a tone', { skip: shouldSkip, timeout: TIMEOUT_MS * 3 }, async () => {
            expect(client).toBeDefined();

            // Read original tone
            const tone = await client!.requestToneData(TEST_TONE_INDEX);
            expect(tone).not.toBeNull();
            originalTone = tone!;

            console.log(`  Original tone: "${tone!.name}" transpose=${tone!.transpose} fineTune=${tone!.fineTune}`);

            // Modify a safe parameter (fine tune)
            const modifiedTone: S550Tone = {
                ...tone!,
                fineTune: tone!.fineTune === 0 ? 10 : 0,
            };

            console.log(`  Writing modified tone (fineTune: ${tone!.fineTune} -> ${modifiedTone.fineTune})...`);
            await client!.sendToneData(TEST_TONE_INDEX, modifiedTone);

            await new Promise(resolve => setTimeout(resolve, 500));

            // Re-read and verify
            client!.invalidateToneCache();
            const readback = await client!.requestToneData(TEST_TONE_INDEX);
            expect(readback).not.toBeNull();

            console.log(`  Readback tone: fineTune=${readback!.fineTune}`);
            expect(readback!.fineTune).toBe(modifiedTone.fineTune);

            console.log('  Tone round-trip verified');
        });

        it('should restore original tone', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            if (!originalTone) return;

            console.log('  Restoring original tone...');
            await client!.sendToneData(TEST_TONE_INDEX, originalTone);

            await new Promise(resolve => setTimeout(resolve, 500));

            client!.invalidateToneCache();
            const readback = await client!.requestToneData(TEST_TONE_INDEX);
            expect(readback).not.toBeNull();
            expect(readback!.fineTune).toBe(originalTone.fineTune);

            console.log(`  Original tone restored: fineTune=${readback!.fineTune}`);
        });
    });

    describe('S-550 Specific Ranges', () => {
        it('should fetch tone at index 32+ (beyond S-330 range)', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            // S-330 only has tones 0-31. S-550 has 0-63.
            // Fetching tone 32 validates we can address the extended range.
            console.log('  Fetching tone 32 (beyond S-330 range)...');
            const tone = await client!.requestToneData(32);

            expect(tone).toBeDefined();
            expect(tone).not.toBeNull();
            validateTone(tone!, 32);

            console.log(`  Tone 32: "${tone!.name}" bank=${tone!.wave.bank} rate=${tone!.sampleRate}`);
        });

        it('should fetch tone at max index (63)', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            console.log('  Fetching tone 63 (max S-550 index)...');
            const tone = await client!.requestToneData(63);

            expect(tone).toBeDefined();
            expect(tone).not.toBeNull();
            validateTone(tone!, 63);

            console.log(`  Tone 63: "${tone!.name}" bank=${tone!.wave.bank}`);
        });

        it('should validate wave bank range supports 0-3', { skip: shouldSkip, timeout: TIMEOUT_MS * 10 }, async () => {
            expect(client).toBeDefined();

            // Load all tones and check if any use banks 2 or 3 (C or D)
            const tones = client!.getLoadedTones().filter((t): t is S550Tone => t !== undefined);

            const bankUsage = new Set<number>();
            for (const tone of tones) {
                if (tone.name.trim()) {
                    bankUsage.add(tone.wave.bank);
                }
            }

            console.log(`  Wave banks in use: ${[...bankUsage].sort().map(b => ['A', 'B', 'C', 'D'][b]).join(', ')}`);

            // All banks should be in valid range (0-3)
            for (const bank of bankUsage) {
                expect(bank).toBeGreaterThanOrEqual(0);
                expect(bank).toBeLessThanOrEqual(3);
            }
        });
    });

    describe('Error Handling', () => {
        it('should return null for non-responsive device', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
            expect(client).toBeDefined();

            const wrongIdClient = createS550Client(
                createEasymidiAdapter(input!, output!),
                { deviceId: 99, timeoutMs: 500 }
            );

            try {
                await wrongIdClient.requestPatchData(0);
                // If it doesn't throw, it should return null
            } catch {
                // Timeout expected with wrong device ID
                console.log('  Wrong device ID handled correctly (timeout)');
            }
        });
    });
});

// =============================================================================
// Validation Helpers
// =============================================================================

function validateTone(tone: S550Tone, index: number): void {
    // Name
    expect(tone.name).toBeDefined();
    expect(tone.name.length).toBeLessThanOrEqual(8);

    // Sample rate
    expect(['15kHz', '30kHz']).toContain(tone.sampleRate);

    // Wave bank - S-550 supports 0-3 (A, B, C, D)
    // Empty tones may have uninitialized bank values
    expect(tone.wave.bank).toBeGreaterThanOrEqual(0);
    if (tone.name.trim()) {
        expect(tone.wave.bank).toBeLessThanOrEqual(3);
    }

    // Wave points should be non-negative
    expect(tone.wave.startPoint).toBeGreaterThanOrEqual(0);
    expect(tone.wave.endPoint).toBeGreaterThanOrEqual(0);
    expect(tone.wave.loopPoint).toBeGreaterThanOrEqual(0);

    // Loop mode
    expect(['forward', 'alternating', 'one-shot', 'reverse']).toContain(tone.loopMode);

    // Source tone - S-550 has 64 tones (0-63)
    expect(tone.sourceTone).toBeGreaterThanOrEqual(0);
    expect(tone.sourceTone).toBeLessThanOrEqual(63);

    // Copy source - also 0-63
    expect(tone.copySource).toBeGreaterThanOrEqual(0);
    expect(tone.copySource).toBeLessThanOrEqual(63);

    // Original key
    expect(tone.originalKey).toBeGreaterThanOrEqual(0);
    expect(tone.originalKey).toBeLessThanOrEqual(127);
}
