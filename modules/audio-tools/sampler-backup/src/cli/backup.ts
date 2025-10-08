#!/usr/bin/env node
/**
 * Akai Sampler Backup CLI
 *
 * Command-line tool for backing up hardware Akai samplers using rsync
 */

import { Command } from "commander";
import { RemoteSource } from "@/sources/remote-source.js";
import { LocalSource } from "@/sources/local-source.js";
import type { RemoteSourceConfig, LocalSourceConfig } from "@/sources/backup-source.js";
import { homedir } from 'os';
import { join } from 'pathe';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const program = new Command();
const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');

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

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error: any) {
    console.error(`Error reading directory ${dirPath}: ${error.message}`);
  }

  return totalSize;
}

/**
 * Count files in a directory recursively
 */
async function countFiles(dirPath: string): Promise<number> {
  let fileCount = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        fileCount += await countFiles(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
      }
    }
  } catch (error: any) {
    console.error(`Error reading directory ${dirPath}: ${error.message}`);
  }

  return fileCount;
}

/**
 * Check if path is a remote SSH path
 */
function isRemotePath(path: string): boolean {
  const hasColon = path.includes(':');
  const isWindowsPath = /^[A-Za-z]:/.test(path);
  return hasColon && !isWindowsPath;
}

/**
 * Parse remote SSH path into host and source path
 */
