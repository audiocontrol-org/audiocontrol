#!/usr/bin/env tsx
/**
 * Integration test using DAW port for slot selection with our library
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import { DawPortControllerImpl } from '../src/core/DawPortController.js';
import type { CustomMode } from '../src/types.js';

async function testDawPortIntegration() {
  console.log('DAW Port Integration Test');
  console.log('=========================\n');

  let device: LaunchControlXL3 | null = null;
  let backend: EasyMidiBackend | null = null;

  try {
    // Initialize MIDI backend
    backend = new EasyMidiBackend();
    await backend.initialize();

    // Open DAW port for LCXL3
    await backend.openDawPort('LCXL3');

    // Create DAW port controller
    const dawController = new DawPortControllerImpl(
      async (port: 'daw', message: number[]) => {
        await backend!.sendDawMessage('LCXL3', message);
      }
    );

    // Create device
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create test modes
    const testMode1: CustomMode = {
      name: 'DAW_SLOT_1',
      controls: [],
      colors: []
    };

    const testMode2: CustomMode = {
      name: 'DAW_SLOT_2',
      controls: [],
      colors: []
    };

    // Add minimal controls (just one encoder each)
    testMode1.controls.push({
      id: 0x10,
      type: 'encoder',
      index: 0,
      cc: 13,
      channel: 1,
      minValue: 0,
      maxValue: 127,
      color: 0
    });
    testMode1.colors.push(0);

    testMode2.controls.push({
      id: 0x10,
      type: 'encoder',
      index: 0,
      cc: 14,  // Different CC to distinguish
      channel: 1,
      minValue: 0,
      maxValue: 127,
      color: 0
    });
    testMode2.colors.push(0);

    // Test 1: Write to physical slot 1 (API slot 0)
    console.log('=== Test 1: Writing to Physical Slot 1 ===');
    console.log('→ Selecting slot 0 via DAW port (physical slot 1)...');
    await dawController.selectSlot(0);
    console.log('✓ Slot selected');

    console.log('→ Writing "DAW_SLOT_1" to slot 0...');
    await device.writeCustomMode(0, testMode1);
    console.log('✓ Write completed');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Write to physical slot 2 (API slot 1)
    console.log('\n=== Test 2: Writing to Physical Slot 2 ===');
    console.log('→ Selecting slot 1 via DAW port (physical slot 2)...');
    await dawController.selectSlot(1);
    console.log('✓ Slot selected');

    console.log('→ Writing "DAW_SLOT_2" to slot 0 (but should go to physical slot 2)...');
    // Note: We're still using slot 0 in the API call, but DAW port controls actual slot
    await device.writeCustomMode(0, testMode2);
    console.log('✓ Write completed');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Read back from slots
    console.log('\n=== Test 3: Reading Back ===');

    console.log('→ Selecting slot 0 for reading...');
    await dawController.selectSlot(0);
    const readBack1 = await device.readCustomMode(0);
    console.log(`✓ Slot 0 (physical 1): "${readBack1?.name || '<empty>'}"`);

    console.log('→ Selecting slot 1 for reading...');
    await dawController.selectSlot(1);
    const readBack2 = await device.readCustomMode(0);
    console.log(`✓ Slot 0 (physical 2 due to DAW selection): "${readBack2?.name || '<empty>'}"`);

    console.log('\n📋 Summary:');
    console.log('- DAW port CC 30 on channel 6 selects the active slot');
    console.log('- Value = physical slot + 5 (slot 1 = 6, slot 2 = 7)');
    console.log('- SysEx slot byte can remain 0x00');
    console.log('- This matches the web editor behavior exactly');

    console.log('\n🔍 Please verify on device:');
    console.log('   - Physical slot 1 should show "DAW_SLOT_1"');
    console.log('   - Physical slot 2 should show "DAW_SLOT_2"');

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  } finally {
    if (device) {
      console.log('\n→ Disconnecting...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
    if (backend) {
      await backend.cleanup();
    }
  }
}

// Run the test
testDawPortIntegration().catch(console.error);