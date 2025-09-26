#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing MIDI input from LCXL3...\n');

// Create input
const input = new midi.Input();

// List all input ports
const inputCount = input.getPortCount();
console.log('Available input ports:');
for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  console.log(`  ${i}: "${name}"`);
}

// Find the LCXL3 DAW port
let dawIndex = -1;
for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 DAW Out') {
    dawIndex = i;
    console.log(`\nFound LCXL3 DAW Out port at index ${i}`);
    break;
  }
}

if (dawIndex >= 0) {
  console.log(`Opening input port ${dawIndex}...`);

  // Set up message handler BEFORE opening the port
  input.on('message', (deltaTime: number, message: number[]) => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`[${timestamp}] Message:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Parse the message type
    if (message.length > 0) {
      const statusByte = message[0];
      const messageType = statusByte & 0xF0;
      const channel = statusByte & 0x0F;

      switch (messageType) {
        case 0xB0: // Control Change
          const controller = message[1];
          const value = message[2];
          console.log(`  -> Control Change: CC${controller} = ${value} (ch ${channel + 1})`);
          break;
        case 0x90: // Note On
          console.log(`  -> Note On: Note ${message[1]}, Velocity ${message[2]} (ch ${channel + 1})`);
          break;
        case 0x80: // Note Off
          console.log(`  -> Note Off: Note ${message[1]}, Velocity ${message[2]} (ch ${channel + 1})`);
          break;
        case 0xF0: // SysEx
          console.log(`  -> SysEx: ${message.length} bytes`);
          break;
      }
    }
  });

  // Now open the port
  input.openPort(dawIndex);

  console.log('\nListening for MIDI messages from LCXL3...');
  console.log('Move knobs, faders, or press buttons on the device.');
  console.log('Press Ctrl+C to exit.\n');

  // Keep the script running
  process.on('SIGINT', () => {
    console.log('\nClosing port...');
    input.closePort();
    process.exit(0);
  });

  // Keep alive
  setInterval(() => {}, 1000);

} else {
  console.log('\nLCXL3 DAW Out port not found');
  console.log('Make sure the device is connected and recognized by the system.');
}