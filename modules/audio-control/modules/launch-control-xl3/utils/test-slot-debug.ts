#!/usr/bin/env tsx
/**
 * Debug test to capture exact SysEx bytes being sent for slot operations
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import type { CustomMode } from '../src/types.js';

async function testSlotDebug() {
  console.log('Slot Debug Test');
  console.log('===============\n');

  let device: LaunchControlXL3 | null = null;
  let capturedMessages: number[][] = [];

  try {
    // Initialize MIDI backend with message capture
    const midiBackend = new EasyMidiBackend();
    await midiBackend.initialize();

    // Monkey-patch to capture outgoing messages
    const originalSend = midiBackend.sendMessage.bind(midiBackend);
    midiBackend.sendMessage = async (port: any, message: any) => {
      if (message[0] === 0xF0) { // SysEx
        console.log(`📤 Capturing outgoing SysEx: ${message.length} bytes`);
        capturedMessages.push(message);

        // Show header bytes for debugging
        const header = message.slice(0, 12).map((b: number) =>
          b.toString(16).padStart(2, '0').toUpperCase()
        ).join(' ');
        console.log(`   Header: ${header}`);

        // Identify the slot byte (position 9 after F0 00 20 29 02 15 05 00 45)
        if (message[8] === 0x45) { // Write command
          console.log(`   ⚠️ SLOT BYTE: 0x${message[9].toString(16).padStart(2, '0').toUpperCase()} (decimal ${message[9]})`);
        }
      }
      return originalSend(port, message);
    };

    // Create device with custom modes enabled
    device = new LaunchControlXL3({
      midiBackend: midiBackend,
      enableLedControl: false,
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create minimal test mode
    const testMode: CustomMode = {
      name: 'SLOT_TEST',
      controls: [],
      colors: []
    };

    // Add just one encoder for testing
    testMode.controls.push({
      id: 0x10,  // First encoder
      type: 'encoder',
      index: 0,
      cc: 13,
      channel: 1,
      minValue: 0,
      maxValue: 127,
      color: 0
    });
    testMode.colors.push(0);

    // Test writing to slot 0
    console.log('\n=== Testing Write to Slot 0 ===');
    capturedMessages = [];
    console.log('→ Writing to slot 0 (should be physical slot 1)...');
    await device.writeCustomMode(0, testMode);
    console.log('✓ Write completed');

    if (capturedMessages.length > 0) {
      const writeMsg = capturedMessages.find(msg => msg[8] === 0x45);
      if (writeMsg) {
        console.log(`\n📊 Analysis:`);
        console.log(`   We sent slot byte: 0x${writeMsg[9].toString(16).padStart(2, '0').toUpperCase()}`);
        console.log(`   This should write to physical slot ${writeMsg[9] + 1}`);
      }
    }

    // Wait and then try to read back
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n→ Reading back from slot 0...');
    capturedMessages = [];
    const readBack = await device.readCustomMode(0);

    if (readBack) {
      console.log(`✓ Read successful: "${readBack.name}"`);
    } else {
      console.log('✗ Read returned empty');
    }

    // Test writing to slot 1
    console.log('\n=== Testing Write to Slot 1 ===');
    capturedMessages = [];
    console.log('→ Writing to slot 1 (should be physical slot 2)...');
    testMode.name = 'SLOT_1_TEST';
    await device.writeCustomMode(1, testMode);
    console.log('✓ Write completed');

    if (capturedMessages.length > 0) {
      const writeMsg = capturedMessages.find(msg => msg[8] === 0x45);
      if (writeMsg) {
        console.log(`\n📊 Analysis:`);
        console.log(`   We sent slot byte: 0x${writeMsg[9].toString(16).padStart(2, '0').toUpperCase()}`);
        console.log(`   This should write to physical slot ${writeMsg[9] + 1}`);
      }
    }

    // Try reading from different slots to see what's there
    console.log('\n=== Checking What\'s In Each Slot ===');
    for (let slot = 0; slot < 5; slot++) {
      console.log(`\n→ Reading slot ${slot}...`);
      capturedMessages = [];

      try {
        const mode = await device.readCustomMode(slot);
        if (mode && mode.name) {
          console.log(`   Slot ${slot}: "${mode.name}"`);
        } else {
          console.log(`   Slot ${slot}: <empty>`);
        }
      } catch (error) {
        console.log(`   Slot ${slot}: Error reading`);
      }
    }

    console.log('\n\n=== Summary ===');
    console.log('If the user says slot 0 is writing to physical slot 2,');
    console.log('then there might be a +1 offset somewhere in the chain.');
    console.log('The captured slot bytes above show exactly what we\'re sending.');

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
testSlotDebug().catch(console.error);