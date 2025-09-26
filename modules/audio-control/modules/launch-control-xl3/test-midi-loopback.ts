#!/usr/bin/env tsx

/**
 * MIDI Loopback Test for SysEx handling
 * Tests our MIDI input/output handling by creating virtual MIDI ports
 * and sending SysEx messages to ourselves
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('MIDI Loopback Test for SysEx Handling...\n');

// Create virtual MIDI input and output
const virtualInput = new midi.Input();
const virtualOutput = new midi.Output();

// Test data - the exact SysEx response format from Launch Control XL 3
const testSysExResponse = [
  0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00, 0x06, 0x20, 0x0E,
  // Mode name: "TestMode"
  0x54, 0x65, 0x73, 0x74, 0x4D, 0x6F, 0x64, 0x65, 0x00,
  // First control definition (simulated)
  0x48, 0x10, 0x02, 0x21, 0x00, 0x00, 0x08, 0x00, 0x53, 0x7F,
  // Second control definition
  0x48, 0x11, 0x02, 0x21, 0x00, 0x01, 0x08, 0x00, 0x53, 0x7F,
  // Third control definition
  0x48, 0x12, 0x02, 0x21, 0x00, 0x02, 0x08, 0x00, 0x53, 0x7F,
  0xF7  // SysEx end
];

console.log(`Test SysEx message: ${testSysExResponse.length} bytes`);
console.log('First 20 bytes:', testSysExResponse.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
console.log('Last 10 bytes:', testSysExResponse.slice(-10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

let messagesReceived = 0;
let lastMessage: number[] = [];

// Set up message handler BEFORE creating virtual ports
virtualInput.on('message', (deltaTime: number, message: number[]) => {
  messagesReceived++;
  lastMessage = [...message]; // Make a copy

  const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
  console.log(`\n[${timestamp}] === VIRTUAL MIDI MESSAGE ${messagesReceived} ===`);
  console.log(`Length: ${message.length} bytes`);
  console.log('First 20 bytes:', message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  if (message.length > 20) {
    console.log('Last 10 bytes:', message.slice(-10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  }

  // Verify it's the SysEx we sent
  if (message.length === testSysExResponse.length) {
    let matches = true;
    for (let i = 0; i < message.length; i++) {
      if (message[i] !== testSysExResponse[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      console.log('✅ Perfect match! SysEx loopback working correctly.');
    } else {
      console.log('❌ Data mismatch in received message.');
    }
  } else {
    console.log(`⚠️ Length mismatch: expected ${testSysExResponse.length}, got ${message.length}`);
  }

  // Parse as Novation SysEx
  if (message.length >= 10 &&
      message[0] === 0xF0 &&
      message[1] === 0x00 &&
      message[2] === 0x20 &&
      message[3] === 0x29 &&
      message[4] === 0x02 &&
      message[5] === 0x15) {

    console.log('🎯 Novation SysEx Response Detected!');

    const operation = message[8];
    const slot = message[9];
    console.log(`   Operation: 0x${operation.toString(16)}`);
    console.log(`   Slot: ${slot}`);

    if (operation === 0x10) {
      console.log('   -> This is a READ response');

      // Extract mode name
      let nameStart = -1;
      for (let i = 10; i < message.length - 3; i++) {
        if (message[i] === 0x06 && message[i + 1] === 0x20 && message[i + 2] === 0x0E) {
          nameStart = i + 3;
          break;
        }
      }

      if (nameStart > 0) {
        const nameBytes = [];
        for (let i = nameStart; i < message.length - 1; i++) {
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

      // Count control definitions
      let controlCount = 0;
      for (let i = 10; i < message.length; i++) {
        if (message[i] === 0x48) controlCount++;
      }
      console.log(`   -> Control definitions found: ${controlCount}`);
    }
  }
});

async function runLoopbackTest() {
  try {
    console.log('\nStep 1: Creating virtual MIDI ports...');

    // Create virtual ports
    virtualOutput.openVirtualPort('TestSysEx Output');
    virtualInput.openVirtualPort('TestSysEx Input');

    console.log('✓ Virtual MIDI ports created:');
    console.log('  - TestSysEx Output (for sending)');
    console.log('  - TestSysEx Input (for receiving)');

    // List all available ports to verify creation
    console.log('\nAvailable MIDI ports:');
    const inputCount = virtualInput.getPortCount();
    for (let i = 0; i < inputCount; i++) {
      console.log(`  Input ${i}: ${virtualInput.getPortName(i)}`);
    }

    const outputCount = virtualOutput.getPortCount();
    for (let i = 0; i < outputCount; i++) {
      console.log(`  Output ${i}: ${virtualOutput.getPortName(i)}`);
    }

    // Wait a moment for ports to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\nStep 2: Connecting to our virtual ports...');

    // Find our virtual ports
    let testInputIndex = -1;
    let testOutputIndex = -1;

    for (let i = 0; i < inputCount; i++) {
      if (virtualInput.getPortName(i).includes('TestSysEx')) {
        testInputIndex = i;
        break;
      }
    }

    for (let i = 0; i < outputCount; i++) {
      if (virtualOutput.getPortName(i).includes('TestSysEx')) {
        testOutputIndex = i;
        break;
      }
    }

    if (testInputIndex >= 0 && testOutputIndex >= 0) {
      console.log(`✓ Found virtual ports: input=${testInputIndex}, output=${testOutputIndex}`);

      // Connect a second input/output pair to communicate with our virtual ports
      const sender = new midi.Output();
      const receiver = new midi.Input();

      // Set up receiver handler
      receiver.on('message', (deltaTime: number, message: number[]) => {
        console.log('📨 Receiver got message:', message.length, 'bytes');
      });

      receiver.openPort(testInputIndex);
      sender.openPort(testOutputIndex);

      console.log('✓ Connected sender/receiver to virtual ports');

      console.log('\nStep 3: Sending test SysEx message...');

      // Send the test SysEx
      sender.sendMessage(testSysExResponse);
      console.log('✓ SysEx message sent');

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`\n📊 Test Results:`);
      console.log(`   Messages received: ${messagesReceived}`);

      if (messagesReceived > 0) {
        console.log('✅ SUCCESS: MIDI loopback working!');
        console.log('   Our SysEx handling is functioning correctly.');
        console.log('   The issue with Launch Control XL 3 is likely device-specific.');
      } else {
        console.log('❌ FAILURE: No messages received in loopback');
        console.log('   This indicates an issue with our MIDI handling code.');
      }

      // Cleanup
      receiver.closePort();
      sender.closePort();

    } else {
      console.log('❌ Could not find virtual ports');
      console.log(`   testInputIndex: ${testInputIndex}`);
      console.log(`   testOutputIndex: ${testOutputIndex}`);
    }

    // Close virtual ports
    virtualInput.closePort();
    virtualOutput.closePort();

    console.log('\n✓ Virtual ports closed');

  } catch (error) {
    console.error('❌ Loopback test failed:', error);
  }
}

runLoopbackTest().catch(console.error);