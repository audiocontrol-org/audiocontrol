/**
 * Local file-based backup source
 * Uses MediaDetector and BorgBackup for efficient local backups
 */

import { homedir } from 'os';
import { join } from 'pathe';
import { MediaDetector } from '@/media/media-detector.js';
import { BorgBackupAdapter } from '@/backup/borg-backup-adapter.js';
import type { BackupSource, LocalSourceConfig } from '@/sources/backup-source.js';
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
 * LocalSource - File-based backup source for local media
 *
 * Uses MediaDetector to discover disk images and BorgBackup for efficient
 * incremental backups with deduplication and compression.
 */
export class LocalSource implements BackupSource {
  readonly type = 'local' as const;
  private readonly mediaDetector: MediaDetector;
  private readonly borgAdapter: IBorgBackupAdapter;
  private readonly retentionPolicy: BorgRetentionPolicy;

  constructor(
    private readonly config: LocalSourceConfig,
    mediaDetector?: MediaDetector,
    borgAdapter?: IBorgBackupAdapter,
    repoPath?: string,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.mediaDetector = mediaDetector ?? new MediaDetector();
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;

    // Use provided adapter or create new one
    this.borgAdapter = borgAdapter ?? new BorgBackupAdapter({
      repoPath: repoPath ?? DEFAULT_REPO_PATH,
      compression: 'zstd',
      encryption: 'none',
    });
  }

  /**
   * Execute local backup using BorgBackup
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

      // Discover disk images in source path
      console.log(`Scanning ${this.config.sourcePath} for disk images...`);
      const diskImages = await this.mediaDetector.findDiskImages(this.config.sourcePath);

      if (diskImages.length === 0) {
        console.log('No disk images found in source path');
        result.success = true;
        return result;
      }

      console.log(`Found ${diskImages.length} disk image(s)`);

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

      console.log(`Creating Borg archive: ${archiveName}`);
      console.log(`Source: ${this.config.sourcePath}`);

      // Create archive from disk image paths
      const diskImagePaths = diskImages.map(img => img.path);

      const archive = await this.borgAdapter.createArchive(
        diskImagePaths,
        archiveName,
        (progress) => {
          // Simple progress output
          if (progress.filesProcessed % 5 === 0 || progress.filesProcessed === progress.totalFiles) {
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
      const errorMessage = `Local backup failed for ${this.config.sourcePath}: ${error.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Test if local source is accessible
   */
  async test(): Promise<boolean> {
    try {
      // Try to discover disk images (verifies source path exists and is readable)
      await this.mediaDetector.findDiskImages(this.config.sourcePath);

      // Test Borg repository access
      await this.borgAdapter.listArchives();

      return true;
    } catch (error: any) {
      console.error(`Local source test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get source configuration
   */
  getConfig(): LocalSourceConfig {
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
