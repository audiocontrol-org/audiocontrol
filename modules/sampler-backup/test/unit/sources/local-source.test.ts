/**
 * Unit tests for LocalSource (RsyncAdapter implementation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalSource } from '@/lib/sources/local-source.js';
import type { LocalSourceConfig } from '@/lib/sources/backup-source.js';
import type { RsyncConfig } from '@/lib/backup/rsync-adapter.js';

// Mock RsyncAdapter
class MockRsyncAdapter {
  syncCalled = false;
  lastSyncConfig: RsyncConfig | null = null;

  async sync(config: RsyncConfig): Promise<void> {
    this.syncCalled = true;
    this.lastSyncConfig = config;
  }

  async checkRsyncAvailable(): Promise<boolean> {
    return true;
  }
}

// Mock existsSync
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// Mock mkdir
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
}));

describe('LocalSource', () => {
  const mockConfig: LocalSourceConfig = {
    type: 'local',
    sourcePath: '/Volumes/SDCARD',
    sampler: 's5k-studio',
    device: 'floppy',
    backupSubdir: 'local-media',
  };

  let mockRsyncAdapter: MockRsyncAdapter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockRsyncAdapter = new MockRsyncAdapter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset mocks
    const { existsSync } = await import('node:fs');
    const { mkdir } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create LocalSource with config and RsyncAdapter', () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      expect(source.type).toBe('local');
      expect(source.getConfig()).toEqual(mockConfig);
    });

    it('should throw error when sampler is missing', () => {
      const invalidConfig = {
        type: 'local' as const,
        sourcePath: '/Volumes/SDCARD',
        device: 'floppy',
        backupSubdir: 'local-media',
      } as any;

      expect(() => {
        new LocalSource(invalidConfig, mockRsyncAdapter);
      }).toThrow('Sampler name is required for local sources');
    });

    it('should throw error when device is missing', () => {
      const invalidConfig = {
        type: 'local' as const,
        sourcePath: '/Volumes/SDCARD',
        sampler: 's5k-studio',
        backupSubdir: 'local-media',
      } as any;

      expect(() => {
        new LocalSource(invalidConfig, mockRsyncAdapter);
      }).toThrow('Device name is required');
    });
  });

  describe('getConfig()', () => {
    it('should return the source configuration', () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('getBackupPath()', () => {
    it('should return the resolved backup path', () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);
      const backupPath = source.getBackupPath();

      expect(backupPath).toContain('.audiotools/backup');
      expect(backupPath).toContain('s5k-studio');
      expect(backupPath).toContain('floppy');
    });
  });

  describe('backup()', () => {
    it('should sync files using rsync adapter', async () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      const result = await source.backup('daily');

      expect(mockRsyncAdapter.syncCalled).toBe(true);
      expect(mockRsyncAdapter.lastSyncConfig).toMatchObject({
        sourcePath: '/Volumes/SDCARD',
        destPath: expect.stringContaining('s5k-studio/floppy'),
      });
      expect(result.success).toBe(true);
      expect(result.interval).toBe('daily');
    });

    it('should create backup directory before syncing', async () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);
      const { mkdir } = await import('node:fs/promises');

      await source.backup('daily');

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('s5k-studio/floppy'),
        { recursive: true }
      );
    });

    it('should handle backup errors', async () => {
      const errorAdapter = new MockRsyncAdapter();
      errorAdapter.sync = async () => {
        throw new Error('rsync failed with code 1');
      };

      const source = new LocalSource(mockConfig, errorAdapter);

      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('rsync failed with code 1');
    });

    it('should support weekly interval', async () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      const result = await source.backup('weekly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('weekly');
    });

    it('should support monthly interval', async () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      const result = await source.backup('monthly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('monthly');
    });

    it('should set snapshotPath to backup directory on success', async () => {
      const source = new LocalSource(mockConfig, mockRsyncAdapter);

      const result = await source.backup('daily');

      expect(result.success).toBe(true);
      expect(result.snapshotPath).toContain('s5k-studio/floppy');
    });
  });

  describe('test()', () => {
    it('should return true when source path exists', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const source = new LocalSource(mockConfig, mockRsyncAdapter);
      const result = await source.test();

      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/Volumes/SDCARD');
    });

    it('should return false when source path does not exist', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const source = new LocalSource(mockConfig, mockRsyncAdapter);
      const result = await source.test();

      expect(result).toBe(false);
    });
  });

  describe('hierarchical repository paths', () => {
    it('should use correct repository path for s5k-studio floppy', () => {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: '/Volumes/FLOPPY',
        sampler: 's5k-studio',
        device: 'floppy',
        backupSubdir: 'floppy',
      };

      const source = new LocalSource(config, mockRsyncAdapter);
      const backupPath = source.getBackupPath();

      expect(backupPath).toContain('s5k-studio');
      expect(backupPath).toContain('floppy');
    });

    it('should use correct repository path for s3k-zulu scsi0', () => {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: '/Volumes/SCSI0',
        sampler: 's3k-zulu',
        device: 'scsi0',
        backupSubdir: 'scsi0',
      };

      const source = new LocalSource(config, mockRsyncAdapter);
      const backupPath = source.getBackupPath();

      expect(backupPath).toContain('s3k-zulu');
      expect(backupPath).toContain('scsi0');
    });
  });
});
