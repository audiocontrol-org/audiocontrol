/**
 * Local backup adapter for copying disk images from local media
 * Implements incremental backup with progress tracking
 */

import { createReadStream, createWriteStream } from 'fs';
import { stat, mkdir, unlink, utimes } from 'fs/promises';
import { dirname, join } from 'pathe';

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
 * Result of a backup operation
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
 * Filesystem operations interface for dependency injection
 */
export interface FileSystemOperations {
  stat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  unlink(path: string): Promise<void>;
  utimes(path: string, atime: Date, mtime: Date): Promise<void>;
  createReadStream(path: string): NodeJS.ReadableStream;
  createWriteStream(path: string): NodeJS.WritableStream;
  readdir(path: string): Promise<string[]>;
}

/**
 * Default filesystem operations using Node.js built-ins
 */
class DefaultFileSystemOperations implements FileSystemOperations {
  async stat(path: string) {
    return stat(path);
  }

  async mkdir(path: string, options?: { recursive: boolean }) {
    await mkdir(path, options);
  }

  async unlink(path: string) {
    await unlink(path);
  }

  async utimes(path: string, atime: Date, mtime: Date) {
    await utimes(path, atime, mtime);
  }

  createReadStream(path: string) {
    return createReadStream(path);
  }

  createWriteStream(path: string) {
    return createWriteStream(path);
  }

  async readdir(path: string) {
    const { readdir } = await import('fs/promises');
    return readdir(path);
  }
}

/**
 * Information about a file to backup
 */
interface FileInfo {
  sourcePath: string;
  destPath: string;
  size: number;
  mtime: Date;
}

/**
 * LocalBackupAdapter - Handles file-based incremental backups
 *
 * Features:
 * - Incremental copying (skip unchanged files)
 * - Timestamp preservation
 * - Progress tracking for large files
 * - Error handling with partial file cleanup
 */
export class LocalBackupAdapter {
  private readonly fs: FileSystemOperations;

  constructor(fsOps?: FileSystemOperations) {
    this.fs = fsOps ?? new DefaultFileSystemOperations();
  }

  /**
   * Perform backup from source to destination
   */
  async backup(options: LocalBackupOptions): Promise<LocalBackupResult> {
    const { sourcePath, destPath, incremental = true, onProgress } = options;

    const result: LocalBackupResult = {
      success: true,
      filesProcessed: 0,
      filesCopied: 0,
      filesSkipped: 0,
      bytesProcessed: 0,
      errors: [],
    };

    try {
      // Verify source exists
      const sourceStat = await this.fs.stat(sourcePath);
      if (!sourceStat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${sourcePath}`);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to access source directory ${sourcePath}: ${error.message}`);
      return result;
    }

    // Discover all files to backup
    const filesToBackup: FileInfo[] = [];
    await this.discoverFiles(sourcePath, destPath, filesToBackup);

    if (filesToBackup.length === 0) {
      return result;
    }

    // Calculate total bytes
    const totalBytes = filesToBackup.reduce((sum, file) => sum + file.size, 0);
    let bytesProcessed = 0;

    // Process each file
    for (const fileInfo of filesToBackup) {
      try {
        const shouldCopy = !incremental || await this.shouldCopyFile(fileInfo.sourcePath, fileInfo.destPath);

        if (shouldCopy) {
          // Ensure destination directory exists
          await this.ensureDirectory(dirname(fileInfo.destPath));

          // Copy file with progress tracking
          await this.copyFileWithProgress(
            fileInfo.sourcePath,
            fileInfo.destPath,
            fileInfo.mtime,
            (bytes) => {
              if (onProgress) {
                onProgress({
                  currentFile: fileInfo.sourcePath,
                  bytesProcessed: bytesProcessed + bytes,
                  totalBytes,
                  filesProcessed: result.filesProcessed,
                  totalFiles: filesToBackup.length,
                });
              }
            }
          );

          result.filesCopied++;
          bytesProcessed += fileInfo.size;
        } else {
          result.filesSkipped++;
          bytesProcessed += fileInfo.size;
        }

        result.filesProcessed++;

        // Final progress update for this file
        if (onProgress) {
          onProgress({
            currentFile: fileInfo.sourcePath,
            bytesProcessed,
            totalBytes,
            filesProcessed: result.filesProcessed,
            totalFiles: filesToBackup.length,
          });
        }
      } catch (error: any) {
        // Handle specific error types
        if (error.code === 'EACCES') {
          result.errors.push(`Permission denied for ${fileInfo.sourcePath}, skipping`);
          continue;
        } else if (error.code === 'ENOSPC') {
          result.success = false;
          result.errors.push(`Disk full while copying ${fileInfo.sourcePath}`);
          return result;
        } else {
          result.success = false;
          result.errors.push(`Failed to copy ${fileInfo.sourcePath}: ${error.message}`);
          return result;
        }
      }
    }

    result.bytesProcessed = bytesProcessed;
    return result;
  }

