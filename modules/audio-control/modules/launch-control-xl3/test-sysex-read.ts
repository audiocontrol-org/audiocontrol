#!/usr/bin/env tsx

/**
 * Low-level test to send custom mode read requests and monitor responses
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing SysEx custom mode reading...\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find ports
const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

let dawInputIndex = -1;
let dawOutputIndex = -1;

for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 DAW Out') {
    dawInputIndex = i;
    console.log(`Found LCXL3 DAW Out (input) at index ${i}`);
    break;
  }
}

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 DAW In') {
    dawOutputIndex = i;
    console.log(`Found LCXL3 DAW In (output) at index ${i}`);
    break;
  }
}

if (dawInputIndex >= 0 && dawOutputIndex >= 0) {
  console.log('\nOpening DAW ports...');

  // Set up SysEx message listener first
  input.on('message', (deltaTime: number, message: number[]) => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`[${timestamp}] SysEx Response:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Check if it's our expected response format
    if (message.length >= 6 &&
        message[0] === 0xF0 &&
        message[1] === 0x00 &&
        message[2] === 0x20 &&
        message[3] === 0x29 &&
        message[4] === 0x11) {

      const command = message[5];
      console.log(`  -> Command: 0x${command.toString(16)} (${command})`);

      if (command === 0x62) { // CUSTOM_MODE_RESPONSE
        const slot = message[6];
        console.log(`  -> Custom mode response for slot ${slot}`);
        console.log(`  -> Message length: ${message.length} bytes`);
      }
    }
  });

  input.openPort(dawInputIndex);
  output.openPort(dawOutputIndex);

  console.log('✓ DAW ports opened');

  // Novation Launch Control XL 3 custom mode read request
  // F0 00 20 29 11 62 <slot> F7
  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;
  const CUSTOM_MODE_READ = 0x62;

  async function readCustomMode(slot: number) {
    console.log(`\nSending custom mode read request for slot ${slot}...`);

    const message = [
      0xF0,                    // SysEx start
      ...MANUFACTURER_ID,      // 00 20 29
      DEVICE_ID,              // 11
      CUSTOM_MODE_READ,       // 62
      slot,                   // slot number
      0xF7                    // SysEx end
    ];

    console.log('Sending:', message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    output.sendMessage(message);

    // Wait a bit for response
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test reading slots 0-3
  for (let slot = 0; slot <= 3; slot++) {
    await readCustomMode(slot);
  }

  // Also try some other SysEx requests to see if device responds at all
  console.log('\nTrying device inquiry on DAW port...');
  const deviceInquiry = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
  console.log('Sending:', deviceInquiry.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  output.sendMessage(deviceInquiry);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Close ports
  input.closePort();
  output.closePort();
  console.log('\nDone.');

} else {
  console.log('\nRequired DAW ports not found:');
  if (dawInputIndex < 0) console.log('  - LCXL3 1 DAW Out');
  if (dawOutputIndex < 0) console.log('  - LCXL3 1 DAW In');
}