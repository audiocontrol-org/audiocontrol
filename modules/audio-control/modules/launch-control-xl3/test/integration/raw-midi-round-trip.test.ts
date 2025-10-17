#!/usr/bin/env tsx
/**
 * Integration Test: Raw MIDI Round-Trip Validation
 *
 * Purpose:
 *   Validates byte-level data integrity through a complete write/read cycle
 *   using direct SysEx protocol without library API abstractions.
 *
 * Test Flow:
 *   1. Read raw bytes from slot 10 (known good, uncorrupted)
 *   2. Write those exact bytes to slot 3 using Novation protocol
 *   3. Read back from slot 3
 *   4. Compare byte-by-byte and report differences
 *
 * Prerequisites:
 *   - Launch Control XL3 connected via USB
 *   - Slot 10 must contain valid custom mode data
 *
 * Validates:
 *   - Novation SysEx protocol write sequence
 *   - Device firmware data storage integrity
 *   - No corruption during write/read operations
 *   - Correct implementation of DAW port slot selection
 *
 * Protocol Details:
 *   - Page 0 and Page 3 must both be written
 *   - Uses command 0x77 (template change) for slot selection
 *   - Follows Novation's documented write sequence
 *
 * Related Issues: #36
 *
 * @module test/integration
 */

import midi from 'midi';
import { setTimeout as delay } from 'timers/promises';
import { writeFileSync } from 'fs';

const MIDI_OUT_PORT = 'LCXL3 1 MIDI Out';
const MIDI_IN_PORT = 'LCXL3 1 MIDI In';
const MANUFACTURER_ID = [0x00, 0x20, 0x29];
const DEVICE_ID = 0x02;

function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function buildReadMessage(page: number, slot: number): number[] {
  return [
    0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x15, 0x05, 0x00, 0x40, page, slot, 0xF7
  ];
}

function buildWriteMessage(page: number, slot: number, ...data: number[]): number[] {
  return [
    0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x15, 0x05, 0x00, 0x45, page, slot, ...data, 0xF7
  ];
}

function buildTemplateChange(slot: number): number[] {
  return [0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x77, slot, 0xF7];
}

async function findPort(midiIO: any, exactName: string): Promise<number> {
  const count = midiIO.getPortCount();
  for (let i = 0; i < count; i++) {
    if (midiIO.getPortName(i) === exactName) {
      return i;
    }
  }
  throw new Error(`Port "${exactName}" not found`);
}

