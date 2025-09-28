#!/usr/bin/env tsx
/**
 * Node.js Handshake Test Script
 *
 * Tests the Launch Control XL 3 device handshake functionality in Node.js.
 * This script will attempt to connect to a Launch Control XL 3 device and verify
 * its identity using the verifyDevice() method.
 *
 * Usage:
 *   tsx utils/test-handshake-node.ts
 *   npm run test:handshake:node
 *
 * Requirements:
 *   - Launch Control XL 3 device connected via USB
 *   - Native MIDI bindings built successfully (node-midi OR jazz-midi)
 *   - Python 3.11 or earlier + build tools (for native bindings)
 *   - Device should be powered on and ready
 *
 * IMPORTANT: All Node.js MIDI libraries require native bindings. There is no pure
 * JavaScript solution for Node.js MIDI access. If native bindings fail to build,
 * use the browser test instead:
 *
 *   Open test-pages/handshake-test.html in Chrome/Edge
 *   (WebMIDI API works without any native dependencies)
 */

import chalk from 'chalk';
import { LaunchControlXL3 } from '../src/index.js';

// Console formatting helpers
const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  step: (msg: string) => console.log(chalk.cyan('→'), msg),
  title: (msg: string) => console.log(chalk.bold.underline(msg)),
  data: (label: string, value: any) => console.log(chalk.gray(`  ${label}:`), chalk.white(value))
};

async function testHandshake(): Promise<void> {
  log.title('Launch Control XL 3 - Node.js Handshake Test');
  console.log('='.repeat(50));

  log.info('Testing device handshake functionality using NodeMidiBackend');
  console.log();

  let controller: LaunchControlXL3 | null = null;
  let success = false;

  try {
    // Step 1: Create LaunchControlXL3 instance (will auto-detect JzzBackend in Node.js)
    log.step('Creating LaunchControlXL3 instance...');
    controller = new LaunchControlXL3({
      autoConnect: true,
      enableLedControl: false,
      enableCustomModes: true,
    });

    log.info('Library will auto-detect JzzBackend for Node.js environment');

    // Step 2: Setup event handlers to monitor the process
    log.step('Setting up event handlers...');

    controller.on('device:connected', (device) => {
      log.success('Device connected successfully!');
      log.data('Manufacturer ID', device.manufacturerId);
      log.data('Family Code', device.familyCode);
      log.data('Model Number', device.modelNumber);
      log.data('Firmware Version', device.firmwareVersion);
      log.data('Serial Number', device.serialNumber || 'Not available');
    });

    controller.on('device:disconnected', (reason) => {
      log.warning(`Device disconnected: ${reason || 'Unknown reason'}`);
    });

    controller.on('device:error', (error) => {
      log.error(`Device error: ${error.message}`);
    });

    let deviceInfo: any = null;

    controller.on('device:ready', () => {
      log.success('Device is ready for operation!');
    });

    // Initialize (autoConnect: true will trigger connection automatically)
    log.step('Initializing controller (autoConnect: true)...');

    // Wait for device:connected event
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      controller!.once('device:connected', (info) => {
        clearTimeout(timeout);
        deviceInfo = info;
        resolve();
      });

      controller!.once('device:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await controller.initialize();
    await connectionPromise;

    // Display results
    console.log();
    log.success('Device handshake verification completed successfully!');
    console.log();
    log.title('Device Information:');
    log.data('Manufacturer ID', deviceInfo.manufacturerId);
    log.data('Device Family', deviceInfo.deviceFamily || deviceInfo.familyCode);
    log.data('Model Number', deviceInfo.deviceModel || deviceInfo.modelNumber);
    log.data('Firmware Version', deviceInfo.firmwareVersion);
    if (deviceInfo.serialNumber) {
      log.data('Serial Number', deviceInfo.serialNumber);
    }

    // Test device status
    console.log();
    log.step('Checking device status...');
    const status = controller.getStatus();
    log.data('Connected', status.connected);
    log.data('State', status.state);
    log.data('Last Seen', status.lastSeen?.toISOString() || 'Never');

    success = true;
    console.log();
    log.success('All tests passed! Device handshake is working correctly.');

  } catch (error: any) {
    console.log();
    log.error('Handshake test failed!');
    log.error(`Error: ${error.message}`);

    // Provide troubleshooting guidance
    console.log();
    log.title('Troubleshooting Guide:');

    if (error.message.includes('No MIDI')) {
      log.warning('No MIDI devices found. Check:');
      console.log('  • Launch Control XL 3 is connected via USB');
      console.log('  • Device is powered on and recognized by your system');
      console.log('  • Try reconnecting the USB cable');
      console.log('  • Check if device appears in your system\'s audio/MIDI settings');
    } else if (error.message.includes('node-midi')) {
      log.warning('node-midi package issue. Check:');
      console.log('  • Install node-midi: npm install midi');
      console.log('  • Make sure you have the required system dependencies');
      console.log('  • On macOS: Xcode command line tools');
      console.log('  • On Linux: libasound2-dev package');
      console.log('  • On Windows: Visual Studio build tools');
    } else if (error.message.includes('not connected')) {
      log.warning('Device connection failed. Check:');
      console.log('  • Device is not being used by another application');
      console.log('  • Try restarting the device (unplug and reconnect USB)');
      console.log('  • Ensure no other DAW or MIDI application is using the device');
    } else if (error.message.includes('handshake') || error.message.includes('timeout')) {
      log.warning('Device handshake failed. Check:');
      console.log('  • Device firmware is up to date');
      console.log('  • Try power cycling the device');
      console.log('  • Ensure device is in the correct mode (not in template mode)');
      console.log('  • Check USB cable for issues');
    } else {
      log.warning('Unexpected error. General troubleshooting:');
      console.log('  • Restart the device (unplug/reconnect USB)');
      console.log('  • Check system MIDI settings');
      console.log('  • Try running the test again');
      console.log('  • Check console for additional error details');
    }

    console.log();
    log.info('For more help, check the README.md or open an issue on GitHub.');
  } finally {
    // Cleanup
    if (controller) {
      try {
        log.step('Cleaning up...');
        await controller.cleanup();
        log.success('Cleanup completed.');
      } catch (cleanupError: any) {
        log.warning(`Cleanup warning: ${cleanupError.message}`);
      }
    }
  }

  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Handle script interruption gracefully
process.on('SIGINT', () => {
  console.log();
  log.warning('Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log();
  log.warning('Test terminated');
  process.exit(1);
});

// Run the test
testHandshake().catch((error) => {
  log.error(`Unexpected script error: ${error.message}`);
  process.exit(1);
});