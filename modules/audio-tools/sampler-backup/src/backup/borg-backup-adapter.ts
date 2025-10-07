/**
 * BorgBackup adapter implementation
 *
 * Provides interface to BorgBackup for sampler disk image backups
 */

import { mkdir } from 'fs/promises';
import type {
  BorgRepositoryConfig,
  BorgArchive,
  BorgRetentionPolicy,
  BorgProgress,
  BorgRepositoryInfo,
  IBorgBackupAdapter
} from '@/types/borg.js';
import {
  executeBorgCommand,
  parseProgress,
  expandPath,
  ensureBorgInstalled,
  checkBorgVersion
} from '@/backup/borg-command.js';

/**
 * BorgBackup adapter for efficient incremental backups
 */
export class BorgBackupAdapter implements IBorgBackupAdapter {
  private config: BorgRepositoryConfig;

  constructor(config: BorgRepositoryConfig) {
    this.config = {
      ...config,
      repoPath: expandPath(config.repoPath),
      compression: config.compression || 'zstd',
      encryption: config.encryption || 'none'
    };
  }

  /**
   * Initialize a new Borg repository
   */
  async initRepository(config: BorgRepositoryConfig): Promise<void> {
    await ensureBorgInstalled();
    await checkBorgVersion('1.2.0');

    // Check if repository already exists
    try {
      await this.getRepositoryInfo();
      console.log('Repository already exists, skipping initialization');
      return;
    } catch {
      // Repository doesn't exist, create it
    }

    const repoPath = expandPath(config.repoPath);
    const args = [
      '--encryption', config.encryption || 'none',
      '--make-parent-dirs',
      repoPath
    ];

    try {
      await executeBorgCommand('init', args);
      console.log(`✓ Initialized Borg repository: ${repoPath}`);
    } catch (error: any) {
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  /**
   * Create a new backup archive
   */
  async createArchive(
    sources: string[],
    archiveName: string,
    onProgress?: (progress: BorgProgress) => void
  ): Promise<BorgArchive> {
    await ensureBorgInstalled();

    const args = [
      '--stats',
      '--json',
      '--progress',
      '--compression', this.config.compression!,
      `${this.config.repoPath}::${archiveName}`,
      ...sources
    ];

    let statsOutput = '';

    try {
      const { stdout } = await executeBorgCommand(
        'create',
        args,
        (line) => {
          // Try to parse progress
          const progress = parseProgress(line);
          if (progress && onProgress) {
            onProgress(progress);
          }
          // Capture stats output
          if (line.trim().startsWith('{')) {
            statsOutput += line;
          }
        }
      );

      // Parse stats from output
      const stats = JSON.parse(statsOutput || stdout);

      return {
        name: archiveName,
        timestamp: new Date(),
        stats: {
          originalSize: stats.archive?.stats?.original_size || 0,
          compressedSize: stats.archive?.stats?.compressed_size || 0,
          dedupedSize: stats.archive?.stats?.deduplicated_size || 0,
          nfiles: stats.archive?.stats?.nfiles || 0
        }
      };
    } catch (error: any) {
      // Handle specific errors
      if (error.message.includes('Failed to create/acquire the lock')) {
        throw new Error(
          'Repository is locked by another process. ' +
          'Wait for other backup to complete or run: borg break-lock ' +
          this.config.repoPath
        );
      }
      if (error.message.includes('Connection refused') ||
          error.message.includes('Connection reset')) {
        throw new Error(
          'Cannot connect to remote host. ' +
          'Check SSH connection and try again.'
        );
      }
      if (error.message.includes('No space left on device')) {
        throw new Error(
          'Not enough disk space for backup. ' +
          'Free up space or change repository location.'
        );
      }
      throw new Error(`Failed to create archive: ${error.message}`);
    }
  }

  /**
   * List all archives in repository
   */
  async listArchives(): Promise<BorgArchive[]> {
    await ensureBorgInstalled();

    const args = [
      '--json',
      this.config.repoPath
    ];

    try {
      const { stdout } = await executeBorgCommand('list', args);
      const data = JSON.parse(stdout);

      return data.archives.map((archive: any) => ({
        name: archive.name,
        timestamp: new Date(archive.time),
        stats: {
          originalSize: 0,  // Not included in list output
          compressedSize: 0,
          dedupedSize: 0,
          nfiles: archive.nfiles || 0
        }
      }));
    } catch (error: any) {
      throw new Error(`Failed to list archives: ${error.message}`);
    }
  }

  /**
   * Restore specific archive to destination
   */
  async restoreArchive(
    archiveName: string,
    destination: string,
    onProgress?: (progress: BorgProgress) => void
  ): Promise<void> {
    await ensureBorgInstalled();

    // Create destination directory
    await mkdir(destination, { recursive: true });

    const args = [
      '--progress',
      `${this.config.repoPath}::${archiveName}`
    ];

    try {
      await executeBorgCommand(
        'extract',
        args,
        (line) => {
          const progress = parseProgress(line);
          if (progress && onProgress) {
            onProgress(progress);
          }
        }
      );
    } catch (error: any) {
      throw new Error(`Failed to restore archive: ${error.message}`);
    }
  }

  /**
   * Prune old archives based on retention policy
   */
  async pruneArchives(policy: BorgRetentionPolicy): Promise<void> {
    await ensureBorgInstalled();

    const args = [
      '--stats',
      '--list',
      `--keep-daily=${policy.daily}`,
      `--keep-weekly=${policy.weekly}`,
      `--keep-monthly=${policy.monthly}`,
      this.config.repoPath
    ];

    try {
      await executeBorgCommand('prune', args);
    } catch (error: any) {
      throw new Error(`Failed to prune archives: ${error.message}`);
    }
  }

  /**
   * Get repository information and statistics
   */
  async getRepositoryInfo(): Promise<BorgRepositoryInfo> {
    await ensureBorgInstalled();

    const args = [
      '--json',
      this.config.repoPath
    ];

    try {
      const { stdout } = await executeBorgCommand('info', args);
      const data = JSON.parse(stdout);

      // Get repository metadata
      const repo = data.repository;
      const cache = data.cache;

      return {
        path: this.config.repoPath,
        id: repo.id,
        lastModified: new Date(repo.last_modified),
        archiveCount: cache?.stats?.total_chunks || 0,
        originalSize: cache?.stats?.total_size || 0,
        compressedSize: cache?.stats?.total_csize || 0,
        dedupedSize: cache?.stats?.unique_csize || 0,
        encryption: data.encryption?.mode || 'none'
      };
    } catch (error: any) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  /**
   * Check repository consistency
   */
  async checkRepository(): Promise<boolean> {
    await ensureBorgInstalled();

    const args = [
      this.config.repoPath
    ];

    try {
      await executeBorgCommand('check', args);
      return true;
    } catch (error: any) {
      console.error(`Repository check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if archive already exists for today
   */
  async hasArchiveForToday(interval: string, source: string): Promise<boolean> {
    const archives = await this.listArchives();

    const today = new Date().toISOString().split('T')[0];
    const prefix = `${interval}-${today}`;

    return archives.some(archive =>
      archive.name.startsWith(prefix) &&
      archive.name.includes(source)
    );
  }
}
