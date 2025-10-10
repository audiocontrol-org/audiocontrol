/**
 * Backup Command
 *
 * Backup Akai sampler disk images using rsync/rsnapshot.
 * Supports both config-based (zero-flag) and flag-based (backward compatible) workflows.
 */

import { Command } from 'commander';
import {
  loadConfig,
  saveConfig,
  updateBackupSource,
  getEnabledBackupSources,
  resolveBackupPath,
  initializeExportConfigIfNeeded,
  type BackupSource
} from '@oletizi/audiotools-config';
import { RemoteSource, LocalSource, AutoDetectBackup, InteractivePrompt, UserCancelledError, DeviceResolver } from '@oletizi/sampler-backup';
import type { RemoteSourceConfig, LocalSourceConfig } from '@oletizi/sampler-backup';
import { createDeviceDetector } from '@oletizi/lib-device-uuid';
import { homedir } from 'os';
import { join } from 'pathe';

const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');

/**
 * Check if path is a local mount path (not a remote SSH path or source name)
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

  const host = path.substring(0, colonIndex);
  const sourcePath = path.substring(colonIndex + 1);

  return { host, sourcePath };
}

/**
 * Backup a single source using the config
 */
async function backupFromConfig(source: BackupSource, dryRun: boolean = false): Promise<void> {
  console.log(`\nBacking up: ${source.name}`);
  console.log(`  Type: ${source.type}`);
  console.log(`  Source: ${source.source}`);
  console.log(`  Device: ${source.device}`);

  try {
    if (source.type === 'remote') {
      const { host, sourcePath } = parseRemotePath(source.source);

      const config: RemoteSourceConfig = {
        type: 'remote',
        host,
        sourcePath,
        device: source.device,
        sampler: source.sampler,
      };

      const remoteSource = new RemoteSource(config);

      if (dryRun) {
        console.log('  [DRY RUN] Would backup remote source');
      } else {
        await remoteSource.backup('daily');
        console.log('  ✓ Backup completed');

        // Save the backup path to config after successful backup
        const backupPath = resolveBackupPath(source);
        let config = await loadConfig();
        let updatedConfig = updateBackupSource(config, source.name, { backupPath });

        // Initialize export config if needed and enable this source
        updatedConfig = initializeExportConfigIfNeeded(updatedConfig, source.name);
        await saveConfig(updatedConfig);

        // If export was just initialized, show helpful message
        if (!config.export) {
          console.log('\n💡 Export is now configured. Run "audiotools export" to extract disk images.');
        }
      }
    } else if (source.type === 'local') {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: source.source,
        device: source.device,
        sampler: source.sampler || 'unknown',
        backupSubdir: source.device, // Use device as subdirectory
      };

      const localSource = new LocalSource(config);

      if (dryRun) {
        console.log('  [DRY RUN] Would backup local source');
      } else {
        await localSource.backup('daily');
        console.log('  ✓ Backup completed');

        // Save the backup path to config after successful backup
        const backupPath = resolveBackupPath(source);
        let config = await loadConfig();
        let updatedConfig = updateBackupSource(config, source.name, { backupPath });

        // Initialize export config if needed and enable this source
        updatedConfig = initializeExportConfigIfNeeded(updatedConfig, source.name);
        await saveConfig(updatedConfig);

        // If export was just initialized, show helpful message
        if (!config.export) {
          console.log('\n💡 Export is now configured. Run "audiotools export" to extract disk images.');
        }
      }
    } else {
      throw new Error(`Unknown source type: ${source.type}`);
    }
  } catch (error: any) {
    console.error(`  ✗ Backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Backup using flags (backward compatible mode)
 */
async function backupWithFlags(options: any): Promise<void> {
  const { source: sourcePath, device, sampler, dryRun } = options;

  if (!sourcePath) {
    throw new Error('--source flag is required when not using config');
  }

  if (!device) {
    throw new Error('--device flag is required when not using config');
  }

  console.log('\nBackup (flag-based mode):');
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Device: ${device}`);
  if (sampler) {
    console.log(`  Sampler: ${sampler}`);
  }

  if (isRemotePath(sourcePath)) {
    const { host, sourcePath: remotePath } = parseRemotePath(sourcePath);

    const config: RemoteSourceConfig = {
      type: 'remote',
      host,
      sourcePath: remotePath,
      device,
      sampler,
    };

    const remoteSource = new RemoteSource(config);

    if (dryRun) {
      console.log('  [DRY RUN] Would backup remote source');
    } else {
      await remoteSource.backup('daily');
      console.log('  ✓ Backup completed');
    }
  } else {
    const config: LocalSourceConfig = {
      type: 'local',
      sourcePath,
      device,
      sampler: sampler || 'unknown',
      backupSubdir: device,
    };

    const localSource = new LocalSource(config);

    if (dryRun) {
      console.log('  [DRY RUN] Would backup local source');
    } else {
      await localSource.backup('daily');
      console.log('  ✓ Backup completed');
    }
  }
}

