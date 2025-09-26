#!/usr/bin/env tsx

/**
 * Debug SysEx parsing to understand the exact structure
 */

import { SysExParser } from '@/core/SysExParser';

// Test data from the actual response
const testResponse = [
  0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00,
  0x06, 0x20, 0x0E, 0x44, 0x69, 0x67, 0x69, 0x74, 0x61, 0x6B,
  0x74, 0x20, 0x6D, 0x69, 0x78, 0x65, 0x72, 0x21, 0x48, 0x03,
  // ... truncated for brevity, but this is the actual start of the message
];

console.log('🔍 Debug SysEx Parsing\n');

console.log('Raw message bytes:');
console.log(testResponse.slice(0, 30).map((b, i) => `[${i}] 0x${b.toString(16).padStart(2, '0')}`).join(' '));

console.log('\nAnalyzing structure:');
console.log(`Position 0: 0x${testResponse[0].toString(16)} (${testResponse[0] === 0xF0 ? 'SysEx start ✓' : 'NOT SysEx start ❌'})`);
console.log(`Position 1-3: 0x${testResponse[1].toString(16)} 0x${testResponse[2].toString(16)} 0x${testResponse[3].toString(16)} (Manufacturer ID)`);
console.log(`Position 4: 0x${testResponse[4].toString(16)} (Device ID)`);
console.log(`Position 5: 0x${testResponse[5].toString(16)} (Command)`);
console.log(`Position 6: 0x${testResponse[6].toString(16)} (Sub-command)`);
console.log(`Position 7: 0x${testResponse[7].toString(16)} (Reserved)`);
console.log(`Position 8: 0x${testResponse[8].toString(16)} (Operation - should be 0x10)`);
console.log(`Position 9: 0x${testResponse[9].toString(16)} (Slot)`);
console.log(`Position 10-12: 0x${testResponse[10].toString(16)} 0x${testResponse[11].toString(16)} 0x${testResponse[12].toString(16)} (Start of data)`);

// Check if it matches the expected structure
const isValidStructure =
  testResponse[1] === 0x00 &&
  testResponse[2] === 0x20 &&
  testResponse[3] === 0x29 &&
  testResponse[4] === 0x02 &&
  testResponse[5] === 0x15 &&
  testResponse[6] === 0x05 &&
  testResponse[7] === 0x00;

console.log(`\nStructure validation: ${isValidStructure ? '✅ VALID' : '❌ INVALID'}`);

// Test parsing
console.log('\nTesting SysEx parser...');
try {
  const parsed = SysExParser.parse(testResponse);
  console.log('✅ Parsing successful!');
  console.log('Result:', parsed);
} catch (error: any) {
  console.error('❌ Parsing failed:', error.message);
}

// Test the internal parsing methods step by step
console.log('\nTesting internal parsing logic...');

// Check manufacturer ID detection
const manufacturerId = SysExParser.getManufacturerId(testResponse);
console.log(`Manufacturer ID: ${manufacturerId?.map(b => '0x' + b.toString(16)).join(' ')}`);

// Check if it's valid SysEx
const isValid = SysExParser.isValidSysEx(testResponse);
console.log(`Is valid SysEx: ${isValid}`);