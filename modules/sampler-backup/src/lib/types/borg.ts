/**
 * Type definitions for BorgBackup integration
 */

import type { RsnapshotInterval } from '@/lib/types/index.js';

/**
 * Borg repository configuration
 */
export interface BorgRepositoryConfig {
  /** Path to Borg repository (e.g., ~/.audiotools/borg-repo) */
  repoPath: string;

  /** Encryption mode (default: 'none' for simplicity) */
  encryption?: 'none' | 'repokey' | 'keyfile';

  /** Compression algorithm (default: 'zstd' for balance) */
  compression?: 'none' | 'lz4' | 'zstd' | 'zlib,6';

  /** SSH connection string for remote repositories (optional) */
  sshCommand?: string;
}

/**
 * Borg archive (snapshot) metadata
 */
export interface BorgArchive {
  /** Archive name (e.g., "daily-2025-10-05T12:34:56-pi-scsi2") */
  name: string;

  /** Archive creation timestamp */
  timestamp: Date;

  /** Archive statistics */
  stats: {
    /** Original uncompressed size */
    originalSize: number;

    /** Compressed size (before deduplication) */
    compressedSize: number;

    /** Deduplicated size (actual storage used) */
    dedupedSize: number;

    /** Number of files in archive */
    nfiles: number;
  };

  /** Archive comment/description (optional) */
  comment?: string;
}

/**
 * Retention policy matching rsnapshot intervals
 */
export interface BorgRetentionPolicy {
  /** Keep last N daily backups */
  daily: number;

  /** Keep last N weekly backups */
  weekly: number;

  /** Keep last N monthly backups */
  monthly: number;
}

/**
 * Progress information during backup/restore
 */
export interface BorgProgress {
  /** Current operation (e.g., "Creating archive") */
  operation: string;

  /** Current file being processed */
  currentFile?: string;

  /** Bytes processed so far */
  bytesProcessed: number;

  /** Total bytes to process (estimate) */
  totalBytes: number;

  /** Files processed so far */
  filesProcessed: number;

  /** Total files to process */
  totalFiles: number;

  /** Compression ratio so far */
  compressionRatio?: number;

  /** Deduplication ratio so far */
  dedupRatio?: number;
}

/**
 * Repository information and statistics
 */
export interface BorgRepositoryInfo {
  /** Repository path */
  path: string;

  /** Repository ID (unique identifier) */
  id: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** Number of archives in repository */
  archiveCount: number;

  /** Total original size of all archives */
  originalSize: number;

  /** Total compressed size */
  compressedSize: number;

  /** Total deduplicated size (actual disk usage) */
  dedupedSize: number;

  /** Repository encryption mode */
  encryption: string;
}

/**
 * Result of a Borg command execution
 */
export interface BorgCommandResult {
  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Exit code */
  exitCode: number;
}

/**
 * Core Borg backup adapter interface
 *
 * This adapter provides a clean interface to BorgBackup for the
 * sampler-backup system, handling repository management, archive
 * creation, restoration, and pruning.
 *
 * @example
 * ```typescript
 * const adapter = new BorgBackupAdapter({
 *   repoPath: '~/.audiotools/borg-repo',
 *   compression: 'zstd',
 *   encryption: 'none'
 * });
 *
 * // Create backup
 * const archive = await adapter.createArchive(
 *   ['/Volumes/SDCARD'],
 *   'daily-2025-10-05-local-media'
 * );
 *
 * // Prune old archives
 * await adapter.pruneArchives({
 *   daily: 7,
 *   weekly: 4,
 *   monthly: 12
 * });
 * ```
 */
export interface IBorgBackupAdapter {
  /**
   * Initialize a new Borg repository
   *
   * Creates a new repository with the specified configuration.
   * This is a one-time operation per repository.
   *
   * @param config Repository configuration
   * @throws Error if repository already exists or cannot be created
   */
  initRepository(config: BorgRepositoryConfig): Promise<void>;

  /**
   * Create a new backup archive
   *
   * Creates a new archive in the repository containing the specified
   * source paths. Supports both local paths and SSH remote paths.
   *
   * @param sources Array of paths to backup (can be local or SSH remote)
   * @param archiveName Name for the archive (must be unique in repository)
   * @param onProgress Optional callback for progress updates
   * @returns Archive metadata with statistics
   * @throws Error if backup fails or archive name already exists
   *
   * @example
   * ```typescript
   * // Local backup
   * const archive = await adapter.createArchive(
   *   ['/Volumes/SDCARD/HD0.hds', '/Volumes/SDCARD/HD1.hds'],
   *   'daily-2025-10-05-local-media',
   *   (progress) => console.log(`${progress.bytesProcessed} bytes`)
   * );
   *
   * // Remote SSH backup
   * const archive = await adapter.createArchive(
   *   ['pi@pi-scsi2.local:/home/orion/images/'],
   *   'daily-2025-10-05-pi-scsi2'
   * );
   * ```
   */
  createArchive(
    sources: string[],
    archiveName: string,
    onProgress?: (progress: BorgProgress) => void
  ): Promise<BorgArchive>;

  /**
   * List all archives in repository
   *
   * Returns metadata for all archives, sorted by creation timestamp.
   *
   * @returns Array of archive metadata
   * @throws Error if repository cannot be accessed
   */
  listArchives(): Promise<BorgArchive[]>;

  /**
   * Restore specific archive to destination
   *
   * Extracts all files from the specified archive to the destination path.
   * Creates destination directory if it doesn't exist.
   *
   * @param archiveName Name of archive to restore
   * @param destination Path where files should be extracted
   * @param onProgress Optional callback for progress updates
   * @throws Error if archive doesn't exist or restore fails
   *
   * @example
   * ```typescript
   * await adapter.restoreArchive(
   *   'daily-2025-10-05-pi-scsi2',
   *   '/tmp/restored-backup'
   * );
   * ```
   */
  restoreArchive(
    archiveName: string,
    destination: string,
    onProgress?: (progress: BorgProgress) => void
  ): Promise<void>;

  /**
   * Prune old archives based on retention policy
   *
   * Removes archives that don't match the retention rules.
   * Borg automatically handles the logic of which archives to keep.
   *
   * @param policy Retention policy (daily, weekly, monthly counts)
   * @throws Error if prune operation fails
   *
   * @example
   * ```typescript
   * await adapter.pruneArchives({
   *   daily: 7,
   *   weekly: 4,
   *   monthly: 12
   * });
   * ```
   */
  pruneArchives(policy: BorgRetentionPolicy): Promise<void>;

  /**
   * Get repository information and statistics
   *
   * Returns detailed information about the repository including
   * size statistics and archive count.
   *
   * @returns Repository metadata and statistics
   * @throws Error if repository cannot be accessed
   */
  getRepositoryInfo(): Promise<BorgRepositoryInfo>;

  /**
   * Check repository consistency
   *
   * Runs Borg's integrity check to verify repository is not corrupted.
   * This can be a slow operation for large repositories.
   *
   * @returns True if repository is consistent, false otherwise
   */
  checkRepository(): Promise<boolean>;

  /**
   * Check if archive already exists for today
   *
   * Used for same-day resume logic to avoid duplicate backups.
   *
   * @param interval Backup interval (daily, weekly, monthly)
   * @param source Source identifier (e.g., "pi-scsi2", "local-media")
   * @returns True if archive exists for today with this interval/source
   */
  hasArchiveForToday(interval: string, source: string): Promise<boolean>;
}
