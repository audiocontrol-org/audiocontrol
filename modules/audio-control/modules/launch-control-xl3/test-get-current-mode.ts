#!/usr/bin/env tsx

/**
 * Test various methods to get current device state from Launch Control XL 3
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing current device state queries...\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find DAW ports
let dawInputIndex = -1;
let dawOutputIndex = -1;

const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 DAW Out') {
    dawInputIndex = i;
    break;
  }
}

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 DAW In') {
    dawOutputIndex = i;
    break;
  }
}

if (dawInputIndex >= 0 && dawOutputIndex >= 0) {
  console.log('Opening DAW ports...');

  let messageCount = 0;

  // Monitor all SysEx responses
  input.on('message', (deltaTime: number, message: number[]) => {
    messageCount++;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`[${timestamp}] Response ${messageCount}:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    if (message.length >= 6 &&
        message[0] === 0xF0 &&
        message[1] === 0x00 &&
        message[2] === 0x20 &&
        message[3] === 0x29 &&
        message[4] === 0x11) {

      const command = message[5];
      console.log(`  -> Novation command: 0x${command.toString(16)}`);

      // Decode known commands
      switch (command) {
        case 0x77: console.log('  -> Template change'); break;
        case 0x78: console.log('  -> LED control'); break;
        case 0x62: console.log('  -> Custom mode response'); break;
        case 0x79: console.log('  -> LED reset'); break;
        default: console.log(`  -> Unknown command: ${command}`);
      }
    }
  });

  input.openPort(dawInputIndex);
  output.openPort(dawOutputIndex);
  console.log('✓ Ports opened, monitoring responses...\n');

  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;

  async function sendAndWait(name: string, message: number[], waitMs = 1500) {
    console.log(`${name}:`);
    console.log('  Sending:', message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    const beforeCount = messageCount;
    output.sendMessage(message);
    await new Promise(resolve => setTimeout(resolve, waitMs));

    if (messageCount === beforeCount) {
      console.log('  -> No response received');
    }
    console.log('');
  }

  // Try different types of queries

  // 1. Standard device inquiry
  await sendAndWait('Device Inquiry (Universal)', [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7]);

  // 2. Novation specific device inquiry
  await sendAndWait('Device Inquiry (Novation)', [0xF0, 0x00, 0x20, 0x29, 0x11, 0x06, 0x01, 0xF7]);

  // 3. Template status query (if supported)
  await sendAndWait('Template Status Query', [0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0xFF, 0xF7]);

  // 4. Try reading custom modes 0-3
  for (let slot = 0; slot <= 3; slot++) {
    await sendAndWait(`Custom Mode Read Slot ${slot}`, [0xF0, 0x00, 0x20, 0x29, 0x11, 0x62, slot, 0xF7], 1000);
  }

  // 5. Try a different custom mode read format (maybe with additional parameters)
  await sendAndWait('Custom Mode Read (Alt Format)', [0xF0, 0x00, 0x20, 0x29, 0x11, 0x62, 0x00, 0x00, 0xF7]);

  // 6. Try requesting all LED states
  await sendAndWait('LED State Query', [0xF0, 0x00, 0x20, 0x29, 0x11, 0x78, 0xFF, 0xF7]);

  console.log('All queries sent. Waiting for any delayed responses...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Close ports
  input.closePort();
  output.closePort();

  if (messageCount === 0) {
    console.log('\n❌ No SysEx responses received from device');
    console.log('The Launch Control XL 3 may not support bidirectional SysEx communication');
    console.log('or may require specific conditions (firmware version, mode, etc.)');
  } else {
    console.log(`\n✅ Received ${messageCount} responses from device`);
  }

} else {
  console.log('DAW ports not found. Make sure device is connected.');
}