/**
 * Auto-detect and backup a local device
 */
async function autoDetectLocalDevice(
  mountPath: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: { device?: string; sampler?: string; dryRun?: boolean }
): Promise<BackupSource> {
  if (options.dryRun) {
    console.log(`[DRY RUN] Would auto-detect device at ${mountPath}`);
    return {
      name: 'dry-run-source',
      type: 'local',
      source: mountPath,
      device: options.device || 'unknown',
      sampler: options.sampler || 'unknown',
      enabled: true,
    };
  }

  const deviceDetector = createDeviceDetector();
  const promptService = new InteractivePrompt();
  const deviceResolver = new DeviceResolver();
  const autoDetect = new AutoDetectBackup(deviceDetector, promptService, deviceResolver);

  console.log(`Auto-detecting device at ${mountPath}...`);

  const result = await autoDetect.detectAndResolve(mountPath, config, {
    deviceType: options.device,
    sampler: options.sampler,
  });

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

  if (result.action === 'registered') {
    console.log(`📝 Registered new backup source: ${result.source.name}`);
  } else if (result.action === 'recognized') {
    console.log(`✓ Recognized existing backup source: ${result.source.name}`);
  } else {
    console.log(`➕ Created backup source: ${result.source.name} (no UUID tracking)`);
  }

  if (result.action === 'registered' || result.action === 'created') {
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
 * Backup command - backup sampler disk images
 */
export const backupCommand = new Command('backup')
  .description('Backup sampler disk images')
  .argument('[source-name]', 'Specific source name to backup (from config)')
  .option('-s, --source <path>', 'Source path (SSH: user@host:/path or local: /path/to/media)')
  .option('-d, --device <name>', 'Device name (e.g., "images", "HD0")')
  .option('--sampler <name>', 'Sampler name (e.g., "s5k", "s3k")')
  .option('--dry-run', 'Show what would be backed up without actually doing it')
  .action(async (sourceName: string | undefined, options) => {
    try {
      // Flag-based mode (backward compatible)
      if (options.source) {
        await backupWithFlags(options);
        return;
      }

      // Config-based mode (new unified workflow)
      const config = await loadConfig();

      // Auto-detect mode: if sourceName is a local mount path
      if (sourceName && isLocalMountPath(sourceName)) {
        try {
          const resolvedSource = await autoDetectLocalDevice(sourceName, config, {
            device: options.device,
            sampler: options.sampler,
            dryRun: options.dryRun,
          });

          await backupFromConfig(resolvedSource, options.dryRun);
          return;
        } catch (error: any) {
          if (error.name === 'UserCancelledError' || error instanceof UserCancelledError) {
            console.log('\nBackup cancelled by user');
            process.exit(0);
          }
          throw error;
        }
      }

      if (!config.backup || !config.backup.sources || config.backup.sources.length === 0) {
        console.log('\n💡 No backup sources configured yet.');
        console.log('\nTo get started:');
        console.log('  1. Insert your sampler media (SD card, floppy, external drive)');
        console.log('  2. Run: audiotools backup /path/to/media');
        console.log('     Example: audiotools backup /Volumes/S3K');
        console.log('\nOr configure sources manually:');
        console.log('  audiotools config');
        return;
      }

      const enabledSources = getEnabledBackupSources(config);

      if (enabledSources.length === 0) {
        console.log('\nNo enabled backup sources found.');
        console.log('Run "audiotools config" to add and enable backup sources.');
        return;
      }

      // Backup specific source by name
      if (sourceName) {
        const source = enabledSources.find(s => s.name === sourceName);

        if (!source) {
          console.error(`\nSource not found: ${sourceName}`);
          console.error('\nAvailable sources:');
          enabledSources.forEach(s => {
            console.error(`  - ${s.name} (${s.type})`);
          });
          process.exit(1);
        }

        await backupFromConfig(source, options.dryRun);
      } else {
        // Backup all enabled sources
        console.log(`\nBacking up ${enabledSources.length} source(s)...`);

        let succeeded = 0;
        let failed = 0;

        for (const source of enabledSources) {
          try {
            await backupFromConfig(source, options.dryRun);
            succeeded++;
          } catch (error) {
            failed++;
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`Backup Summary:`);
        console.log(`  Succeeded: ${succeeded}`);
        console.log(`  Failed: ${failed}`);
        console.log('='.repeat(60));

        if (failed > 0) {
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error(`\nBackup error: ${error.message}`);
      process.exit(1);
    }
  });
