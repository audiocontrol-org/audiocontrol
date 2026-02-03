#!/usr/bin/env node
/**
 * Akai Sampler Backup CLI
 *
 * Command-line tool for backing up hardware Akai samplers using rsync
 */

import { Command } from "commander";
import { RemoteSource } from "@/lib/sources/remote-source.js";
import { LocalSource } from "@/lib/sources/local-source.js";
import type { RemoteSourceConfig, LocalSourceConfig } from "@/lib/sources/backup-source.js";
import { loadConfig, getEnabledBackupSources, type BackupSource, saveConfig } from "@audiocontrol/audiotools-config";
import { DeviceResolver } from "@/lib/device/device-resolver.js";
import { AutoDetectBackup } from "@/lib/device/auto-detect-backup.js";
import { InteractivePrompt, UserCancelledError } from "@/lib/prompt/interactive-prompt.js";
import { createDeviceDetector } from "@audiocontrol/lib-device-uuid";
import { homedir } from 'os';
import { join } from 'pathe';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import packageJson from '../../package.json' with { type: 'json' };

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
 * Check if path is a local mount path (not a source name)
 *
 * Detects:
 * - Absolute paths starting with / (Unix/Linux)
 * - Paths containing /Volumes/ (macOS)
 * - Paths containing /mnt/ (Linux)
 * - Windows paths (C:\, D:\, etc.)
 */
function isLocalMountPath(path: string): boolean {
  // Absolute Unix/Linux path
  if (path.startsWith('/')) {
    return true;
  }

  // macOS volume paths
  if (path.includes('/Volumes/')) {
    return true;
  }

  // Linux mount paths
  if (path.includes('/mnt/')) {
    return true;
  }

  // Windows paths (C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(path)) {
    return true;
  }

  return false;
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
 * Create a backup source instance from BackupSource config
 */
function createSourceFromConfig(sourceConfig: BackupSource): RemoteSource | LocalSource {
  if (sourceConfig.type === 'remote') {
    const config: RemoteSourceConfig = {
      type: 'remote',
      host: sourceConfig.source.split(':')[0],
      sourcePath: sourceConfig.source.split(':')[1] || '~/',
      device: sourceConfig.device,
      sampler: sourceConfig.sampler || samplerNameFromHost(sourceConfig.source.split(':')[0]),
    };
    return new RemoteSource(config);
  } else {
    const config: LocalSourceConfig = {
      type: 'local',
      sourcePath: sourceConfig.source,
      sampler: sourceConfig.sampler || 'unknown',
      device: sourceConfig.device,
      backupSubdir: sourceConfig.sampler || 'unknown',
    };
    return new LocalSource(config);
  }
}

/**
 * Resolve device UUID for local source and update config
 *
 * @param sourceConfig - Backup source configuration
 * @param config - Full audio-tools configuration
 * @param dryRun - If true, skip UUID resolution and config updates
 * @returns Updated backup source with UUID fields populated
 */
