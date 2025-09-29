#!/usr/bin/env tsx
/**
 * Minimal test to reproduce CC 120 flooding issue
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';

async function testWrite() {
  console.log('Minimal Write Test - Monitoring CC 120 Issue');
  console.log('============================================\n');
  console.log('This test will write a simple custom mode and observe device response.\n');
  console.log('Run midi-monitor.ts in another terminal to capture traffic.\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Initialize backend
    const backend = new EasyMidiBackend();
    await backend.initialize();

    // Create device with initialized backend
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,  // Disable LED control to isolate issue
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create a minimal custom mode
    const testMode = {
      name: 'TestCC120',
      controls: [
        {
          controlId: 0x0d,  // First encoder
          name: 'Volume1',
          cc: 13,
          channel: 0
        }
      ]
    };

    console.log('→ Writing custom mode to slot 0...');
    console.log('  Mode:', JSON.stringify(testMode, null, 2));

    await device.writeCustomMode(0, testMode);

    console.log('✓ Write completed\n');
    console.log('⚠️  Check MIDI monitor for CC 120 messages from device\n');

    // Wait a bit to observe any delayed responses
    console.log('→ Waiting 5 seconds to observe device response...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n✓ Test completed');

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (device) {
      console.log('\n→ Disconnecting (without cleanup to avoid extra messages)...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
  }
}

// Run the test
testWrite().catch(console.error);