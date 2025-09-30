#!/usr/bin/env npx tsx
/**
 * Test script to verify clean MIDI communication without garbage messages
 */

import { LaunchControlXL3 } from '../src/index.js';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend.js';

async function testCleanCommunication() {
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  console.log('🔍 Testing MIDI communication for garbage messages...\n');

  try {
    // Connect to device (includes handshake)
    console.log('1. Testing connection and handshake...');
    await device.connect();
    console.log('✅ Connected successfully\n');

    // Test reading a custom mode
    console.log('2. Testing custom mode read (should send 2 clean SysEx messages)...');
    const mode = await device.readCustomMode(0);
    console.log(`✅ Read mode "${mode.name}" with ${Object.keys(mode.controls).length} controls\n`);

    // Test switching to a template
    console.log('3. Testing template switch...');
    await device.selectTemplate(0);
    console.log('✅ Switched to template 0\n');

    // Test writing a simple custom mode
    console.log('4. Testing custom mode write...');
    const testMode = {
      name: 'Test',
      controls: {
        0: { ccNumber: 10, channel: 0, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
      }
    };
    await device.writeCustomMode(7, testMode);
    console.log('✅ Wrote test mode to slot 8\n');

    console.log('🎉 All tests completed successfully!');
    console.log('No garbage messages should have been sent.');
    console.log('\nPlease check the MIDI monitor output to verify:');
    console.log('- No "Invalid 1 bytes" messages');
    console.log('- No single-byte F0 messages');
    console.log('- All SysEx messages are properly formatted');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await device.disconnect();
  }
}

// Run the test
testCleanCommunication().catch(console.error);