/**
 * Type definitions for sampler backup functionality using rsnapshot
 */

/**
 * Information about a discovered disk image file
 */
export interface DiskImageInfo {
  /** Absolute path to disk image file */
  path: string;
  /** Filename without extension */
  name: string;
  /** File size in bytes */
  size: number;
  /** Last modification time */
  mtime: Date;
}

/**
 * Information about detected storage media
 */
export interface MediaInfo {
  /** Mount point path (e.g., "/Volumes/SDCARD") */
  mountPoint: string;
  /** Volume name (e.g., "SDCARD") */
  volumeName: string;
  /** Disk images found on this media */
  diskImages: DiskImageInfo[];
}

export type SamplerType = "s5k" | "s3k";

export type RsnapshotInterval = "daily" | "weekly" | "monthly";

export interface SamplerConfig {
    /**
     * Sampler type identifier
     */
    type: SamplerType;

    /**
     * Remote host (e.g., "pi-scsi2.local")
     */
    host: string;

    /**
     * Remote source path to backup (e.g., "/home/pi/images/")
     */
    sourcePath: string;

    /**
     * Local backup subdirectory name (e.g., "pi-scsi2")
     */
    backupSubdir: string;
}

export interface RsnapshotConfig {
    /**
     * Root directory for snapshots
     */
    snapshotRoot: string;

    /**
     * Retention policy: interval => count
     * e.g., { daily: 7, weekly: 4, monthly: 12 }
     */
    retain: Record<RsnapshotInterval, number>;

    /**
     * Samplers to backup
     */
    samplers: SamplerConfig[];

    /**
     * Additional rsnapshot options
     */
    options?: {
        rsyncShortArgs?: string;
        rsyncLongArgs?: string;
        sshArgs?: string;
        verbose?: number;
    };
}

export interface BackupOptions {
    /**
     * Rsnapshot interval to run (default: "daily")
     */
    interval?: RsnapshotInterval;

    /**
     * Config file path (default: ~/.audiotools/rsnapshot.conf)
     */
    configPath?: string;

    /**
     * Generate config only, don't run backup
     */
    configOnly?: boolean;

    /**
     * Test mode (rsnapshot configtest)
     */
    test?: boolean;
}

export interface BackupResult {
    success: boolean;
    interval: RsnapshotInterval;
    configPath: string;
    snapshotPath?: string;
    errors: string[];
}

/**
 * Options for local backup operations
 */
export interface LocalBackupOptions {
  /** Source directory (e.g., /Volumes/SDCARD) */
  sourcePath: string;
  /** Destination directory (e.g., ~/.audiotools/backup/daily.0/local-media) */
  destPath: string;
  /** Skip unchanged files based on mtime and size (default: true) */
  incremental?: boolean;
  /** Progress callback invoked during backup */
  onProgress?: (progress: BackupProgress) => void;
}

/**
 * Progress information during backup
 */
export interface BackupProgress {
  /** Current file being processed */
  currentFile: string;
  /** Bytes processed so far */
  bytesProcessed: number;
  /** Total bytes to process */
  totalBytes: number;
  /** Files processed so far */
  filesProcessed: number;
  /** Total files to process */
  totalFiles: number;
}

/**
 * Result of a local backup operation
 */
export interface LocalBackupResult {
  /** Whether the backup completed successfully */
  success: boolean;
  /** Number of files processed */
  filesProcessed: number;
  /** Number of files copied */
  filesCopied: number;
  /** Number of files skipped (unchanged) */
  filesSkipped: number;
  /** Total bytes processed */
  bytesProcessed: number;
  /** Errors encountered during backup */
  errors: string[];
}

/**
 * Backup source abstraction types
 */
export type {
  BackupSource,
  BackupSourceConfig,
  RemoteSourceConfig,
  LocalSourceConfig,
} from '@/sources/backup-source.js';

export type {
  BackupSourceFromPathOptions,
} from '@/sources/backup-source-factory.js';
