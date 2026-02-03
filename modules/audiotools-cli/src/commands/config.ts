/**
 * Config Command
 *
 * Interactive configuration wizard for all audio-tools.
 * Manages the unified configuration file at ~/.audiotools/config.json
 */

import { Command } from 'commander';
import { runConfigWizard, loadConfig, DEFAULT_CONFIG_PATH } from '@audiocontrol/audiotools-config';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';

/**
 * Display current configuration
 */
async function displayConfig(): Promise<void> {
  try {
    if (!existsSync(DEFAULT_CONFIG_PATH)) {
      console.log('No configuration file found.');
      console.log(`Expected location: ${DEFAULT_CONFIG_PATH}`);
      console.log('\nRun "audiotools config" to create one.');
      return;
    }

    const configContent = await readFile(DEFAULT_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    console.log('\nCurrent Configuration:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(config, null, 2));
    console.log('='.repeat(60));
    console.log(`\nLocation: ${DEFAULT_CONFIG_PATH}`);
  } catch (error: any) {
    console.error(`Error reading configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(): Promise<void> {
  try {
    if (!existsSync(DEFAULT_CONFIG_PATH)) {
      console.log('No configuration file found. Nothing to reset.');
      return;
    }

    // Confirm reset
    console.log(`\nThis will delete your configuration file at:`);
    console.log(`  ${DEFAULT_CONFIG_PATH}`);
    console.log('\nYou will need to run "audiotools config" to reconfigure.');

    // For now, just delete the file
    // In the future, we could add a confirmation prompt
    await unlink(DEFAULT_CONFIG_PATH);
    console.log('\nConfiguration reset successfully.');
    console.log('Run "audiotools config" to create a new configuration.');
  } catch (error: any) {
    console.error(`Error resetting configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Config command - manage audio-tools configuration
 */
export const configCommand = new Command('config')
  .description('Configure audio tools (interactive wizard)')
  .option('--list', 'Display current configuration')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    try {
      if (options.list) {
        await displayConfig();
      } else if (options.reset) {
        await resetConfig();
      } else {
        // Run interactive wizard
        await runConfigWizard();
      }
    } catch (error: any) {
      console.error(`Configuration error: ${error.message}`);
      process.exit(1);
    }
  });
