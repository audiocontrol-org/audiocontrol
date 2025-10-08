import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Configuration for rsync synchronization operation
 */
export interface RsyncConfig {
  /** Source path - can be local path or user@host:/path for remote */
  sourcePath: string;
  /** Destination path - local directory */
  destPath: string;
  /** Enable verbose output (default: false) */
  verbose?: boolean;
  /** Perform a dry run without making changes (default: false) */
  dryRun?: boolean;
}

/**
 * Simple wrapper around rsync for file synchronization.
 *
 * Provides a clean interface for syncing files from local or remote sources
 * to local destinations. Supports both SSH-based remote sync and local sync.
 *
 * @example
 * ```typescript
 * const adapter = new RsyncAdapter();
 *
 * // Remote sync
 * await adapter.sync({
 *   sourcePath: 'user@host:/remote/path/',
 *   destPath: '/local/backup/path/',
 * });
 *
 * // Local sync
 * await adapter.sync({
 *   sourcePath: '/Volumes/DSK0/',
 *   destPath: '/local/backup/path/',
 *   verbose: true,
 * });
 * ```
 */
export class RsyncAdapter {
  /**
   * Synchronize files from source to destination using rsync.
   *
   * Uses rsync's archive mode (-a) to preserve permissions, timestamps, etc.
   * Automatically deletes files in destination that don't exist in source.
   *
   * @param config - Rsync configuration
   * @throws {Error} If rsync command fails or is not available
   *
   * @example
   * ```typescript
   * await adapter.sync({
   *   sourcePath: 'pi-scsi2:/home/orion/images/',
   *   destPath: '~/.audiotools/backup/pi-scsi2/scsi0/',
   *   dryRun: true,  // Preview changes first
   * });
   * ```
   */
  async sync(config: RsyncConfig): Promise<void> {
    const args = [
      '-av',                    // Archive mode, verbose
      '--delete',               // Delete files that don't exist in source
      '--progress',             // Show progress
    ];

    if (config.dryRun) {
      args.push('--dry-run');
    }

    args.push(config.sourcePath);
    args.push(config.destPath);

    return new Promise<void>((resolve, reject) => {
      const rsync: ChildProcess = spawn('rsync', args, { stdio: 'inherit' });

      rsync.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}`));
        }
      });

      rsync.on('error', (err: Error) => {
        reject(new Error(`Failed to execute rsync: ${err.message}`));
      });
    });
  }

  /**
   * Check if rsync is available on the system.
   *
   * Attempts to execute `rsync --version` to verify availability.
   *
   * @returns Promise that resolves to true if rsync is available, false otherwise
   *
   * @example
   * ```typescript
   * const available = await adapter.checkRsyncAvailable();
   * if (!available) {
   *   throw new Error('rsync is not installed. Please install rsync to continue.');
   * }
   * ```
   */
  async checkRsyncAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const check: ChildProcess = spawn('rsync', ['--version'], { stdio: 'ignore' });

      check.on('close', (code: number | null) => {
        resolve(code === 0);
      });

      check.on('error', () => {
        resolve(false);
      });
    });
  }
}
