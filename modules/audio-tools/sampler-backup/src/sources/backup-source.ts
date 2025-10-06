/**
 * Unified interface for backup sources (remote SSH and local file-based)
 * Provides abstraction over different backup mechanisms
 */

import type { BackupResult, RsnapshotInterval } from '@/types/index.js';

/**
 * Configuration for remote SSH-based backup sources
 */
export interface RemoteSourceConfig {
  /** Source type identifier */
  type: 'remote';
  /** Remote host (e.g., "pi-scsi2.local") */
  host: string;
  /** Remote source path to backup (e.g., "/home/pi/images/") */
  sourcePath: string;
  /** Local backup subdirectory name (e.g., "pi-scsi2") */
  backupSubdir: string;
}

/**
 * Configuration for local file-based backup sources
 */
export interface LocalSourceConfig {
  /** Source type identifier */
  type: 'local';
  /** Local source path to backup from (e.g., "/Volumes/SDCARD") */
  sourcePath: string;
  /** Local backup subdirectory name (e.g., "local-media") */
  backupSubdir: string;
  /** Optional override for snapshot root directory (default: ~/.audiotools/backup) */
  snapshotRoot?: string;
}

/**
 * Union type for all backup source configurations
 */
export type BackupSourceConfig = RemoteSourceConfig | LocalSourceConfig;

/**
 * Unified interface for backup sources
 *
 * Implementations:
 * - RemoteSource: Wraps rsnapshot for SSH-based backups
 * - LocalSource: Uses LocalBackupAdapter for file-based backups
 */
export interface BackupSource {
  /** Source type identifier */
  readonly type: 'remote' | 'local';

  /**
   * Execute backup for the specified interval
   *
   * @param interval - Backup interval (daily, weekly, monthly)
   * @returns Promise resolving to backup result with success status and metadata
   */
  backup(interval: RsnapshotInterval): Promise<BackupResult>;

  /**
   * Test if the source is accessible and properly configured
   *
   * @returns Promise resolving to true if source is accessible, false otherwise
   */
  test(): Promise<boolean>;

  /**
   * Get the configuration for this source
   *
   * @returns Source configuration object
   */
  getConfig(): BackupSourceConfig;
}