function parseRemotePath(path: string): { host: string; sourcePath: string } {
  const colonIndex = path.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid remote path format: ${path}`);
  }

  const hostPart = path.substring(0, colonIndex);
  const sourcePath = path.substring(colonIndex + 1);

  if (!hostPart || !sourcePath) {
    throw new Error(`Invalid remote path format: ${path}. Expected format: host:/path or user@host:/path`);
  }

  return { host: hostPart, sourcePath };
}

/**
 * Generate sampler name from hostname
 */
function samplerNameFromHost(host: string): string {
  // Remove .local suffix if present
  const cleaned = host.replace(/\.local$/, '');
  // Remove user@ prefix if present
  const withoutUser = cleaned.includes('@') ? cleaned.split('@')[1] : cleaned;
  // Replace dots and slashes with hyphens
  return withoutUser.replace(/[.\/]/g, '-');
}

/**
 * Shared sync/backup action handler
 */
async function handleSyncCommand(options: any): Promise<void> {
  try {
    // Detect source type
    const isRemote = isRemotePath(options.source);

    // For local sources, require --sampler
    if (!isRemote && !options.sampler) {
      console.error("Error: --sampler is required for local sources");
      console.error("Example: --sampler s5k-studio");
      process.exit(1);
    }

    console.log(`Source: ${options.source}`);
    console.log(`Device: ${options.device}`);
    if (options.sampler) {
      console.log(`Sampler: ${options.sampler}`);
    }
    if (options.dryRun) {
      console.log("Mode: DRY RUN (no changes will be made)");
    }
    console.log("");

    // Create appropriate source
    let source;
    if (isRemote) {
      const { host, sourcePath } = parseRemotePath(options.source);
      const sampler = options.sampler ?? samplerNameFromHost(host);

      const config: RemoteSourceConfig = {
        type: 'remote',
        host,
        sourcePath,
        device: options.device,
        sampler,
      };

      source = new RemoteSource(config);
      console.log(`Sampler: ${sampler} (from hostname)`);
    } else {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: options.source,
        sampler: options.sampler,
        device: options.device,
        backupSubdir: options.sampler, // Deprecated but required
      };

      source = new LocalSource(config);
    }

    console.log(`Syncing to: ${source.getBackupPath()}`);
    console.log("");

    // Execute sync
    const result = await source.backup('daily'); // interval not used with rsync

    if (!result.success) {
      console.error("\nSync failed:");
      result.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log("\n✓ Sync complete");
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

program
    .name("akai-backup")
    .description("Backup Akai sampler disk images using rsync")
    .version("1.0.0")
    .addHelpText('after', `
Examples:
  Remote (SSH) backup - PiSCSI:
    $ akai-backup sync --source pi-scsi2.local:~/images/ --device images
    $ akai-backup sync --source pi@host:/data/images --device images

  Local media backup:
    $ akai-backup sync --source /Volumes/DSK0 --sampler s5k-studio --device floppy
    $ akai-backup sync --source /Volumes/GOTEK --sampler s3k-zulu --device floppy

  List synced backups:
    $ akai-backup list --all
    $ akai-backup list --sampler pi-scsi2
    $ akai-backup list --sampler s5k-studio --device floppy

Directory Structure:
  ~/.audiotools/backup/
  ├── pi-scsi2/              # Remote sampler (hostname)
  │   └── images/            # PiSCSI disk images directory
  │       ├── HD0.hds
  │       ├── HD1.hds
  │       └── akai.img
  └── s5k-studio/            # Local sampler (via --sampler)
      └── floppy/            # Floppy emulator
          └── DSK0.img

Requirements:
  - rsync: Installed by default on macOS and most Linux systems
  - SSH access to remote hosts (passwordless keys recommended)

How It Works:
  Simple file-level synchronization using rsync. Only changed files are
  transferred. Files are organized hierarchically by sampler and device.
  No snapshots, no archives - just fast, simple sync.
`);

// Sync command (main backup command)
program
    .command("sync")
    .description("Sync sampler disk images from remote or local source")
    .requiredOption("-s, --source <path>", "Source path (local or remote SSH)")
    .requiredOption("-d, --device <name>", "Device name (scsi0, scsi1, floppy, etc.)")
    .option("--sampler <name>", "Sampler name (required for local sources, optional for remote)")
    .option("--dry-run", "Show what would be synced without actually syncing")
    .action(handleSyncCommand);

// Backup command (alias for sync)
program
    .command("backup")
    .description("Alias for 'sync' command")
    .requiredOption("-s, --source <path>", "Source path (local or remote SSH)")
    .requiredOption("-d, --device <name>", "Device name (scsi0, scsi1, floppy, etc.)")
    .option("--sampler <name>", "Sampler name (required for local sources, optional for remote)")
    .option("--dry-run", "Show what would be synced without actually syncing")
    .action(handleSyncCommand);

// List command
program
    .command("list")
    .description("List all synced backups")
    .option("-a, --all", "List all samplers and devices")
    .option("-s, --sampler <name>", "List specific sampler")
    .option("-d, --device <name>", "List specific device (requires --sampler)")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
        try {
            if (!existsSync(DEFAULT_BACKUP_ROOT)) {
                console.log("No backups found.");
                console.log(`Backup directory does not exist: ${DEFAULT_BACKUP_ROOT}`);
                return;
            }

            // Device flag requires sampler flag
            if (options.device && !options.sampler) {
                console.error("Error: --device requires --sampler");
                process.exit(1);
            }

            const data: any = {};

            if (options.sampler && options.device) {
                // List specific device
                const devicePath = join(DEFAULT_BACKUP_ROOT, options.sampler, options.device);
                if (!existsSync(devicePath)) {
                    console.log(`No backup found for ${options.sampler}/${options.device}`);
                    return;
                }

                const fileCount = await countFiles(devicePath);
                const totalSize = await getDirectorySize(devicePath);

                if (options.json) {
                    data[options.sampler] = {
                        [options.device]: {
                            path: devicePath,
                            files: fileCount,
                            size: totalSize,
                            sizeFormatted: formatBytes(totalSize)
                        }
                    };
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    console.log(`${options.sampler}/${options.device}/`);
                    console.log(`  Path: ${devicePath}`);
                    console.log(`  Files: ${fileCount}`);
                    console.log(`  Size: ${formatBytes(totalSize)}`);
                }
            } else if (options.sampler) {
                // List all devices for sampler
                const samplerPath = join(DEFAULT_BACKUP_ROOT, options.sampler);
                if (!existsSync(samplerPath)) {
                    console.log(`No backup found for sampler: ${options.sampler}`);
                    return;
                }

                const devices = await readdir(samplerPath, { withFileTypes: true });
                const deviceDirs = devices.filter(d => d.isDirectory());

                if (deviceDirs.length === 0) {
                    console.log(`No devices found for sampler: ${options.sampler}`);
                    return;
                }

                data[options.sampler] = {};

                for (const device of deviceDirs) {
                    const devicePath = join(samplerPath, device.name);
                    const fileCount = await countFiles(devicePath);
                    const totalSize = await getDirectorySize(devicePath);

                    data[options.sampler][device.name] = {
                        path: devicePath,
                        files: fileCount,
                        size: totalSize,
                        sizeFormatted: formatBytes(totalSize)
                    };
                }

                if (options.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    console.log(`${options.sampler}/`);
                    for (const device of deviceDirs) {
                        const info = data[options.sampler][device.name];
                        console.log(`  ${device.name}/  (${info.files} files, ${info.sizeFormatted})`);
                    }
                }
            } else {
                // List all samplers and devices (--all or default)
                const samplers = await readdir(DEFAULT_BACKUP_ROOT, { withFileTypes: true });
                const samplerDirs = samplers.filter(d => d.isDirectory());

                if (samplerDirs.length === 0) {
                    console.log("No backups found.");
                    return;
                }

                for (const sampler of samplerDirs) {
                    const samplerPath = join(DEFAULT_BACKUP_ROOT, sampler.name);
                    const devices = await readdir(samplerPath, { withFileTypes: true });
                    const deviceDirs = devices.filter(d => d.isDirectory());

                    data[sampler.name] = {};

                    for (const device of deviceDirs) {
                        const devicePath = join(samplerPath, device.name);
                        const fileCount = await countFiles(devicePath);
                        const totalSize = await getDirectorySize(devicePath);

                        data[sampler.name][device.name] = {
                            path: devicePath,
                            files: fileCount,
                            size: totalSize,
                            sizeFormatted: formatBytes(totalSize)
                        };
                    }
                }

                if (options.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    console.log(`${DEFAULT_BACKUP_ROOT}/`);
                    for (const sampler of samplerDirs) {
                        console.log(`├── ${sampler.name}/`);
                        const devices = Object.keys(data[sampler.name]);
                        devices.forEach((device, idx) => {
                            const isLast = idx === devices.length - 1;
                            const prefix = isLast ? '└──' : '├──';
                            const info = data[sampler.name][device];
                            console.log(`│   ${prefix} ${device}/  (${info.files} files, ${info.sizeFormatted})`);
                        });
                    }
                }
            }
        } catch (err: any) {
            console.error(`Error listing backups: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
