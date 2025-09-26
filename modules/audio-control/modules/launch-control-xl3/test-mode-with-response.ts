#!/usr/bin/env tsx

/**
 * Send custom mode and monitor for device response/acknowledgement
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing custom mode with response monitoring...\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find ports
let inputIndex = -1;
let outputIndex = -1;

const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

// Find MIDI ports (not DAW - we want bidirectional communication)
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

  // Monitor for any responses
  input.on('message', (deltaTime: number, message: number[]) => {
    responseReceived = true;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    if (message[0] === 0xF0) {
      console.log(`[${timestamp}] SysEx Response:`, message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

      // Check for Novation response
      if (message.length >= 6 &&
          message[1] === 0x00 &&
          message[2] === 0x20 &&
          message[3] === 0x29 &&
          message[4] === 0x11) {

        const command = message[5];
        console.log(`  -> Novation response, command: 0x${command.toString(16)}`);

        switch (command) {
          case 0x63: // Custom mode write response
            console.log('  -> Custom mode write acknowledgement');
            break;
          case 0x7F: // Success/ACK
            console.log('  -> General acknowledgement');
            break;
          case 0x7E: // Error/NAK
            console.log('  -> Error response');
            if (message.length > 6) {
              console.log(`  -> Error code: 0x${message[6].toString(16)}`);
            }
            break;
          default:
            console.log(`  -> Unknown response: ${command}`);
        }
      }
    } else {
      console.log(`[${timestamp}] MIDI:`, message.map(b => '0x' + b.toString(16)).join(' '));
    }
  });

  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✓ Ports opened, monitoring for responses...\n');

  // Prepare custom mode data
  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;
  const CUSTOM_MODE_WRITE = 0x63;

  // Simple test mode
  const customModeData = [
    // Mode name: "Test"
    0x54, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00, 0x00,

    // Fader 1: Channel 1, CC 77, Green
    0x01, 0x01, 0x01, 0x4D, 0x3C,

    // Fader 2: Channel 1, CC 78, Red
    0x01, 0x02, 0x01, 0x4E, 0x0F,
  ];

  const sysexMessage = [
    0xF0,
    ...MANUFACTURER_ID,
    DEVICE_ID,
    CUSTOM_MODE_WRITE,
    0x00,  // Slot 0
    ...customModeData,
    0xF7
  ];

  console.log('Sending custom mode SysEx...');
  console.log('Message:', sysexMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  console.log('Waiting for device response...\n');

  try {
    output.sendMessage(sysexMessage);
    console.log('✓ SysEx sent successfully');
  } catch (error) {
    console.error('Failed to send SysEx:', error);
  }

  // Wait for response
  setTimeout(() => {
    if (!responseReceived) {
      console.log('❌ No response received from device');
      console.log('This could mean:');
      console.log('  - The device doesn\'t send acknowledgements for custom modes');
      console.log('  - The SysEx format is incorrect');
      console.log('  - The device needs to be in a specific mode to accept custom data');
      console.log('  - Custom mode writing may not be supported on this firmware');
    }

    // Try a different approach - send a simpler command that might get a response
    console.log('\nTrying alternative: LED control (known to work)...');
    const ledMessage = [0xF0, 0x00, 0x20, 0x29, 0x11, 0x78, 0x29, 0x3C, 0xF7]; // Focus1 green
    output.sendMessage(ledMessage);

    setTimeout(() => {
      console.log('\nClosing ports...');
      input.closePort();
      output.closePort();
    }, 2000);

  }, 5000);

} else {
  console.log('Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out (input)');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In (output)');
}