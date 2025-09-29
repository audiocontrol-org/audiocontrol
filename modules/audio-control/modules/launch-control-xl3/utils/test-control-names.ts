#!/usr/bin/env tsx
/**
 * Test script to verify control name extraction from device
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';

async function testControlNames() {
  console.log('Launch Control XL 3 - Control Names Test');
  console.log('========================================\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Create backend
    const backend = new EasyMidiBackend();
    console.log('→ Initializing MIDI backend...');
    await backend.initialize();
    console.log('✓ Backend initialized\n');

    // Create device instance with initialized backend
    device = new LaunchControlXL3({ midiBackend: backend });

    // Connect to device
    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected successfully\n');

    // Read custom modes and check for control names
    console.log('→ Reading custom modes to check control names...\n');

    for (let slot = 1; slot <= 8; slot++) {
      try {
        console.log(`\nSlot ${slot}:`);
        console.log('--------');
        const mode = await device.readCustomMode(slot);

        if (mode) {
          console.log(`Mode Name: ${mode.name || '(unnamed)'}`);
          console.log(`Controls: ${mode.controls?.length || 0}`);

          // Check if any controls have names
          const namedControls = mode.controls?.filter(c => c.name) || [];
          console.log(`Named Controls: ${namedControls.length}`);

          if (namedControls.length > 0) {
            console.log('\nControl Names Found:');
            namedControls.forEach(control => {
              console.log(`  - Control ${control.controlId?.toString(16).padStart(2, '0')}: "${control.name}"`);
            });
          } else {
            console.log('  (No control names found)');
          }
        }
      } catch (error) {
        console.log(`  Error reading slot ${slot}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n✓ Control name test completed');

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
    console.error('\nFull error:', error);
  } finally {
    // Cleanup
    if (device) {
      console.log('\n→ Cleaning up...');
      await device.cleanup();
      console.log('✓ Cleanup complete');
    }
  }
}

// Run the test
testControlNames().catch(console.error);