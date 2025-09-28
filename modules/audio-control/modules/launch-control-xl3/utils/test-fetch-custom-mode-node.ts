#!/usr/bin/env tsx
/**
 * Node.js Custom Mode Fetch Test Script
 *
 * Tests the Launch Control XL 3 custom mode fetching functionality in Node.js.
 * This script will connect to a Launch Control XL 3 device and read custom mode
 * configurations from specified slots.
 *
 * Usage:
 *   tsx utils/test-fetch-custom-mode-node.ts [slot]
 *   npm run test:fetch-mode:node
 *
 * Arguments:
 *   slot - Optional slot number (0-14 for slots 1-15). If not specified, reads all slots.
 *
 * Requirements:
 *   - Launch Control XL 3 device connected via USB
 *   - Native MIDI bindings built successfully (node-midi OR jazz-midi)
 *   - Python 3.11 or earlier + build tools (for native bindings)
 *   - Device should be powered on and ready
 *
 * IMPORTANT: All Node.js MIDI libraries require native bindings. There is no pure
 * JavaScript solution for Node.js MIDI access. If native bindings fail to build,
 * use the browser test instead.
 */

import chalk from 'chalk';
import { LaunchControlXL3 } from '../src';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import type { CustomMode } from '../src/types/CustomMode.js';

// Console formatting helpers
const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  step: (msg: string) => console.log(chalk.cyan('→'), msg),
  title: (msg: string) => console.log(chalk.bold.underline(msg)),
  data: (label: string, value: any) => console.log(chalk.gray(`  ${label}:`), chalk.white(value)),
  section: (msg: string) => console.log(chalk.bgBlue.white(` ${msg} `))
};

// Parse command line arguments
const args = process.argv.slice(2);
const requestedSlot = args[0] ? parseInt(args[0], 10) : undefined;

// Validate slot number if provided
if (requestedSlot !== undefined && (isNaN(requestedSlot) || requestedSlot < 0 || requestedSlot > 14)) {
  log.error('Invalid slot number. Must be 0-14 (for slots 1-15).');
  process.exit(1);
}

/**
 * Format control mapping for display
 */
function formatControlMapping(control: any): string {
  const type = control.controlType || control.type || 'unknown';
  const channel = (control.midiChannel ?? control.channel ?? 0) + 1; // Display as 1-based
  const cc = control.ccNumber ?? control.cc ?? 0;
  const min = control.minValue ?? control.min ?? 0;
  const max = control.maxValue ?? control.max ?? 127;
  const behavior = control.behaviour || control.behavior || 'absolute';

  return `CH${channel} CC${cc} (${min}-${max}) ${behavior}`;
}

/**
 * Display custom mode information
 */
function displayCustomMode(slot: number, mode: CustomMode): void {
  console.log();
  log.section(`Slot ${slot + 1} - ${mode.name || 'Untitled'}`);

  // Display controls grouped by type
  const controls = Object.values(mode.controls || {});

  // Group controls by type/position
  const faders = controls.filter(c => (c.controlId ?? 0) <= 0x07);
  const topEncoders = controls.filter(c => (c.controlId ?? 0) >= 0x10 && (c.controlId ?? 0) <= 0x17);
  const midEncoders = controls.filter(c => (c.controlId ?? 0) >= 0x18 && (c.controlId ?? 0) <= 0x1F);
  const botEncoders = controls.filter(c => (c.controlId ?? 0) >= 0x20 && (c.controlId ?? 0) <= 0x27);
  const buttons = controls.filter(c => (c.controlId ?? 0) >= 0x28);

  if (faders.length > 0) {
    console.log(chalk.yellow('  Faders:'));
    faders.forEach(control => {
      const id = control.controlId ?? 0;
      log.data(`    Fader ${id + 1}`, formatControlMapping(control));
    });
  }

  if (topEncoders.length > 0) {
    console.log(chalk.yellow('  Top Row Encoders:'));
    topEncoders.forEach(control => {
      const id = (control.controlId ?? 0) - 0x10 + 1;
      log.data(`    Encoder ${id}`, formatControlMapping(control));
    });
  }

  if (midEncoders.length > 0) {
    console.log(chalk.yellow('  Middle Row Encoders:'));
    midEncoders.forEach(control => {
      const id = (control.controlId ?? 0) - 0x18 + 1;
      log.data(`    Encoder ${id}`, formatControlMapping(control));
    });
  }

  if (botEncoders.length > 0) {
    console.log(chalk.yellow('  Bottom Row Encoders:'));
    botEncoders.forEach(control => {
      const id = (control.controlId ?? 0) - 0x20 + 1;
      log.data(`    Encoder ${id}`, formatControlMapping(control));
    });
  }

  if (buttons.length > 0) {
    console.log(chalk.yellow('  Buttons:'));
    buttons.forEach(control => {
      const id = (control.controlId ?? 0) - 0x28 + 1;
      log.data(`    Button ${id}`, formatControlMapping(control));
    });
  }

  // Display color mappings if available
  if (mode.colors && mode.colors.size > 0) {
    console.log(chalk.yellow('  LED Colors:'));
    let colorCount = 0;
    mode.colors.forEach((color, controlId) => {
      if (colorCount < 5) { // Show first 5 colors
        const colorName = color === 0 ? 'Off' : `Color ${color}`;
        log.data(`    Control ${controlId}`, colorName);
        colorCount++;
      }
    });
    if (mode.colors.size > 5) {
      console.log(chalk.gray(`    ... and ${mode.colors.size - 5} more`));
    }
  }

  // Display labels if available
  if (mode.labels && mode.labels.size > 0) {
    console.log(chalk.yellow('  Labels:'));
    let labelCount = 0;
    mode.labels.forEach((label, controlId) => {
      if (labelCount < 5) { // Show first 5 labels
        log.data(`    Control ${controlId}`, label);
        labelCount++;
      }
    });
    if (mode.labels.size > 5) {
      console.log(chalk.gray(`    ... and ${mode.labels.size - 5} more`));
    }
  }

  // Statistics
  console.log(chalk.gray('  Statistics:'));
  log.data('    Total controls', controls.length);
  log.data('    Colors defined', mode.colors?.size || 0);
  log.data('    Labels defined', mode.labels?.size || 0);
}

