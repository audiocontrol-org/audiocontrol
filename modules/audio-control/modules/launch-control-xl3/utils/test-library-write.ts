#!/usr/bin/env npx tsx
/**
 * Test Library Write Operation
 *
 * Tests the fixed encodeName method by writing a mode to the device
 * while MIDI spy captures the traffic. This verifies the fix matches
 * the web editor format.
 */

import { LaunchControlXL3, CustomModeBuilder } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';

async function testLibraryWrite() {
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    console.log('🔌 Connecting to device...');
    await device.connect();

    console.log('🏗️  Building test mode with name "CHANTEST"...');

    // Create a simple mode with name "CHANTEST" (same as web editor test)
    const builder = new CustomModeBuilder().name('CHANTEST');

    // Add a few basic controls for completeness
    builder
      .addEncoder(1, 1, { cc: 13, channel: 1 })
      .addEncoderLabel(1, 1, 'TEST1')
      .addEncoder(1, 4, { cc: 17, channel: 1 })
      .addEncoderLabel(1, 4, 'Low Pass');

    const testMode = builder.build();

    console.log('📤 Writing mode to device slot 0...');
    console.log('   Mode name: "CHANTEST"');
    console.log('   (MIDI spy should capture traffic now)');

    await device.writeCustomMode(0, testMode);

    console.log('✅ Write operation completed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Check MIDI spy output for SysEx message');
    console.log('   2. Look for: F0 00 20 29 02 15 05 00 45 00 00 20 08 43 48 41 4E 54 45 53 54');
    console.log('   3. Compare with web editor format');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await device.disconnect();
  }
}

// Run test
testLibraryWrite().catch(console.error);
