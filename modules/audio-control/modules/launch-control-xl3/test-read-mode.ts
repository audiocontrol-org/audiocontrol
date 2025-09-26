#!/usr/bin/env tsx

/**
 * Test reading custom mode from Launch Control XL 3
 */

import { LaunchControlXL3 } from './src/LaunchControlXL3';

console.log('Testing custom mode reading from Launch Control XL 3...\n');

async function main() {
  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
    enableCustomModes: true,
    deviceNameFilter: 'LCXL3 1'
  });

  try {
    console.log('Connecting to device...');
    await controller.initialize();

    const status = controller.getStatus();
    console.log('✓ Connected successfully!');
    console.log(`Device state: ${status.state}\n`);

    // Try to read custom mode from slot 0
    console.log('Reading custom mode from slot 0...');
    try {
      const customMode = await controller.loadCustomMode(0 as any);
      console.log('✓ Custom mode read successfully!');
      console.log('Custom Mode Details:');
      console.log('─'.repeat(40));
      console.log(`Slot: ${customMode.slot}`);
      console.log(`Name: ${customMode.name}`);

      if (customMode.controls) {
        console.log('Controls configuration:');
        console.log(JSON.stringify(customMode.controls, null, 2));
      }

      if (customMode.colors) {
        console.log('Colors configuration:');
        console.log(JSON.stringify(customMode.colors, null, 2));
      }

    } catch (error) {
      console.error('Failed to read custom mode:', (error as Error).message);
    }

    // Also try reading from slot 1
    console.log('\nReading custom mode from slot 1...');
    try {
      const customMode = await controller.loadCustomMode(1 as any);
      console.log('✓ Custom mode read successfully!');
      console.log(`Slot: ${customMode.slot}, Name: ${customMode.name}`);
    } catch (error) {
      console.error('Failed to read custom mode from slot 1:', (error as Error).message);
    }

    // Cleanup
    await controller.cleanup();

  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

main().catch(console.error);