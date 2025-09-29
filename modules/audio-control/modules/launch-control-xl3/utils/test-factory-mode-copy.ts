#!/usr/bin/env tsx

/**
 * Test script to copy factory default custom mode from slot 16 to slot 1
 * This helps verify that the read and write functions work correctly
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

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
  console.log(chalk.bold.blue('Launch Control XL 3 - Mode Copy Test'));
  console.log(chalk.gray('=' .repeat(60)));
  console.log(chalk.yellow('ℹ This will copy data from slot 8 to slot 1'));
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

    // Step 3: Read from slot 8 (index 7) - checking for valid data
    log.section(' STEP 1: READ FROM SLOT 8 ');
    log.info('Reading custom mode from slot 8...');

    const factoryMode = await controller.readCustomMode(7); // Slot 8 = index 7

    if (!factoryMode) {
      throw new Error('Failed to read mode from slot 8');
    }

    log.success('Mode read successfully from slot 8!');
    log.data('Mode Name', factoryMode.name);
    log.data('Control Count', Object.keys(factoryMode.controls).length);

    // Display control details
    console.log(chalk.gray('\n  Factory Controls:'));
    let controlIndex = 0;
    for (const [key, control] of Object.entries(factoryMode.controls)) {
      if (controlIndex < 10) { // Show first 10 controls
        const name = control.name || '(no name)';
        const channel = control.midiChannel ?? control.channel ?? 0;
        const cc = control.ccNumber ?? control.cc ?? 0;
        console.log(chalk.gray(`    ${key}: "${name}" (CH${channel + 1}, CC${cc})`));
      }
      controlIndex++;
    }
    if (controlIndex > 10) {
      console.log(chalk.gray(`    ... and ${controlIndex - 10} more controls`));
    }

    // Step 4: Save to file
    log.section(' STEP 2: SAVE TO FILE ');
    const outputDir = path.join(process.cwd(), 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, 'slot8-data.json');
    log.info(`Saving slot 8 data to ${outputFile}...`);

    const dataToSave = {
      timestamp: new Date().toISOString(),
      sourceSlot: 8,
      modeName: factoryMode.name,
      controls: factoryMode.controls,
      colors: factoryMode.colors,
      labels: factoryMode.labels,
      rawData: factoryMode
    };

    fs.writeFileSync(outputFile, JSON.stringify(dataToSave, null, 2));
    log.success('Slot 8 data saved to file!');

    // Step 5: Write to slot 1
    log.section(' STEP 3: WRITE TO SLOT 1 ');
    log.info('Writing slot 8 data to slot 1...');

    // Convert controls object to array format if needed
    const controlsArray = Array.isArray(factoryMode.controls)
      ? factoryMode.controls
      : Object.values(factoryMode.controls);

    // Convert colors to array format if needed
    const colorsArray = factoryMode.colors
      ? (Array.isArray(factoryMode.colors)
        ? factoryMode.colors
        : Array.from(factoryMode.colors.entries()).map(([controlId, color]) => ({
            controlId,
            color,
            behaviour: 'static'
          })))
      : [];

    const modeToWrite = {
      ...factoryMode,
      controls: controlsArray,
      colors: colorsArray
    };

    await controller.writeCustomMode(0, modeToWrite as any); // Slot 1 = index 0
    log.success('Slot 8 data written to slot 1!');

    // Step 6: Verify by reading back from slot 1
    log.section(' STEP 4: VERIFY SLOT 1 ');
    log.info('Reading back from slot 1 to verify...');

    const verifyMode = await controller.readCustomMode(0); // Slot 1 = index 0

    if (!verifyMode) {
      throw new Error('Failed to read back from slot 1');
    }

    log.success('Slot 1 read successfully!');
    log.data('Mode Name', verifyMode.name);
    log.data('Control Count', Object.keys(verifyMode.controls).length);

    // Compare names
    const namesMatch = factoryMode.name === verifyMode.name;
    if (namesMatch) {
      log.success(`Names match: "${factoryMode.name}"`);
    } else {
      log.warning(`Name mismatch: Factory="${factoryMode.name}", Slot1="${verifyMode.name}"`);
    }

    // Save verification data
    const verifyFile = path.join(outputDir, 'slot1-verification.json');
    log.info(`Saving slot 1 data to ${verifyFile}...`);

    const verifyDataToSave = {
      timestamp: new Date().toISOString(),
      slot: 1,
      modeName: verifyMode.name,
      controls: verifyMode.controls,
      colors: verifyMode.colors,
      labels: verifyMode.labels,
      rawData: verifyMode
    };

    fs.writeFileSync(verifyFile, JSON.stringify(verifyDataToSave, null, 2));
    log.success('Slot 1 data saved to file!');

    console.log();
    log.section(' SUMMARY ');
    log.success('Data from slot 8 has been copied to slot 1');
    log.info('Please check the device to verify:');
    console.log(chalk.gray('  1. Slot 1 name matches slot 8'));
    console.log(chalk.gray('  2. Slot 1 controls match slot 8'));
    console.log(chalk.gray('  3. Slot 1 colors match slot 8'));
    console.log();
    log.info('Data files saved to:');
    console.log(chalk.gray(`  - ${outputFile}`));
    console.log(chalk.gray(`  - ${verifyFile}`));

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