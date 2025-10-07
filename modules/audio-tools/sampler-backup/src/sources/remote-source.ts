/**
 * Remote SSH-based backup source
 * Uses SSHFS + BorgBackup for efficient incremental backups
 *
 * Architecture: Mount remote directory via SSHFS, then backup with Borg to local repository.
 * This allows Borg's incremental deduplication to work efficiently over SSH.
 */

import { homedir } from 'os';
import { join } from 'pathe';
import { BorgBackupAdapter } from '@/backup/borg-backup-adapter.js';
import { SSHFSManager } from '@/backup/sshfs-manager.js';
import { ensureSSHFSInstalled } from '@/utils/sshfs-check.js';
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
 * Default Borg repository path (local)
 */
const DEFAULT_REPO_PATH = join(homedir(), '.audiotools', 'borg-repo');

/**
 * RemoteSource - SSH-based backup source using SSHFS + BorgBackup
 *
 * Implements BackupSource interface using SSHFS to mount remote directories,
 * then Borg to back them up to a local repository with full incremental efficiency.
 */
export class RemoteSource implements BackupSource {
  readonly type = 'remote' as const;
  private readonly borgAdapter: IBorgBackupAdapter;
  private readonly sshfsManager: SSHFSManager;
  private readonly retentionPolicy: BorgRetentionPolicy;

  constructor(
    private readonly config: RemoteSourceConfig,
    borgAdapter?: IBorgBackupAdapter,
    sshfsManager?: SSHFSManager,
    repoPath?: string,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;
    this.sshfsManager = sshfsManager ?? new SSHFSManager();

    // Borg adapter with LOCAL repository
    this.borgAdapter = borgAdapter ?? new BorgBackupAdapter({
      repoPath: repoPath ?? DEFAULT_REPO_PATH,
      compression: 'zstd',
      encryption: 'none',
    });
  }

  /**
   * Execute remote backup using SSHFS + BorgBackup
   *
   * 1. Mount remote directory via SSHFS
   * 2. Backup mounted path with Borg to local repository
   * 3. Unmount SSHFS
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      interval,
      configPath: '', // Not used with Borg
      errors: [],
    };

    let mountPoint: string | undefined;

    try {
      // Ensure SSHFS is installed
      await ensureSSHFSInstalled();

      // Initialize repository if needed
      await this.initializeRepositoryIfNeeded();

      // Check for same-day resume
      const hasToday = await this.borgAdapter.hasArchiveForToday(
        interval,
        this.config.backupSubdir
      );

      if (hasToday) {
        console.log(`Archive already exists for today's ${interval} backup`);
        result.success = true;
        return result;
      }

      // Mount remote filesystem via SSHFS
      console.log(`Mounting ${this.config.host}:${this.config.sourcePath}...`);
      mountPoint = await this.sshfsManager.mount({
        host: this.config.host,
        remotePath: this.config.sourcePath,
      });

      // Generate archive name
      const timestamp = new Date().toISOString().split('T')[0];
      const archiveName = `${interval}-${timestamp}-${this.config.backupSubdir}`;

      console.log(`Creating Borg archive: ${archiveName}`);
      console.log(`Source: ${mountPoint} (via SSHFS)`);

      // Backup mounted path
      const archive = await this.borgAdapter.createArchive(
        [mountPoint],
        archiveName,
        (progress) => {
          if (progress.filesProcessed % 10 === 0 || progress.filesProcessed === progress.totalFiles) {
            const mbProcessed = Math.round(progress.bytesProcessed / 1024 / 1024);
            console.log(
              `Progress: ${progress.filesProcessed}/${progress.totalFiles} files, ${mbProcessed}MB`
            );
          }
        }
      );

      console.log('\n✓ Backup complete:');
      console.log(`  Archive: ${archive.name}`);
      console.log(`  Files: ${archive.stats.nfiles}`);
      console.log(`  Original: ${Math.round(archive.stats.originalSize / 1024 / 1024)}MB`);
      console.log(`  Compressed: ${Math.round(archive.stats.compressedSize / 1024 / 1024)}MB`);
      console.log(`  Deduplicated: ${Math.round(archive.stats.dedupedSize / 1024 / 1024)}MB`);

      // Prune old archives
      console.log('\nPruning old archives...');
      await this.borgAdapter.pruneArchives(this.retentionPolicy);

      result.success = true;
      result.snapshotPath = archiveName;
    } catch (error: any) {
      const errorMessage = `Remote backup failed for ${this.config.host}: ${error.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    } finally {
      // ALWAYS unmount, even on error
      if (mountPoint) {
        try {
          console.log('\nUnmounting SSHFS...');
          await this.sshfsManager.unmount(mountPoint);
        } catch (error: any) {
          console.error(`Failed to unmount: ${error.message}`);
        }
      }
    }

    return result;
  }

  /**
   * Test if remote source is accessible
   *
   * Tests SSHFS mounting capability and SSH connectivity.
   */
  async test(): Promise<boolean> {
    let mountPoint: string | undefined;

    try {
      // Check SSHFS availability
      await ensureSSHFSInstalled();

      // Test mount
      console.log(`Testing mount of ${this.config.host}:${this.config.sourcePath}...`);
      mountPoint = await this.sshfsManager.mount({
        host: this.config.host,
        remotePath: this.config.sourcePath,
      });

      // Verify mount is accessible
      const accessible = await this.sshfsManager.isMounted(mountPoint);

      if (accessible) {
        console.log(`✓ Successfully mounted ${this.config.host}:${this.config.sourcePath}`);
      }

      return accessible;
    } catch (error: any) {
      console.error(`Remote source test failed: ${error.message}`);
      return false;
    } finally {
      // Unmount test mount
      if (mountPoint) {
        try {
          await this.sshfsManager.unmount(mountPoint);
        } catch (error: any) {
          console.error(`Failed to unmount test mount: ${error.message}`);
        }
      }
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
}
