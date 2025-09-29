#!/usr/bin/env tsx
/**
 * Test write with corrected protocol (0x10 instead of 0x45)
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import { SysExParser } from '../src/core/SysExParser.js';

async function testFixedWrite() {
  console.log('Testing Fixed Write Protocol');
  console.log('============================\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Initialize backend
    const backend = new EasyMidiBackend();
    await backend.initialize();

    // Create device
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,
      enableCustomModes: false
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create test mode with minimal data
    const testMode = {
      name: 'FixTest',
      controls: [
        { controlId: 0x10, name: 'FixedVol1', cc: 13, channel: 0 }
      ],
      colors: [
        { controlId: 0x10, color: 0x0F }
      ]
    };

    console.log('→ Generating SysEx with our parser (for comparison)...');
    const originalMessage = SysExParser.buildCustomModeWriteRequest(1, testMode);
    console.log(`Original (0x45): ${originalMessage.slice(0, 12).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')} ... [${originalMessage.length} bytes total]`);

    console.log('\n→ Creating modified message with 0x10 instead of 0x45...');
    const modifiedMessage = [...originalMessage];
    modifiedMessage[8] = 0x10; // Change from 0x45 to 0x10
    console.log(`Modified (0x10): ${modifiedMessage.slice(0, 12).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')} ... [${modifiedMessage.length} bytes total]`);

    console.log('\n→ Sending modified message to slot 1...');
    try {
      await device.sendSysEx(modifiedMessage);
      console.log('✓ Sent successfully');
    } catch (error) {
      console.log(`✗ Send failed: ${error}`);
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n→ Reading slot 1 to check if write worked...');
    try {
      const mode = await device.readCustomMode(1);
      if (mode) {
        console.log('✓ Read slot 1:');
        console.log(`  Name: ${mode.name}`);
        console.log(`  Controls: ${mode.controls?.length || 0}`);

        // Check for our specific control
        const ourControl = mode.controls?.find(c => c.name === 'FixedVol1');
        if (ourControl) {
          console.log('\n🎉 SUCCESS! Found our control:');
          console.log(`  Control ID: 0x${ourControl.controlId?.toString(16)}`);
          console.log(`  Name: ${ourControl.name}`);
          console.log(`  CC: ${ourControl.cc}`);
        } else {
          console.log('\n⚠️  Our control name not found. Named controls:');
          const namedControls = mode.controls?.filter(c => c.name) || [];
          namedControls.forEach(c => {
            console.log(`    - ${c.name} (ID: 0x${c.controlId?.toString(16)})`);
          });
        }
      } else {
        console.log('  Slot is empty');
      }
    } catch (error) {
      console.log(`✗ Read failed: ${error}`);
    }

    console.log('\n\nConclusion:');
    console.log('===========');
    console.log('The key difference is byte 8 in the SysEx header:');
    console.log('- 0x45: Our incorrect assumption (doesn\'t work)');
    console.log('- 0x10: Correct write protocol (matches read response format)');
    console.log('- 0x15: Simple command/trigger (not data transfer)');

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
testFixedWrite().catch(console.error);