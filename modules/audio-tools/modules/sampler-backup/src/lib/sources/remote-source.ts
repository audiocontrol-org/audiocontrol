/**
 * Remote SSH-based backup source
 * Uses rsync for simple file synchronization over SSH
 *
 * Architecture: Direct rsync sync from remote host to local backup directory.
 * Simple, fast, and efficient - just syncs changed files.
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { RsyncAdapter } from '@/lib/backup/rsync-adapter.js';
import { resolveRepositoryPath } from '@/lib/backup/repo-path-resolver.js';
import type { BackupSource, RemoteSourceConfig } from '@/lib/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/lib/types/index.js';

/**
 * RemoteSource - SSH-based backup source using rsync
 *
 * Implements BackupSource interface using rsync to sync remote directories
 * to local backup storage with hierarchical organization.
 */
export class RemoteSource implements BackupSource {
  readonly type = 'remote' as const;
  private readonly rsyncAdapter: RsyncAdapter;
  private readonly backupPath: string;

  constructor(
    private readonly config: RemoteSourceConfig,
    rsyncAdapter?: RsyncAdapter
  ) {
    // Validate required fields
    if (!config.device) {
      throw new Error('Device name is required (e.g., scsi0, scsi1, floppy)');
    }

    this.rsyncAdapter = rsyncAdapter ?? new RsyncAdapter();

    // Resolve backup path: ~/.audiotools/backup/{sampler}/{device}/
    this.backupPath = resolveRepositoryPath({
      sourceType: 'remote',
      host: this.config.host,
      sampler: this.config.sampler, // Optional override
      device: this.config.device, // Required
    });
  }

  /**
   * Execute remote backup using rsync
   *
   * Simple synchronization: user@host:/path → ~/.audiotools/backup/{sampler}/{device}/
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

      // Build source path: user@host:/path or just host:/path
      const source = `${this.config.host}:${this.config.sourcePath}`;

      console.log(`Syncing ${source} → ${this.backupPath}`);

      // Simple rsync: user@host:/source → ~/.audiotools/backup/{sampler}/{device}/
      await this.rsyncAdapter.sync({
        sourcePath: source,
        destPath: this.backupPath,
      });

      console.log(`✓ Backup complete: ${this.backupPath}`);

      result.success = true;
      result.snapshotPath = this.backupPath;
    } catch (error: any) {
      const errorMessage = `Remote backup failed for ${this.config.host}: ${error.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Test if remote source is accessible
   *
   * Tests SSH connectivity to remote host.
   */
  async test(): Promise<boolean> {
    try {
      console.log(`Testing SSH connection to ${this.config.host}...`);

      // Test SSH connection
      const connected = await new Promise<boolean>((resolve) => {
        const ssh = spawn('ssh', [this.config.host, 'echo', 'ok']);

        ssh.on('close', (code: number | null) => {
          resolve(code === 0);
        });

        ssh.on('error', () => {
          resolve(false);
        });
      });

      if (connected) {
        console.log(`✓ Successfully connected to ${this.config.host}`);
      } else {
        console.error(`✗ Failed to connect to ${this.config.host}`);
      }

      return connected;
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
   * Get the backup path for this source
   */
  getBackupPath(): string {
    return this.backupPath;
  }
}
