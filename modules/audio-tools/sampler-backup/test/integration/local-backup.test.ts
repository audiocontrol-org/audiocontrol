/**
 * Integration tests for LocalBackupAdapter with real filesystem
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalBackupAdapter } from '@/backup/local-backup-adapter';
import { mkdir, writeFile, readFile, stat, rm, utimes } from 'fs/promises';
import { join } from 'pathe';
import { tmpdir } from 'os';

describe('LocalBackupAdapter Integration Tests', () => {
  let testDir: string;
  let sourceDir: string;
  let destDir: string;
  let adapter: LocalBackupAdapter;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `backup-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    sourceDir = join(testDir, 'source');
    destDir = join(testDir, 'dest');

    await mkdir(testDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });

    adapter = new LocalBackupAdapter();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('full backup workflow', () => {
    it('should backup disk images from source to destination', async () => {
      // Create test disk images
      await writeFile(join(sourceDir, 'disk1.hds'), 'Disk 1 content');
      await writeFile(join(sourceDir, 'disk2.img'), 'Disk 2 content');
      await writeFile(join(sourceDir, 'disk3.iso'), 'Disk 3 content');

      // Perform backup
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      // Verify results
      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(3);
      expect(result.filesCopied).toBe(3);
      expect(result.filesSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify files were copied
      const dest1 = await readFile(join(destDir, 'disk1.hds'), 'utf-8');
      const dest2 = await readFile(join(destDir, 'disk2.img'), 'utf-8');
      const dest3 = await readFile(join(destDir, 'disk3.iso'), 'utf-8');

      expect(dest1).toBe('Disk 1 content');
      expect(dest2).toBe('Disk 2 content');
      expect(dest3).toBe('Disk 3 content');
    });

    it('should preserve directory structure', async () => {
      // Create nested directory structure
      await mkdir(join(sourceDir, 'subdir'), { recursive: true });
      await mkdir(join(sourceDir, 'subdir', 'nested'), { recursive: true });

      await writeFile(join(sourceDir, 'root.hds'), 'Root file');
      await writeFile(join(sourceDir, 'subdir', 'sub.hds'), 'Sub file');
      await writeFile(join(sourceDir, 'subdir', 'nested', 'deep.hds'), 'Deep file');

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(3);

      // Verify structure
      const rootContent = await readFile(join(destDir, 'root.hds'), 'utf-8');
      const subContent = await readFile(join(destDir, 'subdir', 'sub.hds'), 'utf-8');
      const deepContent = await readFile(join(destDir, 'subdir', 'nested', 'deep.hds'), 'utf-8');

      expect(rootContent).toBe('Root file');
      expect(subContent).toBe('Sub file');
      expect(deepContent).toBe('Deep file');
    });

    it('should preserve file modification times', async () => {
      const mtime = new Date('2024-03-15T10:30:00Z');

      await writeFile(join(sourceDir, 'test.hds'), 'Test content');
      await utimes(join(sourceDir, 'test.hds'), mtime, mtime);

      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      const destStat = await stat(join(destDir, 'test.hds'));
      expect(destStat.mtime.toISOString()).toBe(mtime.toISOString());
    });
  });

  describe('incremental backup', () => {
    it('should skip unchanged files on second run', async () => {
      // First backup
      await writeFile(join(sourceDir, 'disk1.hds'), 'Content 1');
      await writeFile(join(sourceDir, 'disk2.hds'), 'Content 2');

      const result1 = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result1.filesCopied).toBe(2);
      expect(result1.filesSkipped).toBe(0);

      // Second backup (no changes)
      const result2 = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result2.filesCopied).toBe(0);
      expect(result2.filesSkipped).toBe(2);
    });

    it('should copy only modified files', async () => {
      // First backup
      await writeFile(join(sourceDir, 'disk1.hds'), 'Original 1');
      await writeFile(join(sourceDir, 'disk2.hds'), 'Original 2');
      await writeFile(join(sourceDir, 'disk3.hds'), 'Original 3');

      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      // Wait a bit to ensure different mtime
      await new Promise(resolve => setTimeout(resolve, 10));

      // Modify one file
      await writeFile(join(sourceDir, 'disk2.hds'), 'Modified 2');

      // Second backup
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.filesCopied).toBe(1);
      expect(result.filesSkipped).toBe(2);

      // Verify only modified file was updated
      const dest2 = await readFile(join(destDir, 'disk2.hds'), 'utf-8');
      expect(dest2).toBe('Modified 2');
    });

    it('should copy new files added after first backup', async () => {
      // First backup
      await writeFile(join(sourceDir, 'disk1.hds'), 'Content 1');
      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      // Add new files
      await writeFile(join(sourceDir, 'disk2.hds'), 'Content 2');
      await writeFile(join(sourceDir, 'disk3.hds'), 'Content 3');

      // Second backup
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.filesProcessed).toBe(3);
      expect(result.filesCopied).toBe(2); // New files
      expect(result.filesSkipped).toBe(1); // Existing file
    });

    it('should handle mixed scenario: new, modified, and unchanged files', async () => {
      // First backup
      await writeFile(join(sourceDir, 'unchanged.hds'), 'No change');
      await writeFile(join(sourceDir, 'modified.hds'), 'Original');

      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      // Wait for different mtime
      await new Promise(resolve => setTimeout(resolve, 10));

      // Modify one, add one, keep one unchanged
      await writeFile(join(sourceDir, 'modified.hds'), 'Changed');
      await writeFile(join(sourceDir, 'new.hds'), 'Brand new');

      // Second backup
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.filesProcessed).toBe(3);
      expect(result.filesCopied).toBe(2); // modified + new
      expect(result.filesSkipped).toBe(1); // unchanged

      // Verify contents
      const unchanged = await readFile(join(destDir, 'unchanged.hds'), 'utf-8');
      const modified = await readFile(join(destDir, 'modified.hds'), 'utf-8');
      const newFile = await readFile(join(destDir, 'new.hds'), 'utf-8');

      expect(unchanged).toBe('No change');
      expect(modified).toBe('Changed');
      expect(newFile).toBe('Brand new');
    });
  });

  describe('large file handling', () => {
    it('should handle files larger than 10MB', async () => {
      // Create a 10MB file
      const largeContent = Buffer.alloc(10 * 1024 * 1024, 'x');
      await writeFile(join(sourceDir, 'large.hds'), largeContent);

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
      expect(result.filesCopied).toBe(1);
      expect(result.bytesProcessed).toBe(10 * 1024 * 1024);

      // Verify file was copied correctly
      const destStat = await stat(join(destDir, 'large.hds'));
      expect(destStat.size).toBe(10 * 1024 * 1024);
    });

    it('should report progress for large files', async () => {
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'y');
      await writeFile(join(sourceDir, 'large.hds'), largeContent);

      let progressCallCount = 0;
      let lastProgress = 0;

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
        onProgress: (progress) => {
          progressCallCount++;
          expect(progress.bytesProcessed).toBeGreaterThanOrEqual(lastProgress);
          lastProgress = progress.bytesProcessed;
        },
      });

      expect(result.success).toBe(true);
      expect(progressCallCount).toBeGreaterThan(0);
    });
  });

  describe('error scenarios', () => {
    it('should handle non-existent source directory', async () => {
      const result = await adapter.backup({
        sourcePath: '/nonexistent/path',
        destPath: destDir,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to access source directory');
    });

    it('should handle empty source directory', async () => {
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
      expect(result.filesCopied).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('progress callback', () => {
    it('should provide accurate progress information', async () => {
      await writeFile(join(sourceDir, 'file1.hds'), Buffer.alloc(1000, 'a'));
      await writeFile(join(sourceDir, 'file2.hds'), Buffer.alloc(2000, 'b'));
      await writeFile(join(sourceDir, 'file3.hds'), Buffer.alloc(3000, 'c'));

      let progressUpdates = 0;
      let finalProgress: any = null;

      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
        onProgress: (progress) => {
          progressUpdates++;
          finalProgress = progress;
        },
      });

      expect(progressUpdates).toBeGreaterThan(0);
      expect(finalProgress).toBeDefined();
      expect(finalProgress.filesProcessed).toBe(3);
      expect(finalProgress.totalFiles).toBe(3);
      expect(finalProgress.bytesProcessed).toBe(6000);
      expect(finalProgress.totalBytes).toBe(6000);
    });

    it('should report current file being processed', async () => {
      await writeFile(join(sourceDir, 'test.hds'), 'content');

      let reportedFile = '';

      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
        onProgress: (progress) => {
          reportedFile = progress.currentFile;
        },
      });

      expect(reportedFile).toContain('test.hds');
    });
  });

  describe('bytes processed tracking', () => {
    it('should accurately count total bytes processed', async () => {
      await writeFile(join(sourceDir, 'file1.hds'), Buffer.alloc(12345));
      await writeFile(join(sourceDir, 'file2.hds'), Buffer.alloc(67890));

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.bytesProcessed).toBe(12345 + 67890);
    });

    it('should count bytes even for skipped files', async () => {
      await writeFile(join(sourceDir, 'file.hds'), Buffer.alloc(5000));
      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.filesSkipped).toBe(1);
      expect(result.bytesProcessed).toBe(5000);
    });
  });

  describe('hidden files', () => {
    it('should skip hidden files', async () => {
      await writeFile(join(sourceDir, '.hidden.hds'), 'Hidden content');
      await writeFile(join(sourceDir, 'visible.hds'), 'Visible content');

      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      expect(result.filesProcessed).toBe(1);

      // Verify only visible file was copied
      const visibleExists = await stat(join(destDir, 'visible.hds')).then(() => true).catch(() => false);
      const hiddenExists = await stat(join(destDir, '.hidden.hds')).then(() => true).catch(() => false);

      expect(visibleExists).toBe(true);
      expect(hiddenExists).toBe(false);
    });
  });

  describe('non-incremental mode', () => {
    it('should copy all files regardless of timestamps when incremental is false', async () => {
      // First backup
      await writeFile(join(sourceDir, 'file.hds'), 'Original');
      await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
      });

      // Modify destination to have newer timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      await writeFile(join(destDir, 'file.hds'), 'Modified in dest');

      // Second backup with incremental=false
      await writeFile(join(sourceDir, 'file.hds'), 'New source');
      const result = await adapter.backup({
        sourcePath: sourceDir,
        destPath: destDir,
        incremental: false,
      });

      expect(result.filesCopied).toBe(1);
      expect(result.filesSkipped).toBe(0);

      // Verify source content was copied
      const content = await readFile(join(destDir, 'file.hds'), 'utf-8');
      expect(content).toBe('New source');
    });
  });
});
