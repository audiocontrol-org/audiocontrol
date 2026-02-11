/**
 * Roland D-110 Hardware Integration Test
 *
 * Tests real hardware communication using the D110Client and easymidi.
 * This test validates the complete fetch/modify/validate cycle for D-110 parameters.
 *
 * ## Requirements
 * - Physical Roland D-110 connected via MIDI
 * - MIDI interface available (default: "Volt 4")
 * - Environment variable MIDI_DEVICE_NAME can override default
 * - D-110 device ID must match (default: 17, which is 0x10 in SysEx)
 *
 * ## Test Flow
 * 1. Connect to D-110 via MIDI
 * 2. Fetch system parameters using RQ1/DT1 protocol
 * 3. Fetch part configurations
 * 4. Fetch tone data for a part
 * 5. Modify parameters and verify persistence
 * 6. Restore original values
 *
 * ## Protocol Notes
 * - D-110 uses RQ1 (0x11) for data requests
 * - D-110 uses DT1 (0x12) for data writes
 * - Model ID is 0x16
 * - Checksum is Roland standard: (128 - (sum & 0x7F)) & 0x7F
 *
 * ## Running
 * ```bash
 * pnpm test:hardware
 * ```
 *
 * Or with custom MIDI device:
 * ```bash
 * MIDI_DEVICE_NAME="My Interface" pnpm test:hardware
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createEasymidiAdapter, findMidiPort } from '@/core/midi/EasymidiAdapter';
import { createD110Client } from '@/core/midi/D110Client';
import {
  buildRQ1Message,
  parseSysExMessage,
  getSystemAddress,
  formatBytes,
} from '@/core/midi/sysex';
import {
  SYSTEM_PARAMS_SIZE,
  REVERB_MODE_NAMES,
  TONE_GROUP_NAMES,
} from '@/core/midi/constants';
import type { D110MidiIO, D110ClientInterface, SystemParams, PartConfig } from '@/core/midi/types';

// =============================================================================
// Configuration
// =============================================================================

/** MIDI device name - can be overridden with MIDI_DEVICE_NAME env var */
const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3 Hybrid MIDI Port';

/** Device ID for D-110 (17-32 in user terms, 0x10-0x1F in SysEx) */
const DEVICE_ID = parseInt(process.env.D110_DEVICE_ID || '17', 10);

/** Timeout for MIDI operations */
const TIMEOUT_MS = 5000;

/** Part to test (0-7) */
const TEST_PART_INDEX = 0;

// =============================================================================
// Test State
// =============================================================================

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let adapter: D110MidiIO | null = null;
let client: D110ClientInterface | null = null;

/** Original values for restoration */
let originalSystemParams: SystemParams | null = null;
let originalPartConfig: PartConfig | null = null;

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

  adapter = createEasymidiAdapter(input, output);

  // Device ID in SysEx is 0x10-0x1F (user sees 17-32)
  const sysexDeviceId = DEVICE_ID - 1; // Convert from user ID to SysEx ID
  client = createD110Client(adapter, { deviceId: sysexDeviceId, timeoutMs: TIMEOUT_MS });

  console.log(`D-110 Device ID: ${DEVICE_ID} (SysEx: 0x${sysexDeviceId.toString(16)})`);
}

/**
 * Teardown MIDI connection
 */
function teardownMidi(): void {
  input?.close();
  output?.close();
  input = null;
  output = null;
  adapter = null;
  client = null;
}

// =============================================================================
// Tests
// =============================================================================

