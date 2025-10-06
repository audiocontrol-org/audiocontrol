/**
 * Unit tests for LocalBackupAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalBackupAdapter, type FileSystemOperations, type LocalBackupOptions, type BackupProgress } from '@/backup/local-backup-adapter';
import { Readable, Writable } from 'stream';

/**
 * Mock filesystem for testing
 */
class MockFileSystem implements FileSystemOperations {
  private files = new Map<string, { size: number; mtime: Date; content: Buffer; isDirectory: boolean }>();
  private directories = new Set<string>();

  // Mock error triggers
  public nextStatError: Error | null = null;
  public nextReaddirError: Error | null = null;
  public nextMkdirError: Error | null = null;
  public nextUnlinkError: Error | null = null;
  public nextUtimesError: Error | null = null;
  public nextReadStreamError: Error | null = null;
  public nextWriteStreamError: Error | null = null;

  addFile(path: string, content: Buffer, mtime: Date) {
    this.files.set(path, { size: content.length, mtime, content, isDirectory: false });
  }

  addDirectory(path: string) {
    this.directories.add(path);
  }

  getFile(path: string) {
    return this.files.get(path);
  }

  hasDirectory(path: string): boolean {
    return this.directories.has(path);
  }

  async stat(path: string) {
    if (this.nextStatError) {
      const error = this.nextStatError;
      this.nextStatError = null;
      throw error;
    }

    const file = this.files.get(path);
    if (file) {
      return {
        size: file.size,
        mtime: file.mtime,
        isFile: () => !file.isDirectory,
        isDirectory: () => file.isDirectory,
      };
    }

    if (this.directories.has(path)) {
      return {
        size: 0,
        mtime: new Date(),
        isFile: () => false,
        isDirectory: () => true,
      };
    }

    const error: any = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    error.code = 'ENOENT';
    throw error;
  }

  async mkdir(path: string, options?: { recursive: boolean }) {
    if (this.nextMkdirError) {
      const error = this.nextMkdirError;
      this.nextMkdirError = null;
      throw error;
    }

    this.directories.add(path);
  }

  async unlink(path: string) {
    if (this.nextUnlinkError) {
      const error = this.nextUnlinkError;
      this.nextUnlinkError = null;
      throw error;
    }

    this.files.delete(path);
  }

  async utimes(path: string, atime: Date, mtime: Date) {
    if (this.nextUtimesError) {
      const error = this.nextUtimesError;
      this.nextUtimesError = null;
      throw error;
    }

    const file = this.files.get(path);
    if (file) {
      file.mtime = mtime;
    }
  }

  createReadStream(path: string): NodeJS.ReadableStream {
    const file = this.files.get(path);

    if (this.nextReadStreamError) {
      const error = this.nextReadStreamError;
      this.nextReadStreamError = null;
      const stream = new Readable({
        read() {
          this.destroy(error);
        }
      });
      return stream as any;
    }

    if (!file) {
      const error: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
      error.code = 'ENOENT';
      const stream = new Readable({
        read() {
          this.destroy(error);
        }
      });
      return stream as any;
    }

    const stream = new Readable({
      read() {
        this.push(file.content);
        this.push(null);
      }
    });

    return stream as any;
  }

  createWriteStream(path: string): NodeJS.WritableStream {
    if (this.nextWriteStreamError) {
      const error = this.nextWriteStreamError;
      this.nextWriteStreamError = null;
      const stream = new Writable({
        write(chunk, encoding, callback) {
          callback(error);
        }
      });
      return stream as any;
    }

    const chunks: Buffer[] = [];
    const self = this;

    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        const content = Buffer.concat(chunks);
        self.files.set(path, {
          size: content.length,
          mtime: new Date(),
          content,
          isDirectory: false,
        });
        callback();
      }
    });

    return stream as any;
  }

  async readdir(path: string): Promise<string[]> {
    if (this.nextReaddirError) {
      const error = this.nextReaddirError;
      this.nextReaddirError = null;
      throw error;
    }

    if (!this.directories.has(path)) {
      const error: any = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      error.code = 'ENOENT';
      throw error;
    }

    const results: string[] = [];

    // Find all files in this directory
    for (const [filePath] of this.files) {
      if (filePath.startsWith(path + '/')) {
        const relativePath = filePath.substring(path.length + 1);
        const firstSegment = relativePath.split('/')[0];
        if (!results.includes(firstSegment)) {
          results.push(firstSegment);
        }
      }
    }

    // Find all subdirectories
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(path + '/') && dirPath !== path) {
        const relativePath = dirPath.substring(path.length + 1);
        const firstSegment = relativePath.split('/')[0];
        if (!results.includes(firstSegment)) {
          results.push(firstSegment);
        }
      }
    }

    return results;
  }
}

