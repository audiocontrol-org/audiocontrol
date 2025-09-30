#!/usr/bin/env tsx
/**
 * Test selecting slots via DAW port CC messages before writing
 */

import easymidi from 'easymidi';

async function testSlotSelection() {
  console.log('Slot Selection Test - Using DAW Port CC Messages');
  console.log('=================================================\n');

  let dawOutput: any = null;
  let midiOutput: any = null;
  let midiInput: any = null;

  try {
    // List available MIDI devices
    console.log('Available MIDI outputs:', easymidi.getOutputs());
    console.log('Available MIDI inputs:', easymidi.getInputs());
    console.log();

    // Find Launch Control XL3 ports
    const midiPortName = easymidi.getOutputs().find((name: string) =>
      name.includes('LCXL3') && name.includes('MIDI In'));
    const dawPortName = easymidi.getOutputs().find((name: string) =>
      name.includes('LCXL3') && name.includes('DAW In'));
    const inputPortName = easymidi.getInputs().find((name: string) =>
      name.includes('LCXL3') && name.includes('MIDI Out'));

    if (!midiPortName || !dawPortName) {
      throw new Error('Launch Control XL3 ports not found');
    }

    console.log(`📡 MIDI Port: ${midiPortName}`);
    console.log(`📡 DAW Port: ${dawPortName}`);
    console.log();

    // Connect to ports
    midiOutput = new easymidi.Output(midiPortName);
    dawOutput = new easymidi.Output(dawPortName);

    if (inputPortName) {
      midiInput = new easymidi.Input(inputPortName);

      // Listen for responses
      midiInput.on('sysex', (msg: any) => {
        console.log(`📥 Received SysEx response: ${msg.bytes.length} bytes`);
        const preview = msg.bytes.slice(0, 12).map((b: number) =>
          '0x' + b.toString(16).padStart(2, '0').toUpperCase()
        ).join(' ');
        console.log(`   Preview: ${preview}...`);
      });
    }

    // Test slot selection pattern discovered:
    // CC 30 on channel 6, value = slot + 5
    // Also send Note 11 on channel 15 as observed

    console.log('=== Testing Slot 1 Selection ===');
    console.log('Sending to DAW port:');
    console.log('  - Note On: note=11, velocity=127, channel=15');
    console.log('  - CC: controller=30, value=6, channel=6');
    console.log('  - Note Off: note=11, velocity=0, channel=15');
    console.log();

    // Send slot 1 selection (value 6)
    dawOutput.send('noteon', {
      note: 11,
      velocity: 127,
      channel: 15
    });

    dawOutput.send('cc', {
      controller: 30,
      value: 6,  // Slot 1
      channel: 6
    });

    dawOutput.send('noteon', {
      note: 11,
      velocity: 0,  // Note off
      channel: 15
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Now send a simple SysEx write command
    console.log('→ Sending test write to MIDI port...');

    // Create a minimal test SysEx message
    const testData = [
      0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x45, 0x00, // Header with slot 0
      0x01, 0x20, 0x10, 0x2A, // Version and name length
      // Name: "SLOT_1_TEST     " (15 bytes padded)
      0x53, 0x4C, 0x4F, 0x54, 0x5F, 0x31, 0x5F, 0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20,
      // Just one encoder for testing
      0x49, 0x10, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x0D, 0x7F, 0x00,
      0xF7
    ];

    midiOutput.send('sysex', testData);
    console.log('✓ Sent write command with slot byte 0x00');
    console.log('  (Should write to physical slot 1 due to DAW port pre-selection)');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n=== Testing Slot 2 Selection ===');
    console.log('Sending to DAW port:');
    console.log('  - Note On: note=11, velocity=127, channel=15');
    console.log('  - CC: controller=30, value=7, channel=6');
    console.log('  - Note Off: note=11, velocity=0, channel=15');
    console.log();

    // Send slot 2 selection (value 7)
    dawOutput.send('noteon', {
      note: 11,
      velocity: 127,
      channel: 15
    });

    dawOutput.send('cc', {
      controller: 30,
      value: 7,  // Slot 2
      channel: 6
    });

    dawOutput.send('noteon', {
      note: 11,
      velocity: 0,  // Note off
      channel: 15
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Send another test write
    console.log('→ Sending test write to MIDI port...');

    const testData2 = [
      0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x45, 0x00, // Header with slot 0
      0x01, 0x20, 0x10, 0x2A, // Version and name length
      // Name: "SLOT_2_TEST     " (15 bytes padded)
      0x53, 0x4C, 0x4F, 0x54, 0x5F, 0x32, 0x5F, 0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20,
      // Just one encoder for testing
      0x49, 0x10, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x0D, 0x7F, 0x00,
      0xF7
    ];

    midiOutput.send('sysex', testData2);
    console.log('✓ Sent write command with slot byte 0x00');
    console.log('  (Should write to physical slot 2 due to DAW port pre-selection)');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📋 Summary:');
    console.log('- DAW port CC 30 on channel 6 controls active slot');
    console.log('- Value = physical slot number + 5');
    console.log('- Note 11 on channel 15 might be a trigger/notification');
    console.log('\n🔍 Please check the device:');
    console.log('   - Physical slot 1 should show "SLOT_1_TEST"');
    console.log('   - Physical slot 2 should show "SLOT_2_TEST"');

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (midiOutput) midiOutput.close();
    if (dawOutput) dawOutput.close();
    if (midiInput) midiInput.close();
    console.log('\n✓ Test completed');
  }
}

// Run the test
testSlotSelection().catch(console.error);