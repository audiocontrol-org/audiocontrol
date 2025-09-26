#!/usr/bin/env tsx

/**
 * Test reading from multiple slots to see if any respond
 * Based on protocol clarification that slot numbering may differ
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing read requests from multiple slots...\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find ports
let inputIndex = -1;
let outputIndex = -1;

const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 MIDI Out') {
    inputIndex = i;
    console.log(`Found input: ${name} at index ${i}`);
    break;
  }
}

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 MIDI In') {
    outputIndex = i;
    console.log(`Found output: ${name} at index ${i}`);
    break;
  }
}

if (inputIndex >= 0 && outputIndex >= 0) {
  console.log('\nOpening MIDI ports...');

  let responsesReceived = 0;
  const responses: Array<{slot: number, data: number[]}> = [];

  // Monitor for responses
  input.on('message', (deltaTime: number, message: number[]) => {
    responsesReceived++;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    console.log(`[${timestamp}] Response ${responsesReceived} (${message.length} bytes):`,
      message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Check for Novation response
    if (message.length >= 6 &&
        message[0] === 0xF0 &&
        message[1] === 0x00 &&
        message[2] === 0x20 &&
        message[3] === 0x29 &&
        message[4] === 0x02) {

      const command = message[5];
      console.log(`  -> Novation LCXL3 response, command: 0x${command.toString(16)}`);

      if (command === 0x15 && message[6] === 0x05) {
        console.log('  -> Custom mode operation response!');
        if (message.length > 9) {
          const operation = message[8];
          const slot = message[9];
          console.log(`  -> Operation: 0x${operation.toString(16)}, Slot: ${slot}`);

          // Store for analysis
          responses.push({slot, data: [...message]});
        }
      }
    }
  });

  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✓ Ports opened, testing multiple slots...\n');

  // Test slots 0-7 (which might map to device slots 1-8)
  const slotsToTest = [0, 1, 2, 3, 4, 5, 6, 7];
  let currentSlot = 0;

  const testNextSlot = () => {
    if (currentSlot >= slotsToTest.length) {
      // All slots tested
      setTimeout(() => {
        console.log(`\n📊 Test Summary:`);
        console.log(`Total responses received: ${responsesReceived}`);

        if (responses.length > 0) {
          console.log(`✅ Found ${responses.length} slot(s) with data:`);
          responses.forEach(r => {
            console.log(`  - Slot ${r.slot}: ${r.data.length} bytes`);
          });
        } else {
          console.log(`❌ No slots responded with data`);
          console.log('Possible reasons:');
          console.log('  - Device doesn\'t support read operations');
          console.log('  - All slots are empty');
          console.log('  - Different protocol format needed');
        }

        // Cleanup
        input.closePort();
        output.closePort();
        console.log('\n✓ Ports closed');
      }, 2000);
      return;
    }

    const slot = slotsToTest[currentSlot];
    console.log(`Testing slot ${slot}...`);

    const readMessage = [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID
      0x02,             // Device ID
      0x15,             // Command
      0x05,             // Sub-command
      0x00,             // Reserved
      0x15,             // Read command identifier
      slot,             // Slot number
      0x06,             // Read operation parameter
      0xF7              // SysEx end
    ];

    try {
      output.sendMessage(readMessage);
      console.log(`✓ Read request sent for slot ${slot}`);
    } catch (error) {
      console.error(`Failed to send read request for slot ${slot}:`, error);
    }

    currentSlot++;
    setTimeout(testNextSlot, 1000); // Wait 1 second between requests
  };

  // Start testing
  testNextSlot();

} else {
  console.log('Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out (input)');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In (output)');
}