describe('LocalBackupAdapter', () => {
  let mockFs: MockFileSystem;
  let adapter: LocalBackupAdapter;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    adapter = new LocalBackupAdapter(mockFs);
  });

  describe('backup()', () => {
    describe('basic functionality', () => {
      it('should copy new file when destination does not exist', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test content'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(result.filesCopied).toBe(1);
        expect(result.filesSkipped).toBe(0);
        expect(result.errors).toHaveLength(0);

        const destFile = mockFs.getFile('/dest/file1.hds');
        expect(destFile).toBeDefined();
        expect(destFile?.content.toString()).toBe('test content');
        expect(destFile?.mtime).toEqual(mtime);
      });

      it('should skip unchanged file with same mtime and size', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory(destPath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);
        mockFs.addFile('/dest/file1.hds', Buffer.from('test'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(result.filesCopied).toBe(0);
        expect(result.filesSkipped).toBe(1);
      });

      it('should update file when source mtime is newer', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const oldMtime = new Date('2024-01-01');
        const newMtime = new Date('2024-01-02');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory(destPath);
        mockFs.addFile('/source/file1.hds', Buffer.from('new content'), newMtime);
        mockFs.addFile('/dest/file1.hds', Buffer.from('old content'), oldMtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesCopied).toBe(1);
        expect(result.filesSkipped).toBe(0);

        const destFile = mockFs.getFile('/dest/file1.hds');
        expect(destFile?.content.toString()).toBe('new content');
        expect(destFile?.mtime).toEqual(newMtime);
      });

      it('should update file when size differs', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory(destPath);
        mockFs.addFile('/source/file1.hds', Buffer.from('new content'), mtime);
        mockFs.addFile('/dest/file1.hds', Buffer.from('old'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesCopied).toBe(1);

        const destFile = mockFs.getFile('/dest/file1.hds');
        expect(destFile?.content.toString()).toBe('new content');
      });

      it('should copy all files when incremental is false', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory(destPath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);
        mockFs.addFile('/dest/file1.hds', Buffer.from('test'), mtime);

        const result = await adapter.backup({ sourcePath, destPath, incremental: false });

        expect(result.success).toBe(true);
        expect(result.filesCopied).toBe(1);
        expect(result.filesSkipped).toBe(0);
      });
    });

    describe('progress tracking', () => {
      it('should invoke progress callback during copy', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');
        const content = Buffer.alloc(1024, 'x'); // 1KB file

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', content, mtime);

        const progressUpdates: BackupProgress[] = [];
        const onProgress = vi.fn((progress: BackupProgress) => {
          progressUpdates.push({ ...progress });
        });

        await adapter.backup({ sourcePath, destPath, onProgress });

        expect(onProgress).toHaveBeenCalled();
        expect(progressUpdates.length).toBeGreaterThan(0);

        // Check final progress
        const finalProgress = progressUpdates[progressUpdates.length - 1];
        expect(finalProgress.filesProcessed).toBe(1);
        expect(finalProgress.totalFiles).toBe(1);
        expect(finalProgress.bytesProcessed).toBe(1024);
        expect(finalProgress.totalBytes).toBe(1024);
      });

      it('should track progress for multiple files', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.alloc(100, 'a'), mtime);
        mockFs.addFile('/source/file2.hds', Buffer.alloc(200, 'b'), mtime);
        mockFs.addFile('/source/file3.hds', Buffer.alloc(300, 'c'), mtime);

        const progressUpdates: BackupProgress[] = [];
        const onProgress = vi.fn((progress: BackupProgress) => {
          progressUpdates.push({ ...progress });
        });

        await adapter.backup({ sourcePath, destPath, onProgress });

        const finalProgress = progressUpdates[progressUpdates.length - 1];
        expect(finalProgress.filesProcessed).toBe(3);
        expect(finalProgress.totalFiles).toBe(3);
        expect(finalProgress.bytesProcessed).toBe(600);
        expect(finalProgress.totalBytes).toBe(600);
      });

      it('should track bytes accurately for large files', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');
        const largeContent = Buffer.alloc(10 * 1024 * 1024, 'x'); // 10MB

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/large.hds', largeContent, mtime);

        const progressUpdates: BackupProgress[] = [];
        const onProgress = vi.fn((progress: BackupProgress) => {
          progressUpdates.push({ ...progress });
        });

        await adapter.backup({ sourcePath, destPath, onProgress });

        expect(progressUpdates.length).toBeGreaterThan(0);
        const finalProgress = progressUpdates[progressUpdates.length - 1];
        expect(finalProgress.bytesProcessed).toBe(10 * 1024 * 1024);
      });
    });

    describe('error handling', () => {
      it('should handle missing source directory', async () => {
        const result = await adapter.backup({ sourcePath: '/nonexistent', destPath: '/dest' });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Failed to access source directory');
      });

      it('should handle source that is not a directory', async () => {
        mockFs.addFile('/file.txt', Buffer.from('test'), new Date());

        const result = await adapter.backup({ sourcePath: '/file.txt', destPath: '/dest' });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Source path is not a directory');
      });

      it('should skip files with permission errors and continue', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test1'), mtime);
        mockFs.addFile('/source/file2.hds', Buffer.from('test2'), mtime);

        // Trigger EACCES error on first file's read stream
        const eaccesError: any = new Error('Permission denied');
        eaccesError.code = 'EACCES';
        mockFs.nextReadStreamError = eaccesError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1); // Only second file processed
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Permission denied');
        expect(result.errors[0]).toContain('/source/file1.hds');
      });

      it('should fail on disk full error', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        const enospcError: any = new Error('No space left on device');
        enospcError.code = 'ENOSPC';
        mockFs.nextWriteStreamError = enospcError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Disk full');
      });

      it('should cleanup partial files on write error', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        const writeError = new Error('Write failed');
        mockFs.nextWriteStreamError = writeError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(mockFs.getFile('/dest/file1.hds')).toBeUndefined();
      });

      it('should cleanup partial files on read error', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        const readError = new Error('Read failed');
        mockFs.nextReadStreamError = readError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(mockFs.getFile('/dest/file1.hds')).toBeUndefined();
      });

      it('should handle generic errors and stop processing', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        const genericError = new Error('Something went wrong');
        mockFs.nextReadStreamError = genericError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Failed to copy');
        expect(result.errors[0]).toContain('Something went wrong');
      });

      it('should handle utimes error after successful copy', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        const utimesError = new Error('Failed to set timestamps');
        mockFs.nextUtimesError = utimesError;

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Failed to copy');
        expect(result.errors[0]).toContain('Failed to set timestamps');
      });

      it('should handle stat error in ensureDirectory', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test'), mtime);

        // First stat succeeds (source directory check), second stat fails (ensureDirectory check for destination)
        let statCallCount = 0;
        const originalStat = mockFs.stat.bind(mockFs);
        mockFs.stat = async (path: string) => {
          statCallCount++;
          // First call is for source directory - allow it
          if (statCallCount === 1) {
            return originalStat(path);
          }
          // Second call is for source file discovery - allow it
          if (statCallCount === 2) {
            return originalStat(path);
          }
          // Third call will be for destination directory in ensureDirectory - fail with non-ENOENT error
          if (statCallCount === 3) {
            const statError: any = new Error('Permission denied on stat');
            statError.code = 'EPERM';
            throw statError;
          }
          return originalStat(path);
        };

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Failed to copy');
      });
    });

    describe('directory structure', () => {
      it('should preserve directory structure', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory('/source/subdir');
        mockFs.addDirectory('/source/subdir/nested');
        mockFs.addFile('/source/subdir/file1.hds', Buffer.from('test1'), mtime);
        mockFs.addFile('/source/subdir/nested/file2.hds', Buffer.from('test2'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(2);

        expect(mockFs.getFile('/dest/subdir/file1.hds')).toBeDefined();
        expect(mockFs.getFile('/dest/subdir/nested/file2.hds')).toBeDefined();
        expect(mockFs.hasDirectory('/dest/subdir')).toBe(true);
        expect(mockFs.hasDirectory('/dest/subdir/nested')).toBe(true);
      });

      it('should create nested directories as needed', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory('/source/a');
        mockFs.addDirectory('/source/a/b');
        mockFs.addDirectory('/source/a/b/c');
        mockFs.addFile('/source/a/b/c/deep.hds', Buffer.from('deep file'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(mockFs.getFile('/dest/a/b/c/deep.hds')).toBeDefined();
      });

      it('should skip hidden files and directories', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/.hidden.hds', Buffer.from('hidden'), mtime);
        mockFs.addFile('/source/visible.hds', Buffer.from('visible'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(mockFs.getFile('/dest/.hidden.hds')).toBeUndefined();
        expect(mockFs.getFile('/dest/visible.hds')).toBeDefined();
      });
    });

    describe('timestamp preservation', () => {
      it('should preserve source file modification time', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-03-15T10:30:00Z');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file.hds', Buffer.from('test'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);

        const destFile = mockFs.getFile('/dest/file.hds');
        expect(destFile?.mtime).toEqual(mtime);
      });

      it('should preserve timestamps for multiple files', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime1 = new Date('2024-01-01');
        const mtime2 = new Date('2024-02-01');
        const mtime3 = new Date('2024-03-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.from('test1'), mtime1);
        mockFs.addFile('/source/file2.hds', Buffer.from('test2'), mtime2);
        mockFs.addFile('/source/file3.hds', Buffer.from('test3'), mtime3);

        await adapter.backup({ sourcePath, destPath });

        expect(mockFs.getFile('/dest/file1.hds')?.mtime).toEqual(mtime1);
        expect(mockFs.getFile('/dest/file2.hds')?.mtime).toEqual(mtime2);
        expect(mockFs.getFile('/dest/file3.hds')?.mtime).toEqual(mtime3);
      });
    });

    describe('empty directory handling', () => {
      it('should handle empty source directory', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';

        mockFs.addDirectory(sourcePath);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(0);
        expect(result.filesCopied).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle directories with only subdirectories (no files)', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory('/source/empty1');
        mockFs.addDirectory('/source/empty2');

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(0);
      });
    });

    describe('bytes processed tracking', () => {
      it('should track total bytes processed', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addFile('/source/file1.hds', Buffer.alloc(1000, 'a'), mtime);
        mockFs.addFile('/source/file2.hds', Buffer.alloc(2000, 'b'), mtime);
        mockFs.addFile('/source/file3.hds', Buffer.alloc(3000, 'c'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.bytesProcessed).toBe(6000);
      });

      it('should track bytes even for skipped files', async () => {
        const sourcePath = '/source';
        const destPath = '/dest';
        const mtime = new Date('2024-01-01');

        mockFs.addDirectory(sourcePath);
        mockFs.addDirectory(destPath);
        mockFs.addFile('/source/file1.hds', Buffer.alloc(1000, 'a'), mtime);
        mockFs.addFile('/dest/file1.hds', Buffer.alloc(1000, 'a'), mtime);

        const result = await adapter.backup({ sourcePath, destPath });

        expect(result.success).toBe(true);
        expect(result.filesSkipped).toBe(1);
        expect(result.bytesProcessed).toBe(1000);
      });
    });
  });
});
