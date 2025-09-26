#!/usr/bin/env tsx

/**
 * Complete test to verify bidirectional communication with Launch Control XL 3
 *
 * This test will:
 * 1. Connect to the device using the correct ports
 * 2. Listen for control changes from the hardware
 * 3. Light up corresponding LEDs based on control values
 * 4. Display the control changes with a visual bar graph
 */

import { LaunchControlXL3 } from './src/LaunchControlXL3';

console.log('Testing complete Launch Control XL 3 integration...\n');

async function main() {
  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
    deviceNameFilter: 'LCXL3 1'
  });

  try {
    console.log('Initializing controller...');
    await controller.initialize();

    const status = controller.getStatus();
    console.log('\n✓ Connected successfully!');
    console.log(`Device state: ${status.state}`);
    if (status.deviceInfo) {
      console.log(`Firmware: ${status.deviceInfo.firmwareVersion || 'Unknown'}`);
    }

    console.log('\n===============================================');
    console.log('Move knobs, faders, or press buttons on the device');
    console.log('Control changes will be displayed below:');
    console.log('===============================================\n');

    // Listen for control changes
    controller.on('control:change', (controlId: string, value: number) => {
      const bar = '█'.repeat(Math.round((value / 127) * 30));
      const empty = '░'.repeat(30 - bar.length);
      console.log(`${controlId.padEnd(12)} [${bar}${empty}] ${value.toString().padStart(3)}`);
    });

    // Handle device disconnection
    controller.on('device:disconnected', (reason?: string) => {
      console.log(`\nDevice disconnected: ${reason || 'Unknown reason'}`);
      process.exit(0);
    });

    // Handle errors
    controller.on('device:error', (error: Error) => {
      console.error(`\nDevice error: ${error.message}`);
    });

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await controller.cleanup();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    console.error(`Failed to initialize: ${(error as Error).message}`);
    process.exit(1);
  }
}

main().catch(console.error);