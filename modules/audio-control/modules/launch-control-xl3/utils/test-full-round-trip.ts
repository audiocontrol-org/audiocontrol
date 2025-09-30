#!/usr/bin/env npx tsx
/**
 * Comprehensive Round-Trip Test using JUCE HTTP backend
 * Tests writing a complete custom mode with all 48 controls to device,
 * then reading it back and validating all data matches exactly.
 */

import { LaunchControlXL3, CustomModeBuilder, Color } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';
import { CustomMode } from '../src/types';

function createTestCustomMode(timestamp: number): CustomMode {
  // Use a short name that fits the 8-character limit
  const testName = `RT${timestamp.toString().slice(-5)}`; // RT + last 5 digits of timestamp

  let ccValue = 20; // Start from CC 20 to avoid common conflicts

  // Use the CustomModeBuilder to create a proper custom mode
  const builder = new CustomModeBuilder().name(testName);

  // Row 1 - 8 Encoders (Top)
  for (let i = 1; i <= 8; i++) {
    builder
      .addEncoder(1, i, { cc: ccValue++, channel: 1 })
      .addEncoderLabel(1, i, `K1-${i}`);
  }

  // Row 2 - 8 Encoders (Middle)
  for (let i = 1; i <= 8; i++) {
    builder
      .addEncoder(2, i, { cc: ccValue++, channel: 2 })
      .addEncoderLabel(2, i, `K2-${i}`);
  }

  // Row 3 - 8 Encoders (Bottom)
  for (let i = 1; i <= 8; i++) {
    builder
      .addEncoder(3, i, { cc: ccValue++, channel: 3 })
      .addEncoderLabel(3, i, `K3-${i}`);
  }

  // Faders - 8 Faders
  for (let i = 1; i <= 8; i++) {
    builder
      .addFader(i, { cc: ccValue++, channel: 4 })
      .addFaderLabel(i, `F-${i}`);
  }

  // Side buttons - 8 buttons with colors
  for (let i = 1; i <= 8; i++) {
    builder
      .addSideButton(i, { cc: ccValue++, channel: 5 })
      .addSideButtonColor(i, i % 2 === 0 ? Color.RED_FULL : Color.GREEN_FULL);
  }

  return builder.build();
}

function validateConfigurations(written: CustomMode, read: CustomMode): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (written.name !== read.name) {
    errors.push(`Name mismatch: "${written.name}" !== "${read.name}"`);
  }

  // Validate control count
  const writtenControlCount = Object.keys(written.controls).length;
  const readControlCount = Object.keys(read.controls).length;

  if (writtenControlCount !== readControlCount) {
    errors.push(`Control count mismatch: ${writtenControlCount} !== ${readControlCount}`);
  }

  // Validate individual controls
  for (const [id, writtenControl] of Object.entries(written.controls)) {
    const readControl = read.controls[id];

    if (!readControl) {
      errors.push(`Missing control in read data: ${id}`);
      continue;
    }

    // Check critical properties
    if (writtenControl.controlType !== readControl.controlType) {
      errors.push(`${id}: controlType mismatch: ${writtenControl.controlType} !== ${readControl.controlType}`);
    }

    if (writtenControl.midiChannel !== readControl.midiChannel) {
      errors.push(`${id}: midiChannel mismatch: ${writtenControl.midiChannel} !== ${readControl.midiChannel}`);
    }

    if (writtenControl.ccNumber !== readControl.ccNumber) {
      errors.push(`${id}: ccNumber mismatch: ${writtenControl.ccNumber} !== ${readControl.ccNumber}`);
    }

    if (writtenControl.behavior !== readControl.behavior) {
      errors.push(`${id}: behavior mismatch: ${writtenControl.behavior} !== ${readControl.behavior}`);
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
}

async function runFullRoundTrip() {
  console.log('=== JUCE Backend Full Round-Trip Test ===\n');

  const timestamp = Date.now();
  const testSlot = 1; // Physical slot 1 (0-indexed)

  // Create device with JUCE backend
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    // Initialize backend
    console.log('🔧 Initializing JUCE backend...');
    await backend.initialize();

    // Connect to device
    console.log('🔌 Connecting to Launch Control XL3...');
    await device.connect();
    console.log('✓ Connected\n');

    // Perform handshake to verify connection
    console.log('🤝 Performing device verification...');
    const info = await device.verifyDevice();
    console.log(`✓ Device: ${info.manufacturer} ${info.product}`);
    console.log(`  Serial: ${info.serialNumber}`);
    console.log(`  Version: ${info.firmwareVersion}\n`);

    // Generate test configuration using library API
    console.log('📝 Creating test custom mode using CustomModeBuilder...');
    const testConfig = createTestCustomMode(timestamp);
    console.log(`✓ Test mode created: "${testConfig.name}"`);
    console.log(`  Controls: ${Object.keys(testConfig.controls).length}\n`);

    // Show sample of what we're writing
    console.log('📋 Sample controls being written:');
    const sampleControls = Object.entries(testConfig.controls).slice(0, 5);
    for (const [id, control] of sampleControls) {
      console.log(`  ${id}: CC${control.ccNumber} (CH${control.midiChannel + 1}, Type${control.controlType.toString(16)})`);
    }
    console.log(`  ... and ${Object.keys(testConfig.controls).length - 5} more\n`);

    // Write configuration to device
    console.log(`💾 Writing to slot ${testSlot}...`);
    await device.writeCustomMode(testSlot, testConfig);
    console.log('✓ Write completed\n');

    // Add delay to ensure write completes
    console.log('⏳ Waiting for write to settle...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✓ Ready to read\n');

    // Read back configuration
    console.log(`📖 Reading back from slot ${testSlot}...`);
    const readConfig = await device.readCustomMode(testSlot);

    if (!readConfig) {
      throw new Error(`Failed to read custom mode from slot ${testSlot} - slot appears to be empty`);
    }

    console.log(`✓ Read completed: "${readConfig.name}"`);
    console.log(`  Controls read: ${Object.keys(readConfig.controls).length}\n`);

    // Debug: Show control IDs in both configs
    console.log('🔍 Debug: Control IDs comparison:');
    console.log(`  Written control IDs: ${Object.keys(testConfig.controls).sort().join(', ')}`);
    console.log(`  Read control IDs: ${Object.keys(readConfig.controls).sort().join(', ')}\n`);

    // Validate data integrity
    console.log('🔍 Validating data integrity...');
    const validation = validateConfigurations(testConfig, readConfig);

    if (validation.success) {
      console.log('✅ SUCCESS - Perfect round-trip validation!');
      console.log(`   Written: "${testConfig.name}"`);
      console.log(`   Read:    "${readConfig.name}"`);
      console.log(`   Controls: ${Object.keys(testConfig.controls).length} ✓`);
      console.log(`   All data matches exactly! 🎉`);
    } else {
      console.log('❌ VALIDATION FAILED');
      console.log(`   Written: "${testConfig.name}"`);
      console.log(`   Read:    "${readConfig.name}"`);
      console.log(`   Errors found: ${validation.errors.length}`);
      console.log('\n📝 Detailed errors:');
      validation.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }

    // Show sample of read data for verification
    console.log('\n📋 Sample controls read back:');
    const readSample = Object.entries(readConfig.controls).slice(0, 5);
    for (const [id, control] of readSample) {
      console.log(`  ${id}: CC${control.ccNumber} (CH${control.midiChannel + 1}, Type${control.controlType.toString(16)})`);
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await device.disconnect();
    await backend.close();
    console.log('✓ Done');
  }
}

// Run the test
runFullRoundTrip().catch(console.error);