function compareBytes(original: number[], readBack: number[]): { match: boolean; differences: string[] } {
  const differences: string[] = [];

  if (original.length !== readBack.length) {
    differences.push(`Length mismatch: original=${original.length}, read=${readBack.length}`);
  }

  const minLength = Math.min(original.length, readBack.length);
  for (let i = 0; i < minLength; i++) {
    if (original[i] !== readBack[i]) {
      differences.push(`Byte ${i}: expected 0x${original[i].toString(16).padStart(2, '0')}, got 0x${readBack[i].toString(16).padStart(2, '0')}`);
    }
  }

  return {
    match: differences.length === 0,
    differences
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Raw MIDI Round-Trip Validation Integration Test');
  console.log('═══════════════════════════════════════════════════\n');

  const midiOutput = new midi.Output();
  const midiInput = new midi.Input();

  // CRITICAL: Enable SysEx
  midiInput.ignoreTypes(false, false, false);

  const midiOutPort = await findPort(midiOutput, MIDI_IN_PORT);
  const midiInPort = await findPort(midiInput, MIDI_OUT_PORT);

  midiOutput.openPort(midiOutPort);
  midiInput.openPort(midiInPort);

  console.log('✓ Ports opened\n');

  let lastResponse: number[] | null = null;
  midiInput.on('message', (_deltaTime: number, message: number[]) => {
    lastResponse = Array.from(message);
  });

  const sourceSlot = 10;
  const targetSlot = 3;

  // Step 1: Read from source slot (10)
  console.log(`Step 1: Reading from slot ${sourceSlot} (known good)...`);

  const sourcePage0: number[] = [];
  const sourcePage3: number[] = [];

  // Read page 0 from slot 10
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(0, sourceSlot));
  await delay(1000);

  if (!lastResponse) {
    console.log('✗ No response from device for page 0');
    process.exit(1);
  }

  sourcePage0.push(...lastResponse.slice(10, -1));
  console.log(`  Page 0: ${sourcePage0.length} bytes`);

  // Read page 3 from slot 10
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(3, sourceSlot));
  await delay(1000);

  if (!lastResponse) {
    console.log('✗ No response from device for page 3');
    process.exit(1);
  }

  sourcePage3.push(...lastResponse.slice(10, -1));
  console.log(`  Page 3: ${sourcePage3.length} bytes`);
  console.log(`\n✓ Read complete: ${sourcePage0.length} + ${sourcePage3.length} bytes total\n`);

  // Step 2: Write to target slot (3) using Novation protocol
  console.log(`Step 2: Writing to slot ${targetSlot} using Novation protocol...`);

  // 2a. Write page 0
  console.log('  → Write page 0');
  lastResponse = null;
  midiOutput.sendMessage(buildWriteMessage(0, targetSlot, ...sourcePage0));
  await delay(500);

  if (!lastResponse) {
    console.log('  ✗ No response for page 0 write');
  } else {
    console.log(`  ✓ Response: ${toHex(lastResponse)}`);
  }

  // 2b. Send command 0x77
  console.log('  → Send command 0x77');
  midiOutput.sendMessage(buildTemplateChange(targetSlot));
  await delay(100);

  // 2c. Write page 0 again (Novation protocol)
  console.log('  → Write page 0 again');
  lastResponse = null;
  midiOutput.sendMessage(buildWriteMessage(0, targetSlot, ...sourcePage0));
  await delay(500);

  if (!lastResponse) {
    console.log('  ✗ No response for page 0 second write');
  } else {
    console.log(`  ✓ Response: ${toHex(lastResponse)}`);
  }

  // 2d. Write page 3
  console.log('  → Write page 3');
  lastResponse = null;
  midiOutput.sendMessage(buildWriteMessage(3, targetSlot, ...sourcePage3));
  await delay(500);

  if (!lastResponse) {
    console.log('  ✗ No response for page 3 write');
  } else {
    console.log(`  ✓ Response: ${toHex(lastResponse)}`);
  }

  console.log('\n✓ Write sequence complete\n');

  // Wait for device to finish processing writes
  console.log('Waiting for device to settle...');
  await delay(1000);

  // Step 3: Read back from target slot (3)
  console.log(`Step 3: Reading back from slot ${targetSlot}...`);

  // IMPORTANT: Select the target slot before reading
  console.log('  → Select target slot with command 0x77');
  midiOutput.sendMessage(buildTemplateChange(targetSlot));
  await delay(200);

  const readPage0: number[] = [];
  const readPage3: number[] = [];

  // Read page 0 from slot 3
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(0, targetSlot));
  await delay(1000);

  if (!lastResponse) {
    console.log('✗ No response from device for page 0 read-back');
    process.exit(1);
  }

  readPage0.push(...lastResponse.slice(10, -1));
  console.log(`  Page 0: ${readPage0.length} bytes`);

  // Read page 3 from slot 3
  lastResponse = null;
  midiOutput.sendMessage(buildReadMessage(3, targetSlot));
  await delay(1000);

  if (!lastResponse) {
    console.log('✗ No response from device for page 3 read-back');
    process.exit(1);
  }

  readPage3.push(...lastResponse.slice(10, -1));
  console.log(`  Page 3: ${readPage3.length} bytes`);
  console.log(`\n✓ Read-back complete: ${readPage0.length} + ${readPage3.length} bytes total\n`);

  // Step 4: Compare byte-by-byte
  console.log('Step 4: Comparing data...\n');

  const page0Comparison = compareBytes(sourcePage0, readPage0);
  const page3Comparison = compareBytes(sourcePage3, readPage3);

  console.log('Page 0 Comparison:');
  console.log('─────────────────');
  if (page0Comparison.match) {
    console.log('✓ MATCH - All bytes identical');
  } else {
    console.log(`✗ MISMATCH - ${page0Comparison.differences.length} differences found:`);
    page0Comparison.differences.slice(0, 10).forEach(diff => console.log(`  ${diff}`));
    if (page0Comparison.differences.length > 10) {
      console.log(`  ... and ${page0Comparison.differences.length - 10} more`);
    }
  }

  console.log('\nPage 3 Comparison:');
  console.log('─────────────────');
  if (page3Comparison.match) {
    console.log('✓ MATCH - All bytes identical');
  } else {
    console.log(`✗ MISMATCH - ${page3Comparison.differences.length} differences found:`);
    page3Comparison.differences.slice(0, 10).forEach(diff => console.log(`  ${diff}`));
    if (page3Comparison.differences.length > 10) {
      console.log(`  ... and ${page3Comparison.differences.length - 10} more`);
    }
  }

  // Overall result
  const overallMatch = page0Comparison.match && page3Comparison.match;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('RESULT');
  console.log('═══════════════════════════════════════════════════');

  if (overallMatch) {
    console.log('✓ TEST PASSED');
    console.log(`  Data from slot ${sourceSlot} successfully written to slot ${targetSlot}`);
    console.log('  and verified byte-for-byte');
  } else {
    console.log('✗ TEST FAILED');
    console.log('  Data corruption detected during write/read cycle');
  }
  console.log('═══════════════════════════════════════════════════\n');

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    sourceSlot,
    targetSlot,
    sourcePage0Length: sourcePage0.length,
    sourcePage3Length: sourcePage3.length,
    readPage0Length: readPage0.length,
    readPage3Length: readPage3.length,
    page0Match: page0Comparison.match,
    page3Match: page3Comparison.match,
    overallMatch,
    page0Differences: page0Comparison.differences,
    page3Differences: page3Comparison.differences
  };

  const resultsPath = `/Users/orion/work/ol_dsp/modules/audio-control/tmp/raw-midi-round-trip-${Date.now()}.json`;
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsPath}\n`);

  midiOutput.closePort();
  midiInput.closePort();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
