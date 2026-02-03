#!/usr/bin/env node

/**
 * Launch Control XL 3 CLI Tool
 *
 * Simple command-line interface for testing the Launch Control XL 3 library
 */

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { LaunchControlXL3 } from '../LaunchControlXL3.js';
import type { CustomMode } from '../types/CustomMode.js';

const program = new Command();
const VERSION = '0.1.0';

// Controller instance
let controller: LaunchControlXL3 | null = null;

/**
 * Connect to device
 */
async function connect(): Promise<LaunchControlXL3> {
  if (controller && controller.isConnected()) {
    return controller;
  }

  console.log('Connecting to Launch Control XL 3...');

  try {
    controller = new LaunchControlXL3({
      enableCustomModes: true,
      deviceNameFilter: 'LCXL3 1'  // Use LCXL3 ports
    });

    await controller.connect();
    console.log('✓ Connected successfully');

    // Setup basic event listeners
    controller.on('control:change', (controlId: string, value: number) => {
      console.log(`[Control] ${controlId}: ${value}`);
    });

    controller.on('device:disconnected', () => {
      console.log('[Device] Disconnected');
      controller = null;
    });

    return controller;
  } catch (error) {
    console.error(`Failed to connect: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (controller) {
    await controller.cleanup();
  }
  process.exit(0);
});

// ============================================
// CLI Setup
// ============================================

program
  .name('lcxl3')
  .description('Launch Control XL 3 CLI Tool')
  .version(VERSION);

// Connect command
program
  .command('connect')
  .description('Connect to Launch Control XL 3')
  .action(async () => {
    try {
      await connect();
      console.log('Device ready for use');
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show device status')
  .action(async () => {
    try {
      const ctrl = await connect();
      const status = ctrl.getStatus();

      console.log('\nDevice Status:');
      console.log('─'.repeat(30));
      console.log(`Connected: ${status.connected ? 'Yes' : 'No'}`);
      console.log(`State: ${status.state}`);

      if (status.deviceInfo) {
        console.log(`Firmware: ${status.deviceInfo.firmwareVersion}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor control changes')
  .action(async () => {
    try {
      const ctrl = await connect();
      console.log('Monitoring controls (Ctrl+C to exit)...');
      console.log('─'.repeat(30));

      ctrl.on('control:change', (controlId: string, value: number) => {
        const bar = '█'.repeat(Math.round((value / 127) * 20));
        const empty = '░'.repeat(20 - bar.length);
        console.log(`${controlId.padEnd(12)} [${bar}${empty}] ${value}`);
      });

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Load mode command
program
  .command('load-mode <slot>')
  .description('Load custom mode (0-15)')
  .action(async (slot: string) => {
    try {
      const ctrl = await connect();
      const slotNum = parseInt(slot, 10);

      if (slotNum < 0 || slotNum > 15) {
        console.error('Slot must be 0-15');
        process.exit(1);
      }

      console.log(`Loading mode from slot ${slotNum}...`);
      const mode = await ctrl.loadCustomMode(slotNum as any);
      console.log(`✓ Loaded mode: ${mode.name}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Write mode command
program
  .command('write-mode <slot> <file>')
  .description('Write custom mode to slot (0-15) from JSON file')
  .action(async (slot: string, file: string) => {
    try {
      const ctrl = await connect();
      const slotNum = parseInt(slot, 10);

      // Validate slot number
      if (isNaN(slotNum) || slotNum < 0 || slotNum > 15) {
        console.error('Slot must be 0-15');
        process.exit(1);
      }

      // Read JSON file
      console.log(`Reading mode from ${file}...`);
      let fileContent: string;
      try {
        fileContent = await readFile(file, 'utf-8');
      } catch (error) {
        console.error(`Failed to read file: ${(error as Error).message}`);
        process.exit(1);
      }

      // Parse JSON
      let mode: CustomMode;
      try {
        mode = JSON.parse(fileContent) as CustomMode;
      } catch (error) {
        console.error(`Failed to parse JSON: ${(error as Error).message}`);
        process.exit(1);
      }

      // Write mode to device
      console.log(`Writing mode to slot ${slotNum}...`);
      await ctrl.writeCustomMode(slotNum, mode);
      console.log(`✓ Mode written successfully`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
