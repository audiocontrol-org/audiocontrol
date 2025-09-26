#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing MIDI input from LCXL3 MIDI port...\n');

// Create input
const input = new midi.Input();

// Find the LCXL3 MIDI port (not DAW)
const inputCount = input.getPortCount();
let midiIndex = -1;
for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 MIDI Out') {
    midiIndex = i;
    console.log(`Found LCXL3 MIDI Out port at index ${i}`);
    break;
  }
}

if (midiIndex >= 0) {
  console.log(`Opening MIDI port ${midiIndex}...`);

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
          const bar = '█'.repeat(Math.round((value / 127) * 20));
          const empty = '░'.repeat(20 - bar.length);
          console.log(`  -> CC${controller.toString().padEnd(3)} [${bar}${empty}] ${value.toString().padStart(3)} (ch ${channel + 1})`);
          break;
        case 0x90: // Note On
          console.log(`  -> Note On: Note ${message[1]}, Vel ${message[2]} (ch ${channel + 1})`);
          break;
        case 0x80: // Note Off
          console.log(`  -> Note Off: Note ${message[1]} (ch ${channel + 1})`);
          break;
      }
    }
  });

  // Now open the port
  input.openPort(midiIndex);

  console.log('\n✓ Listening for MIDI messages from LCXL3...');
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
  console.log('\nLCXL3 MIDI Out port not found');
  console.log('Make sure the device is connected.');
}