describe('D-110 Hardware Integration', () => {
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

  afterAll(async () => {
    if (!shouldSkip && client && originalSystemParams) {
      // Restore original system params if we modified them
      console.log('Restoring original system parameters...');
      try {
        await client.sendSystemParameter(1, originalSystemParams.reverbMode);
        await client.sendSystemParameter(2, originalSystemParams.reverbTime);
        await client.sendSystemParameter(3, originalSystemParams.reverbLevel);
        console.log('✓ System parameters restored');
      } catch (error) {
        console.error('Failed to restore system parameters:', error);
      }
    }

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

    it('should have client initialized', { skip: shouldSkip }, () => {
      expect(client).toBeDefined();
      expect(adapter).toBeDefined();
      console.log(`  ✓ D-110 client initialized (Device ID: ${DEVICE_ID})`);
    });
  });

  describe('Low-Level SysEx Communication', () => {
    it('should send RQ1 and receive response', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(adapter).toBeDefined();

      const address = getSystemAddress();
      const request = buildRQ1Message(address, SYSTEM_PARAMS_SIZE, DEVICE_ID - 1);

      console.log(`  Sending RQ1 request: ${formatBytes(request)}`);

      const responsePromise = new Promise<number[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          adapter!.removeSysExListener(handler);
          reject(new Error('Timeout waiting for D-110 response'));
        }, TIMEOUT_MS);

        const handler = (msg: number[]) => {
          clearTimeout(timeout);
          adapter!.removeSysExListener(handler);
          resolve(msg);
        };

        adapter!.onSysEx(handler);
      });

      adapter!.send(request);
      const response = await responsePromise;

      console.log(`  Received response: ${formatBytes(response.slice(0, 20))}... (${response.length} bytes)`);

      const parsed = parseSysExMessage(response);
      expect(parsed.isValid).toBe(true);
      expect(parsed.address.aa).toBe(0x10); // System address

      console.log(`  ✓ Received valid DT1 response (${parsed.data.length} bytes)`);
    });
  });

  describe('System Parameters', () => {
    it('should fetch system parameters', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();

      console.log('  Requesting system parameters...');
      const params = await client!.requestSystemParams();

      expect(params).toBeDefined();
      expect(params.reverbMode).toBeGreaterThanOrEqual(0);
      expect(params.reverbMode).toBeLessThanOrEqual(7);
      expect(params.reverbTime).toBeGreaterThanOrEqual(0);
      expect(params.reverbTime).toBeLessThanOrEqual(7);
      expect(params.reverbLevel).toBeGreaterThanOrEqual(0);
      expect(params.reverbLevel).toBeLessThanOrEqual(7);
      expect(params.partialReserve).toHaveLength(9); // 8 parts + rhythm
      expect(params.midiChannels).toHaveLength(9);

      // Store for restoration
      originalSystemParams = params;

      console.log(`  ✓ System Parameters:`);
      console.log(`    Reverb: ${REVERB_MODE_NAMES[params.reverbMode]} (Time: ${params.reverbTime}, Level: ${params.reverbLevel})`);
      console.log(`    Partial Reserve: ${params.partialReserve.slice(0, 8).join(', ')} (Rhythm: ${params.partialReserve[8]})`);
      console.log(`    MIDI Channels: ${params.midiChannels.slice(0, 8).join(', ')} (Rhythm: ${params.midiChannels[8]})`);
    });

    it('should modify reverb parameters', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();
      expect(originalSystemParams).toBeDefined();

      const newReverbTime = (originalSystemParams!.reverbTime + 1) % 8;

      console.log(`  Changing reverb time from ${originalSystemParams!.reverbTime} to ${newReverbTime}...`);

      // Send new reverb time (offset 2 in system params)
      await client!.sendSystemParameter(2, newReverbTime);

      // Wait for D-110 to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Re-fetch and verify
      const params = await client!.requestSystemParams();
      expect(params.reverbTime).toBe(newReverbTime);

      console.log(`  ✓ Reverb time changed to ${params.reverbTime}`);

      // Restore original
      await client!.sendSystemParameter(2, originalSystemParams!.reverbTime);
      console.log(`  ✓ Reverb time restored to ${originalSystemParams!.reverbTime}`);
    });
  });

  describe('Part Configuration', () => {
    it('should fetch part configuration', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();

      console.log(`  Requesting Part ${TEST_PART_INDEX + 1} configuration...`);
      const config = await client!.requestPartConfig(TEST_PART_INDEX);

      expect(config).toBeDefined();
      expect(config.toneGroup).toBeGreaterThanOrEqual(0);
      expect(config.toneGroup).toBeLessThanOrEqual(3);
      expect(config.toneNumber).toBeGreaterThanOrEqual(0);
      expect(config.toneNumber).toBeLessThanOrEqual(63);
      expect(config.keyRangeLower).toBeGreaterThanOrEqual(0);
      expect(config.keyRangeLower).toBeLessThanOrEqual(127);
      expect(config.keyRangeUpper).toBeGreaterThanOrEqual(0);
      expect(config.keyRangeUpper).toBeLessThanOrEqual(127);

      // Store for potential restoration
      originalPartConfig = config;

      console.log(`  ✓ Part ${TEST_PART_INDEX + 1} Configuration:`);
      console.log(`    Tone: ${TONE_GROUP_NAMES[config.toneGroup]} #${config.toneNumber + 1}`);
      console.log(`    Key Range: ${config.keyRangeLower} - ${config.keyRangeUpper}`);
      console.log(`    Level: ${config.outputLevel}, Pan: ${config.pan}`);
      console.log(`    Bender Range: ${config.benderRange}, Assign Mode: ${config.assignMode}`);
    });

    it('should fetch all 8 part configurations', { skip: shouldSkip, timeout: TIMEOUT_MS * 8 + 1000 }, async () => {
      expect(client).toBeDefined();

      console.log('  Fetching all 8 part configurations...');
      const configs: PartConfig[] = [];

      for (let i = 0; i < 8; i++) {
        const config = await client!.requestPartConfig(i);
        configs.push(config);
        console.log(`    Part ${i + 1}: ${TONE_GROUP_NAMES[config.toneGroup]} #${config.toneNumber + 1}, Ch ${config.outputLevel}`);
      }

      expect(configs).toHaveLength(8);
      console.log(`  ✓ All 8 part configurations fetched`);
    });

    it('should modify part output level', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();
      expect(originalPartConfig).toBeDefined();

      const originalLevel = originalPartConfig!.outputLevel;
      const newLevel = (originalLevel + 10) % 101; // Keep in 0-100 range

      console.log(`  Changing Part ${TEST_PART_INDEX + 1} level from ${originalLevel} to ${newLevel}...`);

      // Output level is at offset 8 in part timbre data
      await client!.sendPartParameter(TEST_PART_INDEX, 8, newLevel);

      // Wait for D-110 to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Re-fetch and verify
      const config = await client!.requestPartConfig(TEST_PART_INDEX);
      expect(config.outputLevel).toBe(newLevel);

      console.log(`  ✓ Part level changed to ${config.outputLevel}`);

      // Restore original
      await client!.sendPartParameter(TEST_PART_INDEX, 8, originalLevel);
      console.log(`  ✓ Part level restored to ${originalLevel}`);
    });
  });

  describe('Tone Data', () => {
    it('should fetch temporary tone data', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();

      console.log(`  Requesting tone data for Part ${TEST_PART_INDEX + 1}...`);
      const tone = await client!.requestTone(TEST_PART_INDEX);

      expect(tone).toBeDefined();
      expect(tone.common).toBeDefined();
      expect(tone.common.name).toBeDefined();
      expect(tone.partial1).toBeDefined();
      expect(tone.partial2).toBeDefined();
      expect(tone.partial3).toBeDefined();
      expect(tone.partial4).toBeDefined();

      console.log(`  ✓ Tone: "${tone.common.name}"`);
      console.log(`    Structure: ${tone.common.structure12 + 1}/${tone.common.structure34 + 1}`);
      console.log(`    Partial Mutes: P1=${tone.common.partialMutes.partial1 ? 'OFF' : 'ON'}, ` +
        `P2=${tone.common.partialMutes.partial2 ? 'OFF' : 'ON'}, ` +
        `P3=${tone.common.partialMutes.partial3 ? 'OFF' : 'ON'}, ` +
        `P4=${tone.common.partialMutes.partial4 ? 'OFF' : 'ON'}`);

      // Log partial 1 info
      console.log(`    Partial 1: Pitch=${tone.partial1.pitchCoarse}, Cutoff=${tone.partial1.tvfCutoff}, Level=${tone.partial1.tvaLevel}`);
    });

    it('should validate tone parameter ranges', { skip: shouldSkip, timeout: TIMEOUT_MS + 1000 }, async () => {
      expect(client).toBeDefined();

      const tone = await client!.requestTone(TEST_PART_INDEX);

      // Validate common parameters
      expect(tone.common.structure12).toBeGreaterThanOrEqual(0);
      expect(tone.common.structure12).toBeLessThanOrEqual(12);
      expect(tone.common.structure34).toBeGreaterThanOrEqual(0);
      expect(tone.common.structure34).toBeLessThanOrEqual(12);

      // Validate partial parameters (check partial 1)
      const p1 = tone.partial1;

      expect(p1.pitchCoarse).toBeGreaterThanOrEqual(0);
      expect(p1.pitchCoarse).toBeLessThanOrEqual(96);

      expect(p1.pitchFine).toBeGreaterThanOrEqual(0);
      expect(p1.pitchFine).toBeLessThanOrEqual(100);

      expect(p1.tvfCutoff).toBeGreaterThanOrEqual(0);
      expect(p1.tvfCutoff).toBeLessThanOrEqual(100);

      expect(p1.tvfResonance).toBeGreaterThanOrEqual(0);
      expect(p1.tvfResonance).toBeLessThanOrEqual(30);

      expect(p1.tvaLevel).toBeGreaterThanOrEqual(0);
      expect(p1.tvaLevel).toBeLessThanOrEqual(100);

      console.log(`  ✓ All tone parameter ranges valid`);
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout gracefully', { skip: shouldSkip, timeout: 3000 }, async () => {
      expect(adapter).toBeDefined();

      // Create a client with wrong device ID - D-110 won't respond
      const wrongIdClient = createD110Client(adapter!, {
        deviceId: 0x1f, // Device ID 32 (unlikely to match)
        timeoutMs: 1000,
      });

      console.log('  Testing timeout with wrong device ID...');

      try {
        await wrongIdClient.requestSystemParams();
        // If we get here without timeout, the device might actually have this ID
        console.log('  Note: Device responded (may have matching ID)');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Timeout');
        console.log('  ✓ Timeout handled correctly');
      }
    });

    it('should reject invalid part index', { skip: shouldSkip }, async () => {
      expect(client).toBeDefined();

      console.log('  Testing invalid part index...');

      try {
        await client!.requestPartConfig(99);
        expect.fail('Expected error for invalid part index');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Invalid part index');
        console.log('  ✓ Invalid part index rejected');
      }
    });
  });

  describe('Full Patch Fetch', () => {
    it('should fetch complete patch (system + all parts)', { skip: shouldSkip, timeout: TIMEOUT_MS * 10 }, async () => {
      expect(client).toBeDefined();

      console.log('  Fetching complete patch data...');
      const patch = await client!.requestPatch();

      expect(patch).toBeDefined();
      expect(patch.system).toBeDefined();
      expect(patch.parts).toHaveLength(8);

      console.log(`  ✓ Patch: "${patch.name}"`);
      console.log(`    Reverb: ${REVERB_MODE_NAMES[patch.system.reverbMode]}`);
      console.log(`    Parts:`);

      for (let i = 0; i < 8; i++) {
        const part = patch.parts[i];
        console.log(`      ${i + 1}: ${TONE_GROUP_NAMES[part.toneGroup]} #${part.toneNumber + 1} ` +
          `(Level: ${part.outputLevel}, Keys: ${part.keyRangeLower}-${part.keyRangeUpper})`);
      }
    });
  });
});
