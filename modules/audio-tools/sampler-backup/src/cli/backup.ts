#!/usr/bin/env node
/**
 * Akai Sampler Backup CLI
 *
 * Command-line tool for backing up hardware Akai samplers using BorgBackup
 */

import { Command } from "commander";
import { BackupSourceFactory } from "@/sources/backup-source-factory.js";
import { BorgBackupAdapter } from "@/backup/borg-backup-adapter.js";
import type { RsnapshotInterval } from "@/types/index.js";
import type { BorgRetentionPolicy } from "@/types/borg.js";
import { homedir } from 'os';
import { join } from 'pathe';

const program = new Command();
const DEFAULT_REPO_PATH = join(homedir(), '.audiotools', 'borg-repo');
const DEFAULT_SNAPSHOT_ROOT = join(homedir(), '.audiotools', 'backup');

/**
 * Default backup sources (pi-scsi2.local and s3k.local)
 */
const DEFAULT_SOURCES = [
  'pi@pi-scsi2.local:/home/orion/images/',
  'pi@s3k.local:/home/orion/images/'
];

/**
 * Default retention policy
 */
const DEFAULT_RETENTION: BorgRetentionPolicy = {
  daily: 7,
  weekly: 4,
  monthly: 12
};

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(2)} ${units[i]}`;
}

program
    .name("akai-backup")
    .description("Backup Akai sampler disk images using BorgBackup")
    .version("1.0.0-alpha.1")
    .addHelpText('after', `
Examples:
  $ akai-backup backup                    Backup default sources (pi-scsi2.local + s3k.local)
  $ akai-backup backup daily              Same as above (daily is default interval)
  $ akai-backup backup --source /Volumes/SDCARD  Backup from local SD card
  $ akai-backup backup --source pi@host:/images  Backup from custom remote SSH host
  $ akai-backup batch                     Daily backup (alias for 'backup daily')
  $ akai-backup list                      List all backup archives
  $ akai-backup list --json               List archives in JSON format
  $ akai-backup info                      Show repository statistics
  $ akai-backup restore <archive> <dest>  Restore specific archive
  $ akai-backup check                     Verify repository integrity
  $ akai-backup prune                     Manually prune old archives

Default Sources:
  - pi@pi-scsi2.local:/home/orion/images/
  - pi@s3k.local:/home/orion/images/

Repository:
  - Default location: ~/.audiotools/borg-repo
  - Compression: zstd (balanced speed/ratio)
  - Encryption: none (local trust model)
