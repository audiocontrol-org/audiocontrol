/**
 * Backup Command
 *
 * Backup Akai sampler disk images using rsync/rsnapshot.
 * Supports both config-based (zero-flag) and flag-based (backward compatible) workflows.
 */

import { Command } from 'commander';
import { loadConfig, getEnabledBackupSources, type BackupSource } from '@oletizi/audiotools-config';
import { RemoteSource, LocalSource } from '@oletizi/sampler-backup';
import type { RemoteSourceConfig, LocalSourceConfig } from '@oletizi/sampler-backup';
import { homedir } from 'os';
import { join } from 'pathe';

const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');

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

      if (!config.backup) {
        console.error('\nNo backup configuration found.');
        console.error('Run "audiotools config" to configure backup sources.');
        process.exit(1);
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
