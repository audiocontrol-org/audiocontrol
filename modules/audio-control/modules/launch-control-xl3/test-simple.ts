#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing MIDI connection to LCXL3...\n');

// Create output
const output = new midi.Output();

// Find the LCXL3 port
const outputCount = output.getPortCount();
let lcxlIndex = -1;

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  console.log(`Port ${i}: "${name}"`);
  if (name.includes('LCXL3')) {
    lcxlIndex = i;
    console.log(`  -> Found LCXL3 at index ${i}`);
  }
}

if (lcxlIndex >= 0) {
  console.log(`\nOpening port ${lcxlIndex}...`);
  output.openPort(lcxlIndex);

  console.log('Sending device inquiry...');
  // Send device inquiry SysEx
  const deviceInquiry = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
  output.sendMessage(deviceInquiry);

  console.log('Message sent successfully!');

  // Close port
  output.closePort();
} else {
  console.log('LCXL3 not found');
}

console.log('\nDone.');