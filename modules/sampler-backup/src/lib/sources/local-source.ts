/**
 * Local file-based backup source
 * Uses RsyncAdapter for simple file-level synchronization
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { RsyncAdapter } from '@/lib/backup/rsync-adapter.js';
import { resolveRepositoryPath } from '@/lib/backup/repo-path-resolver.js';
import type { BackupSource, LocalSourceConfig } from '@/lib/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/lib/types/index.js';

/**
 * LocalSource - File-based backup source for local media
 *
 * Uses RsyncAdapter for simple file-level synchronization without snapshots,
 * rotation, or deduplication. Fast and straightforward.
 */
export class LocalSource implements BackupSource {
  readonly type = 'local' as const;
  private readonly rsyncAdapter: RsyncAdapter;
  private readonly backupPath: string;

  constructor(
    private readonly config: LocalSourceConfig,
    rsyncAdapter?: RsyncAdapter
  ) {
    this.rsyncAdapter = rsyncAdapter ?? new RsyncAdapter();

    // Resolve backup path: ~/.audiotools/backup/{sampler}/{device}/
    this.backupPath = resolveRepositoryPath({
      sourceType: 'local',
      sampler: this.config.sampler,
      device: this.config.device,
    });
  }

  /**
   * Execute local backup using rsync
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      interval,
      configPath: '', // Not used with rsync
      errors: [],
    };

    try {
      // Ensure backup directory exists
      await mkdir(this.backupPath, { recursive: true });

      console.log(`Syncing ${this.config.sourcePath} to ${this.backupPath}...`);

      // Simple rsync: /Volumes/DSK0 → ~/.audiotools/backup/{sampler}/{device}/
      await this.rsyncAdapter.sync({
        sourcePath: this.config.sourcePath,
        destPath: this.backupPath,
      });

      console.log('\nBackup complete');
      result.success = true;
      result.snapshotPath = this.backupPath;
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
    // Test if source path exists
    return existsSync(this.config.sourcePath);
  }

  /**
   * Get source configuration
   */
  getConfig(): LocalSourceConfig {
    return this.config;
  }

  /**
   * Get backup path for this source
   */
  getBackupPath(): string {
    return this.backupPath;
  }
}
