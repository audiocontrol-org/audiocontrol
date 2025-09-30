#!/usr/bin/env npx tsx

/**
 * Focused round-trip test for physical slot 1 (API slot 0)
 * Verifies that data written to slot 0 can be read back correctly
 */

import { LaunchControlXL3 } from '../src/LaunchControlXL3.js';
import { CustomMode } from '../src/types/CustomMode.js';
import { ControlChange } from '../src/types/ControlChange.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';

async function testSlot0RoundTrip(): Promise<void> {
  console.log('Physical Slot 1 (API Slot 0) Round-Trip Test');
  console.log('=============================================\n');

  const backend = new EasyMidiBackend();
  const device = new LaunchControlXL3({
    midiBackend: backend,
    enableLedControl: false,
    enableCustomModes: true
  });

  try {
    // Connect to device
    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create a unique test mode with specific values
    const testMode: CustomMode = {
      name: 'SLOT0_TEST_MODE',
      controls: [],
      colors: [] // Initialize colors array
    };

    // Create 48 controls with unique, verifiable values
    for (let i = 0; i < 48; i++) {
      const control: ControlChange = {
        name: `TEST_CTRL_${i}`,
        type: i < 8 ? 'encoder' : i < 24 ? 'fader' : 'button',
        channel: i % 16, // Channels 0-15 (0-based)
        cc: 20 + i, // CC 20-67
        minValue: 0,
        maxValue: 127,
        defaultValue: i, // Use index as default value for easy verification
        color: i % 4 // Cycle through 4 colors
      };
      testMode.controls.push(control);

      // Also add to colors array (for button LEDs)
      testMode.colors.push(i % 4);
    }

    console.log('Test Mode Configuration:');
    console.log('========================');
    console.log(`Name: ${testMode.name}`);
    console.log(`Controls: ${testMode.controls.length}`);
    console.log(`First control: ${testMode.controls[0].name} (CC ${testMode.controls[0].cc}, Channel ${testMode.controls[0].channel + 1})`);
    console.log(`Last control: ${testMode.controls[47].name} (CC ${testMode.controls[47].cc}, Channel ${testMode.controls[47].channel + 1})`);
    console.log();

    // Write to slot 0
    console.log('→ Writing custom mode to slot 0...');
    await device.writeCustomMode(0, testMode);
    console.log('✓ Write completed\n');

    // Wait a bit for device to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Read back from slot 0
    console.log('→ Reading back from slot 0...');
    const readMode = await device.readCustomMode(0);
    console.log('✓ Read successful\n');

    // Detailed verification
    console.log('Verification:');
    console.log('-------------');

    let allMatch = true;

    // Check name
    const nameMatch = readMode.name === testMode.name;
    console.log(`Name: ${nameMatch ? '✓' : '✗'} "${readMode.name}" ${nameMatch ? '==' : '!='} "${testMode.name}"`);
    if (!nameMatch) allMatch = false;

    // Check control count
    const countMatch = readMode.controls.length === testMode.controls.length;
    console.log(`Control count: ${countMatch ? '✓' : '✗'} ${readMode.controls.length} ${countMatch ? '==' : '!='} ${testMode.controls.length}`);
    if (!countMatch) allMatch = false;

    // Check each control in detail
    let mismatchCount = 0;
    const maxToShow = 5;
    for (let i = 0; i < Math.min(readMode.controls.length, testMode.controls.length); i++) {
      const readCtrl = readMode.controls[i];
      const testCtrl = testMode.controls[i];

      const match =
        readCtrl.name === testCtrl.name &&
        readCtrl.cc === testCtrl.cc &&
        readCtrl.channel === testCtrl.channel &&
        readCtrl.type === testCtrl.type &&
        (readCtrl.defaultValue ?? readCtrl.value) === testCtrl.defaultValue &&
        readCtrl.color === testCtrl.color;

      if (!match) {
        mismatchCount++;
        if (mismatchCount <= maxToShow) {
          console.log(`\nControl ${i}: ✗`);
          console.log(`  Name: "${readCtrl.name}" vs "${testCtrl.name}"`);
          console.log(`  CC: ${readCtrl.cc} vs ${testCtrl.cc}`);
          console.log(`  Channel: ${readCtrl.channel} vs ${testCtrl.channel}`);
          console.log(`  Type: ${readCtrl.type} vs ${testCtrl.type}`);
          console.log(`  Default: ${readCtrl.defaultValue ?? readCtrl.value} vs ${testCtrl.defaultValue}`);
          console.log(`  Color: ${readCtrl.color} vs ${testCtrl.color}`);
        }
        allMatch = false;
      }
    }

    if (mismatchCount > maxToShow) {
      console.log(`\n... and ${mismatchCount - maxToShow} more mismatches`);
    }

    if (mismatchCount === 0 && readMode.controls.length === testMode.controls.length) {
      console.log('\n✓ All 48 controls match perfectly!');
    }

    // Final result
    console.log('\n' + '='.repeat(50));
    if (allMatch) {
      console.log('✅ SUCCESS: Physical Slot 1 Round-Trip Test PASSED');
      console.log('Data written to slot 0 was read back correctly!');
    } else {
      console.log('❌ FAILURE: Physical Slot 1 Round-Trip Test FAILED');
      console.log('Data read from slot 0 does not match what was written.');

      // Debug: Show raw data sizes if available
      if ((readMode as any).rawData && (testMode as any).rawData) {
        console.log(`\nDebug: Raw data size - Read: ${(readMode as any).rawData.length}, Expected: ~600 bytes`);
      }
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    console.log('\n→ Disconnecting...');
    await device.disconnect();
    console.log('✓ Disconnected');
  }
}

// Run the test
testSlot0RoundTrip().catch(console.error);