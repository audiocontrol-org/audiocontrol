#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing dual-port configuration for LCXL3...\n');

// Create inputs and outputs
const midiInput = new midi.Input();
const dawOutput = new midi.Output();

// Find MIDI input port (for control changes)
const inputCount = midiInput.getPortCount();
let midiInputIndex = -1;
for (let i = 0; i < inputCount; i++) {
  const name = midiInput.getPortName(i);
  if (name === 'LCXL3 1 MIDI Out') {
    midiInputIndex = i;
    console.log(`Found LCXL3 MIDI Out (input) at index ${i}`);
    break;
  }
}

// Find DAW output port (for SysEx LEDs)
const outputCount = dawOutput.getPortCount();
let dawOutputIndex = -1;
for (let i = 0; i < outputCount; i++) {
  const name = dawOutput.getPortName(i);
  if (name === 'LCXL3 1 DAW In') {
    dawOutputIndex = i;
    console.log(`Found LCXL3 DAW In (output) at index ${i}`);
    break;
  }
}

if (midiInputIndex >= 0 && dawOutputIndex >= 0) {
  // Open the MIDI input port
  midiInput.on('message', (deltaTime: number, message: number[]) => {
    const statusByte = message[0];
    const messageType = statusByte & 0xF0;

    if (messageType === 0xB0) { // Control Change
      const controller = message[1];
      const value = message[2];
      const bar = '█'.repeat(Math.round((value / 127) * 20));
      const empty = '░'.repeat(20 - bar.length);
      console.log(`CC${controller.toString().padEnd(3)} [${bar}${empty}] ${value.toString().padStart(3)}`);

      // Light up corresponding LED based on value
      const controlLedMap: Record<number, number> = {
        77: 0x29, // Fader 1 -> Focus 1 LED
        78: 0x2A, // Fader 2 -> Focus 2 LED
        79: 0x2B, // Fader 3 -> Focus 3 LED
        80: 0x2C, // Fader 4 -> Focus 4 LED
        81: 0x39, // Fader 5 -> Focus 5 LED
        82: 0x3A, // Fader 6 -> Focus 6 LED
        83: 0x3B, // Fader 7 -> Focus 7 LED
        84: 0x3C, // Fader 8 -> Focus 8 LED
      };

      const ledId = controlLedMap[controller];
      if (ledId) {
        // Map value to color (0-127 -> red/amber/green)
        let color = 0x00; // Off
        if (value > 0 && value <= 42) {
          color = 0x0F; // Red
        } else if (value > 42 && value <= 85) {
          color = 0x3F; // Amber
        } else if (value > 85) {
          color = 0x3C; // Green
        }

        // Send LED update via SysEx on DAW port
        const sysex = [0xF0, 0x00, 0x20, 0x29, 0x11, 0x0C, ledId, color, 0xF7];
        dawOutput.sendMessage(sysex);
      }
    }
  });

  midiInput.openPort(midiInputIndex);
  dawOutput.openPort(dawOutputIndex);

  console.log('\n✓ Dual-port configuration active!');
  console.log('Move faders to see LED feedback.');
  console.log('Press Ctrl+C to exit.\n');

  // Initial LED test
  const leds = [0x29, 0x2A, 0x2B, 0x2C, 0x39, 0x3A, 0x3B, 0x3C];
  for (const led of leds) {
    dawOutput.sendMessage([0xF0, 0x00, 0x20, 0x29, 0x11, 0x0C, led, 0x3F, 0xF7]); // Amber
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 500));
  for (const led of leds) {
    dawOutput.sendMessage([0xF0, 0x00, 0x20, 0x29, 0x11, 0x0C, led, 0x00, 0xF7]); // Off
  }

  // Keep running
  process.on('SIGINT', () => {
    console.log('\nClosing ports...');
    midiInput.closePort();
    dawOutput.closePort();
    process.exit(0);
  });

  setInterval(() => {}, 1000);

} else {
  console.log('\nRequired ports not found:');
  if (midiInputIndex < 0) console.log('  - LCXL3 1 MIDI Out');
  if (dawOutputIndex < 0) console.log('  - LCXL3 1 DAW In');
}