#!/usr/bin/env tsx

/**
 * Simple test to write a minimal custom mode with clear names
 * This helps diagnose if the write function is working at all
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import chalk from 'chalk';

// Logging utilities
const log = {
  info: (msg: string) => console.log(chalk.cyan(`→ ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`✗ ${msg}`)),
  warning: (msg: string) => console.log(chalk.yellow(`⚠ ${msg}`)),
  data: (label: string, value: any) => {
    console.log(chalk.gray(`  ${label}: ${chalk.white(value)}`));
  },
  section: (title: string) => {
    console.log(chalk.bgBlue.white.bold(`\n ${title} `));
  }
};

async function main() {
  console.log(chalk.bold.blue('Launch Control XL 3 - Simple Write Test'));
  console.log(chalk.gray('=' .repeat(60)));
  console.log(chalk.yellow('ℹ This will write a simple mode to slot 2 with clear names'));
  console.log();

  let controller: LaunchControlXL3 | null = null;
  let backend: EasyMidiBackend | null = null;

  try {
    // Step 1: Create backend and controller
    log.info('Creating EasyMidiBackend instance...');
    backend = new EasyMidiBackend();

    log.info('Initializing EasyMidiBackend...');
    await backend.initialize();
    log.success('EasyMidiBackend initialized successfully!');

    log.info('Creating LaunchControlXL3 instance...');
    controller = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: true,
      enableCustomModes: true,
    });

    // Step 2: Connect to device
    log.info('Connecting to Launch Control XL 3...');

    // Set up connection promise
    const connectPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      controller!.once('device:connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      controller!.once('device:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await controller.connect();
    await connectPromise;

    log.success('Connected to Launch Control XL 3!');
    console.log();

    // Step 3: Create a simple custom mode with just a few controls
    log.section(' CREATE SIMPLE MODE ');

    const simpleMode = {
      name: 'TEST123',  // Short, clear name
      controls: [
        {
          id: 'control_1',
          controlId: 1,
          type: 'fader' as const,
          name: 'VOL1',  // Short name for first fader
          midiChannel: 0,
          ccNumber: 13,
          minValue: 0,
          maxValue: 127,
          defaultValue: 0,
          behavior: 'absolute' as const
        },
        {
          id: 'control_2',
          controlId: 2,
          type: 'fader' as const,
          name: 'VOL2',  // Short name for second fader
          midiChannel: 0,
          ccNumber: 14,
          minValue: 0,
          maxValue: 127,
          defaultValue: 0,
          behavior: 'absolute' as const
        },
        {
          id: 'control_9',
          controlId: 9,
          type: 'encoder' as const,
          name: 'PAN1',  // Short name for first encoder
          midiChannel: 0,
          ccNumber: 21,
          minValue: 0,
          maxValue: 127,
          defaultValue: 64,
          behavior: 'absolute' as const
        }
      ],
      colors: [
        { controlId: 'control_1', color: 0x0F, behaviour: 'static' }, // Red for fader 1
        { controlId: 'control_2', color: 0x3C, behaviour: 'static' }, // Yellow for fader 2
        { controlId: 'control_9', color: 0x0C, behaviour: 'static' }  // Green for encoder 1
      ],
      labels: {}
    };

    log.info('Created simple mode with:');
    log.data('Mode Name', simpleMode.name);
    log.data('Control Count', simpleMode.controls.length);
    console.log();
    log.info('Controls:');
    simpleMode.controls.forEach(control => {
      log.data(`  ${control.id}`, `"${control.name}" (CC${control.ccNumber})`);
    });

    // Step 4: Write to slot 2 (to avoid slot 1 corruption)
    log.section(' WRITE TO SLOT 2 ');
    log.info('Writing simple mode to slot 2...');

    await controller.writeCustomMode(1, simpleMode as any); // Slot 2 = index 1

    log.success('Simple mode written to slot 2!');

    // Step 5: Verify by reading back
    log.section(' VERIFY SLOT 2 ');
    log.info('Reading back from slot 2 to verify...');

    const verifyMode = await controller.readCustomMode(1); // Slot 2 = index 1

    if (!verifyMode) {
      throw new Error('Failed to read back from slot 2');
    }

    log.success('Slot 2 read successfully!');
    log.data('Mode Name', verifyMode.name || '(empty)');
    log.data('Control Count', Object.keys(verifyMode.controls).length);

    // Check specific controls
    const fader1 = verifyMode.controls['control_1'];
    const fader2 = verifyMode.controls['control_2'];
    const encoder1 = verifyMode.controls['control_9'];

    console.log();
    log.section(' VERIFICATION RESULTS ');

    if (verifyMode.name === 'TEST123') {
      log.success(`✓ Mode name matches: "${verifyMode.name}"`);
    } else {
      log.warning(`✗ Mode name mismatch: Expected "TEST123", got "${verifyMode.name || '(empty)'}"`);
    }

    if (fader1?.name === 'VOL1') {
      log.success(`✓ Fader 1 name matches: "${fader1.name}"`);
    } else {
      log.warning(`✗ Fader 1 name mismatch: Expected "VOL1", got "${fader1?.name || '(empty)'}"`);
    }

    if (fader2?.name === 'VOL2') {
      log.success(`✓ Fader 2 name matches: "${fader2.name}"`);
    } else {
      log.warning(`✗ Fader 2 name mismatch: Expected "VOL2", got "${fader2?.name || '(empty)'}"`);
    }

    if (encoder1?.name === 'PAN1') {
      log.success(`✓ Encoder 1 name matches: "${encoder1.name}"`);
    } else {
      log.warning(`✗ Encoder 1 name mismatch: Expected "PAN1", got "${encoder1?.name || '(empty)'}"`);
    }

    console.log();
    log.section(' MANUAL VERIFICATION REQUIRED ');
    console.log(chalk.yellow('Please check the device to verify SLOT 2:'));
    console.log(chalk.gray('  1. Slot 2 should be named "TEST123"'));
    console.log(chalk.gray('  2. First fader should be named "VOL1" (red LED)'));
    console.log(chalk.gray('  3. Second fader should be named "VOL2" (yellow LED)'));
    console.log(chalk.gray('  4. First encoder should be named "PAN1" (green LED)'));
    console.log();

    // Also log the raw SysEx message for debugging
    log.section(' DEBUG INFO ');
    const sysexParser = (controller as any).customModeManager?.sysexParser;
    if (sysexParser) {
      const message = sysexParser.buildCustomModeWriteRequest(1, simpleMode);
      log.info(`SysEx message length: ${message.length} bytes`);

      // Show first 100 bytes in hex
      const hexStr = Array.from(message.slice(0, 100))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      log.data('First 100 bytes', hexStr);

      // Look for specific markers
      const labelMarkers = message.filter(b => b === 0x69);
      const colorMarkers = message.filter(b => b === 0x60);
      log.data('Label markers (0x69)', `${labelMarkers.length} found`);
      log.data('Color markers (0x60)', `${colorMarkers.length} found`);
    }

  } catch (error) {
    log.error(`Error: ${error}`);
    console.error(error);
  } finally {
    // Clean up
    if (controller) {
      log.info('Disconnecting from device...');
      await controller.disconnect();
      log.success('Disconnected successfully');
    }

    if (backend) {
      log.info('Cleaning up MIDI backend...');
      backend.cleanup();
    }
  }
}

// Run the test
main().catch(console.error);