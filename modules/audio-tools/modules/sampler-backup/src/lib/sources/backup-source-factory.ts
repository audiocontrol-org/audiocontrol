/**
 * Factory for creating BackupSource instances
 * Supports auto-detection of source type from path or explicit configuration
 */

import { RemoteSource } from '@/lib/sources/remote-source.js';
import { LocalSource } from '@/lib/sources/local-source.js';
import type { BackupSource, BackupSourceConfig, RemoteSourceConfig, LocalSourceConfig } from '@/lib/sources/backup-source.js';

/**
 * Options for creating a backup source from a path string
 *
 * @example
 * ```typescript
 * const options: BackupSourceFromPathOptions = {
 *   backupSubdir: 'my-sampler',
 *   snapshotRoot: '/custom/backup/location'
 * };
 * ```
 */
export interface BackupSourceFromPathOptions {
  /**
   * Sampler name (REQUIRED for local sources, optional for remote)
   * @example 's5k-studio', 's3k-zulu', 'my-sampler'
   */
  sampler?: string;

  /**
   * Device name (REQUIRED for all sources)
   * @example 'scsi0', 'scsi1', 'floppy'
   */
  device?: string;

  /**
   * Backup subdirectory name (DEPRECATED: use device instead)
   * @deprecated Use device parameter instead
   */
  backupSubdir?: string;

  /**
   * Snapshot root directory (DEPRECATED)
   * @deprecated No longer used with rsync
   */
  snapshotRoot?: string;

  /**
   * Config file path (DEPRECATED)
   * @deprecated No longer used with rsync
   */
  configPath?: string;
}

/**
 * BackupSourceFactory - Factory for creating BackupSource instances
 *
 * Provides unified interface for creating backup sources from either explicit
 * configuration objects or path strings with automatic type detection.
 *
 * @remarks
 * The factory automatically detects whether a path is a remote SSH source or
 * local filesystem path based on the presence of a colon (`:`) in the path.
 *
 * Path detection logic:
 * - Contains `:` and not a Windows path → Remote SSH source (e.g., `host:/path`)
 * - Otherwise → Local filesystem source (e.g., `/Volumes/SDCARD`)
 *
 * @example
 * Create from explicit configuration
 * ```typescript
 * const config: LocalSourceConfig = {
 *   type: 'local',
 *   sourcePath: '/Volumes/SDCARD',
 *   backupSubdir: 'sdcard'
 * };
 * const source = BackupSourceFactory.create(config);
 * ```
 *
 * @example
 * Create from local path with auto-detection
 * ```typescript
 * const source = BackupSourceFactory.fromPath('/Volumes/SDCARD', {
 *   backupSubdir: 'gotek',
 *   snapshotRoot: '~/.audiotools/backup'
 * });
 * await source.backup('daily');
 * ```
 *
 * @example
 * Create from remote SSH path with auto-detection
 * ```typescript
 * const source = BackupSourceFactory.fromPath('pi@host:/home/pi/images/', {
 *   backupSubdir: 'pi-scsi2'
 * });
 * await source.backup('daily');
 * ```
 */
export class BackupSourceFactory {
  /**
   * Create a BackupSource from explicit configuration
   *
   * @param config - Backup source configuration (RemoteSourceConfig or LocalSourceConfig)
   * @returns BackupSource instance (RemoteSource or LocalSource)
   *
   * @example
   * Create a remote source
   * ```typescript
   * const source = BackupSourceFactory.create({
   *   type: 'remote',
   *   host: 'pi@pi-scsi2.local',
   *   sourcePath: '/home/pi/images/',
   *   backupSubdir: 'pi-scsi2'
   * });
   * ```
   *
   * @example
   * Create a local source
   * ```typescript
   * const source = BackupSourceFactory.create({
   *   type: 'local',
   *   sourcePath: '/Volumes/SDCARD',
   *   backupSubdir: 'sdcard',
   *   snapshotRoot: '~/.audiotools/backup'
   * });
   * ```
   */
  static create(config: BackupSourceConfig): BackupSource {
    if (config.type === 'remote') {
      return new RemoteSource(config);
    } else {
      return new LocalSource(config);
    }
  }

