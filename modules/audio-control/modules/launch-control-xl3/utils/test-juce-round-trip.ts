#!/usr/bin/env npx tsx
/**
 * Round-trip test using JUCE HTTP backend
 * Tests writing and reading back data to/from physical slots
 */

import { LaunchControlXL3 } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';
import { ControlType, ControlBehavior } from '../src/types';

async function runRoundTrip() {
  console.log('=== JUCE Backend Round-Trip Test ===\n');

  // Create device with JUCE backend
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    // Initialize backend
    console.log('Initializing JUCE backend...');
    await backend.initialize();

    // Connect to device
    console.log('Connecting to Launch Control XL3...');
    await device.connect();
    console.log('✓ Connected\n');

    // Perform handshake
    console.log('Performing handshake...');
    const info = await device.handshake();
    console.log(`✓ Device: ${info.manufacturer} ${info.product}`);
    console.log(`  Serial: ${info.serialNumber}`);
    console.log(`  Version: ${info.firmwareVersion}\n`);

    // Test slot 1 (physical slot 1)
    const physicalSlot = 1;
    const testName = `JUCE_RT_${Date.now()}`;

    console.log(`Testing Physical Slot ${physicalSlot}:`);
    console.log(`Writing "${testName}"...\n`);

    // Create configuration
    const config = {
      header: {
        productId: 0x1520, // LCXL3 product ID
        configFlags: 0x102A, // Standard flags
        name: testName
      },
      controls: {}
    };

    // Add all 48 controls with unique CC values
    // Generate controls for each row
    const controlIds = [
      // Row 1 - Knobs
      ...Array.from({ length: 8 }, (_, i) => `knob1_${i + 1}`),
      // Row 2 - Knobs
      ...Array.from({ length: 8 }, (_, i) => `knob2_${i + 1}`),
      // Row 3 - Knobs
      ...Array.from({ length: 8 }, (_, i) => `knob3_${i + 1}`),
      // Row 4 - Faders
      ...Array.from({ length: 8 }, (_, i) => `fader_${i + 1}`),
      // Buttons
      ...Array.from({ length: 8 }, (_, i) => `button1_${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `button2_${i + 1}`)
    ];

    let ccValue = 0;
    for (const id of controlIds) {
      const isKnob = id.startsWith('knob');
      const isFader = id.startsWith('fader');
      const isButton = id.startsWith('button');

      config.controls[id] = {
        type: isKnob ? 'knob' : isFader ? 'fader' : 'button',
        channel: 0,
        behavior: isButton ? 'toggle' : 'absolute',
        midiType: isButton ? 'note' : 'cc',
        note: isButton ? 60 + ccValue : undefined,
        cc: !isButton ? ccValue : undefined,
        min: 0,
        max: 127,
        color: 'off'
      } as any;
      ccValue++;
    }

    // Write configuration
    await device.writeSlot(physicalSlot, config);
    console.log('✓ Configuration written\n');

    // Add delay to ensure write completes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Read back configuration
    console.log('Reading back from device...');
    const readConfig = await device.readSlot(physicalSlot);
    console.log(`✓ Read name: "${readConfig.header.name}"\n`);

    // Verify
    if (readConfig.header.name === testName) {
      console.log('✅ SUCCESS - Round-trip verified!');
      console.log(`   Written: "${testName}"`);
      console.log(`   Read:    "${readConfig.header.name}"`);
    } else {
      console.log('❌ FAILURE - Data mismatch!');
      console.log(`   Written: "${testName}"`);
      console.log(`   Read:    "${readConfig.header.name}"`);
    }

    // Verify control count
    const controlCount = Object.keys(readConfig.controls).length;
    console.log(`\n✓ Controls read: ${controlCount}/48`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up
    console.log('\nDisconnecting...');
    await device.disconnect();
    await backend.close();
    console.log('✓ Done');
  }
}

// Run the test
runRoundTrip().catch(console.error);