#!/usr/bin/env node
/**
 * Akai Sampler Backup CLI
 *
 * Command-line tool for backing up hardware Akai samplers using rsnapshot
 */

import { Command } from "commander";
import { runBackup } from "@/backup/rsnapshot-wrapper.js";
import { getDefaultConfigPath } from "@/config/rsnapshot-config.js";
import type { RsnapshotInterval } from "@/types/index.js";

const program = new Command();

program
    .name("akai-backup")
    .description("Backup Akai sampler disk images using rsnapshot")
    .version("1.0.0");

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
    .description("Run rsnapshot backup")
    .argument("[interval]", "Backup interval: daily, weekly, monthly (default: daily)", "daily")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .action(async (interval: string, options) => {
        try {
            const configPath = options.config || getDefaultConfigPath();

            // Validate interval
            const validIntervals = ["daily", "weekly", "monthly"];
            if (!validIntervals.includes(interval)) {
                console.error(`Invalid interval: ${interval}`);
                console.error(`Valid intervals: ${validIntervals.join(", ")}`);
                process.exit(1);
            }

            const result = await runBackup({
                interval: interval as RsnapshotInterval,
                configPath,
            });

            if (!result.success) {
                console.error("\nBackup failed:");
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
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
    .action(async (options) => {
        try {
            const configPath = options.config || getDefaultConfigPath();

            const result = await runBackup({
                interval: "daily",
                configPath,
            });

            if (!result.success) {
                console.error("\nBackup failed:");
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
