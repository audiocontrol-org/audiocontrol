#!/usr/bin/env tsx

/**
 * Test Launch Control XL 3 protocol based on ACTUAL web editor MIDI capture
 * Using the exact protocol from docs/midi-capture.md
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing Launch Control XL 3 with ACTUAL web editor protocol...\n');

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
  let fullResponse: number[] = [];

  // Monitor for responses
  input.on('message', (deltaTime: number, message: number[]) => {
    responseReceived = true;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    console.log(`[${timestamp}] Response (${message.length} bytes):`,
      message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
      message.length > 20 ? '...' : '');

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
          const slot = message[9];
          console.log(`  -> Operation: 0x${operation.toString(16)}, Slot: ${slot}`);

          if (operation === 0x10) {
            console.log('  -> READ response data received!');

            // Look for mode name (after header: 06 20 0E)
            const headerPattern = [0x06, 0x20, 0x0E];
            let nameStart = -1;
            for (let i = 10; i < message.length - 3; i++) {
              if (message[i] === headerPattern[0] &&
                  message[i + 1] === headerPattern[1] &&
                  message[i + 2] === headerPattern[2]) {
                nameStart = i + 3;
                break;
              }
            }

            if (nameStart > 0) {
              // Extract name
              const nameBytes = [];
              for (let i = nameStart; i < message.length - 1; i++) {
                if (message[i] === 0x00 || message[i] === 0x48 || message[i] === 0xF7) break;
                if (message[i] >= 32 && message[i] <= 126) { // Printable ASCII
                  nameBytes.push(message[i]);
                }
              }

              if (nameBytes.length > 0) {
                const modeName = String.fromCharCode(...nameBytes);
                console.log(`  -> Mode name: "${modeName}"`);
              }
            }

            // Count control definitions (0x48 markers from capture)
            let controlCount = 0;
            for (let i = 0; i < message.length; i++) {
              if (message[i] === 0x48) controlCount++;
            }
            console.log(`  -> Found ${controlCount} control markers (0x48)`);
          } else if (operation === 0x15) {
            console.log('  -> WRITE acknowledgment received!');
          }
        }
      }

      // Store full response for later analysis
      fullResponse = [...message];
    }
  });

  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✓ Ports opened, monitoring for responses...\n');

  // Test 1: READ from slot 0 using ACTUAL web editor protocol
  console.log('Step 1: Reading from slot 0 using web editor protocol...');

  // FROM CAPTURE: F0 00 20 29 02 15 05 00 40 00 00 F7
  const readMessage = [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID
    0x02,             // Device ID
    0x15,             // Command
    0x05,             // Sub-command
    0x00,             // Reserved
    0x40,             // READ command (from capture - NOT 0x15!)
    0x00,             // Slot 0
    0x00,             // Parameter (from capture - NOT 0x06!)
    0xF7              // SysEx end
  ];

  console.log('Read request:', readMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  try {
    output.sendMessage(readMessage);
    console.log('✓ Read request sent using web editor protocol');
  } catch (error) {
    console.error('Failed to send read request:', error);
  }

  // Wait for response
  setTimeout(() => {
    if (responseReceived) {
      console.log('\n✅ Device responded to read request!');
      console.log('Web editor protocol is working correctly!');
      if (fullResponse.length > 50) {
        console.log('\n📊 Response analysis:');
        console.log(`  - Total response length: ${fullResponse.length} bytes`);
        console.log(`  - Response header: ${fullResponse.slice(0, 15).map(b => '0x' + b.toString(16)).join(' ')}`);
      }
    } else {
      console.log('\n❌ No response received from read request');
      console.log('Even with the web editor protocol format.');

      // Try reading from slot 3 as well (second request from capture)
      console.log('\nTrying slot 3 (second request from capture)...');
      const readMessage3 = [
        0xF0,             // SysEx start
        0x00, 0x20, 0x29, // Manufacturer ID
        0x02,             // Device ID
        0x15,             // Command
        0x05,             // Sub-command
        0x00,             // Reserved
        0x40,             // READ command
        0x03,             // Slot 3
        0x00,             // Parameter
        0xF7              // SysEx end
      ];

      try {
        output.sendMessage(readMessage3);
        console.log('✓ Read request for slot 3 sent');
      } catch (error) {
        console.error('Failed to send read request for slot 3:', error);
      }

      setTimeout(() => {
        if (responseReceived) {
          console.log('✅ Got response from slot 3!');
        } else {
          console.log('❌ Still no response - device may need different state/mode');
        }

        // Cleanup
        input.closePort();
        output.closePort();
        console.log('✓ Ports closed');
      }, 3000);
    }
  }, 3000);

} else {
  console.log('Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out (input)');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In (output)');
}