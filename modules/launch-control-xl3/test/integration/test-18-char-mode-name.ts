#!/usr/bin/env tsx
/**
 * Integration test to validate 18-character mode names work with actual device
 * 
 * This test:
 * 1. Creates a mode with an 18-character name
 * 2. Writes it to the device
 * 3. Reads it back
 * 4. Verifies the name persists correctly
 */

import { NodeMidiBackend } from '@/backends/NodeMidiBackend.js';
import { MidiInterface } from '@/core/MidiInterface.js';
import { DeviceManager } from '@/device/DeviceManager.js';
import { CustomModeBuilder } from '@/builders/CustomModeBuilder.js';

const DEVICE_NAME = 'LCXL3 1'; // Matches both 'LCXL3 1 MIDI Out' and 'LCXL3 1 MIDI In'
const TEST_SLOT = 14; // Use slot 14 for testing to avoid overwriting user data

async function main() {
  console.log('=== 18-Character Mode Name Integration Test ===\n');

  // Initialize MIDI backend
  const backend = new NodeMidiBackend();
  await backend.initialize();

  const midi = new MidiInterface(backend);
  await midi.initialize();

  // Find device
  const outputPorts = await midi.getOutputPorts();
  const inputPorts = await midi.getInputPorts();
  
  const outputPort = outputPorts.find(p => p.name.includes(DEVICE_NAME));
  const inputPort = inputPorts.find(p => p.name.includes(DEVICE_NAME));

  if (!outputPort || !inputPort) {
    console.error('❌ Device not found. Please ensure Launch Control XL3 is connected.');
    console.log('\nAvailable output ports:', outputPorts.map(p => p.name));
    console.log('Available input ports:', inputPorts.map(p => p.name));
    process.exit(1);
  }

  console.log(`✓ Found device: ${outputPort.name}`);

  // Connect to device
  await midi.openInput(inputPort.id);
  await midi.openOutput(outputPort.id);

  const deviceManager = new DeviceManager(midi);

  try {
    // Step 1: Create mode with 18-character name
    const eighteenCharName = 'EXACTLY18CHARSLONG'; // Exactly 18 characters
    console.log(`\n1. Creating mode with 18-character name: "${eighteenCharName}"`);
    console.log(`   Length: ${eighteenCharName.length} characters`);

    const mode = new CustomModeBuilder()
      .name(eighteenCharName)
      .addFader(1, { cc: 10, channel: 1 })
      .addEncoder(1, 1, { cc: 13, channel: 1 })
      .addEncoderLabel(1, 1, 'Test')
      .build();

    console.log(`✓ Mode created successfully`);

    // Step 2: Write mode to slot 14
    console.log(`\n2. Writing mode to slot ${TEST_SLOT}...`);
    await deviceManager.writeCustomMode(TEST_SLOT, mode);
    console.log(`✓ Mode written successfully`);

    // Wait a bit for device to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Read back from slot 14
    console.log(`\n3. Reading mode back from slot ${TEST_SLOT}...`);
    const readMode = await deviceManager.readCustomMode(TEST_SLOT);
    console.log(`✓ Mode read successfully`);

    // Step 4: Verify the name
    console.log(`\n4. Verifying mode name...`);
    console.log(`   Expected: "${eighteenCharName}" (${eighteenCharName.length} chars)`);
    console.log(`   Received: "${readMode.name}" (${readMode.name.length} chars)`);

    if (readMode.name === eighteenCharName) {
      console.log(`\n✅ SUCCESS: 18-character mode name persisted correctly!`);
      process.exit(0);
    } else if (readMode.name.startsWith(eighteenCharName.substring(0, 8))) {
      console.log(`\n⚠️  WARNING: Mode name was truncated to 8 characters`);
      console.log(`   This suggests the device firmware may have an 8-character limit,`);
      console.log(`   not the 18-character limit we expected.`);
      process.exit(1);
    } else {
      console.log(`\n❌ FAIL: Mode name mismatch`);
      console.log(`   Expected: "${eighteenCharName}"`);
      console.log(`   Got: "${readMode.name}"`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`\n❌ Test failed:`, error.message);
    process.exit(1);
  } finally {
    await midi.cleanup();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
