#!/usr/bin/env npx tsx
/**
 * Comprehensive Round-Trip Test using JUCE HTTP backend
 * Tests writing a complete custom mode with all 48 controls to device,
 * then reading it back and validating all data matches exactly.
 */

import { LaunchControlXL3 } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';
import { ControlType, ControlBehavior } from '../src/types';

interface TestControl {
  id: string;
  type: ControlType;
  channel: number;
  behavior: ControlBehavior;
  midiType: 'cc' | 'note';
  cc?: number;
  note?: number;
  min: number;
  max: number;
  color: string;
  name: string;
}

function createTestCustomMode(timestamp: number) {
  const testName = `FULL_RT_${timestamp}`;

  // Create all 48 controls with unique, identifiable values
  const controls: { [id: string]: TestControl } = {};

  let ccValue = 20; // Start from CC 20 to avoid common conflicts
  let noteValue = 60; // Start from middle C

  // Row 1 - 8 Knobs (Upper)
  for (let i = 1; i <= 8; i++) {
    const id = `knob1_${i}`;
    controls[id] = {
      id,
      type: 'knob',
      channel: 0, // Channel 1
      behavior: 'absolute',
      midiType: 'cc',
      cc: ccValue++,
      min: 0,
      max: 127,
      color: 'red',
      name: `K1-${i}`
    };
  }

  // Row 2 - 8 Knobs (Middle)
  for (let i = 1; i <= 8; i++) {
    const id = `knob2_${i}`;
    controls[id] = {
      id,
      type: 'knob',
      channel: 1, // Channel 2
      behavior: 'absolute',
      midiType: 'cc',
      cc: ccValue++,
      min: 0,
      max: 127,
      color: 'green',
      name: `K2-${i}`
    };
  }

  // Row 3 - 8 Knobs (Lower)
  for (let i = 1; i <= 8; i++) {
    const id = `knob3_${i}`;
    controls[id] = {
      id,
      type: 'knob',
      channel: 2, // Channel 3
      behavior: 'absolute',
      midiType: 'cc',
      cc: ccValue++,
      min: 0,
      max: 127,
      color: 'blue',
      name: `K3-${i}`
    };
  }

  // Row 4 - 8 Faders
  for (let i = 1; i <= 8; i++) {
    const id = `fader_${i}`;
    controls[id] = {
      id,
      type: 'fader',
      channel: 3, // Channel 4
      behavior: 'absolute',
      midiType: 'cc',
      cc: ccValue++,
      min: 0,
      max: 127,
      color: 'yellow',
      name: `F-${i}`
    };
  }

  // Row 5 - 8 Buttons (Upper)
  for (let i = 1; i <= 8; i++) {
    const id = `button1_${i}`;
    controls[id] = {
      id,
      type: 'button',
      channel: 4, // Channel 5
      behavior: 'toggle',
      midiType: 'note',
      note: noteValue++,
      min: 0,
      max: 127,
      color: 'purple',
      name: `B1-${i}`
    };
  }

  // Row 6 - 8 Buttons (Lower)
  for (let i = 1; i <= 8; i++) {
    const id = `button2_${i}`;
    controls[id] = {
      id,
      type: 'button',
      channel: 5, // Channel 6
      behavior: 'toggle',
      midiType: 'note',
      note: noteValue++,
      min: 0,
      max: 127,
      color: 'cyan',
      name: `B2-${i}`
    };
  }

  return {
    header: {
      productId: 0x1520, // LCXL3 product ID
      configFlags: 0x102A, // Standard flags
      name: testName
    },
    controls
  };
}

function validateConfigurations(written: any, read: any): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate header
  if (written.header.name !== read.header.name) {
    errors.push(`Name mismatch: "${written.header.name}" !== "${read.header.name}"`);
  }

  if (written.header.productId !== read.header.productId) {
    errors.push(`Product ID mismatch: ${written.header.productId} !== ${read.header.productId}`);
  }

  // Validate control count
  const writtenControlCount = Object.keys(written.controls).length;
  const readControlCount = Object.keys(read.controls).length;

  if (writtenControlCount !== readControlCount) {
    errors.push(`Control count mismatch: ${writtenControlCount} !== ${readControlCount}`);
  }

  // Validate individual controls
  for (const [id, writtenControl] of Object.entries(written.controls) as [string, TestControl][]) {
    const readControl = read.controls[id];

    if (!readControl) {
      errors.push(`Missing control in read data: ${id}`);
      continue;
    }

    // Check critical properties
    if (writtenControl.type !== readControl.type) {
      errors.push(`${id}: type mismatch: ${writtenControl.type} !== ${readControl.type}`);
    }

    if (writtenControl.channel !== readControl.channel) {
      errors.push(`${id}: channel mismatch: ${writtenControl.channel} !== ${readControl.channel}`);
    }

    if (writtenControl.behavior !== readControl.behavior) {
      errors.push(`${id}: behavior mismatch: ${writtenControl.behavior} !== ${readControl.behavior}`);
    }

    if (writtenControl.midiType !== readControl.midiType) {
      errors.push(`${id}: midiType mismatch: ${writtenControl.midiType} !== ${readControl.midiType}`);
    }

    if (writtenControl.cc !== readControl.cc) {
      errors.push(`${id}: cc mismatch: ${writtenControl.cc} !== ${readControl.cc}`);
    }

    if (writtenControl.note !== readControl.note) {
      errors.push(`${id}: note mismatch: ${writtenControl.note} !== ${readControl.note}`);
    }

    if (writtenControl.color !== readControl.color) {
      errors.push(`${id}: color mismatch: ${writtenControl.color} !== ${readControl.color}`);
    }

    if (writtenControl.name !== readControl.name) {
      errors.push(`${id}: name mismatch: "${writtenControl.name}" !== "${readControl.name}"`);
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

    // Generate test configuration
    console.log('📝 Creating test custom mode...');
    const testConfig = createTestCustomMode(timestamp);
    console.log(`✓ Test mode created: "${testConfig.header.name}"`);
    console.log(`  Controls: ${Object.keys(testConfig.controls).length}/48\n`);

    // Show sample of what we're writing
    console.log('📋 Sample controls being written:');
    const sampleControls = Object.entries(testConfig.controls).slice(0, 5);
    for (const [id, control] of sampleControls) {
      const midiInfo = control.midiType === 'cc' ? `CC${control.cc}` : `Note${control.note}`;
      console.log(`  ${id}: "${control.name}" (CH${control.channel + 1}, ${midiInfo}, ${control.color})`);
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

    console.log(`✓ Read completed: "${readConfig.header.name}"`);
    console.log(`  Controls read: ${Object.keys(readConfig.controls).length}\n`);

    // Validate data integrity
    console.log('🔍 Validating data integrity...');
    const validation = validateConfigurations(testConfig, readConfig);

    if (validation.success) {
      console.log('✅ SUCCESS - Perfect round-trip validation!');
      console.log(`   Written: "${testConfig.header.name}"`);
      console.log(`   Read:    "${readConfig.header.name}"`);
      console.log(`   Controls: ${Object.keys(testConfig.controls).length} ✓`);
      console.log(`   All data matches exactly! 🎉`);
    } else {
      console.log('❌ VALIDATION FAILED');
      console.log(`   Written: "${testConfig.header.name}"`);
      console.log(`   Read:    "${readConfig.header.name}"`);
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
      const midiInfo = control.midiType === 'cc' ? `CC${control.cc}` : `Note${control.note}`;
      console.log(`  ${id}: "${control.name}" (CH${control.channel + 1}, ${midiInfo}, ${control.color})`);
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