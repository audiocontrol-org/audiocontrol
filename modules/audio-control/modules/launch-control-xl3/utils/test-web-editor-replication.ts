#!/usr/bin/env npx tsx
/**
 * Test Web Editor Replication
 *
 * This script recreates the exact custom mode that the web editor sent
 * to validate our library implementation matches the known-good protocol.
 */

import { LaunchControlXL3, CustomModeBuilder, Color } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';

function createWebEditorMode() {
  console.log('🔍 Recreating "New Custom Mode" from web editor capture...');

  // Based on the captured protocol, the web editor sent:
  // Mode name: "New Custom Mode"
  // Controls with CCs 0x0D through 0x24 (13-36)
  // Control types: 0x05, 0x09, 0x0D for different rows
  // Control IDs: 0x10-0x27 (16-39)

  const builder = new CustomModeBuilder().name('NCM'); // 8 char limit

  // Row 1 - Top Encoders (CC 13-20, Type 0x05)
  for (let i = 1; i <= 8; i++) {
    builder.addEncoder(1, i, { cc: 12 + i, channel: 1 }); // CC 13-20
  }

  // Row 2 - Middle Encoders (CC 21-28, Type 0x09)
  for (let i = 1; i <= 8; i++) {
    builder.addEncoder(2, i, { cc: 20 + i, channel: 1 }); // CC 21-28
  }

  // Row 3 - Bottom Encoders (CC 29-36, Type 0x0D)
  for (let i = 1; i <= 8; i++) {
    builder.addEncoder(3, i, { cc: 28 + i, channel: 1 }); // CC 29-36
  }

  return builder.build();
}

async function testWebEditorReplication() {
  console.log('=== Web Editor Protocol Validation Test ===\n');

  const targetSlot = 0; // API slot 0 = physical slot 1

  // Create device with JUCE backend
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    console.log('🔧 Initializing JUCE backend...');
    await backend.initialize();

    console.log('🔌 Connecting to Launch Control XL3...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create the web editor mode
    const webEditorMode = createWebEditorMode();
    console.log(`📝 Created mode: "${webEditorMode.name}"`);
    console.log(`   Controls: ${Object.keys(webEditorMode.controls).length}`);
    console.log(`   Target: API slot ${targetSlot} (physical slot ${targetSlot + 1})\n`);

    // Show sample of controls being written
    console.log('📋 Sample controls to write:');
    const sampleControls = Object.entries(webEditorMode.controls).slice(0, 5);
    for (const [id, control] of sampleControls) {
      console.log(`  ${id}: CC${control.ccNumber} (CH${control.midiChannel + 1}, Type${control.controlType.toString(16)})`);
    }
    console.log(`  ... and ${Object.keys(webEditorMode.controls).length - 5} more\n`);

    console.log('💾 Writing to device...');
    console.log('⚠️  MIDI monitor should capture this communication for comparison!');

    await device.writeCustomMode(targetSlot, webEditorMode);

    console.log('✅ Write operation completed!');
    console.log(`\n🎯 Expected Result: Mode "${webEditorMode.name}" should be in physical slot ${targetSlot + 1}`);
    console.log('📝 Please check the device display to confirm the mode was written correctly.');
    console.log('🔍 Check the MIDI monitor output to compare with the web editor capture.');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    console.log('\n🧹 Cleaning up...');
    await device.disconnect();
    await backend.close();
    console.log('✓ Done');
  }
}

// Run the test
testWebEditorReplication().catch(console.error);