#!/usr/bin/env tsx

/**
 * Test LED control based on web editor analysis
 * Uses the actual working protocol discovered from web editor MIDI traffic
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing Launch Control XL 3 LED Control (Web Editor Protocol)...\n');

// Color mapping based on web editor analysis
const colors = {
  off: 0x0C,
  red: 0x0F,
  green: 0x3C,
  amber: 0x60,
  yellow: 0x3F,
  blue: 0x3D,
};

// LED ID mapping based on captured traffic
const ledIds = {
  // Encoders (from captured traffic)
  encoder1: 0x41,
  encoder2: 0x42,
  encoder3: 0x43,
  encoder4: 0x44,
  encoder5: 0x45,
  encoder6: 0x46,
  encoder7: 0x47,
  encoder8: 0x48,

  // These are estimates based on pattern - need verification
  // Faders (likely different range)
  fader1: 0x29,
  fader2: 0x2A,
  fader3: 0x2B,
  fader4: 0x2C,

  // Buttons (likely another range)
  button1: 0x51,
  button2: 0x52,
};

function createLedControlMessage(ledId: number, colorCode: number): number[] {
  return [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID (Novation)
    0x11,             // Device ID (Launch Control XL 3) - from captured traffic
    0x78,             // LED control command - from captured traffic
    ledId,            // LED identifier
    colorCode,        // Color code
    0xF7              // SysEx end
  ];
}

// Create output
const output = new midi.Output();
const outputCount = output.getPortCount();
let outputIndex = -1;

// Find MIDI port (not DAW port)
console.log('Finding MIDI output port...');
for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 MIDI In') {
    outputIndex = i;
    console.log(`Found LCXL3 1 MIDI In at port ${i}`);
    break;
  }
}

if (outputIndex >= 0) {
  output.openPort(outputIndex);
  console.log('✓ MIDI port opened');

  console.log('\n🎨 Testing LED control sequence...');

  let step = 0;
  const testSequence = [
    { led: ledIds.encoder1, color: colors.red, name: 'Encoder 1 Red' },
    { led: ledIds.encoder2, color: colors.green, name: 'Encoder 2 Green' },
    { led: ledIds.encoder3, color: colors.amber, name: 'Encoder 3 Amber' },
    { led: ledIds.encoder4, color: colors.yellow, name: 'Encoder 4 Yellow' },
    { led: ledIds.encoder1, color: colors.off, name: 'Encoder 1 Off' },
    { led: ledIds.encoder2, color: colors.off, name: 'Encoder 2 Off' },
    { led: ledIds.encoder3, color: colors.off, name: 'Encoder 3 Off' },
    { led: ledIds.encoder4, color: colors.off, name: 'Encoder 4 Off' },
  ];

  const runTest = () => {
    if (step >= testSequence.length) {
      console.log('\n✅ LED control test completed!');
      console.log('If you saw LEDs change color, the protocol is working correctly.');

      // Clean up
      setTimeout(() => {
        output.closePort();
        console.log('✓ MIDI port closed');
      }, 500);
      return;
    }

    const test = testSequence[step];
    const message = createLedControlMessage(test.led, test.color);

    console.log(`${step + 1}. ${test.name}`);
    console.log(`   Message: ${message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

    try {
      output.sendMessage(message);
      console.log('   ✓ Sent successfully');
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }

    step++;
    setTimeout(runTest, 1500); // 1.5 second delay between steps
  };

  runTest();

} else {
  console.error('❌ LCXL3 1 MIDI In port not found');
  console.error('Make sure the Launch Control XL 3 is connected via USB.');

  console.log('\nAvailable MIDI ports:');
  for (let i = 0; i < outputCount; i++) {
    console.log(`  ${i}: ${output.getPortName(i)}`);
  }
}