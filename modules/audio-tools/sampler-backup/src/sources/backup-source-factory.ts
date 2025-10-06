/**
 * Factory for creating BackupSource instances
 * Supports auto-detection of source type from path or explicit configuration
 */

import { RemoteSource } from '@/sources/remote-source.js';
import { LocalSource } from '@/sources/local-source.js';
import type { BackupSource, BackupSourceConfig, RemoteSourceConfig, LocalSourceConfig } from '@/sources/backup-source.js';

/**
 * Options for creating a backup source from a path
 */
export interface BackupSourceFromPathOptions {
  /** Backup subdirectory name (default: auto-generated from path) */
  backupSubdir?: string;
  /** Snapshot root directory (for local sources only) */
  snapshotRoot?: string;
  /** Config file path (for remote sources only) */
  configPath?: string;
}

/**
 * BackupSourceFactory - Factory for creating BackupSource instances
 *
 * Provides two creation methods:
 * 1. create() - From explicit BackupSourceConfig
 * 2. fromPath() - Auto-detect source type from path string
 */
export class BackupSourceFactory {
  /**
   * Create a BackupSource from explicit configuration
   *
   * @param config - Backup source configuration
   * @returns BackupSource instance (RemoteSource or LocalSource)
   */
  static create(config: BackupSourceConfig): BackupSource {
    if (config.type === 'remote') {
      return new RemoteSource(config);
    } else {
      return new LocalSource(config);
    }
  }

  /**
   * Create a BackupSource from a path string with auto-detection
   *
   * Detection logic:
   * - Contains ':' → Remote SSH source (e.g., "host:/path")
   * - Otherwise → Local filesystem source (e.g., "/Volumes/SDCARD")
   *
   * @param path - Source path (local or remote SSH syntax)
   * @param options - Optional configuration
   * @returns BackupSource instance
   * @throws Error if path format is invalid
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

    // Generate backup subdirectory name from host if not provided
    const backupSubdir = options.backupSubdir ?? this.generateSubdirFromHost(host);

    const config: RemoteSourceConfig = {
      type: 'remote',
      host: hostPart, // Keep user@ prefix if present
      sourcePath,
      backupSubdir,
    };

    return new RemoteSource(config, options.configPath);
  }

  /**
   * Create LocalSource from filesystem path string
   */
  private static createLocalFromPath(
    path: string,
    options: BackupSourceFromPathOptions
  ): BackupSource {
    // Generate backup subdirectory name from path if not provided
    const backupSubdir = options.backupSubdir ?? this.generateSubdirFromPath(path);

    const config: LocalSourceConfig = {
      type: 'local',
      sourcePath: path,
      backupSubdir,
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
