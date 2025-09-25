/**
 * Basic Connection Example
 *
 * Demonstrates how to connect to Launch Control XL 3 and handle events
 */

import { LaunchControlXL3 } from '../src';

async function main() {
  console.log('Launch Control XL 3 - Basic Connection Example');
  console.log('='.repeat(50));

  // Create controller instance
  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
    enableCustomModes: true,
  });

  // Setup event handlers
  controller.on('device:connected', (device) => {
    console.log('✓ Device connected');
    console.log(`  Manufacturer: ${device.manufacturerId}`);
    console.log(`  Firmware: ${device.firmwareVersion}`);
  });

  controller.on('device:disconnected', (reason) => {
    console.log(`✗ Device disconnected: ${reason || 'Unknown'}`);
  });

  controller.on('device:error', (error) => {
    console.error(`Error: ${error.message}`);
  });

  controller.on('control:change', (controlId, value, channel) => {
    console.log(`Control ${controlId}: ${value} (ch${channel})`);
  });

  try {
    // Initialize and connect
    console.log('Connecting to device...');
    await controller.initialize();

    // Get device status
    const status = controller.getStatus();
    console.log('\nDevice Status:');
    console.log(`  Connected: ${status.connected}`);
    console.log(`  State: ${status.state}`);

    // Keep the script running
    console.log('\nMonitoring controls... Press Ctrl+C to exit');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await controller.cleanup();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('Failed to connect:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);