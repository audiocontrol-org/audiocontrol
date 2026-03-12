/**
 * S-330 WSD Protocol Retry Integration Test
 *
 * Tests the WSD protocol with retry logic to handle device busy conditions.
 *
 * ## Running
 * ```bash
 * pnpm test:integration -- s330-wsd-retry
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, type S330ClientInterface } from '@/devices/s330/s330-client';
import type { S330MidiAdapter } from '@/devices/s330/s330-types';

// =============================================================================
// Configuration
// =============================================================================

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || 'Volt 4';
const DEVICE_ID = 0;
const TIMEOUT_MS = 2000; // Increased timeout for retry testing

// =============================================================================
// MIDI Adapter
// =============================================================================

/**
 * Find a MIDI port by partial name match
 */
function findMidiPort(ports: string[], searchName: string): string | undefined {
  return ports.find((port) => port.toLowerCase().includes(searchName.toLowerCase()));
}

/**
 * Create S330MidiAdapter from easymidi input/output
 */
function createEasymidiAdapter(
  input: easymidi.Input,
  output: easymidi.Output
): S330MidiAdapter {
  const listeners: ((data: number[]) => void)[] = [];

  // Handle sysex messages
  input.on('sysex', (msg) => {
    const data = Array.from(msg.bytes);
    for (const listener of listeners) {
      listener(data);
    }
  });

  return {
    send(data: number[]): void {
      // easymidi expects the byte array directly for sysex
      output.send('sysex', data as any);
    },
    onSysEx(callback: (data: number[]) => void): void {
      listeners.push(callback);
    },
    removeSysExListener(callback: (data: number[]) => void): void {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
  };
}

// =============================================================================
// Test State
// =============================================================================

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330ClientInterface | null = null;

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
        `Available outputs: ${outputs.join(', ')}`
    );
  }

  console.log(`Opening MIDI input: ${inputPort}`);
  console.log(`Opening MIDI output: ${outputPort}`);

  input = new easymidi.Input(inputPort);
  output = new easymidi.Output(outputPort);

  const midiIO = createEasymidiAdapter(input, output);
  client = createS330Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
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

describe('S-330 WSD Protocol with Retry', () => {
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
      throw error;
    }
  });

  afterAll(() => {
    if (!shouldSkip) {
      teardownMidi();
    }
  });

  it('should connect to S-330', { skip: shouldSkip }, async () => {
    expect(client).toBeDefined();
    const connected = await client!.connect();
    expect(connected).toBe(true);
    console.log('✓ Connected to S-330');
  });

  it('should read a tone parameter', { skip: shouldSkip, timeout: 10000 }, async () => {
    expect(client).toBeDefined();

    console.log('Reading tone 0...');
    const tone = await client!.requestToneData(0);

    console.log('Tone 0:', tone ? tone.name : 'null');
    expect(tone).not.toBeNull();

    console.log('✓ Successfully read tone data');
  });

  it('should write a tone name (uses WSD protocol)', { skip: shouldSkip, timeout: 15000 }, async () => {
    expect(client).toBeDefined();

    // Read current tone
    console.log('Reading tone 0...');
    const tone = await client!.requestToneData(0);
    expect(tone).not.toBeNull();
    if (!tone) return;

    const originalName = tone.name;
    console.log(`Original name: "${originalName}"`);

    // Write a test name
    const testName = 'RETRY-TEST';
    console.log(`Writing name: "${testName}"...`);

    const modifiedTone = { ...tone, name: testName };
    await client!.sendToneData(0, modifiedTone);

    console.log('Write complete, verifying...');

    // Read back to verify
    const verifyTone = await client!.requestToneData(0);
    expect(verifyTone).not.toBeNull();
    console.log(`Verified name: "${verifyTone?.name}"`);
    expect(verifyTone?.name.trim()).toBe(testName);

    // Restore original name
    console.log(`Restoring original name: "${originalName}"...`);
    const restoredTone = { ...tone, name: originalName };
    await client!.sendToneData(0, restoredTone);

    console.log('✓ WSD write with retry successful');
  });

  it('should handle rapid sequential writes', { skip: shouldSkip, timeout: 30000 }, async () => {
    expect(client).toBeDefined();

    // Read current tone
    const tone = await client!.requestToneData(0);
    expect(tone).not.toBeNull();
    if (!tone) return;

    const originalName = tone.name;
    console.log(`Original name: "${originalName}"`);

    // Perform multiple rapid writes - this should trigger retry behavior
    // if the device gets overwhelmed
    const names = ['TEST-01', 'TEST-02', 'TEST-03', 'TEST-04', 'TEST-05'];

    for (const name of names) {
      console.log(`Writing: "${name}"...`);
      const modifiedTone = { ...tone, name };
      await client!.sendToneData(0, modifiedTone);
      console.log(`  ✓ Written`);

      // Small delay between writes
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Verify final state
    const finalTone = await client!.requestToneData(0);
    expect(finalTone?.name.trim()).toBe(names[names.length - 1]);

    // Restore
    const restoredTone = { ...tone, name: originalName };
    await client!.sendToneData(0, restoredTone);

    console.log('✓ Rapid sequential writes successful');
  });

  it('should handle patch writes under load', { skip: shouldSkip, timeout: 30000 }, async () => {
    expect(client).toBeDefined();

    // Read current patch
    console.log('Reading patch 0...');
    const patch = await client!.requestPatchData(0);
    expect(patch).not.toBeNull();
    if (!patch) return;

    const originalName = patch.common.name;
    console.log(`Original patch name: "${originalName}"`);

    // Write patch data (uses WSD protocol)
    const testName = 'PATCH-TEST   ';
    console.log(`Writing patch name: "${testName}"...`);

    const modifiedPatch = {
      ...patch.common,
      name: testName
    };
    await client!.sendPatchData(0, modifiedPatch);

    // Verify
    const verifyPatch = await client!.requestPatchData(0);
    console.log(`Verified: "${verifyPatch?.common.name}"`);
    expect(verifyPatch?.common.name.trim()).toBe(testName.trim());

    // Restore
    const restoredPatch = { ...patch.common, name: originalName };
    await client!.sendPatchData(0, restoredPatch);

    console.log('✓ Patch WSD write successful');
  });
});