`);

// Generate config command (deprecated - rsnapshot removed)
program
    .command("config")
    .description("Generate rsnapshot configuration file (DEPRECATED)")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .option("--test", "Test the configuration after generating")
    .action(async (options) => {
        console.error("Error: The 'config' command has been removed.");
        console.error("Rsnapshot has been replaced with BorgBackup.");
        console.error("Please use --source flag for backup operations instead.");
        process.exit(1);
    });

// Test config command (deprecated - rsnapshot removed)
program
    .command("test")
    .description("Test rsnapshot configuration (DEPRECATED)")
    .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
    .action(async (options) => {
        console.error("Error: The 'test' command has been removed.");
        console.error("Rsnapshot has been replaced with BorgBackup.");
        console.error("Please use --source flag for backup operations instead.");
        process.exit(1);
    });

// Backup command
program
    .command("backup")
    .description("Run backup from remote hosts or local media using BorgBackup")
    .argument("[interval]", "Backup interval: daily, weekly, monthly (default: daily)", "daily")
    .option("-s, --source <path>", "Override default sources with specific path (local or remote SSH)")
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

            // If --source provided, use it; otherwise use defaults
            if (options.source) {
                console.log(`Backing up from source: ${options.source}`);
                console.log("");

                const source = BackupSourceFactory.fromPath(options.source, {
                    snapshotRoot: DEFAULT_SNAPSHOT_ROOT,
                    backupSubdir: options.subdir,
                });

                const config = source.getConfig();
                console.log(`Source type: ${config.type}`);
                console.log(`Backup subdirectory: ${config.backupSubdir}`);
                console.log(`Repository: ${DEFAULT_REPO_PATH}`);
                console.log("");

                const result = await source.backup(typedInterval);

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n✓ Backup complete");
            } else {
                // Use default sources
                console.log("Backing up from default sources:");
                DEFAULT_SOURCES.forEach(src => console.log(`  - ${src}`));
                console.log(`Repository: ${DEFAULT_REPO_PATH}`);
                console.log("");

                let hasErrors = false;
                const errors: string[] = [];

                for (const sourcePath of DEFAULT_SOURCES) {
                    try {
                        console.log(`\n--- Backing up ${sourcePath} ---`);
                        const source = BackupSourceFactory.fromPath(sourcePath, {
                            snapshotRoot: DEFAULT_SNAPSHOT_ROOT,
                        });

                        const result = await source.backup(typedInterval);

                        if (!result.success) {
                            hasErrors = true;
                            result.errors.forEach(err => errors.push(err));
                            console.error("\nBackup failed for this source:");
                            result.errors.forEach((err) => console.error(`  - ${err}`));
                        } else {
                            console.log("\n✓ Backup complete for this source");
                        }
                    } catch (err: any) {
                        hasErrors = true;
                        const errorMsg = `Failed to backup ${sourcePath}: ${err.message}`;
                        errors.push(errorMsg);
                        console.error(`\nError: ${errorMsg}`);
                    }
                }

                if (hasErrors) {
                    console.error("\n\nSome backups failed:");
                    errors.forEach(err => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n\n✓ All backups complete");
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Batch command (alias for 'backup daily')
program
    .command("batch")
    .description("Run daily backup from default sources (alias for 'backup daily')")
    .option("-s, --source <path>", "Override default sources with specific path")
    .option("--subdir <name>", "Backup subdirectory name (default: auto-generated from source)")
    .action(async (options) => {
        try {
            const typedInterval: RsnapshotInterval = "daily";

            // If --source provided, use it; otherwise use defaults
            if (options.source) {
                console.log(`Backing up from source: ${options.source}`);
                console.log("");

                const source = BackupSourceFactory.fromPath(options.source, {
                    snapshotRoot: DEFAULT_SNAPSHOT_ROOT,
                    backupSubdir: options.subdir,
                });

                const config = source.getConfig();
                console.log(`Source type: ${config.type}`);
                console.log(`Backup subdirectory: ${config.backupSubdir}`);
                console.log(`Repository: ${DEFAULT_REPO_PATH}`);
                console.log("");

                const result = await source.backup(typedInterval);

                if (!result.success) {
                    console.error("\nBackup failed:");
                    result.errors.forEach((err) => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n✓ Backup complete");
            } else {
                // Use default sources
                console.log("Backing up from default sources:");
                DEFAULT_SOURCES.forEach(src => console.log(`  - ${src}`));
                console.log(`Repository: ${DEFAULT_REPO_PATH}`);
                console.log("");

                let hasErrors = false;
                const errors: string[] = [];

                for (const sourcePath of DEFAULT_SOURCES) {
                    try {
                        console.log(`\n--- Backing up ${sourcePath} ---`);
                        const source = BackupSourceFactory.fromPath(sourcePath, {
                            snapshotRoot: DEFAULT_SNAPSHOT_ROOT,
                        });

                        const result = await source.backup(typedInterval);

                        if (!result.success) {
                            hasErrors = true;
                            result.errors.forEach(err => errors.push(err));
                            console.error("\nBackup failed for this source:");
                            result.errors.forEach((err) => console.error(`  - ${err}`));
                        } else {
                            console.log("\n✓ Backup complete for this source");
                        }
                    } catch (err: any) {
                        hasErrors = true;
                        const errorMsg = `Failed to backup ${sourcePath}: ${err.message}`;
                        errors.push(errorMsg);
                        console.error(`\nError: ${errorMsg}`);
                    }
                }

                if (hasErrors) {
                    console.error("\n\nSome backups failed:");
                    errors.forEach(err => console.error(`  - ${err}`));
                    process.exit(1);
                }

                console.log("\n\n✓ All backups complete");
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// List archives command
program
    .command("list")
    .description("List all backup archives in repository")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
        try {
            const adapter = new BorgBackupAdapter({
                repoPath: DEFAULT_REPO_PATH,
                compression: 'zstd',
                encryption: 'none'
            });

            const archives = await adapter.listArchives();

            if (options.json) {
                console.log(JSON.stringify(archives, null, 2));
            } else {
                if (archives.length === 0) {
                    console.log("No archives found in repository.");
                    return;
                }

                console.log(`Found ${archives.length} archive(s):\n`);
                archives.forEach((archive) => {
                    console.log(`  ${archive.name}`);
                    console.log(`    Date: ${archive.timestamp.toISOString()}`);
                    console.log(`    Files: ${archive.stats.nfiles}`);
                    if (archive.stats.originalSize > 0) {
                        console.log(`    Original size: ${formatBytes(archive.stats.originalSize)}`);
                        console.log(`    Compressed size: ${formatBytes(archive.stats.compressedSize)}`);
                        console.log(`    Deduplicated size: ${formatBytes(archive.stats.dedupedSize)}`);

                        const compressionRatio = archive.stats.originalSize > 0
                            ? (1 - archive.stats.compressedSize / archive.stats.originalSize) * 100
                            : 0;
                        const dedupRatio = archive.stats.originalSize > 0
                            ? (1 - archive.stats.dedupedSize / archive.stats.originalSize) * 100
                            : 0;

                        console.log(`    Compression ratio: ${compressionRatio.toFixed(1)}%`);
                        console.log(`    Deduplication ratio: ${dedupRatio.toFixed(1)}%`);
                    }
                    console.log("");
                });
            }
        } catch (err: any) {
            console.error(`Error listing archives: ${err.message}`);
            process.exit(1);
        }
    });

// Info command
program
    .command("info")
    .description("Show repository statistics and information")
    .action(async () => {
        try {
            const adapter = new BorgBackupAdapter({
                repoPath: DEFAULT_REPO_PATH,
                compression: 'zstd',
                encryption: 'none'
            });

            const info = await adapter.getRepositoryInfo();

            console.log("Repository Information:");
            console.log(`  Path: ${info.path}`);
            console.log(`  ID: ${info.id}`);
            console.log(`  Last modified: ${info.lastModified.toISOString()}`);
            console.log(`  Encryption: ${info.encryption}`);
            console.log("");
            console.log("Statistics:");
            console.log(`  Total archives: ${info.archiveCount}`);
            console.log(`  Original size: ${formatBytes(info.originalSize)}`);
            console.log(`  Compressed size: ${formatBytes(info.compressedSize)}`);
            console.log(`  Deduplicated size: ${formatBytes(info.dedupedSize)}`);

            const compressionRatio = info.originalSize > 0
                ? (1 - info.compressedSize / info.originalSize) * 100
                : 0;
            const dedupRatio = info.originalSize > 0
                ? (1 - info.dedupedSize / info.originalSize) * 100
                : 0;

            console.log(`  Compression ratio: ${compressionRatio.toFixed(1)}%`);
            console.log(`  Space saved by deduplication: ${dedupRatio.toFixed(1)}%`);
        } catch (err: any) {
            console.error(`Error getting repository info: ${err.message}`);
            process.exit(1);
        }
    });

// Restore command
program
    .command("restore")
    .description("Restore a specific archive to destination directory")
    .argument("<archive>", "Archive name to restore")
    .argument("<destination>", "Destination directory for restored files")
    .action(async (archive: string, destination: string) => {
        try {
            const adapter = new BorgBackupAdapter({
                repoPath: DEFAULT_REPO_PATH,
                compression: 'zstd',
                encryption: 'none'
            });

            console.log(`Restoring archive: ${archive}`);
            console.log(`Destination: ${destination}`);
            console.log("");

            await adapter.restoreArchive(
                archive,
                destination,
                (progress) => {
                    const percent = progress.totalFiles > 0
                        ? ((progress.filesProcessed / progress.totalFiles) * 100).toFixed(1)
                        : '0.0';
                    console.log(`Progress: ${progress.filesProcessed}/${progress.totalFiles} files (${percent}%), ${formatBytes(progress.bytesProcessed)}`);
                }
            );

            console.log("\n✓ Restore complete");
        } catch (err: any) {
            console.error(`Error restoring archive: ${err.message}`);
            process.exit(1);
        }
    });

// Check command
program
    .command("check")
    .description("Verify repository integrity and consistency")
    .action(async () => {
        try {
            const adapter = new BorgBackupAdapter({
                repoPath: DEFAULT_REPO_PATH,
                compression: 'zstd',
                encryption: 'none'
            });

            console.log("Checking repository integrity...");
            console.log("This may take a while for large repositories.\n");

            const isValid = await adapter.checkRepository();

            if (isValid) {
                console.log("\n✓ Repository check passed - no errors found");
            } else {
                console.error("\n✗ Repository check failed - see errors above");
                process.exit(1);
            }
        } catch (err: any) {
            console.error(`Error checking repository: ${err.message}`);
            process.exit(1);
        }
    });

// Prune command
program
    .command("prune")
    .description("Manually prune old archives based on retention policy")
    .option("--daily <n>", "Keep last N daily backups", "7")
    .option("--weekly <n>", "Keep last N weekly backups", "4")
    .option("--monthly <n>", "Keep last N monthly backups", "12")
    .action(async (options) => {
        try {
            const adapter = new BorgBackupAdapter({
                repoPath: DEFAULT_REPO_PATH,
                compression: 'zstd',
                encryption: 'none'
            });

            const policy: BorgRetentionPolicy = {
                daily: parseInt(options.daily, 10),
                weekly: parseInt(options.weekly, 10),
                monthly: parseInt(options.monthly, 10)
            };

            console.log("Pruning old archives with policy:");
            console.log(`  Daily: keep last ${policy.daily}`);
            console.log(`  Weekly: keep last ${policy.weekly}`);
            console.log(`  Monthly: keep last ${policy.monthly}`);
            console.log("");

            await adapter.pruneArchives(policy);

            console.log("\n✓ Prune complete");
        } catch (err: any) {
            console.error(`Error pruning archives: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
