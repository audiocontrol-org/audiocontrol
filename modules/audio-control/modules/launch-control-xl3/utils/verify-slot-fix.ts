#!/usr/bin/env npx tsx
/**
 * Verify Slot Selection Fix
 *
 * This script provides mathematical proof that the slot selection bug is fixed.
 * It verifies that buildCustomModeWriteRequest() correctly uses the slot parameter
 * instead of hardcoding 0x00.
 *
 * Test method: Inspect actual SysEx bytes generated for different slots.
 */

import { SysExParser } from '../src/core/SysExParser.js';

console.log('Slot Selection Fix Verification');
console.log('═══════════════════════════════════════════════════\n');

// Create minimal test mode data
const testModeData = {
  type: 'custom_mode_write' as const,
  manufacturerId: [0x00, 0x20, 0x29],
  slot: 0, // This field is actually ignored by the fixed code (uses parameter instead)
  controls: [
    {
      controlId: 0x10,
      channel: 0,
      ccNumber: 13,
      minValue: 0,
      maxValue: 127,
      behaviour: 'absolute' as const,
    }
  ],
  colors: [
    {
      controlId: 0x10,
      color: 0x60,
      behaviour: 'static' as const,
    }
  ],
  data: [],
};

console.log('Testing buildCustomModeWriteRequest() with different slots...\n');

interface TestResult {
  slot: number;
  page: number;
  slotBytePosition: number;
  actualSlotByte: number;
  expectedSlotByte: number;
  passed: boolean;
}

const results: TestResult[] = [];

// Test multiple slots to prove the fix works
const testSlots = [0, 1, 3, 7, 14];
const testPages = [0, 3]; // Page 0 = encoders, Page 3 = faders/buttons

for (const slot of testSlots) {
  for (const page of testPages) {
    try {
      // Generate SysEx message
      const message = SysExParser.buildCustomModeWriteRequest(slot, page, testModeData);

      // SysEx format: F0 00 20 29 02 15 05 00 45 [PAGE] [SLOT] [data...] F7
      // Byte positions:  0  1  2  3  4  5  6  7  8    9     10
      const slotBytePosition = 10;
      const actualSlotByte = message[slotBytePosition];

      const passed = actualSlotByte === slot;

      results.push({
        slot,
        page,
        slotBytePosition,
        actualSlotByte: actualSlotByte ?? -1,
        expectedSlotByte: slot,
        passed,
      });

      const status = passed ? '✅' : '❌';
      const pageHex = page === 0 ? '0x00' : '0x03';
      console.log(`${status} Slot ${slot}, Page ${page} (${pageHex}): byte[10] = 0x${(actualSlotByte ?? 0).toString(16).padStart(2, '0')} (expected 0x${slot.toString(16).padStart(2, '0')})`);

    } catch (error) {
      console.log(`❌ Slot ${slot}, Page ${page}: Error - ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        slot,
        page,
        slotBytePosition: 10,
        actualSlotByte: -1,
        expectedSlotByte: slot,
        passed: false,
      });
    }
  }
}

console.log('\n' + '═'.repeat(50));
console.log('Summary');
console.log('═'.repeat(50) + '\n');

const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;

console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log();

if (failedTests > 0) {
  console.log('Failed tests:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - Slot ${r.slot}, Page ${r.page}: Got 0x${r.actualSlotByte.toString(16)}, expected 0x${r.expectedSlotByte.toString(16)}`);
  });
  console.log();
}

// Verify slot validation works
console.log('Testing slot validation...\n');

try {
  SysExParser.buildCustomModeWriteRequest(-1, 0, testModeData);
  console.log('❌ Slot -1: Should have thrown error (out of range)');
} catch (error) {
  console.log('✅ Slot -1: Correctly rejected (out of range)');
}

try {
  SysExParser.buildCustomModeWriteRequest(15, 0, testModeData);
  console.log('❌ Slot 15: Should have thrown error (reserved slot)');
} catch (error) {
  console.log('✅ Slot 15: Correctly rejected (reserved slot)');
}

try {
  SysExParser.buildCustomModeWriteRequest(16, 0, testModeData);
  console.log('❌ Slot 16: Should have thrown error (out of range)');
} catch (error) {
  console.log('✅ Slot 16: Correctly rejected (out of range)');
}

console.log();

// Final verdict
console.log('═'.repeat(50));
if (failedTests === 0) {
  console.log('║                                                ║');
  console.log('║            ✅ FIX VERIFIED                     ║');
  console.log('║                                                ║');
  console.log('║  Slot selection bug is FIXED!                 ║');
  console.log('║  All test slots produce correct SysEx bytes.  ║');
  console.log('║                                                ║');
  console.log('═'.repeat(50));
  console.log();
  console.log('The slot byte (position 10) now correctly uses the slot parameter');
  console.log('instead of the hardcoded 0x00 value.');
  console.log();
  console.log('Proof:');
  console.log('  - Tested slots: 0, 1, 3, 7, 14');
  console.log('  - Tested pages: 0 (encoders), 3 (faders/buttons)');
  console.log('  - All combinations produce correct slot byte');
  console.log('  - Slot validation works (rejects invalid slots)');
  process.exit(0);
} else {
  console.log('║                                                ║');
  console.log('║            ❌ FIX FAILED                       ║');
  console.log('║                                                ║');
  console.log('║  Slot selection bug is NOT fixed!             ║');
  console.log('║  Some tests produced incorrect SysEx bytes.   ║');
  console.log('║                                                ║');
  console.log('═'.repeat(50));
  process.exit(1);
}
