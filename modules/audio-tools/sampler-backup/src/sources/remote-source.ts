/**
 * Remote SSH-based backup source
 * Uses BorgBackup with remote execution for efficient incremental backups
 *
 * Architecture: Borg runs ON the remote host and stores backups in a remote repository.
 * This allows Borg to read local files efficiently without transferring entire files over SSH.
 */

import {
  initRemoteRepository,
  createRemoteArchive,
  listRemoteArchives,
  pruneRemoteArchives,
  hasRemoteArchiveForToday,
  type RemoteBorgConfig
} from '@/backup/remote-borg-executor.js';
import type { BackupSource, RemoteSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/types/index.js';
import type { BorgRetentionPolicy } from '@/types/borg.js';

/**
 * Default retention policy matching rsnapshot defaults
 */
const DEFAULT_RETENTION: BorgRetentionPolicy = {
  daily: 7,
  weekly: 4,
  monthly: 12,
};

/**
 * Default Borg repository path on remote host
 * Using ~ to expand to the logged-in user's home directory
 */
const DEFAULT_REMOTE_REPO_PATH = '~/.audiotools/borg-repo';

/**
 * RemoteSource - SSH-based backup source using BorgBackup with remote execution
 *
 * Implements BackupSource interface using BorgBackup executed remotely via SSH.
 * Borg runs ON the remote host for efficient local file access and stores backups
 * in a remote repository.
 */
export class RemoteSource implements BackupSource {
  readonly type = 'remote' as const;
  private readonly remoteBorgConfig: RemoteBorgConfig;
  private readonly retentionPolicy: BorgRetentionPolicy;

  constructor(
    private readonly config: RemoteSourceConfig,
    remoteRepoPath?: string,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;

    // Configure remote Borg execution
    // Host may already include user (e.g., "pi@pi-scsi2.local")
    this.remoteBorgConfig = {
      sshHost: this.config.host,
      repoPath: remoteRepoPath ?? DEFAULT_REMOTE_REPO_PATH,
      compression: 'zstd',
      encryption: 'none'
    };
  }

  /**
   * Execute remote backup using BorgBackup over SSH
   *
   * Runs Borg ON the remote host to backup local files to remote repository.
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      interval,
      configPath: '', // Not used with Borg
      errors: [],
    };

    try {
      // Initialize remote repository if needed
      console.log('Initializing Borg repository...');
      await initRemoteRepository(this.remoteBorgConfig);

      // Check for same-day resume logic
      const hasToday = await hasRemoteArchiveForToday(
        this.remoteBorgConfig,
        interval,
        this.config.backupSubdir
      );

      if (hasToday) {
        console.log(`Archive already exists for today's ${interval} backup, skipping...`);
        result.success = true;
        return result;
      }

      // Generate archive name: {interval}-{timestamp}-{backupSubdir}
      const timestamp = new Date().toISOString().split('T')[0];
      const archiveName = `${interval}-${timestamp}-${this.config.backupSubdir}`;

      console.log(`Creating Borg archive: ${archiveName}`);
      console.log(`Source: ${this.config.sourcePath} (on ${this.remoteBorgConfig.sshHost})`);

      // Create archive (Borg runs on remote host, backing up local path)
      const archive = await createRemoteArchive(
        this.remoteBorgConfig,
        archiveName,
        this.config.sourcePath
      );

      console.log('\n✓ Backup complete:');
      console.log(`  Archive: ${archive.name}`);
      console.log(`  Files: ${archive.stats.nfiles}`);
      console.log(`  Original size: ${Math.round(archive.stats.originalSize / 1024 / 1024)}MB`);
      console.log(`  Compressed size: ${Math.round(archive.stats.compressedSize / 1024 / 1024)}MB`);
      console.log(`  Deduplicated size: ${Math.round(archive.stats.dedupedSize / 1024 / 1024)}MB`);

      // Prune old archives
      console.log('\nPruning old archives...');
      await pruneRemoteArchives(this.remoteBorgConfig, this.retentionPolicy);

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
   *
   * Tests both SSH connectivity and Borg availability on remote host.
   */
  async test(): Promise<boolean> {
    try {
      // Test SSH connectivity by attempting to list remote archives
      // This will fail if:
      // - SSH is not configured
      // - Host is unreachable
      // - Borg is not installed on remote host
      await listRemoteArchives(this.remoteBorgConfig);
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
}
