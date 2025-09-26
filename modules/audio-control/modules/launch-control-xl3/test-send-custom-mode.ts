#!/usr/bin/env tsx

/**
 * Direct SysEx test to send custom mode data to Launch Control XL 3
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing direct custom mode SysEx sending...\n');

// Create output
const output = new midi.Output();

// Find output port
const outputCount = output.getPortCount();
let outputIndex = -1;

console.log('Available output ports:');
for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  console.log(`  ${i}: ${name}`);
  if (name === 'LCXL3 1 MIDI In') {
    outputIndex = i;
  }
}

if (outputIndex >= 0) {
  console.log(`\nUsing output port ${outputIndex}: LCXL3 1 MIDI In`);
  output.openPort(outputIndex);

  // Novation Launch Control XL 3 SysEx format
  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;
  const CUSTOM_MODE_WRITE = 0x63;

  // Create a simple custom mode configuration
  // This is based on what I've seen in the protocol docs
  console.log('Preparing custom mode data...');

  // Basic custom mode structure (may need to be adjusted based on actual protocol)
  const customModeData = [
    // Mode name (8 bytes, padded with zeros)
    0x54, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00, 0x00,  // "Test" + padding

    // Control mappings - simplified format
    // Each control: [type, position, channel, cc, color]

    // Fader 1: Channel 1, CC 77, Green
    0x01, 0x01, 0x01, 0x4D, 0x3C,

    // Fader 2: Channel 1, CC 78, Green
    0x01, 0x02, 0x01, 0x4E, 0x3C,

    // Fader 3: Channel 1, CC 79, Amber
    0x01, 0x03, 0x01, 0x4F, 0x3F,

    // Fader 4: Channel 1, CC 80, Amber
    0x01, 0x04, 0x01, 0x50, 0x3F,

    // Knob 1 (top row): Channel 2, CC 13, Red
    0x02, 0x01, 0x02, 0x0D, 0x0F,

    // Knob 2 (top row): Channel 2, CC 14, Red
    0x02, 0x02, 0x02, 0x0E, 0x0F,
  ];

  // Build complete SysEx message
  const sysexMessage = [
    0xF0,                    // SysEx start
    ...MANUFACTURER_ID,      // 00 20 29
    DEVICE_ID,              // 11
    CUSTOM_MODE_WRITE,      // 63
    0x00,                   // Slot 0
    ...customModeData,      // Mode data
    0xF7                    // SysEx end
  ];

  console.log(`Custom Mode SysEx (${sysexMessage.length} bytes):`);
  console.log('Message:', sysexMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  console.log('');

  console.log('Sending custom mode to device...');
  try {
    output.sendMessage(sysexMessage);
    console.log('✓ Custom mode SysEx sent successfully!');
    console.log('');
    console.log('If successful, you should be able to:');
    console.log('1. Switch to User mode on your device');
    console.log('2. See the custom control mappings take effect');
    console.log('3. Test faders and knobs with the new CC assignments');

  } catch (error) {
    console.error('Failed to send SysEx:', error);
  }

  // Wait a moment then close
  setTimeout(() => {
    output.closePort();
    console.log('\nDone.');
  }, 1000);

} else {
  console.log('\nLCXL3 1 MIDI In port not found');
  console.log('Make sure the device is connected.');
}