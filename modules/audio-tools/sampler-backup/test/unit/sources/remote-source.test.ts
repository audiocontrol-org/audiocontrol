/**
 * Unit tests for RemoteSource (BorgBackup implementation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteSource } from '@/sources/remote-source.js';
import type { RemoteSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult } from '@/types/index.js';
import type { IBorgBackupAdapter, BorgArchive } from '@/types/borg.js';

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

describe('RemoteSource', () => {
  const mockConfig: RemoteSourceConfig = {
    type: 'remote',
    host: 'pi-scsi2.local',
    sourcePath: '/home/pi/images/',
    backupSubdir: 'pi-scsi2',
  };

  let mockBorgAdapter: MockBorgAdapter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockBorgAdapter = new MockBorgAdapter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create RemoteSource with config and BorgBackup adapter', () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      expect(source.type).toBe('remote');
      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('getConfig()', () => {
    it('should return the source configuration', () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('backup()', () => {
    it('should create Borg archive and prune old archives', async () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      const result = await source.backup('daily');

      expect(mockBorgAdapter.createArchiveCalled).toBe(true);
      expect(mockBorgAdapter.pruneArchivesCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.interval).toBe('daily');
    });

    it('should support weekly interval', async () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      const result = await source.backup('weekly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('weekly');
    });

    it('should support monthly interval', async () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      const result = await source.backup('monthly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('monthly');
    });

    it('should handle backup errors', async () => {
      const errorAdapter = new MockBorgAdapter();
      errorAdapter.createArchive = async () => {
        throw new Error('Borg backup failed');
      };

      const source = new RemoteSource(mockConfig, errorAdapter);
      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Borg backup failed');
    });
  });

  describe('test()', () => {
    it('should return true when Borg repository is accessible', async () => {
      const source = new RemoteSource(mockConfig, mockBorgAdapter);

      const result = await source.test();

      expect(result).toBe(true);
    });

    it('should return false when Borg repository is not accessible', async () => {
      const errorAdapter = new MockBorgAdapter();
      errorAdapter.listArchives = async () => {
        throw new Error('Repository not found');
      };

      const source = new RemoteSource(mockConfig, errorAdapter);
      const result = await source.test();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Remote source test failed')
      );
    });
  });
});