async function testFetchCustomMode(): Promise<void> {
  log.title('Launch Control XL 3 - Custom Mode Fetch Test');
  console.log('='.repeat(50));

  if (requestedSlot !== undefined) {
    log.info(`Testing custom mode fetch for slot ${requestedSlot + 1}`);
  } else {
    log.info('Testing custom mode fetch for all slots');
  }
  console.log();

  let controller: LaunchControlXL3 | null = null;
  let backend: EasyMidiBackend | null = null;
  let success = false;

  try {
    // Step 1: Create and initialize EasyMidiBackend
    log.step('Creating EasyMidiBackend instance...');
    backend = new EasyMidiBackend();

    log.step('Initializing EasyMidiBackend...');
    await backend.initialize();
    log.success('EasyMidiBackend initialized successfully!');

    // Step 2: Create LaunchControlXL3 instance
    log.step('Creating LaunchControlXL3 instance...');
    controller = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: true,
      enableCustomModes: true,
    });

    // Step 3: Connect to device (performs full 4-message handshake)
    log.step('Connecting to device (4-message handshake)...');

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      controller!.once('device:connected', (info) => {
        clearTimeout(timeout);
        log.success('Device connected successfully!');
        log.data('Serial Number', info.serialNumber || 'Not available');
        resolve();
      });

      controller!.once('device:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await controller.connect();
    await connectionPromise;

    console.log();
    log.title('Fetching Custom Modes:');

    // Step 4: Fetch custom modes
    const slots = requestedSlot !== undefined ? [requestedSlot] : Array.from({ length: 15 }, (_, i) => i);
    const customModes: Map<number, CustomMode> = new Map();
    let fetchedCount = 0;

    for (const slot of slots) {
      try {
        log.step(`Reading custom mode from slot ${slot + 1}...`);

        // Set a timeout for the read operation
        const readPromise = controller.readCustomMode(slot);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Read timeout')), 3000);
        });

        const mode = await Promise.race([readPromise, timeoutPromise]);

        if (mode) {
          customModes.set(slot, mode);
          fetchedCount++;
          log.success(`Successfully read custom mode from slot ${slot + 1}: "${mode.name || 'Untitled'}"`);
        } else {
          log.warning(`Slot ${slot + 1} is empty or unreadable`);
        }
      } catch (error: any) {
        if (error.message.includes('timeout')) {
          log.warning(`Slot ${slot + 1}: Read timeout (slot may be empty)`);
        } else {
          log.error(`Slot ${slot + 1}: ${error.message}`);
        }
      }
    }

    // Step 5: Display fetched custom modes
    console.log();
    log.title('Custom Mode Details:');

    if (customModes.size === 0) {
      log.warning('No custom modes found on the device');
    } else {
      customModes.forEach((mode, slot) => {
        displayCustomMode(slot, mode);
      });

      console.log();
      log.success(`Successfully fetched ${fetchedCount} custom mode(s) from the device!`);
    }

    success = true;

  } catch (error: any) {
    console.log();
    log.error('Custom mode fetch test failed!');
    log.error(`Error: ${error.message}`);

    // Provide troubleshooting guidance
    console.log();
    log.title('Troubleshooting Guide:');

    if (error.message.includes('No MIDI')) {
      log.warning('No MIDI devices found. Check:');
      console.log('  • Launch Control XL 3 is connected via USB');
      console.log('  • Device is powered on and recognized by your system');
      console.log('  • Try reconnecting the USB cable');
    } else if (error.message.includes('handshake')) {
      log.warning('Device handshake failed. Check:');
      console.log('  • Device firmware is up to date');
      console.log('  • Device supports the new 4-message handshake protocol');
      console.log('  • Try power cycling the device');
    } else if (error.message.includes('timeout')) {
      log.warning('Communication timeout. Check:');
      console.log('  • Device is not being used by another application');
      console.log('  • USB connection is stable');
      console.log('  • Try reducing the number of slots being read');
    } else if (error.message.includes('custom mode')) {
      log.warning('Custom mode read failed. Check:');
      console.log('  • Device has custom modes configured');
      console.log('  • Device firmware supports custom mode reading');
      console.log('  • Try reading a specific slot instead of all slots');
    } else {
      log.warning('Unexpected error. General troubleshooting:');
      console.log('  • Restart the device (unplug/reconnect USB)');
      console.log('  • Check system MIDI settings');
      console.log('  • Try running the handshake test first');
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
testFetchCustomMode().catch((error) => {
  log.error(`Unexpected script error: ${error.message}`);
  process.exit(1);
});