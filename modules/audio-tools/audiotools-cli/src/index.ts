#!/usr/bin/env node
/**
 * Audio Tools - Unified CLI
 *
 * Single command-line interface for all audio-tools functionality:
 * - Backup: Incremental backups of Akai sampler disk images
 * - Export: Extract and convert disk images to modern formats
 * - Config: Interactive configuration wizard for all tools
 *
 * @packageDocumentation
 * @module @oletizi/audiotools
 */

import { Command } from 'commander';
import { backupCommand } from './commands/backup.js';
import { exportCommand } from './commands/export.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('audiotools')
  .description('Audio Tools - Backup, extract, and convert Akai sampler data')
  .version('1.0.0');

// Add subcommands
program.addCommand(backupCommand);
program.addCommand(exportCommand);
program.addCommand(configCommand);

// Parse arguments
program.parse();
