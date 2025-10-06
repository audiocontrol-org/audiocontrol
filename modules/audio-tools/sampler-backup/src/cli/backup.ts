#!/usr/bin/env node
/**
 * Akai Sampler Backup CLI
 *
 * Command-line tool for backing up hardware Akai samplers using rsnapshot
 */

import { Command } from "commander";
import { runBackup } from "@/backup/rsnapshot-wrapper.js";
import { getDefaultConfigPath, getDefaultRsnapshotConfig } from "@/config/rsnapshot-config.js";
import { BackupSourceFactory } from "@/sources/backup-source-factory.js";
import type { RsnapshotInterval } from "@/types/index.js";

const program = new Command();

program
    .name("akai-backup")
    .description("Backup Akai sampler disk images from remote hosts or local media")
    .version("1.0.0")
    .addHelpText('after', `
Examples:
  $ akai-backup backup daily              Backup using rsnapshot config (remote)
  $ akai-backup --source /Volumes/SDCARD  Backup from local SD card
  $ akai-backup --source pi@pi.local:/images  Backup from remote SSH host
  $ akai-backup --source /mnt/usb --subdir my-usb  Custom backup subdirectory
  $ akai-backup batch                     Daily backup (alias for 'backup daily')
  $ akai-backup batch --source /Volumes/GOTEK  Daily backup from local source
  $ akai-backup config                    Generate rsnapshot configuration file
  $ akai-backup test                      Test rsnapshot configuration

Source Detection:
  - Paths with ':' are treated as remote SSH sources (e.g., user@host:/path)
  - Other paths are treated as local filesystem sources (e.g., /Volumes/SDCARD)
  - Backup subdirectory is auto-generated from source if not specified
`);

// Generate config command
program
    .command("config")
    .description("Generate rsnapshot configuration file")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .option("--test", "Test the configuration after generating")
    .action(async (options) => {
        try {
            const configPath = options.config || getDefaultConfigPath();

            const result = await runBackup({
                configPath,
                configOnly: true,
            });

            if (!result.success) {
                console.error("Config generation failed:");
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
            }

            console.log(`\nConfiguration written to: ${configPath}`);
            console.log(`Snapshot root: ${result.snapshotPath}`);

            if (options.test) {
                console.log("");
                const testResult = await runBackup({
                    configPath,
                    test: true,
                });

                if (!testResult.success) {
                    process.exit(1);
                }
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Test config command
program
    .command("test")
    .description("Test rsnapshot configuration")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .action(async (options) => {
        try {
            const configPath = options.config || getDefaultConfigPath();

            const result = await runBackup({
                configPath,
                test: true,
            });

            if (!result.success) {
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Backup command
program
    .command("backup")
    .description("Run backup from remote host or local media")
    .argument("[interval]", "Backup interval: daily, weekly, monthly (default: daily)", "daily")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .option("-s, --source <path>", "Local or remote source path (e.g., /Volumes/SDCARD or pi@host:/path)")
    .option("--subdir <name>", "Backup subdirectory name (default: auto-generated from source)")
    .action(async (interval: string, options) => {
        try {
            // Validate interval
            const validIntervals = ["daily", "weekly", "monthly"];
            if (!validIntervals.includes(interval)) {
                console.error(`Invalid interval: ${interval}`);
                console.error(`Valid intervals: ${validIntervals.join(", ")}`);
                process.exit(1);
            }

            const typedInterval = interval as RsnapshotInterval;

            // If --source is provided, use BackupSourceFactory
            if (options.source) {
                console.log(`Backing up from source: ${options.source}`);

                const defaultConfig = getDefaultRsnapshotConfig();
                const source = BackupSourceFactory.fromPath(options.source, {
                    snapshotRoot: defaultConfig.snapshotRoot,
                    backupSubdir: options.subdir,
                    configPath: options.config,
                });

                const config = source.getConfig();
                console.log(`Source type: ${config.type}`);
                console.log(`Backup subdirectory: ${config.backupSubdir}`);
                console.log(`Snapshot root: ${defaultConfig.snapshotRoot}`);
                console.log("");

                const result = await source.backup(typedInterval);

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n✓ Backup complete");
            } else {
                // Existing rsnapshot workflow (backward compatible)
                const configPath = options.config || getDefaultConfigPath();

                const result = await runBackup({
                    interval: typedInterval,
                    configPath,
                });

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Batch command (alias for 'backup daily')
program
    .command("batch")
    .description("Run daily backup (alias for 'backup daily')")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .option("-s, --source <path>", "Local or remote source path (e.g., /Volumes/SDCARD or pi@host:/path)")
    .option("--subdir <name>", "Backup subdirectory name (default: auto-generated from source)")
    .action(async (options) => {
        try {
            const typedInterval: RsnapshotInterval = "daily";

            // If --source is provided, use BackupSourceFactory
            if (options.source) {
                console.log(`Backing up from source: ${options.source}`);

                const defaultConfig = getDefaultRsnapshotConfig();
                const source = BackupSourceFactory.fromPath(options.source, {
                    snapshotRoot: defaultConfig.snapshotRoot,
                    backupSubdir: options.subdir,
                    configPath: options.config,
                });

                const config = source.getConfig();
                console.log(`Source type: ${config.type}`);
                console.log(`Backup subdirectory: ${config.backupSubdir}`);
                console.log(`Snapshot root: ${defaultConfig.snapshotRoot}`);
                console.log("");

                const result = await source.backup(typedInterval);

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n✓ Backup complete");
            } else {
                // Existing rsnapshot workflow (backward compatible)
                const configPath = options.config || getDefaultConfigPath();

                const result = await runBackup({
                    interval: typedInterval,
                    configPath,
                });

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
