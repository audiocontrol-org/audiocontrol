#!/usr/bin/env tsx

/**
 * Test script to verify control name sending works correctly
 * Reads from slot 8, modifies a control name, then writes to slot 1
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
  console.log(chalk.bold.blue('Launch Control XL 3 - Control Name Test'));
  console.log(chalk.gray('=' .repeat(60)));
  console.log(chalk.yellow('ℹ This will read slot 8, modify control names, write to slot 1'));
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

    // Step 3: Read from slot 8
    log.section(' STEP 1: READ FROM SLOT 8 ');
    log.info('Reading custom mode from slot 8...');

    const sourceMode = await controller.readCustomMode(7); // Slot 8 = index 7

    if (!sourceMode) {
      throw new Error('Failed to read mode from slot 8');
    }

    log.success('Mode read successfully from slot 8!');
    log.data('Original Mode Name', sourceMode.name || '(empty)');
    log.data('Control Count', Object.keys(sourceMode.controls).length);

    // Step 4: Modify control names
    log.section(' STEP 2: MODIFY CONTROL NAMES ');

    // Get the first fader control (control ID 1)
    const faderControlId = 'control_1';
    const firstFader = sourceMode.controls[faderControlId];

    if (firstFader) {
      log.info(`Modifying first fader control (${faderControlId}):`);
      log.data('Original Name', firstFader.name || '(no name)');

      // Set a distinctive name for the first fader
      firstFader.name = 'TestVolume1';
      log.data('New Name', firstFader.name);
    }

    // Also modify the first encoder (control ID 9)
    const encoderControlId = 'control_9';
    const firstEncoder = sourceMode.controls[encoderControlId];

    if (firstEncoder) {
      log.info(`Modifying first encoder control (${encoderControlId}):`);
      log.data('Original Name', firstEncoder.name || '(no name)');

      // Set a distinctive name for the first encoder
      firstEncoder.name = 'TestPan1';
      log.data('New Name', firstEncoder.name);
    }

    // Also set a mode name
    sourceMode.name = 'NameTest';
    log.success(`Mode name set to: "${sourceMode.name}"`);

    // Step 5: Write modified data to slot 1
    log.section(' STEP 3: WRITE TO SLOT 1 ');
    log.info('Writing modified data to slot 1...');

    // Convert controls object to array format if needed
    const controlsArray = Array.isArray(sourceMode.controls)
      ? sourceMode.controls
      : Object.values(sourceMode.controls);

    // Convert colors to array format if needed
    const colorsArray = sourceMode.colors
      ? (Array.isArray(sourceMode.colors)
        ? sourceMode.colors
        : Array.from(sourceMode.colors.entries()).map(([controlId, color]) => ({
            controlId,
            color,
            behaviour: 'static'
          })))
      : [];

    const modeToWrite = {
      ...sourceMode,
      controls: controlsArray,
      colors: colorsArray
    };

    await controller.writeCustomMode(0, modeToWrite as any); // Slot 1 = index 0
    log.success('Modified data written to slot 1!');

    // Step 6: Verify by reading back from slot 1
    log.section(' STEP 4: VERIFY SLOT 1 ');
    log.info('Reading back from slot 1 to verify...');

    const verifyMode = await controller.readCustomMode(0); // Slot 1 = index 0

    if (!verifyMode) {
      throw new Error('Failed to read back from slot 1');
    }

    log.success('Slot 1 read successfully!');
    log.data('Mode Name', verifyMode.name || '(empty)');
    log.data('Control Count', Object.keys(verifyMode.controls).length);

    // Check if the names match
    const verifyFader = verifyMode.controls[faderControlId];
    const verifyEncoder = verifyMode.controls[encoderControlId];

    console.log();
    log.section(' VERIFICATION RESULTS ');

    if (verifyMode.name === 'NameTest') {
      log.success(`✓ Mode name matches: "${verifyMode.name}"`);
    } else {
      log.warning(`✗ Mode name mismatch: Expected "NameTest", got "${verifyMode.name || '(empty)'}"`);
    }

    if (verifyFader && verifyFader.name === 'TestVolume1') {
      log.success(`✓ Fader name matches: "${verifyFader.name}"`);
    } else {
      log.warning(`✗ Fader name mismatch: Expected "TestVolume1", got "${verifyFader?.name || '(empty)'}"`);
    }

    if (verifyEncoder && verifyEncoder.name === 'TestPan1') {
      log.success(`✓ Encoder name matches: "${verifyEncoder.name}"`);
    } else {
      log.warning(`✗ Encoder name mismatch: Expected "TestPan1", got "${verifyEncoder?.name || '(empty)'}"`);
    }

    console.log();
    log.section(' MANUAL VERIFICATION REQUIRED ');
    console.log(chalk.yellow('Please check the device to verify:'));
    console.log(chalk.gray('  1. Slot 1 is named "NameTest"'));
    console.log(chalk.gray('  2. First fader is named "TestVolume1"'));
    console.log(chalk.gray('  3. First encoder is named "TestPan1"'));
    console.log();

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