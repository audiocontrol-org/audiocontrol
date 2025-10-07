/**
 * Media detection and disk image discovery for local storage media
 * Supports macOS and Linux platform-specific mount point detection
 */

import { readdir, stat } from 'fs/promises';
import { platform } from 'os';
import { join, basename, extname } from 'pathe';

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

/**
 * Filesystem operations interface for dependency injection
 */
export interface FileSystemOperations {
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; size: number; mtime: Date }>;
  platform(): string;
}

/**
 * Default filesystem operations using Node.js built-ins
 */
class DefaultFileSystemOperations implements FileSystemOperations {
  async readdir(path: string): Promise<string[]> {
    return readdir(path);
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; size: number; mtime: Date }> {
    return stat(path);
  }

  platform(): string {
    return platform();
  }
}

/**
 * MediaDetector - Detects storage media and discovers disk images
 *
 * Platform support:
 * - macOS: Scans /Volumes/ (excludes system volumes)
 * - Linux: Scans /media/$USER/ and /mnt/
 *
 * Supported disk image formats: .hds, .img, .iso
 */
export class MediaDetector {
  private readonly fs: FileSystemOperations;
  private static readonly DISK_IMAGE_EXTENSIONS = ['.hds', '.img', '.iso'];
  private static readonly HIDDEN_FILE_PREFIX = '.';
  private static readonly MACOS_SYSTEM_VOLUMES = ['Macintosh HD', 'Data', 'Preboot', 'Recovery', 'VM'];

  constructor(fsOps?: FileSystemOperations) {
    this.fs = fsOps ?? new DefaultFileSystemOperations();
  }

  /**
   * Detect all available storage media on the system
   * @returns Array of MediaInfo for each detected media
   */
  async detectMedia(): Promise<MediaInfo[]> {
    const platformType = this.fs.platform();
    const mountPoints = await this.getMountPoints(platformType);
    const mediaInfos: MediaInfo[] = [];

    for (const mountPoint of mountPoints) {
      try {
        const diskImages = await this.findDiskImages(mountPoint);
        const volumeName = basename(mountPoint);

        mediaInfos.push({
          mountPoint,
          volumeName,
          diskImages,
        });
      } catch (error: any) {
        // Skip mount points we can't access (permissions, unmounted, etc.)
        // This is expected behavior - not all mount points may be accessible
        continue;
      }
    }

    return mediaInfos;
  }

  /**
   * Recursively find disk images in a directory
   * @param path - Directory path to search
   * @returns Array of DiskImageInfo for discovered disk images
   */
  async findDiskImages(path: string): Promise<DiskImageInfo[]> {
    const diskImages: DiskImageInfo[] = [];

    // First verify the path exists and is accessible
    try {
      await this.fs.stat(path);
    } catch (error: any) {
      throw new Error(`Failed to scan directory ${path}: ${error.message}`);
    }

    // Now scan the directory - any errors during scanning are logged but don't fail
    await this.scanDirectory(path, diskImages);

    return diskImages;
  }

  /**
   * Get platform-specific mount points to scan
   */
  private async getMountPoints(platformType: string): Promise<string[]> {
    if (platformType === 'darwin') {
      return this.getMacOSMountPoints();
    } else if (platformType === 'linux') {
      return this.getLinuxMountPoints();
    }

    throw new Error(`Unsupported platform: ${platformType}`);
  }

  /**
   * Get macOS mount points from /Volumes/
   * Excludes system volumes like "Macintosh HD"
   */
  private async getMacOSMountPoints(): Promise<string[]> {
    const volumesPath = '/Volumes';
    const mountPoints: string[] = [];

    try {
      const entries = await this.fs.readdir(volumesPath);

      for (const entry of entries) {
        // Skip hidden files
        if (entry.startsWith(MediaDetector.HIDDEN_FILE_PREFIX)) {
          continue;
        }

        // Skip system volumes
        if (MediaDetector.MACOS_SYSTEM_VOLUMES.includes(entry)) {
          continue;
        }

        const fullPath = join(volumesPath, entry);

        try {
          const stats = await this.fs.stat(fullPath);
          if (stats.isDirectory()) {
            mountPoints.push(fullPath);
          }
        } catch {
          // Skip entries we can't stat
          continue;
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to read macOS volumes directory: ${error.message}`);
    }

    return mountPoints;
  }

  /**
   * Get Linux mount points from /media/$USER/ and /mnt/
   */
  private async getLinuxMountPoints(): Promise<string[]> {
    const mountPoints: string[] = [];
    const username = process.env.USER || process.env.USERNAME || '';
    const mediaPaths = [
      `/media/${username}`,
      '/mnt',
    ];

    for (const basePath of mediaPaths) {
      try {
        const entries = await this.fs.readdir(basePath);

        for (const entry of entries) {
          // Skip hidden files
          if (entry.startsWith(MediaDetector.HIDDEN_FILE_PREFIX)) {
            continue;
          }

          const fullPath = join(basePath, entry);

          try {
            const stats = await this.fs.stat(fullPath);
            if (stats.isDirectory()) {
              mountPoints.push(fullPath);
            }
          } catch {
            // Skip entries we can't stat
            continue;
          }
        }
      } catch {
        // Path doesn't exist or not accessible, skip it
        continue;
      }
    }

    return mountPoints;
  }

  /**
   * Recursively scan a directory for disk images
   */
  private async scanDirectory(dirPath: string, results: DiskImageInfo[]): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath);

      for (const entry of entries) {
        // Skip hidden files
        if (entry.startsWith(MediaDetector.HIDDEN_FILE_PREFIX)) {
          continue;
        }

        const fullPath = join(dirPath, entry);

        try {
          const stats = await this.fs.stat(fullPath);

          if (stats.isDirectory()) {
            // Recurse into subdirectories
            await this.scanDirectory(fullPath, results);
          } else if (stats.isFile()) {
            // Check if this is a disk image file
            if (this.isDiskImage(entry)) {
              const name = basename(entry, extname(entry));
              results.push({
                path: fullPath,
                name,
                size: stats.size,
                mtime: stats.mtime,
              });
            }
          }
        } catch {
          // Skip entries we can't stat (permissions, broken symlinks, etc.)
          continue;
        }
      }
    } catch (error: any) {
      // If we can't read this directory, skip it silently
      // This handles permission errors during recursive scanning
      return;
    }
  }

  /**
   * Check if a filename has a disk image extension
   */
  private isDiskImage(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return MediaDetector.DISK_IMAGE_EXTENSIONS.includes(ext);
  }
}