  /**
   * Recursively discover files to backup
   */
  private async discoverFiles(sourcePath: string, destPath: string, results: FileInfo[]): Promise<void> {
    try {
      const entries = await this.fs.readdir(sourcePath);

      for (const entry of entries) {
        // Skip hidden files
        if (entry.startsWith('.')) {
          continue;
        }

        const sourceFile = join(sourcePath, entry);
        const destFile = join(destPath, entry);

        try {
          const stats = await this.fs.stat(sourceFile);

          if (stats.isDirectory()) {
            await this.discoverFiles(sourceFile, destFile, results);
          } else if (stats.isFile()) {
            results.push({
              sourcePath: sourceFile,
              destPath: destFile,
              size: stats.size,
              mtime: stats.mtime,
            });
          }
        } catch {
          // Skip files we can't stat
          continue;
        }
      }
    } catch {
      // Skip directories we can't read
      return;
    }
  }

  /**
   * Determine if a file should be copied based on incremental logic
   * Returns true if:
   * - Destination doesn't exist
   * - Source is newer than destination (mtime)
   * - Source size differs from destination
   */
  private async shouldCopyFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      const [sourceStat, destStat] = await Promise.all([
        this.fs.stat(sourcePath),
        this.fs.stat(destPath),
      ]);

      // Compare modification time and size
      return sourceStat.mtime > destStat.mtime || sourceStat.size !== destStat.size;
    } catch (error: any) {
      // If destination doesn't exist, we need to copy
      if (error.code === 'ENOENT') {
        return true;
      }
      // For other errors, throw to be handled by caller
      throw error;
    }
  }

  /**
   * Copy file with progress tracking and timestamp preservation
   */
  private async copyFileWithProgress(
    sourcePath: string,
    destPath: string,
    mtime: Date,
    onProgress?: (bytes: number) => void
  ): Promise<void> {
    let bytesWritten = 0;
    let cleanupNeeded = false;

    return new Promise((resolve, reject) => {
      const readStream = this.fs.createReadStream(sourcePath);
      const writeStream = this.fs.createWriteStream(destPath);

      cleanupNeeded = true;

      readStream.on('data', (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (onProgress) {
          onProgress(bytesWritten);
        }
      });

      readStream.on('error', async (error) => {
        // Cleanup partial file
        if (cleanupNeeded) {
          try {
            await this.fs.unlink(destPath);
          } catch {
            // Ignore cleanup errors
          }
        }
        reject(error);
      });

      writeStream.on('error', async (error) => {
        // Cleanup partial file
        if (cleanupNeeded) {
          try {
            await this.fs.unlink(destPath);
          } catch {
            // Ignore cleanup errors
          }
        }
        reject(error);
      });

      writeStream.on('finish', async () => {
        cleanupNeeded = false;

        try {
          // Preserve modification time
          await this.fs.utimes(destPath, mtime, mtime);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      readStream.pipe(writeStream);
    });
  }

  /**
   * Ensure directory exists, creating it recursively if needed
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await this.fs.stat(dirPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        await this.fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }
}
