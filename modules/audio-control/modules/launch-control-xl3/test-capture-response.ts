#!/usr/bin/env tsx

/**
 * Test to properly capture the Launch Control XL 3 SysEx response
 * Based on confirmed working communication from MIDI capture
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing Launch Control XL 3 SysEx Response Capture...\n');

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

  let responseCount = 0;
  let responseData: number[][] = [];

  // Set up proper response handler BEFORE opening ports
  input.on('message', (deltaTime: number, message: number[]) => {
    responseCount++;
    responseData.push([...message]); // Make a copy

    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`\n[${timestamp}] === RESPONSE ${responseCount} ===`);
    console.log(`Length: ${message.length} bytes`);
    console.log(`First 20 bytes: ${message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

    if (message.length > 20) {
      console.log(`Last 10 bytes: ${message.slice(-10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }

    // Check for Novation SysEx header
    if (message.length >= 10 &&
        message[0] === 0xF0 &&
        message[1] === 0x00 &&
        message[2] === 0x20 &&
        message[3] === 0x29 &&
        message[4] === 0x02 &&
        message[5] === 0x15 &&
        message[6] === 0x05 &&
        message[7] === 0x00) {

      const operation = message[8];
      const slot = message[9];

      console.log(`✅ Novation Custom Mode Response!`);
      console.log(`   Operation: 0x${operation.toString(16).padStart(2, '0')}`);
      console.log(`   Slot: ${slot}`);

      if (operation === 0x10) {
        console.log(`   -> This is a READ response`);

        // Look for mode name after header pattern 06 20 0E
        let nameStart = -1;
        for (let i = 10; i < message.length - 3; i++) {
          if (message[i] === 0x06 && message[i + 1] === 0x20 && message[i + 2] === 0x0E) {
            nameStart = i + 3;
            break;
          }
        }

        if (nameStart > 0 && nameStart < message.length) {
          // Extract mode name
          const nameBytes = [];
          for (let i = nameStart; i < Math.min(nameStart + 20, message.length - 1); i++) {
            if (message[i] === 0x00 || message[i] === 0x48 || message[i] === 0xF7) break;
            if (message[i] >= 32 && message[i] <= 126) {
              nameBytes.push(message[i]);
            }
          }

          if (nameBytes.length > 0) {
            const modeName = String.fromCharCode(...nameBytes);
            console.log(`   -> Mode name: "${modeName}"`);
          }
        }

        // Count control definitions (0x48 markers)
        let controlCount = 0;
        for (let i = 10; i < message.length; i++) {
          if (message[i] === 0x48) controlCount++;
        }
        console.log(`   -> Control definitions: ${controlCount}`);

        // Parse first few control definitions
        console.log(`   -> Parsing control definitions:`);
        let pos = 10;
        let controlsParsed = 0;

        while (pos < message.length - 10 && controlsParsed < 5) {
          if (message[pos] === 0x48) {
            const controlId = message[pos + 1];
            const defType = message[pos + 2];
            const controlType = message[pos + 3];
            const channel = message[pos + 4];
            const param1 = message[pos + 5];
            const param2 = message[pos + 6];
            const ccNumber = message[pos + 7];
            const maxValue = message[pos + 8];

            console.log(`      Control ${controlsParsed + 1}: ID=0x${controlId.toString(16)}, Type=0x${controlType.toString(16)}, Ch=${channel + 1}, CC=${ccNumber}`);
            controlsParsed++;
            pos += 9; // Move past this control definition
          } else {
            pos++;
          }
        }
      }
    }
  });

  // Open ports
  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✓ Ports opened with response handler active');
  console.log('✓ Monitoring for responses...\n');

  // Send the exact read request from your capture
  const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];

  console.log('Sending read request to slot 0...');
  console.log('Request:', readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  try {
    output.sendMessage(readRequest);
    console.log('✓ Read request sent successfully');
    console.log('⏳ Waiting for response...');
  } catch (error) {
    console.error('❌ Failed to send read request:', error);
  }

  // Wait longer for response and give detailed status
  setTimeout(() => {
    console.log(`\n📊 Final Results:`);
    console.log(`   Responses received: ${responseCount}`);

    if (responseCount > 0) {
      console.log(`   ✅ SUCCESS: Device responded!`);
      responseData.forEach((data, i) => {
        console.log(`   Response ${i + 1}: ${data.length} bytes`);
      });
    } else {
      console.log(`   ❌ No responses captured`);
      console.log(`   Possible issues:`);
      console.log(`   - Handler setup timing`);
      console.log(`   - Port configuration`);
      console.log(`   - Device state/mode`);
    }

    // Cleanup
    input.closePort();
    output.closePort();
    console.log('\n✓ Ports closed');
  }, 5000); // Wait 5 seconds for response

} else {
  console.log('❌ Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out (input)');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In (output)');
}