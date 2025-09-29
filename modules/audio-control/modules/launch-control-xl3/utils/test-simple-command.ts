#!/usr/bin/env tsx
/**
 * Test sending simple command-style SysEx messages like the web editor
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';

async function testSimpleCommand() {
  console.log('Testing Simple Command Protocol');
  console.log('================================\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Initialize backend
    const backend = new EasyMidiBackend();
    await backend.initialize();

    // Create device
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,
      enableCustomModes: false // Disable to avoid interference
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Test various command formats similar to web editor
    const commands = [
      {
        name: 'Web Editor Format - Slot 0',
        message: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x06, 0xf7],
        description: 'Exact copy of web editor slot 0 command'
      },
      {
        name: 'Web Editor Format - Slot 3',
        message: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x03, 0x06, 0xf7],
        description: 'Exact copy of web editor slot 3 command'
      },
      {
        name: 'Variant - Different end byte',
        message: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x00, 0xf7],
        description: 'Testing if 0x06 is significant'
      },
      {
        name: 'Read-style command',
        message: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x62, 0x00, 0xf7],
        description: 'Using read command format (0x62)'
      }
    ];

    for (const cmd of commands) {
      console.log(`\nTesting: ${cmd.name}`);
      console.log(`Description: ${cmd.description}`);
      console.log(`Message: ${cmd.message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      try {
        await device.sendSysEx(cmd.message);
        console.log('✓ Sent successfully');

        // Wait a bit to see if there's a response
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`✗ Failed: ${error}`);
      }
    }

    console.log('\n→ Reading slot 0 to see if anything changed...');
    try {
      const mode = await device.readCustomMode(0);
      if (mode) {
        console.log('✓ Read slot 0:');
        console.log(`  Name: ${mode.name}`);
        console.log(`  Controls: ${mode.controls?.length || 0}`);
        if (mode.controls && mode.controls.length > 0) {
          const namedControls = mode.controls.filter(c => c.name);
          console.log(`  Named controls: ${namedControls.length}`);
          if (namedControls.length > 0) {
            console.log('  First named control:', namedControls[0]);
          }
        }
      } else {
        console.log('  Slot is empty');
      }
    } catch (error) {
      console.log(`✗ Read failed: ${error}`);
    }

    console.log('\n✓ Test completed');

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
testSimpleCommand().catch(console.error);