async function resolveLocalDevice(
  sourceConfig: BackupSource,
  config: ReturnType<typeof loadConfig> extends Promise<infer T> ? T : never,
  dryRun: boolean = false
): Promise<BackupSource> {
  // Only resolve for local sources
  if (sourceConfig.type !== 'local') {
    return sourceConfig;
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would resolve device UUID for ${sourceConfig.name}`);
    return sourceConfig;
  }

  const resolver = new DeviceResolver();

  try {
    const result = await resolver.resolveDevice(
      sourceConfig.source,  // mount path
      sourceConfig.name,    // source name
      config
    );

    // Display resolution status
    if (result.action === 'registered') {
      console.log(`📝 ${result.message}`);
    } else if (result.action === 'recognized') {
      console.log(`✓ ${result.message}`);
    }

    return result.source;
  } catch (error: any) {
    // Device resolution failed - this is not fatal, just warn user
    console.warn(`⚠️  Device UUID resolution failed: ${error.message}`);
    console.warn(`   Continuing backup without UUID tracking`);
    return sourceConfig;
  }
}

/**
 * Auto-detect and resolve local mount path to backup source.
 *
 * Performs complete auto-detection workflow:
 * 1. Detects device info using lib-device-uuid
 * 2. Infers device type from filesystem if not provided
 * 3. Prompts for missing device type if needed
 * 4. Prompts for sampler if needed
 * 5. Checks if device is already registered
 * 6. Returns complete BackupSource ready to use
 *
 * @param mountPath - Path where device is mounted
 * @param config - Current audio-tools configuration
 * @param options - CLI options (device, sampler, dryRun)
 * @returns Complete backup source ready to use
 * @throws UserCancelledError if user cancels prompts
 */
async function autoDetectLocalDevice(
  mountPath: string,
  config: ReturnType<typeof loadConfig> extends Promise<infer T> ? T : never,
  options: { device?: string; sampler?: string; dryRun?: boolean }
): Promise<BackupSource> {
  if (options.dryRun) {
    console.log(`[DRY RUN] Would auto-detect device at ${mountPath}`);
    // For dry-run, create minimal source without detection
    return {
      name: 'dry-run-source',
      type: 'local',
      source: mountPath,
      device: options.device || 'unknown',
      sampler: options.sampler || 'unknown',
      enabled: true,
    };
  }

  // Create auto-detect service with dependencies
  const deviceDetector = createDeviceDetector();
  const promptService = new InteractivePrompt();
  const deviceResolver = new DeviceResolver();
  const autoDetect = new AutoDetectBackup(deviceDetector, promptService, deviceResolver);

  console.log(`Auto-detecting device at ${mountPath}...`);

  // Run auto-detection with CLI options as overrides
  const result = await autoDetect.detectAndResolve(mountPath, config, {
    deviceType: options.device,
    sampler: options.sampler,
  });

  // Display device info
  console.log('');
  console.log('Device detected:');
  if (result.deviceInfo.volumeLabel) {
    console.log(`  Label: ${result.deviceInfo.volumeLabel}`);
  }
  if (result.deviceInfo.volumeUUID) {
    console.log(`  UUID: ${result.deviceInfo.volumeUUID}`);
  }
  if (result.deviceInfo.filesystem) {
    console.log(`  Filesystem: ${result.deviceInfo.filesystem}`);
  }
  console.log('');

  // Display action taken
  if (result.action === 'registered') {
    console.log(`📝 Registered new backup source: ${result.source.name}`);
  } else if (result.action === 'recognized') {
    console.log(`✓ Recognized existing backup source: ${result.source.name}`);
  } else {
    console.log(`➕ Created backup source: ${result.source.name} (no UUID tracking)`);
  }

  // Update config if source was registered or created
  if (result.action === 'registered' || result.action === 'created') {
    // Add to config
    if (!config.backup) {
      config.backup = {
        backupRoot: DEFAULT_BACKUP_ROOT,
        sources: [],
      };
    }
    if (!config.backup.sources) {
      config.backup.sources = [];
    }
    config.backup.sources.push(result.source);
    await saveConfig(config);
    console.log('✓ Configuration saved');
  } else if (result.action === 'recognized') {
    // Update existing source (for lastSeen timestamp)
    const sourceIndex = config.backup?.sources?.findIndex(
      (s: BackupSource) => s.name === result.source.name
    );
    if (sourceIndex !== undefined && sourceIndex !== -1 && config.backup?.sources) {
      config.backup.sources[sourceIndex] = result.source;
      await saveConfig(config);
      console.log('✓ Configuration updated');
    }
  }

  console.log('');

  return result.source;
}

/**
 * Backup a single source
 */
async function backupSource(source: RemoteSource | LocalSource, dryRun: boolean = false): Promise<void> {
  console.log(`Syncing to: ${source.getBackupPath()}`);
  console.log("");

  if (dryRun) {
    console.log("Mode: DRY RUN (no changes will be made)");
    return;
  }

  // Execute sync
  const result = await source.backup('daily'); // interval not used with rsync

  if (!result.success) {
    console.error("\nSync failed:");
    result.errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error('Backup failed');
  }

  console.log("\n✓ Sync complete");
}

/**
 * Shared sync/backup action handler (flag-based)
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

    await backupSource(source, options.dryRun);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Config-based backup command handler
 */
async function handleBackupCommand(sourceName: string | undefined, options: any): Promise<void> {
  try {
    // Load config first (needed for all code paths)
    const config = await loadConfig();

    // NEW: If positional argument is provided, check if it's a path (auto-detect flow)
    if (sourceName && isLocalMountPath(sourceName)) {
      // This is a local mount path - trigger auto-detect flow
      const mountPath = sourceName;

      try {
        const resolvedSource = await autoDetectLocalDevice(mountPath, config, {
          device: options.device,
          sampler: options.sampler,
          dryRun: options.dryRun,
        });

        // Proceed with backup using resolved source
        const source = createSourceFromConfig(resolvedSource);
        await backupSource(source, options.dryRun);
        return;
      } catch (error: any) {
        if (error instanceof UserCancelledError) {
          console.log('\nBackup cancelled by user');
          process.exit(0);
        }
        throw error;
      }
    }

    // BACKWARD COMPATIBILITY: If --source flag is provided, use flag-based logic
    if (options.source) {
      return handleSyncCommand(options);
    }

    // Config-based backup (existing behavior)
    if (!config.backup) {
      console.error("Error: No backup configuration found");
      console.error("Run 'audiotools config' or 'akai-backup config' to set up configuration");
      process.exit(1);
    }

    const enabledSources = getEnabledBackupSources(config);

    if (enabledSources.length === 0) {
      console.error("Error: No enabled backup sources found in configuration");
      console.error("Run 'audiotools config' or 'akai-backup config' to add backup sources");
      process.exit(1);
    }

    // If sourceName is provided and not a path, backup only that source by name
    if (sourceName) {
      let sourceConfig = enabledSources.find(s => s.name === sourceName);
      if (!sourceConfig) {
        console.error(`Error: Source '${sourceName}' not found or not enabled in configuration`);
        console.error(`Available sources: ${enabledSources.map(s => s.name).join(', ')}`);
        process.exit(1);
      }

      console.log(`Backing up source: ${sourceConfig.name}`);
      console.log(`Type: ${sourceConfig.type}`);
      console.log(`Source: ${sourceConfig.source}`);
      console.log(`Device: ${sourceConfig.device}`);
      console.log("");

      // Resolve device UUID for local sources
      const updatedSource = await resolveLocalDevice(sourceConfig, config, options.dryRun);

      // If source was updated (registered/recognized), save config
      if (updatedSource !== sourceConfig) {
        if (config.backup?.sources) {
          const sourceIndex = config.backup.sources.findIndex((s: BackupSource) => s.name === sourceName);
          if (sourceIndex !== -1) {
            config.backup.sources[sourceIndex] = updatedSource;
            await saveConfig(config);
            console.log(`✓ Configuration updated\n`);
          }
        }
        sourceConfig = updatedSource;
      }

      const source = createSourceFromConfig(sourceConfig);
      await backupSource(source, options.dryRun);
      return;
    }

    // Backup all enabled sources
    console.log(`Found ${enabledSources.length} enabled backup source(s)\n`);

    for (let i = 0; i < enabledSources.length; i++) {
      let sourceConfig = enabledSources[i];
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${i + 1}/${enabledSources.length}] ${sourceConfig.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Type: ${sourceConfig.type}`);
      console.log(`Source: ${sourceConfig.source}`);
      console.log(`Device: ${sourceConfig.device}`);
      console.log("");

      try {
        // Resolve device UUID for local sources
        const updatedSource = await resolveLocalDevice(sourceConfig, config, options.dryRun);

        // If source was updated (registered/recognized), save config
        if (updatedSource !== sourceConfig) {
          if (config.backup?.sources) {
            const sourceIndex = config.backup.sources.findIndex((s: BackupSource) => s.name === sourceConfig.name);
            if (sourceIndex !== -1) {
              config.backup.sources[sourceIndex] = updatedSource;
              await saveConfig(config);
              console.log(`✓ Configuration updated\n`);
            }
          }
          sourceConfig = updatedSource;
        }

        const source = createSourceFromConfig(sourceConfig);
        await backupSource(source, options.dryRun);
      } catch (err: any) {
        console.error(`Failed to backup ${sourceConfig.name}: ${err.message}`);
        // Continue with next source
      }

      console.log("");
    }

    console.log("✓ All backups complete");
  } catch (err: any) {
    if (err instanceof UserCancelledError) {
      console.log('\nBackup cancelled by user');
      process.exit(0);
    }
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

program
    .name("akai-backup")
    .description("Backup Akai sampler disk images using rsync")
    .version(packageJson.version)
    .addHelpText('after', `
Examples:
  Auto-detect backup (NEW):
    $ akai-backup backup /Volumes/SDCARD            # Auto-detect device, prompt for details
    $ akai-backup backup /Volumes/SDCARD --device floppy   # Auto-detect, specify device
    $ akai-backup backup /Volumes/SDCARD --device floppy --sampler s5000   # No prompts
    $ akai-backup backup /mnt/usb/sdcard --dry-run  # Preview auto-detect

  Config-based backup:
    $ akai-backup backup                    # Backup all enabled sources from config
    $ akai-backup backup pi-scsi2          # Backup specific source by name
    $ akai-backup backup --dry-run         # Preview changes without backing up

  Device UUID Tracking (Automatic):
    Local sources are automatically tracked by device UUID. When you backup
    a local device (SD card, USB drive), the system:
    - Detects the device UUID on first backup (registration)
    - Recognizes the same device on subsequent backups (recognition)
    - Updates the lastSeen timestamp each time
    - Works even if the mount path changes between backups

  Flag-based backup (backward compatible):
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

Configuration:
  Run 'audiotools config' or 'akai-backup config' to set up backup sources.
  Config file: ~/.audiotools/config.json

Requirements:
  - rsync: Installed by default on macOS and most Linux systems
  - SSH access to remote hosts (passwordless keys recommended)

How It Works:
  Simple file-level synchronization using rsync. Only changed files are
  transferred. Files are organized hierarchically by sampler and device.
  No snapshots, no archives - just fast, simple sync.
`);

// Backup command (NEW - config-based with optional source name argument OR auto-detect path)
program
    .command("backup [source]")
    .description("Backup from config, auto-detect device, or by source name")
    .option("-s, --source <path>", "Override: use flag-based source path instead of config")
    .option("-d, --device <name>", "Device type (for auto-detect or --source)")
    .option("--sampler <name>", "Sampler name (for auto-detect or --source)")
    .option("--dry-run", "Show what would be synced without actually syncing")
    .action(handleBackupCommand);

// Sync command (backward compatible - flag-based)
program
    .command("sync")
    .description("Sync sampler disk images from remote or local source (flag-based)")
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
