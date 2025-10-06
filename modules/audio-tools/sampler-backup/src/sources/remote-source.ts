/**
 * Remote SSH-based backup source
 * Uses BorgBackup for efficient incremental backups over SSH
 */

import { homedir } from 'os';
import { join } from 'pathe';
import { BorgBackupAdapter } from '@/backup/borg-backup-adapter.js';
import type { BackupSource, RemoteSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/types/index.js';
import type { BorgRetentionPolicy, IBorgBackupAdapter } from '@/types/borg.js';

/**
 * Default retention policy matching rsnapshot defaults
 */
const DEFAULT_RETENTION: BorgRetentionPolicy = {
  daily: 7,
  weekly: 4,
  monthly: 12,
};

/**
 * Default Borg repository path
 */
const DEFAULT_REPO_PATH = join(homedir(), '.audiotools', 'borg-repo');

/**
 * RemoteSource - SSH-based backup source using BorgBackup
 *
 * Implements BackupSource interface using BorgBackup for efficient
 * incremental backups over SSH with deduplication and compression.
 */
export class RemoteSource implements BackupSource {
  readonly type = 'remote' as const;
  private readonly borgAdapter: IBorgBackupAdapter;
  private readonly retentionPolicy: BorgRetentionPolicy;

  constructor(
    private readonly config: RemoteSourceConfig,
    borgAdapter?: IBorgBackupAdapter,
    repoPath?: string,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;

    // Use provided adapter or create new one
    this.borgAdapter = borgAdapter ?? new BorgBackupAdapter({
      repoPath: repoPath ?? DEFAULT_REPO_PATH,
      compression: 'zstd',
      encryption: 'none',
    });
  }

  /**
   * Execute remote backup using BorgBackup over SSH
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      interval,
      configPath: '', // Not used with Borg
      errors: [],
    };

    try {
      // Initialize repository if needed
      await this.initializeRepositoryIfNeeded();

      // Check for same-day resume logic
      const hasToday = await this.borgAdapter.hasArchiveForToday(
        interval,
        this.config.backupSubdir
      );

      if (hasToday) {
        console.log(`Archive already exists for today's ${interval} backup, resuming...`);
      }

      // Generate archive name: {interval}-{timestamp}-{backupSubdir}
      const timestamp = new Date().toISOString().split('T')[0];
      const archiveName = `${interval}-${timestamp}-${this.config.backupSubdir}`;

      // Build SSH source path: user@host:path or host:path
      const sshSource = this.buildSSHSourcePath();

      console.log(`Creating Borg archive: ${archiveName}`);
      console.log(`Source: ${sshSource}`);

      // Create archive
      const archive = await this.borgAdapter.createArchive(
        [sshSource],
        archiveName,
        (progress) => {
          // Simple progress output
          if (progress.filesProcessed % 10 === 0 || progress.filesProcessed === progress.totalFiles) {
            const mbProcessed = Math.round(progress.bytesProcessed / 1024 / 1024);
            console.log(
              `Progress: ${progress.filesProcessed}/${progress.totalFiles} files, ${mbProcessed}MB`
            );
          }
        }
      );

      console.log('\nBackup complete:');
      console.log(`  Archive: ${archive.name}`);
      console.log(`  Files: ${archive.stats.nfiles}`);
      console.log(`  Original size: ${Math.round(archive.stats.originalSize / 1024 / 1024)}MB`);
      console.log(`  Compressed size: ${Math.round(archive.stats.compressedSize / 1024 / 1024)}MB`);
      console.log(`  Deduplicated size: ${Math.round(archive.stats.dedupedSize / 1024 / 1024)}MB`);

      // Prune old archives
      console.log('\nPruning old archives...');
      await this.borgAdapter.pruneArchives(this.retentionPolicy);

      result.success = true;
      result.snapshotPath = archiveName;
    } catch (error: any) {
      const errorMessage = `Remote backup failed for ${this.config.host}:${this.config.sourcePath}: ${error.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Test if remote source is accessible
   */
  async test(): Promise<boolean> {
    try {
      // Test SSH connectivity by attempting to list archives
      // This will fail if SSH is not configured or host is unreachable
      await this.borgAdapter.listArchives();
      return true;
    } catch (error: any) {
      console.error(`Remote source test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get source configuration
   */
  getConfig(): RemoteSourceConfig {
    return this.config;
  }

  /**
   * Initialize repository if it doesn't exist
   */
  private async initializeRepositoryIfNeeded(): Promise<void> {
    try {
      await this.borgAdapter.getRepositoryInfo();
    } catch {
      // Repository doesn't exist, initialize it
      console.log('Initializing Borg repository...');
      await this.borgAdapter.initRepository({
        repoPath: DEFAULT_REPO_PATH,
        compression: 'zstd',
        encryption: 'none',
      });
    }
  }

  /**
   * Build SSH source path in format: [user@]host:path
   */
  private buildSSHSourcePath(): string {
    // Check if host already includes user (e.g., "user@host")
    if (this.config.host.includes('@')) {
      return `${this.config.host}:${this.config.sourcePath}`;
    }

    // Otherwise, just use host:path (relies on SSH config for user)
    return `${this.config.host}:${this.config.sourcePath}`;
  }
}
