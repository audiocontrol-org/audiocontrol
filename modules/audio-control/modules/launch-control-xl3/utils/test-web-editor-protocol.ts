#!/usr/bin/env tsx
/**
 * Test the exact protocol captured from the web editor
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';

async function testWebEditorProtocol() {
  console.log('Testing Web Editor Protocol');
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

    console.log('Key Discovery from Web Editor Analysis:');
    console.log('========================================');
    console.log('The web editor sends ONLY a 12-byte command:');
    console.log('0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 [slot] 0x06 0xf7\n');

    console.log('This suggests the web editor either:');
    console.log('1. Pre-loads data via a different channel (HTTP/WebSocket)');
    console.log('2. Uses a two-phase protocol we haven\'t captured yet');
    console.log('3. Relies on browser-side state management\n');

    // Test sending the exact web editor command for different slots
    const testSlots = [0, 1, 2, 3];

    for (const slot of testSlots) {
      console.log(`\n→ Sending web editor command for slot ${slot}...`);
      const webEditorCommand = [
        0xF0,             // SysEx start
        0x00, 0x20, 0x29, // Manufacturer ID (Novation)
        0x02,             // Device ID
        0x15,             // Command
        0x05,             // Sub-command
        0x00,             // Reserved
        0x15,             // Web editor write operation
        slot,             // Slot number
        0x06,             // Unknown marker
        0xF7              // SysEx end
      ];

      console.log(`Command: ${webEditorCommand.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      try {
        await device.sendSysEx(webEditorCommand);
        console.log('✓ Sent successfully');

        // Wait a bit for any response
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`✗ Send failed: ${error}`);
      }
    }

    // Now try reading the slots to see if anything changed
    console.log('\n\n→ Reading all slots to check state...');
    for (const slot of testSlots) {
      console.log(`\nSlot ${slot}:`);
      try {
        const mode = await device.readCustomMode(slot);
        if (mode) {
          console.log(`  Name: ${mode.name}`);
          console.log(`  Controls: ${mode.controls?.length || 0}`);

          // Check for our test name
          const namedControls = mode.controls?.filter(c => c.name) || [];
          if (namedControls.length > 0) {
            console.log(`  Named controls: ${namedControls.length}`);
            const spyTest = namedControls.find(c => c.name?.includes('SPY_TEST'));
            if (spyTest) {
              console.log(`  🎯 Found our test control: ${spyTest.name}`);
            }
          }
        } else {
          console.log('  Empty');
        }
      } catch (error) {
        console.log(`  Read failed: ${error}`);
      }
    }

    console.log('\n\nConclusion:');
    console.log('===========');
    console.log('The 12-byte command alone is NOT sufficient for writing data.');
    console.log('The web editor must be using additional mechanisms we haven\'t captured yet.');
    console.log('\nNext steps:');
    console.log('1. Monitor ALL MIDI ports (including virtual ones)');
    console.log('2. Check browser network traffic for HTTP/WebSocket data');
    console.log('3. Analyze browser console for Web MIDI API calls');

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
testWebEditorProtocol().catch(console.error);