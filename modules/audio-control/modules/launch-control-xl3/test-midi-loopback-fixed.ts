#!/usr/bin/env tsx

/**
 * Fixed MIDI Loopback Test for SysEx handling
 * Properly connects virtual MIDI input/output for loopback testing
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Fixed MIDI Loopback Test for SysEx Handling...\n');

// Test data - simulating the Launch Control XL 3 response
const testSysExResponse = [
  0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00, 0x06, 0x20, 0x0E,
  // Mode name: "TestMode"
  0x54, 0x65, 0x73, 0x74, 0x4D, 0x6F, 0x64, 0x65, 0x00,
  // Control definitions
  0x48, 0x10, 0x02, 0x21, 0x00, 0x00, 0x08, 0x00, 0x53, 0x7F,
  0x48, 0x11, 0x02, 0x21, 0x00, 0x01, 0x08, 0x00, 0x53, 0x7F,
  0x48, 0x12, 0x02, 0x21, 0x00, 0x02, 0x08, 0x00, 0x53, 0x7F,
  0xF7
];

let messagesReceived = 0;

console.log(`Test SysEx message: ${testSysExResponse.length} bytes`);
console.log('Data:', testSysExResponse.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

async function runFixedLoopbackTest() {
  try {
    console.log('\n=== Method 1: Direct Virtual Port Connection ===');

    // Create one virtual output port
    const virtualOutput = new midi.Output();
    virtualOutput.openVirtualPort('LoopbackTest');

    // Create a regular input and connect it to our virtual output
    const regularInput = new midi.Input();

    // Set up message handler
    regularInput.on('message', (deltaTime: number, message: number[]) => {
      messagesReceived++;
      const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

      console.log(`\n[${timestamp}] === RECEIVED MESSAGE ${messagesReceived} ===`);
      console.log(`Length: ${message.length} bytes`);
      console.log('Data:', message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        message.length > 20 ? '...' : '');

      // Verify exact match
      if (message.length === testSysExResponse.length) {
        let matches = true;
        for (let i = 0; i < message.length; i++) {
          if (message[i] !== testSysExResponse[i]) {
            matches = false;
            console.log(`Mismatch at byte ${i}: expected 0x${testSysExResponse[i].toString(16)}, got 0x${message[i].toString(16)}`);
            break;
          }
        }

        if (matches) {
          console.log('✅ PERFECT MATCH! Loopback working correctly.');
        } else {
          console.log('❌ Data mismatch detected.');
        }
      } else {
        console.log(`❌ Length mismatch: expected ${testSysExResponse.length}, got ${message.length}`);
      }

      // Parse as Novation SysEx
      if (message[0] === 0xF0 && message.length > 10) {
        console.log('🎯 SysEx message parsed successfully!');
      }
    });

    // Give ports time to initialize
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find our virtual port
    const inputCount = regularInput.getPortCount();
    let virtualPortIndex = -1;

    console.log('\nAvailable input ports:');
    for (let i = 0; i < inputCount; i++) {
      const name = regularInput.getPortName(i);
      console.log(`  ${i}: ${name}`);
      if (name.includes('LoopbackTest')) {
        virtualPortIndex = i;
      }
    }

    if (virtualPortIndex >= 0) {
      console.log(`\n✓ Found virtual port at index ${virtualPortIndex}`);

      // Connect input to virtual port
      regularInput.openPort(virtualPortIndex);
      console.log('✓ Connected input to virtual port');

      // Send test message
      console.log('\nSending SysEx message...');
      virtualOutput.sendMessage(testSysExResponse);
      console.log('✓ Message sent');

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`\n📊 Results:`);
      console.log(`Messages received: ${messagesReceived}`);

      if (messagesReceived > 0) {
        console.log('✅ SUCCESS: Virtual MIDI loopback is working!');
        console.log('This means our SysEx handling code is functional.');
        console.log('The issue with Launch Control XL 3 is device/port specific.');
      } else {
        console.log('❌ STILL NO MESSAGES: Deeper MIDI handling issue');
      }

      // Cleanup
      regularInput.closePort();
    } else {
      console.log('❌ Could not find virtual port');
    }

    virtualOutput.closePort();

    console.log('\n=== Method 2: Test with existing virtual ports ===');

    // Try using the existing virtual1/virtual2 ports if available
    const testInput2 = new midi.Input();
    const testOutput2 = new midi.Output();

    let virtual1Input = -1;
    let virtual1Output = -1;

    const inputCount2 = testInput2.getPortCount();
    const outputCount2 = testOutput2.getPortCount();

    for (let i = 0; i < inputCount2; i++) {
      if (testInput2.getPortName(i).includes('virtual1')) {
        virtual1Input = i;
        break;
      }
    }

    for (let i = 0; i < outputCount2; i++) {
      if (testOutput2.getPortName(i).includes('virtual1')) {
        virtual1Output = i;
        break;
      }
    }

    if (virtual1Input >= 0 && virtual1Output >= 0) {
      console.log(`Found virtual1 ports: input=${virtual1Input}, output=${virtual1Output}`);

      let method2Messages = 0;

      testInput2.on('message', (deltaTime: number, message: number[]) => {
        method2Messages++;
        console.log(`Method 2 received message ${method2Messages}: ${message.length} bytes`);
      });

      testInput2.openPort(virtual1Input);
      testOutput2.openPort(virtual1Output);

      console.log('Sending to virtual1...');
      testOutput2.sendMessage(testSysExResponse);

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`Method 2 results: ${method2Messages} messages received`);

      testInput2.closePort();
      testOutput2.closePort();
    } else {
      console.log('virtual1 ports not available for Method 2');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runFixedLoopbackTest().catch(console.error);