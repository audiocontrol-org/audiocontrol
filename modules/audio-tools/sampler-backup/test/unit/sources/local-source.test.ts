/**
 * Unit tests for LocalSource (BorgBackup implementation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalSource } from '@/sources/local-source.js';
import type { LocalSourceConfig } from '@/sources/backup-source.js';
import type { DiskImageInfo } from '@/types/index.js';
import type { IBorgBackupAdapter, BorgArchive } from '@/types/borg.js';

// Mock MediaDetector
class MockMediaDetector {
  findDiskImages = vi.fn();
}

// Mock BorgBackup adapter
class MockBorgAdapter implements IBorgBackupAdapter {
  createArchiveCalled = false;
  pruneArchivesCalled = false;

  async initRepository(): Promise<void> {}
  async createArchive(): Promise<BorgArchive> {
    this.createArchiveCalled = true;
    return {
      name: 'test-archive',
      id: 'abc123',
      stats: {
        nfiles: 10,
        originalSize: 1024 * 1024,
        compressedSize: 512 * 1024,
        dedupedSize: 256 * 1024,
      },
    };
  }
  async listArchives(): Promise<BorgArchive[]> {
    return [];
  }
  async pruneArchives(): Promise<void> {
    this.pruneArchivesCalled = true;
  }
  async getRepositoryInfo(): Promise<any> {
    return { location: '/mock/repo' };
  }
  async hasArchiveForToday(): Promise<boolean> {
    return false;
  }
}

describe('LocalSource', () => {
  const mockConfig: LocalSourceConfig = {
    type: 'local',
    sourcePath: '/Volumes/SDCARD',
    backupSubdir: 'local-media',
  };

  let mockMediaDetector: MockMediaDetector;
  let mockBorgAdapter: MockBorgAdapter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockMediaDetector = new MockMediaDetector();
    mockBorgAdapter = new MockBorgAdapter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create LocalSource with config and BorgBackup adapter', () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      expect(source.type).toBe('local');
      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('getConfig()', () => {
    it('should return the source configuration', () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('backup()', () => {
    it('should discover disk images and create Borg archive', async () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      const mockDiskImages: DiskImageInfo[] = [
        { path: '/Volumes/SDCARD/disk1.hds', name: 'disk1', size: 1024, mtime: new Date() },
        { path: '/Volumes/SDCARD/disk2.hds', name: 'disk2', size: 2048, mtime: new Date() },
      ];

      mockMediaDetector.findDiskImages.mockResolvedValue(mockDiskImages);

      const result = await source.backup('daily');

      expect(mockMediaDetector.findDiskImages).toHaveBeenCalledWith('/Volumes/SDCARD');
      expect(mockBorgAdapter.createArchiveCalled).toBe(true);
      expect(mockBorgAdapter.pruneArchivesCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.interval).toBe('daily');
    });

    it('should handle no disk images found', async () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([]);

      const result = await source.backup('daily');

      expect(result.success).toBe(true);
      expect(mockBorgAdapter.createArchiveCalled).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No disk images found')
      );
    });

    it('should handle backup errors', async () => {
      const errorAdapter = new MockBorgAdapter();
      errorAdapter.createArchive = async () => {
        throw new Error('Borg backup failed');
      };

      const source = new LocalSource(mockConfig, mockMediaDetector, errorAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([
        { path: '/Volumes/SDCARD/disk.hds', name: 'disk', size: 1024, mtime: new Date() },
      ]);

      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Borg backup failed');
    });

    it('should support weekly interval', async () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([
        { path: '/Volumes/SDCARD/disk.hds', name: 'disk', size: 1024, mtime: new Date() },
      ]);

      const result = await source.backup('weekly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('weekly');
    });

    it('should support monthly interval', async () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([
        { path: '/Volumes/SDCARD/disk.hds', name: 'disk', size: 1024, mtime: new Date() },
      ]);

      const result = await source.backup('monthly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('monthly');
    });
  });

  describe('test()', () => {
    it('should return true when source is accessible', async () => {
      const source = new LocalSource(mockConfig, mockMediaDetector, mockBorgAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([]);

      const result = await source.test();

      expect(result).toBe(true);
    });

    it('should return false when source is not accessible', async () => {
      const errorDetector = new MockMediaDetector();
      errorDetector.findDiskImages = vi.fn().mockRejectedValue(new Error('Source not found'));

      const source = new LocalSource(mockConfig, errorDetector, mockBorgAdapter);

      const result = await source.test();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Local source test failed')
      );
    });

    it('should return false when Borg repository is not accessible', async () => {
      const errorAdapter = new MockBorgAdapter();
      errorAdapter.listArchives = async () => {
        throw new Error('Repository not found');
      };

      const source = new LocalSource(mockConfig, mockMediaDetector, errorAdapter);

      mockMediaDetector.findDiskImages.mockResolvedValue([]);

      const result = await source.test();

      expect(result).toBe(false);
    });
  });
});
