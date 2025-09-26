#!/usr/bin/env tsx

/**
 * Demonstrates using the CustomModeBuilder API to create and upload custom modes
 * to the Launch Control XL 3
 */

import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';
import { LaunchControlXL3 } from '@/LaunchControlXL3';
import { CustomModeBuilder, Color } from '@/builders/CustomModeBuilder';

async function demonstrateCustomModeBuilder() {
  console.log('🎛️ Launch Control XL 3 - Custom Mode Builder Demo\n');

  // Initialize MIDI backend
  const backend = new NodeMidiBackend();
  await backend.initialize();

  // Find the device
  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    console.log('Available inputs:', inputPorts.map(p => p.name));
    console.log('Available outputs:', outputPorts.map(p => p.name));
    await backend.cleanup();
    return;
  }

  // Open ports
  const inputPort = await backend.openInput(lcxl3Input.id);
  const outputPort = await backend.openOutput(lcxl3Output.id);

  // Create the main LaunchControlXL3 instance
  const lcxl3 = new LaunchControlXL3(true); // Enable debug mode
  await lcxl3.connect(inputPort, outputPort);

  console.log('✅ Connected to Launch Control XL 3\n');

  // Example 1: Create a simple mixer mode
  console.log('📝 Example 1: Simple Mixer Mode');
  console.log('================================\n');

  const mixerMode = new CustomModeBuilder()
    .name('MIXER')
    .addFader(1, { cc: 10, channel: 1 })
    .addFader(2, { cc: 11, channel: 1 })
    .addFader(3, { cc: 12, channel: 1 })
    .addFader(4, { cc: 13, channel: 1 })
    .addEncoder(1, 1, { cc: 20, channel: 1 }) // Top row encoder 1
    .addEncoder(1, 2, { cc: 21, channel: 1 }) // Top row encoder 2
    .addEncoder(2, 1, { cc: 30, channel: 1 }) // Middle row encoder 1
    .addEncoder(2, 2, { cc: 31, channel: 1 }) // Middle row encoder 2
    .addFaderLabel(1, 'Vol 1')
    .addFaderLabel(2, 'Vol 2')
    .addFaderLabel(3, 'Vol 3')
    .addFaderLabel(4, 'Vol 4')
    .addEncoderLabel(1, 1, 'Pan 1')
    .addEncoderLabel(1, 2, 'Pan 2')
    .addEncoderLabel(2, 1, 'Send 1')
    .addEncoderLabel(2, 2, 'Send 2')
    .build();

  console.log('Built mixer mode with:');
  console.log(`  - ${mixerMode.controls.length} controls`);
  console.log(`  - ${mixerMode.labels?.size || 0} labels`);
  console.log('\nUploading to slot 2...');

  try {
    await lcxl3.writeCustomMode(1, mixerMode); // Slot 2 (index 1)
    console.log('✅ Mixer mode uploaded successfully!\n');
  } catch (error) {
    console.error('❌ Failed to upload mixer mode:', error);
  }

  // Example 2: Create an EQ mode with colors
  console.log('📝 Example 2: EQ Mode with Colors');
  console.log('=================================\n');

  const eqMode = new CustomModeBuilder()
    .name('EQ')
    // Low frequency controls (green)
    .addEncoder(1, 1, { cc: 40, channel: 1 })
    .addEncoderLabel(1, 1, 'Low Freq')
    .addEncoder(2, 1, { cc: 41, channel: 1 })
    .addEncoderLabel(2, 1, 'Low Gain')
    .addEncoder(3, 1, { cc: 42, channel: 1 })
    .addEncoderLabel(3, 1, 'Low Q')
    // Mid frequency controls (amber)
    .addEncoder(1, 2, { cc: 43, channel: 1 })
    .addEncoderLabel(1, 2, 'Mid Freq')
    .addEncoder(2, 2, { cc: 44, channel: 1 })
    .addEncoderLabel(2, 2, 'Mid Gain')
    .addEncoder(3, 2, { cc: 45, channel: 1 })
    .addEncoderLabel(3, 2, 'Mid Q')
    // High frequency controls (red)
    .addEncoder(1, 3, { cc: 46, channel: 1 })
    .addEncoderLabel(1, 3, 'Hi Freq')
    .addEncoder(2, 3, { cc: 47, channel: 1 })
    .addEncoderLabel(2, 3, 'Hi Gain')
    .addEncoder(3, 3, { cc: 48, channel: 1 })
    .addEncoderLabel(3, 3, 'Hi Q')
    // Side buttons for band enable/disable
    .addSideButton(1, { cc: 60, channel: 1 })
    .addSideButton(2, { cc: 61, channel: 1 })
    .addSideButton(3, { cc: 62, channel: 1 })
    .addSideButtonColor(1, Color.GREEN_FULL)
    .addSideButtonColor(2, Color.AMBER_FULL)
    .addSideButtonColor(3, Color.RED_FULL)
    .build();

  console.log('Built EQ mode with:');
  console.log(`  - ${eqMode.controls.length} controls`);
  console.log(`  - ${eqMode.labels?.size || 0} labels`);
  console.log(`  - ${eqMode.colors?.size || 0} colors`);
  console.log('\nUploading to slot 3...');

  try {
    await lcxl3.writeCustomMode(2, eqMode); // Slot 3 (index 2)
    console.log('✅ EQ mode uploaded successfully!\n');
  } catch (error) {
    console.error('❌ Failed to upload EQ mode:', error);
  }

  // Example 3: Use the pre-configured CHANNEV mode
  console.log('📝 Example 3: Pre-configured CHANNEV Mode');
  console.log('=========================================\n');

  console.log('Uploading CHANNEV mode to slot 4...');
  try {
    await lcxl3.uploadChannevMode(3); // Slot 4 (index 3)
    console.log('✅ CHANNEV mode uploaded successfully!\n');
  } catch (error) {
    console.error('❌ Failed to upload CHANNEV mode:', error);
  }

  // Example 4: Read back and verify modes
  console.log('📝 Example 4: Reading Back Modes');
  console.log('================================\n');

  for (let slot = 1; slot <= 3; slot++) {
    console.log(`Reading slot ${slot + 1}...`);
    try {
      const readMode = await lcxl3.readCustomMode(slot);
      console.log(`  Mode name: "${readMode.name}"`);
      console.log(`  Controls: ${readMode.controls.length}`);
      console.log();
    } catch (error) {
      console.error(`  Failed to read slot ${slot + 1}:`, error);
    }
  }

  // Example 5: Create a minimal test mode
  console.log('📝 Example 5: Minimal Test Mode');
  console.log('===============================\n');

  const testMode = CustomModeBuilder.createTestMode().build();

  console.log('Built test mode with:');
  console.log(`  - Name: "${testMode.name}"`);
  console.log(`  - ${testMode.controls.length} controls`);
  console.log(`  - ${testMode.labels?.size || 0} labels`);

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  await lcxl3.disconnect();
  await backend.cleanup();
  console.log('✅ Done!');
}

// Run the demo
demonstrateCustomModeBuilder().catch(console.error);