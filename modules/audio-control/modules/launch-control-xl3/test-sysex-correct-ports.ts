#!/usr/bin/env tsx

/**
 * Test SysEx custom mode reading using the correct MIDI ports
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing SysEx on correct MIDI ports...\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find regular MIDI ports (not DAW)
let midiInputIndex = -1;
let midiOutputIndex = -1;

const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

console.log('Available input ports:');
for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  console.log(`  ${i}: ${name}`);
  if (name === 'LCXL3 1 MIDI Out') {
    midiInputIndex = i;
  }
}

console.log('\nAvailable output ports:');
for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  console.log(`  ${i}: ${name}`);
  if (name === 'LCXL3 1 MIDI In') {
    midiOutputIndex = i;
  }
}

if (midiInputIndex >= 0 && midiOutputIndex >= 0) {
  console.log(`\nUsing MIDI ports: Input ${midiInputIndex}, Output ${midiOutputIndex}`);
  console.log('Opening MIDI ports...');

  let messageCount = 0;

  // Monitor all incoming messages
  input.on('message', (deltaTime: number, message: number[]) => {
    messageCount++;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    // Check if it's SysEx
    if (message[0] === 0xF0) {
      console.log(`[${timestamp}] SysEx Response ${messageCount}:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

      if (message.length >= 6 &&
          message[1] === 0x00 &&
          message[2] === 0x20 &&
          message[3] === 0x29 &&
          message[4] === 0x11) {

        const command = message[5];
        console.log(`  -> Novation command: 0x${command.toString(16)}`);

        if (command === 0x62) { // Custom mode response
          console.log(`  -> Custom mode data for slot ${message[6] || 'unknown'}`);
          console.log(`  -> Data length: ${message.length} bytes`);
          if (message.length > 7) {
            console.log(`  -> Payload:`, message.slice(7, -1));
          }
        }
      }
    } else {
      // Regular MIDI message - just count it
      console.log(`[${timestamp}] MIDI message: ${message.map(b => '0x' + b.toString(16)).join(' ')}`);
    }
  });

  input.openPort(midiInputIndex);
  output.openPort(midiOutputIndex);
  console.log('✓ MIDI ports opened, monitoring responses...\n');

  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;

  async function sendAndWait(name: string, message: number[], waitMs = 2000) {
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

  // Test different SysEx queries on regular MIDI ports

  // 1. Universal device inquiry
  await sendAndWait('Universal Device Inquiry', [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7]);

  // 2. Custom mode read requests
  for (let slot = 0; slot <= 2; slot++) {
    await sendAndWait(`Custom Mode Read Slot ${slot}`, [0xF0, 0x00, 0x20, 0x29, 0x11, 0x62, slot, 0xF7]);
  }

  // 3. Try template query
  await sendAndWait('Template Query', [0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0x00, 0xF7]);

  console.log('Waiting for any delayed responses...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Close ports
  input.closePort();
  output.closePort();

  if (messageCount === 0) {
    console.log('\n❌ No responses received');
    console.log('The device may not support these SysEx queries or requires different formatting');
  } else {
    console.log(`\n✅ Received ${messageCount} messages from device`);
  }

} else {
  console.log('\nRequired MIDI ports not found:');
  if (midiInputIndex < 0) console.log('  - LCXL3 1 MIDI Out (for input)');
  if (midiOutputIndex < 0) console.log('  - LCXL3 1 MIDI In (for output)');
}