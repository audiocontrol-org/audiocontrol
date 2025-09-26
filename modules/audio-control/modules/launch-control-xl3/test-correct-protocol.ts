#!/usr/bin/env tsx

/**
 * Test custom mode sending using the CORRECT Launch Control XL 3 protocol
 * Based on LAUNCH-CONTROL-PROTOCOL.md analysis
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing CORRECT Launch Control XL 3 protocol...\n');

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

  let responseReceived = false;

  // Monitor for responses
  input.on('message', (deltaTime: number, message: number[]) => {
    responseReceived = true;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    console.log(`[${timestamp}] Response:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

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
        if (message.length > 8) {
          const operation = message[8];
          console.log(`  -> Operation type: 0x${operation.toString(16)}`);
        }
      }
    }
  });

  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✓ Ports opened, monitoring for responses...\n');

  // Build correct SysEx message according to protocol
  function createCustomModeSysEx(slot: number, name: string) {
    const data: number[] = [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Write Custom Mode)
      0x05,             // Sub-command (Custom Mode Data)
      0x00,             // Reserved
      0x10,             // Data type (Write operation)
      slot,             // Target slot (0-14 for slots 1-15)
      0x06, 0x20, 0x10  // Additional header bytes
    ];

    // Add mode name as ASCII
    const nameBytes = [];
    for (let i = 0; i < name.length && i < 16; i++) {
      nameBytes.push(name.charCodeAt(i));
    }
    // Pad name to reasonable length
    while (nameBytes.length < 8) {
      nameBytes.push(0x00);
    }

    data.push(...nameBytes);

    // Add simple control definitions using the protocol format
    // Control 1: Fader 1 -> CC 77
    data.push(
      0x48,       // Control marker
      0x10,       // Control ID (fader 1)
      0x02,       // Definition type
      0x31,       // Control type (fader)
      0x00,       // MIDI channel 1
      0x48, 0x00, // Parameter separator
      77,         // CC number
      0x7F        // Max value
    );

    // Control 2: Encoder 1 -> CC 21
    data.push(
      0x48,       // Control marker
      0x20,       // Control ID (encoder row 1, pos 1)
      0x02,       // Definition type
      0x09,       // Control type (encoder)
      0x00,       // MIDI channel 1
      0x48, 0x00, // Parameter separator
      21,         // CC number
      0x7F        // Max value
    );

    data.push(0xF7); // SysEx end

    return data;
  }

  // Test 1: Try reading current mode from slot 0 first
  console.log('Step 1: Reading current mode from slot 0...');
  const readMessage = [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID
    0x02,             // Device ID
    0x15,             // Command
    0x05,             // Sub-command
    0x00,             // Reserved
    0x15,             // Read command identifier
    0x00,             // Slot 0
    0x06,             // Read operation parameter
    0xF7              // SysEx end
  ];

  console.log('Read message:', readMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  try {
    output.sendMessage(readMessage);
    console.log('✓ Read request sent');
  } catch (error) {
    console.error('Failed to send read request:', error);
  }

  // Wait for read response
  setTimeout(() => {
    console.log('\nStep 2: Writing custom mode to slot 0...');

    const writeMessage = createCustomModeSysEx(0, 'TestMode');
    console.log(`Write message (${writeMessage.length} bytes):`,
      writeMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    try {
      output.sendMessage(writeMessage);
      console.log('✓ Write request sent');
    } catch (error) {
      console.error('Failed to send write request:', error);
    }

    // Final status check
    setTimeout(() => {
      if (responseReceived) {
        console.log('\n✅ Device responded! Protocol appears to be working.');
      } else {
        console.log('\n❌ No response - may need different approach or device state');
      }

      // Cleanup
      input.closePort();
      output.closePort();
    }, 3000);

  }, 3000);

} else {
  console.log('Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In');
}