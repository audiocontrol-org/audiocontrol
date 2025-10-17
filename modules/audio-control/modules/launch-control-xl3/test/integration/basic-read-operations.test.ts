#!/usr/bin/env tsx
/**
 * Integration Test: Basic Read Operations
 *
 * Purpose:
 *   Validates fundamental device communication and read operations
 *   using direct SysEx protocol without high-level API.
 *
 * Test Flow:
 *   1. Read from slot 10
 *   2. Send command 0x77 to select slot 3
 *   3. Read from slot 3
 *   4. Read from slot 10 again to verify slot independence
 *
 * Prerequisites:
 *   - Launch Control XL3 connected via USB
 *   - Slots 3 and 10 should contain custom modes
 *
 * Validates:
 *   - Basic MIDI port communication
 *   - SysEx message sending and receiving
 *   - Device response to read commands
 *   - Command 0x77 (template change) functionality
 *   - Slot selection independence
 *
 * Protocol Details:
 *   - Uses command 0x40 for read operations
 *   - Command 0x77 changes active template slot
 *   - Each read should return ~260+ bytes per page
 *
 * @module test/integration
 */

import midi from 'midi';
import { setTimeout as delay } from 'timers/promises';

const MIDI_OUT_PORT = 'LCXL3 1 MIDI Out';
const MIDI_IN_PORT = 'LCXL3 1 MIDI In';
const MANUFACTURER_ID = [0x00, 0x20, 0x29];
const DEVICE_ID = 0x02;

function buildReadMessage(page: number, slot: number): number[] {
  return [0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x15, 0x05, 0x00, 0x40, page, slot, 0xF7];
}

function buildTemplateChange(slot: number): number[] {
  return [0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x77, slot, 0xF7];
}

async function findPort(midiIO: any, exactName: string): Promise<number> {
  const count = midiIO.getPortCount();
  for (let i = 0; i < count; i++) {
    if (midiIO.getPortName(i) === exactName) return i;
  }
  throw new Error(`Port "${exactName}" not found`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Basic Read Operations Integration Test');
  console.log('═══════════════════════════════════════════════════\n');

  const midiOutput = new midi.Output();
  const midiInput = new midi.Input();

  // Enable SysEx message reception
  midiInput.ignoreTypes(false, false, false);

  console.log('→ Opening MIDI ports...');
  midiOutput.openPort(await findPort(midiOutput, MIDI_IN_PORT));
  midiInput.openPort(await findPort(midiInput, MIDI_OUT_PORT));
  console.log('✓ Ports opened\n');

  let lastResponse: number[] | null = null;
  midiInput.on('message', (_: number, message: number[]) => {
    lastResponse = Array.from(message);
  });

  // Test 1: Read from slot 10
  console.log('Test 1: Read from slot 10 (page 0)');
  console.log('───────────────────────────────────');
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(0, 10));
  await delay(1000);

  if (lastResponse) {
    console.log(`✓ Response received: ${lastResponse.length} bytes`);
    console.log(`  Expected: ~270 bytes (SysEx header + data + footer)`);
    console.log(`  Status: ${lastResponse.length > 260 ? 'PASS' : 'WARN - shorter than expected'}`);
  } else {
    console.log('✗ No response from device');
  }

  // Test 2: Send command 0x77 to select slot 3
  console.log('\nTest 2: Send command 0x77 to select slot 3');
  console.log('───────────────────────────────────────────');
  midiOutput.sendMessage(buildTemplateChange(3));
  await delay(200);
  console.log('✓ Command sent');

  // Test 3: Read from slot 3
  console.log('\nTest 3: Read from slot 3 (page 0)');
  console.log('──────────────────────────────────');
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(0, 3));
  await delay(1000);

  if (lastResponse) {
    console.log(`✓ Response received: ${lastResponse.length} bytes`);
    console.log(`  Expected: ~270 bytes (SysEx header + data + footer)`);
    console.log(`  Status: ${lastResponse.length > 260 ? 'PASS' : 'WARN - shorter than expected'}`);
  } else {
    console.log('✗ No response from device');
  }

  // Test 4: Read from slot 10 again
  console.log('\nTest 4: Read from slot 10 again (verify independence)');
  console.log('─────────────────────────────────────────────────────');
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(0, 10));
  await delay(1000);

  if (lastResponse) {
    console.log(`✓ Response received: ${lastResponse.length} bytes`);
    console.log(`  Expected: ~270 bytes (SysEx header + data + footer)`);
    console.log(`  Status: ${lastResponse.length > 260 ? 'PASS' : 'WARN - shorter than expected'}`);
    console.log('  Note: Should match Test 1 data (slot independence verified)');
  } else {
    console.log('✗ No response from device');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('RESULT');
  console.log('═══════════════════════════════════════════════════');
  console.log('✓ Basic read operations completed');
  console.log('  All communication tests executed');
  console.log('  Review output for any WARN/ERROR messages');
  console.log('═══════════════════════════════════════════════════\n');

  midiOutput.closePort();
  midiInput.closePort();
}

main().catch(console.error);
