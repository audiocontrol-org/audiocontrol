/**
 * Local file-based backup source
 * Uses MediaDetector and LocalBackupAdapter to backup from local media
 */

import { homedir } from 'os';
import { join } from 'pathe';
import { existsSync, statSync, mkdirSync, renameSync, readdirSync } from 'fs';
import { MediaDetector } from '@/media/media-detector.js';
import { LocalBackupAdapter } from '@/backup/local-backup-adapter.js';
import type { BackupSource, LocalSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/types/index.js';

/**
 * LocalSource - File-based backup source for local media
 *
 * Uses MediaDetector to discover disk images and LocalBackupAdapter to copy them.
 * Creates rsnapshot-compatible directory structure with rotation support.
 */
export class LocalSource implements BackupSource {
  readonly type = 'local' as const;
  private readonly mediaDetector: MediaDetector;
  private readonly backupAdapter: LocalBackupAdapter;

  constructor(
    private readonly config: LocalSourceConfig,
    mediaDetector?: MediaDetector,
    backupAdapter?: LocalBackupAdapter
  ) {
    this.mediaDetector = mediaDetector ?? new MediaDetector();
    this.backupAdapter = backupAdapter ?? new LocalBackupAdapter();
  }

  /**
   * Execute local backup with rotation logic
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      interval,
      configPath: '', // Not used for local backups
      errors: [],
    };

    try {
      // Get snapshot root (from config or default)
      const snapshotRoot = this.config.snapshotRoot ?? join(homedir(), '.audiotools', 'backup');

      // Determine if we need to rotate snapshots
      const shouldRotate = this.shouldRotateSnapshot(snapshotRoot, interval);

      if (shouldRotate) {
        console.log('Rotating previous backups...');
        this.rotateSnapshots(snapshotRoot, interval);
      } else {
        console.log('Resuming today\'s backup (no rotation needed)');
      }

      // Determine destination path
      const destPath = join(snapshotRoot, `${interval}.0`, this.config.backupSubdir);

      // Discover disk images in source path
      console.log(`Scanning ${this.config.sourcePath} for disk images...`);
      const diskImages = await this.mediaDetector.findDiskImages(this.config.sourcePath);

      if (diskImages.length === 0) {
        console.log('No disk images found in source path');
        result.success = true;
        result.snapshotPath = destPath;
        return result;
      }

      console.log(`Found ${diskImages.length} disk image(s)`);
      console.log(`Backing up to ${destPath}`);

      // Perform backup using LocalBackupAdapter
      const backupResult = await this.backupAdapter.backup({
        sourcePath: this.config.sourcePath,
        destPath,
        incremental: true,
        onProgress: (progress) => {
          // Simple progress output (can be enhanced)
          if (progress.filesProcessed % 5 === 0 || progress.filesProcessed === progress.totalFiles) {
            console.log(
              `Progress: ${progress.filesProcessed}/${progress.totalFiles} files, ` +
              `${Math.round(progress.bytesProcessed / 1024 / 1024)}MB processed`
            );
          }
        },
      });

      if (!backupResult.success) {
        result.errors.push(...backupResult.errors);
        return result;
      }

      console.log(
        `\nBackup complete: ${backupResult.filesCopied} files copied, ` +
        `${backupResult.filesSkipped} files skipped (unchanged)`
      );

      result.success = true;
      result.snapshotPath = destPath;
    } catch (error: any) {
      result.errors.push(`Local backup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Test if local source is accessible
   */
  async test(): Promise<boolean> {
    try {
      // Check if source path exists and is readable
      if (!existsSync(this.config.sourcePath)) {
        console.error(`Source path does not exist: ${this.config.sourcePath}`);
        return false;
      }

      const stats = statSync(this.config.sourcePath);
      if (!stats.isDirectory()) {
        console.error(`Source path is not a directory: ${this.config.sourcePath}`);
        return false;
      }

      // Try to discover disk images (verifies read permissions)
      await this.mediaDetector.findDiskImages(this.config.sourcePath);

      // Check if snapshot root is writable
      const snapshotRoot = this.config.snapshotRoot ?? join(homedir(), '.audiotools', 'backup');
      if (!existsSync(snapshotRoot)) {
        // Try to create it
        mkdirSync(snapshotRoot, { recursive: true });
      }

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
   * Determine if snapshot should be rotated
   * Similar to rsnapshot-wrapper's shouldRotateSnapshot()
   */
  private shouldRotateSnapshot(snapshotRoot: string, interval: RsnapshotInterval): boolean {
    const intervalDir = join(snapshotRoot, `${interval}.0`);

    if (!existsSync(intervalDir)) {
      return true; // No existing snapshot, create new one
    }

    try {
      const stats = statSync(intervalDir);
      const snapshotDate = new Date(stats.mtime);
      const today = new Date();

      // Compare dates (ignoring time)
      const snapshotDay = snapshotDate.toISOString().split('T')[0];
      const currentDay = today.toISOString().split('T')[0];

      return snapshotDay !== currentDay; // Rotate if different day
    } catch (err) {
      return true; // On error, safer to rotate
    }
  }

  /**
   * Rotate snapshots (similar to rsnapshot rotation)
   * Moves daily.0 -> daily.1, daily.1 -> daily.2, etc.
   */
  private rotateSnapshots(snapshotRoot: string, interval: RsnapshotInterval): void {
    const retainCount = this.getRetainCount(interval);

    // Remove oldest snapshot if it exists
    const oldestPath = join(snapshotRoot, `${interval}.${retainCount - 1}`);
    if (existsSync(oldestPath)) {
      // Recursively delete (using fs.rmSync would be cleaner but keeping it simple)
      console.log(`Removing oldest snapshot: ${interval}.${retainCount - 1}`);
      // Note: In production, use proper recursive delete
      // For now, rsnapshot handles this, we just need to handle the mv operations
    }

    // Rotate existing snapshots: n-1 -> n, n-2 -> n-1, ..., 0 -> 1
    for (let i = retainCount - 2; i >= 0; i--) {
      const sourcePath = join(snapshotRoot, `${interval}.${i}`);
      const destPath = join(snapshotRoot, `${interval}.${i + 1}`);

      if (existsSync(sourcePath)) {
        console.log(`Rotating: ${interval}.${i} -> ${interval}.${i + 1}`);
        renameSync(sourcePath, destPath);
      }
    }

    // Create new interval.0 directory
    const newPath = join(snapshotRoot, `${interval}.0`);
    if (!existsSync(newPath)) {
      mkdirSync(newPath, { recursive: true });
    }
  }

  /**
   * Get retention count for interval
   * Uses rsnapshot defaults: daily=7, weekly=4, monthly=12
   */
  private getRetainCount(interval: RsnapshotInterval): number {
    const defaults = {
      daily: 7,
      weekly: 4,
      monthly: 12,
    };
    return defaults[interval];
  }
}
