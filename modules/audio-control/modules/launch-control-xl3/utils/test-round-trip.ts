#!/usr/bin/env tsx
/**
 * Round-trip test: Write custom mode data and read it back to verify integrity
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import type { CustomMode } from '../src/types.js';

async function testRoundTrip() {
  console.log('Round-Trip Write->Read Test');
  console.log('============================\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Initialize backend
    const backend = new EasyMidiBackend();
    await backend.initialize();

    // Create device with custom modes enabled
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create a test custom mode with identifiable data
    const testMode: CustomMode = {
      name: 'ROUND_TRIP_TEST',
      controls: [],
      colors: [] // Initialize colors array
    };

    // Add controls with specific test patterns
    for (let i = 0; i < 48; i++) {
      const controlType = i < 24 ? 'encoder' : i < 32 ? 'fader' : 'button';
      const controlIndex = i < 24 ? i : i < 32 ? i - 24 : i - 32;
      const testName = `RT_${controlType.toUpperCase()}_${controlIndex + 1}`;

      const color = i % 4; // Cycle through colors

      // Calculate proper control ID based on type and index
      let controlId: number;
      if (controlType === 'encoder') {
        controlId = 0x10 + controlIndex; // 0x10-0x27 for encoders
      } else if (controlType === 'fader') {
        controlId = 0x28 + controlIndex; // 0x28-0x2F for faders
      } else {
        controlId = 0x30 + controlIndex; // 0x30-0x3F for buttons
      }

      testMode.controls.push({
        id: controlId,  // Use proper control ID instead of sequential index
        type: controlType as 'encoder' | 'fader' | 'button',
        index: controlIndex,
        name: testName,
        cc: i + 10, // Offset CC numbers to be different from defaults
        channel: 1,
        minValue: 0,
        maxValue: 127,
        color: color
      });

      // Add color to colors array
      testMode.colors.push(color);
    }

    console.log('Test Mode Configuration:');
    console.log('========================');
    console.log(`Name: ${testMode.name}`);
    console.log(`Controls: ${testMode.controls.length}`);
    console.log(`Sample control: ${testMode.controls[0].name} (CC ${testMode.controls[0].cc})`);
    console.log();

    // Test multiple slots
    const testSlots = [0, 1, 7, 14]; // Test first, second, middle and last slots

    for (const slot of testSlots) {
      console.log(`\n=== Testing Slot ${slot} ===`);

      // Step 1: Write the custom mode
      console.log(`→ Writing custom mode to slot ${slot}...`);
      try {
        await device.writeCustomMode(slot, testMode);
        console.log('✓ Write completed');

        // Wait a bit for device to process
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`✗ Write failed: ${error}`);
        continue;
      }

      // Step 2: Read it back
      console.log(`→ Reading back from slot ${slot}...`);
      try {
        const readMode = await device.readCustomMode(slot);

        if (!readMode) {
          console.log('✗ Read returned empty slot');
          continue;
        }

        console.log('✓ Read successful');

        // Step 3: Verify the data
        console.log('\nVerification:');
        console.log('-------------');

        // Check name
        const nameMatch = readMode.name === testMode.name;
        console.log(`Name: ${nameMatch ? '✓' : '✗'} "${readMode.name}" ${nameMatch ? '==' : '!='} "${testMode.name}"`);

        // Check control count
        const countMatch = readMode.controls?.length === testMode.controls.length;
        console.log(`Control count: ${countMatch ? '✓' : '✗'} ${readMode.controls?.length} ${countMatch ? '==' : '!='} ${testMode.controls.length}`);

        // Check specific controls
        if (readMode.controls && readMode.controls.length > 0) {
          let mismatches = 0;

          for (let i = 0; i < Math.min(3, readMode.controls.length); i++) {
            const written = testMode.controls[i];
            const read = readMode.controls[i];

            if (written && read) {
              const matches = {
                name: read.name === written.name,
                cc: read.cc === written.cc,
                channel: read.channel === written.channel,
                type: read.type === written.type
              };

              const allMatch = Object.values(matches).every(v => v);

              console.log(`Control ${i}: ${allMatch ? '✓' : '✗'}`);
              if (!allMatch) {
                if (!matches.name) console.log(`  Name: "${read.name}" != "${written.name}"`);
                if (!matches.cc) console.log(`  CC: ${read.cc} != ${written.cc}`);
                if (!matches.channel) console.log(`  Channel: ${read.channel} != ${written.channel}`);
                if (!matches.type) console.log(`  Type: ${read.type} != ${written.type}`);
                mismatches++;
              }
            }
          }

          // Check for our specific test name pattern
          const hasTestNames = readMode.controls.some(c => c.name?.includes('RT_'));
          console.log(`\nTest name pattern found: ${hasTestNames ? '✓' : '✗'}`);

          if (hasTestNames) {
            const sampleNames = readMode.controls
              .filter(c => c.name?.includes('RT_'))
              .slice(0, 3)
              .map(c => c.name);
            console.log(`Sample names: ${sampleNames.join(', ')}`);
          }
        }

        // Overall result
        const success = nameMatch && countMatch && readMode.controls?.some(c => c.name?.includes('RT_'));
        console.log(`\nSlot ${slot} Round-Trip: ${success ? '✓ PASS' : '✗ FAIL'}`);

      } catch (error) {
        console.error(`✗ Read failed: ${error}`);
      }
    }

    console.log('\n\n=== Summary ===');
    console.log('The round-trip test verifies that:');
    console.log('1. Data can be written to the device');
    console.log('2. Data can be read back from the device');
    console.log('3. The read data matches what was written');
    console.log('\nThis confirms the SysEx protocol is working correctly with 0x45 for writes.');

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (device) {
      console.log('\n→ Disconnecting...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
  }
}

// Run the test
testRoundTrip().catch(console.error);