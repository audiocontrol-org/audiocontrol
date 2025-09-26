#!/usr/bin/env tsx

/**
 * Test various solutions for SysEx handling in node-midi
 * Investigate common issues and workarounds
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('=== SYSEX HANDLING SOLUTIONS TEST ===\n');

async function testSysExSolutions() {
  console.log('Testing different approaches to SysEx handling...\n');

  // Test data
  const simpleSysEx = [0xF0, 0x43, 0x12, 0x34, 0xF7];
  const mediumSysEx = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00, 0x01, 0x02, 0x03, 0xF7];
  const largeSysEx = [
    0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00,
    ...Array(50).fill(0x42),
    0xF7
  ];

  const testMessages = [
    { name: 'Simple SysEx (5 bytes)', data: simpleSysEx },
    { name: 'Medium SysEx (14 bytes)', data: mediumSysEx },
    { name: 'Large SysEx (61 bytes)', data: largeSysEx }
  ];

  console.log('=== SOLUTION 1: Check node-midi version and capabilities ===');

  try {
    // Check if we can access version info
    console.log('node-midi library loaded successfully');

    // Create instances
    const input = new midi.Input();
    const output = new midi.Output();

    console.log(`Available input ports: ${input.getPortCount()}`);
    console.log(`Available output ports: ${output.getPortCount()}`);

    // Check for any SysEx-related configuration options
    console.log('Input properties:', Object.getOwnPropertyNames(input));
    console.log('Output properties:', Object.getOwnPropertyNames(output));

  } catch (error) {
    console.error('Failed to inspect node-midi:', error);
  }

  console.log('\n=== SOLUTION 2: Test with ignoreTypes disabled ===');

  try {
    const input = new midi.Input();
    const output = new midi.Output();

    // Try to disable ignoreTypes if it exists
    if (typeof input.ignoreTypes === 'function') {
      console.log('Found ignoreTypes - disabling all filters...');
      input.ignoreTypes(false, false, false); // Don't ignore SysEx, timing, active sensing
    } else {
      console.log('ignoreTypes not found - may not be available');
    }

    let receivedCount = 0;

    input.on('message', (deltaTime, message) => {
      receivedCount++;
      console.log(`📨 Received ${receivedCount}: ${message.length} bytes -`,
        message.slice(0, 10).map(b => '0x' + b.toString(16)).join(' '));
    });

    output.openVirtualPort('SysExTest2');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and connect
    const inputCount = input.getPortCount();
    let testPort = -1;
    for (let i = 0; i < inputCount; i++) {
      if (input.getPortName(i).includes('SysExTest2')) {
        testPort = i;
        break;
      }
    }

    if (testPort >= 0) {
      input.openPort(testPort);
      console.log(`Connected to port ${testPort}`);

      // Test CC first (baseline)
      console.log('\nTesting CC message (baseline)...');
      output.sendMessage([0xB0, 0x10, 0x7F]);
      await new Promise(resolve => setTimeout(resolve, 500));

      const ccReceived = receivedCount;
      console.log(`CC messages received: ${ccReceived}`);

      // Test each SysEx message
      for (const test of testMessages) {
        console.log(`\nTesting ${test.name}...`);
        const beforeCount = receivedCount;

        output.sendMessage(test.data);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const afterCount = receivedCount;
        const received = afterCount - beforeCount;

        console.log(`${test.name} result: ${received} messages received`);

        if (received > 0) {
          console.log('✅ This SysEx size works!');
        } else {
          console.log('❌ This SysEx size failed');
        }
      }

      input.closePort();
    } else {
      console.log('Could not find test port');
    }

    output.closePort();

  } catch (error) {
    console.error('Solution 2 failed:', error);
  }

  console.log('\n=== SOLUTION 3: Test with different MIDI library options ===');

  try {
    // Try creating input with different options
    const input = new midi.Input();
    const output = new midi.Output();

    // Check if there are constructor options
    console.log('Testing different input configurations...');

    let methodsFound = [];
    for (const prop in input) {
      if (typeof input[prop] === 'function') {
        methodsFound.push(prop);
      }
    }
    console.log('Available methods:', methodsFound);

    // Try any available configuration methods
    if (input.ignoreTypes) {
      try {
        input.ignoreTypes(false, false, false);
        console.log('✓ Configured ignoreTypes');
      } catch (e) {
        console.log('Failed to configure ignoreTypes:', e.message);
      }
    }

    if (input.setCallback) {
      try {
        let callbackCount = 0;
        input.setCallback((deltaTime, message) => {
          callbackCount++;
          console.log(`Callback ${callbackCount}:`, message);
        });
        console.log('✓ Set callback directly');
      } catch (e) {
        console.log('Failed to set callback:', e.message);
      }
    }

  } catch (error) {
    console.error('Solution 3 failed:', error);
  }

  console.log('\n=== SOLUTION 4: Test with Launch Control XL 3 directly ===');

  try {
    const input = new midi.Input();
    const output = new midi.Output();

    // Try to use the actual Launch Control XL 3 ports
    let lcxl3InputIndex = -1;
    let lcxl3OutputIndex = -1;

    const inputCount = input.getPortCount();
    const outputCount = output.getPortCount();

    for (let i = 0; i < inputCount; i++) {
      if (input.getPortName(i) === 'LCXL3 1 MIDI Out') {
        lcxl3InputIndex = i;
        break;
      }
    }

    for (let i = 0; i < outputCount; i++) {
      if (output.getPortName(i) === 'LCXL3 1 MIDI In') {
        lcxl3OutputIndex = i;
        break;
      }
    }

    if (lcxl3InputIndex >= 0 && lcxl3OutputIndex >= 0) {
      console.log(`Found LCXL3: input=${lcxl3InputIndex}, output=${lcxl3OutputIndex}`);

      let lcxlMessages = 0;

      // Configure for SysEx
      if (input.ignoreTypes) {
        input.ignoreTypes(false, false, false);
      }

      input.on('message', (deltaTime, message) => {
        lcxlMessages++;
        console.log(`🎛️ LCXL3 Message ${lcxlMessages}:`, message.length, 'bytes');
        console.log('   Data:', message.slice(0, 15).map(b => '0x' + b.toString(16)).join(' '), '...');

        if (message[0] === 0xF0) {
          console.log('   ✅ SysEx received from actual device!');
        }
      });

      input.openPort(lcxl3InputIndex);
      output.openPort(lcxl3OutputIndex);

      console.log('Connected to actual LCXL3, sending read request...');

      // Send the corrected read request
      const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];
      output.sendMessage(readRequest);

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`LCXL3 Test Result: ${lcxlMessages} messages received`);

      if (lcxlMessages > 0) {
        console.log('✅ SUCCESS! SysEx working with actual device!');
      } else {
        console.log('❌ No SysEx received from actual device');
      }

      input.closePort();
      output.closePort();

    } else {
      console.log('LCXL3 not available for direct test');
    }

  } catch (error) {
    console.error('Solution 4 failed:', error);
  }

  console.log('\n=== TEST SUMMARY ===');
  console.log('This test should help identify the specific SysEx handling issue.');
}

testSysExSolutions().catch(console.error);