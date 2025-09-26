#!/usr/bin/env tsx

/**
 * Simplest possible MIDI test to isolate the event handling issue
 * Tests basic MIDI message reception with minimal complexity
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('=== SIMPLE MIDI EVENT HANDLING TEST ===\n');

// Test with a simple CC message first
const testCCMessage = [0xB0, 0x10, 0x7F]; // CC 16, value 127 on channel 1

console.log('Testing basic MIDI event handling...');

const input = new midi.Input();
const output = new midi.Output();

let messageCount = 0;

console.log('\nStep 1: Setting up event handler...');

// Simplest possible event handler
input.on('message', (deltaTime, message) => {
  messageCount++;
  console.log(`🎵 MESSAGE ${messageCount}:`, message, `(${message.length} bytes)`);
  console.log('   Hex:', message.map(b => '0x' + b.toString(16)).join(' '));

  if (message[0] >= 0xB0 && message[0] <= 0xBF) {
    console.log('   -> Control Change detected');
  } else if (message[0] === 0xF0) {
    console.log('   -> SysEx detected');
  } else {
    console.log('   -> Other MIDI message');
  }
});

console.log('✓ Event handler registered');

async function runSimpleTest() {
  try {
    console.log('\nStep 2: Creating virtual port...');

    output.openVirtualPort('SimpleTest');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find the virtual port
    const inputCount = input.getPortCount();
    let testPort = -1;

    console.log('\nAvailable ports:');
    for (let i = 0; i < inputCount; i++) {
      const name = input.getPortName(i);
      console.log(`  ${i}: ${name}`);
      if (name.includes('SimpleTest')) {
        testPort = i;
      }
    }

    if (testPort < 0) {
      throw new Error('Could not find virtual port');
    }

    console.log(`\nStep 3: Connecting to port ${testPort}...`);
    input.openPort(testPort);
    console.log('✓ Connected');

    console.log('\nStep 4: Testing CC message...');
    output.sendMessage(testCCMessage);
    console.log('✓ CC message sent');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`\nCC Test Result: ${messageCount} messages received`);

    if (messageCount > 0) {
      console.log('✅ Basic MIDI working! Now testing SysEx...');

      // Test SysEx
      const simpleSysEx = [0xF0, 0x43, 0x12, 0x34, 0xF7]; // Simple 5-byte SysEx
      console.log('\nSending simple SysEx:', simpleSysEx.map(b => '0x' + b.toString(16)).join(' '));

      output.sendMessage(simpleSysEx);
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`SysEx Test Result: ${messageCount} total messages`);

      if (messageCount > 1) {
        console.log('✅ SysEx also working!');

        // Test larger SysEx (similar size to Launch Control)
        const largeSysEx = [
          0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00,
          ...Array(40).fill(0x42), // 40 bytes of data
          0xF7
        ];

        console.log(`\nSending large SysEx (${largeSysEx.length} bytes)...`);
        output.sendMessage(largeSysEx);
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`Large SysEx Result: ${messageCount} total messages`);

      } else {
        console.log('❌ SysEx not working - event handler issue');
      }

    } else {
      console.log('❌ Basic MIDI not working - fundamental event handler issue');

      // Try alternative event setup
      console.log('\nTrying alternative event handler setup...');

      input.removeAllListeners('message');

      // Set callback directly
      try {
        input.on('message', function(deltaTime, message) {
          console.log('📨 Alternative handler:', message);
        });

        console.log('Retesting with alternative handler...');
        output.sendMessage(testCCMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log('Alternative handler also failed:', error);
      }
    }

    // Cleanup
    input.closePort();
    output.closePort();

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runSimpleTest().catch(console.error);