  /**
   * Create a BackupSource from a path string with automatic type detection
   *
   * This is the recommended method for CLI integration and simple use cases.
   * The factory automatically determines whether the path is a remote SSH
   * source or local filesystem path.
   *
   * @param path - Source path (local or remote SSH syntax)
   * @param options - Optional configuration overrides
   * @returns BackupSource instance (RemoteSource or LocalSource)
   *
   * @throws Error if path is empty or invalid format
   *
   * @remarks
   * Detection logic:
   * - Contains `:` and not a Windows path → Remote SSH source (e.g., `host:/path`)
   * - Otherwise → Local filesystem source (e.g., `/Volumes/SDCARD`)
   *
   * Subdirectory naming:
   * - Remote: Generated from hostname (e.g., `pi-scsi2.local` → `pi-scsi2`)
   * - Local: Generated from last path component (e.g., `/Volumes/SDCARD` → `sdcard`)
   * - Override with `options.backupSubdir` for custom naming
   *
   * @example
   * Auto-detect local filesystem path
   * ```typescript
   * const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');
   * await source.backup('daily');
   * // Backs up to: ~/.audiotools/backup/daily.0/sdcard/
   * ```
   *
   * @example
   * Auto-detect remote SSH path
   * ```typescript
   * const source = BackupSourceFactory.fromPath('pi@host:/images/');
   * await source.backup('daily');
   * // Backs up to: ~/.audiotools/backup/daily.0/host/
   * ```
   *
   * @example
   * Override subdirectory name
   * ```typescript
   * const source = BackupSourceFactory.fromPath('/Volumes/GOTEK', {
   *   backupSubdir: 'gotek-s3000xl'
   * });
   * await source.backup('daily');
   * // Backs up to: ~/.audiotools/backup/daily.0/gotek-s3000xl/
   * ```
   */
  static fromPath(path: string, options: BackupSourceFromPathOptions = {}): BackupSource {
    if (!path || path.trim().length === 0) {
      throw new Error('Source path cannot be empty');
    }

    // Detect if path is remote (contains colon for SSH syntax)
    if (this.isRemotePath(path)) {
      return this.createRemoteFromPath(path, options);
    } else {
      return this.createLocalFromPath(path, options);
    }
  }

  /**
   * Check if path is a remote SSH path
   * Remote paths follow the format: [user@]host:path
   */
  private static isRemotePath(path: string): boolean {
    // Check for SSH syntax: contains ':' and doesn't look like a Windows path
    // Windows paths like "C:\..." should not be treated as remote
    const hasColon = path.includes(':');
    const isWindowsPath = /^[A-Za-z]:/.test(path);

    return hasColon && !isWindowsPath;
  }

  /**
   * Create RemoteSource from SSH path string
   */
  private static createRemoteFromPath(
    path: string,
    options: BackupSourceFromPathOptions
  ): BackupSource {
    // Parse SSH path: [user@]host:sourcePath
    const colonIndex = path.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid remote path format: ${path}`);
    }

    const hostPart = path.substring(0, colonIndex);
    const sourcePath = path.substring(colonIndex + 1);

    if (!hostPart || !sourcePath) {
      throw new Error(`Invalid remote path format: ${path}. Expected format: host:/path or user@host:/path`);
    }

    // Extract host (strip user@ if present)
    const host = hostPart.includes('@') ? hostPart.split('@')[1] : hostPart;

    // Device is required
    const device = options.device ?? options.backupSubdir;
    if (!device) {
      throw new Error('Device name is required (use --device flag)');
    }

    const config: RemoteSourceConfig = {
      type: 'remote',
      host: hostPart, // Keep user@ prefix if present
      sourcePath,
      device,
      sampler: options.sampler, // Optional override
      backupSubdir: device, // DEPRECATED: for backward compatibility
    };

    return new RemoteSource(config);
  }

  /**
   * Create LocalSource from filesystem path string
   */
  private static createLocalFromPath(
    path: string,
    options: BackupSourceFromPathOptions
  ): BackupSource {
    // Sampler is required for local sources
    if (!options.sampler) {
      throw new Error('Sampler name is required for local sources (use --sampler flag)');
    }

    // Device is required
    const device = options.device ?? options.backupSubdir;
    if (!device) {
      throw new Error('Device name is required (use --device flag)');
    }

    const config: LocalSourceConfig = {
      type: 'local',
      sourcePath: path,
      sampler: options.sampler,
      device,
      backupSubdir: device, // DEPRECATED: for backward compatibility
      snapshotRoot: options.snapshotRoot,
    };

    return new LocalSource(config);
  }

  /**
   * Generate backup subdirectory name from hostname
   * Examples: "pi-scsi2.local" → "pi-scsi2"
   */
  private static generateSubdirFromHost(host: string): string {
    // Remove .local suffix if present
    const cleaned = host.replace(/\.local$/, '');
    // Remove user@ prefix if present
    const withoutUser = cleaned.includes('@') ? cleaned.split('@')[1] : cleaned;
    // Replace dots and slashes with hyphens
    return withoutUser.replace(/[.\/]/g, '-');
  }

  /**
   * Generate backup subdirectory name from filesystem path
   * Examples:
   *   "/Volumes/SDCARD" → "sdcard"
   *   "/media/user/USB" → "usb"
   *   "local-media" → "local-media"
   */
  private static generateSubdirFromPath(path: string): string {
    // Get last path component
    const parts = path.split('/').filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1] || 'local-media';

    // Convert to lowercase and replace spaces with hyphens
    return lastPart.toLowerCase().replace(/\s+/g, '-');
  }
}
