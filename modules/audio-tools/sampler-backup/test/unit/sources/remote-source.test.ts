/**
 * Unit tests for RemoteSource
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteSource } from '@/sources/remote-source.js';
import type { RemoteSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult } from '@/types/index.js';

// Mock the rsnapshot wrapper and config modules
vi.mock('@/backup/rsnapshot-wrapper.js', () => ({
  runBackup: vi.fn(),
  testRsnapshotConfig: vi.fn(),
}));

vi.mock('@/config/rsnapshot-config.js', () => ({
  getDefaultRsnapshotConfig: vi.fn(),
  writeRsnapshotConfig: vi.fn(),
  getDefaultConfigPath: vi.fn(() => '/mock/.audiotools/rsnapshot.conf'),
}));

// Import mocked functions
import { runBackup, testRsnapshotConfig } from '@/backup/rsnapshot-wrapper.js';
import { getDefaultRsnapshotConfig, writeRsnapshotConfig } from '@/config/rsnapshot-config.js';

describe('RemoteSource', () => {
  const mockConfig: RemoteSourceConfig = {
    type: 'remote',
    host: 'pi-scsi2.local',
    sourcePath: '/home/pi/images/',
    backupSubdir: 'pi-scsi2',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(getDefaultRsnapshotConfig).mockReturnValue({
      snapshotRoot: '/mock/backup',
      retain: { daily: 7, weekly: 4, monthly: 12 },
      samplers: [],
      options: {
        rsyncShortArgs: '-a',
        rsyncLongArgs: '--delete --numeric-ids',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create RemoteSource with config', () => {
      const source = new RemoteSource(mockConfig);

      expect(source.type).toBe('remote');
      expect(source.getConfig()).toEqual(mockConfig);
    });

    it('should accept custom config path', () => {
      const customPath = '/custom/rsnapshot.conf';
      const source = new RemoteSource(mockConfig, customPath);

      expect(source).toBeInstanceOf(RemoteSource);
    });
  });

  describe('getConfig()', () => {
    it('should return the source configuration', () => {
      const source = new RemoteSource(mockConfig);

      expect(source.getConfig()).toEqual(mockConfig);
    });
  });

  describe('backup()', () => {
    it('should generate rsnapshot config and run backup', async () => {
      const source = new RemoteSource(mockConfig);

      const mockResult: BackupResult = {
        success: true,
        interval: 'daily',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: [],
      };

      vi.mocked(runBackup).mockResolvedValue(mockResult);

      const result = await source.backup('daily');

      expect(writeRsnapshotConfig).toHaveBeenCalledTimes(1);
      expect(writeRsnapshotConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          samplers: expect.arrayContaining([
            expect.objectContaining({
              host: mockConfig.host,
              sourcePath: mockConfig.sourcePath,
              backupSubdir: mockConfig.backupSubdir,
            }),
          ]),
        }),
        '/mock/.audiotools/rsnapshot.conf'
      );

      expect(runBackup).toHaveBeenCalledTimes(1);
      expect(runBackup).toHaveBeenCalledWith({
        interval: 'daily',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        configOnly: false,
        test: false,
      });

      expect(result).toEqual(mockResult);
    });

    it('should support weekly interval', async () => {
      const source = new RemoteSource(mockConfig);

      const mockResult: BackupResult = {
        success: true,
        interval: 'weekly',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: [],
      };

      vi.mocked(runBackup).mockResolvedValue(mockResult);

      await source.backup('weekly');

      expect(runBackup).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'weekly' })
      );
    });

    it('should support monthly interval', async () => {
      const source = new RemoteSource(mockConfig);

      const mockResult: BackupResult = {
        success: true,
        interval: 'monthly',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: [],
      };

      vi.mocked(runBackup).mockResolvedValue(mockResult);

      await source.backup('monthly');

      expect(runBackup).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'monthly' })
      );
    });

    it('should return backup errors from runBackup', async () => {
      const source = new RemoteSource(mockConfig);

      const mockResult: BackupResult = {
        success: false,
        interval: 'daily',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: ['Rsnapshot failed: Permission denied'],
      };

      vi.mocked(runBackup).mockResolvedValue(mockResult);

      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Rsnapshot failed: Permission denied');
    });

    it('should use custom config path if provided', async () => {
      const customPath = '/custom/rsnapshot.conf';
      const source = new RemoteSource(mockConfig, customPath);

      vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'daily',
        configPath: customPath,
        errors: [],
      });

      await source.backup('daily');

      expect(writeRsnapshotConfig).toHaveBeenCalledWith(
        expect.any(Object),
        customPath
      );

      expect(runBackup).toHaveBeenCalledWith(
        expect.objectContaining({ configPath: customPath })
      );
    });
  });

  describe('test()', () => {
    it('should return true when rsnapshot config is valid', async () => {
      const source = new RemoteSource(mockConfig);

      vi.mocked(testRsnapshotConfig).mockResolvedValue({ valid: true });

      const result = await source.test();

      expect(result).toBe(true);
      expect(writeRsnapshotConfig).toHaveBeenCalledTimes(1);
      expect(testRsnapshotConfig).toHaveBeenCalledTimes(1);
    });

    it('should return false when rsnapshot config is invalid', async () => {
      const source = new RemoteSource(mockConfig);

      vi.mocked(testRsnapshotConfig).mockResolvedValue({
        valid: false,
        error: 'Invalid config',
      });

      const result = await source.test();

      expect(result).toBe(false);
    });

    it('should return false and log error when test throws', async () => {
      const source = new RemoteSource(mockConfig);

      vi.mocked(testRsnapshotConfig).mockRejectedValue(
        new Error('Network error')
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await source.test();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Remote source test failed')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should use custom config path for testing', async () => {
      const customPath = '/custom/rsnapshot.conf';
      const source = new RemoteSource(mockConfig, customPath);

      vi.mocked(testRsnapshotConfig).mockResolvedValue({ valid: true });

      await source.test();

      expect(writeRsnapshotConfig).toHaveBeenCalledWith(
        expect.any(Object),
        customPath
      );

      expect(testRsnapshotConfig).toHaveBeenCalledWith(customPath);
    });
  });

  describe('rsnapshot config conversion', () => {
    it('should merge RemoteSourceConfig with default rsnapshot config', async () => {
      const source = new RemoteSource(mockConfig);

      vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'daily',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: [],
      });

      await source.backup('daily');

      const configArg = vi.mocked(writeRsnapshotConfig).mock.calls[0][0];

      expect(configArg).toMatchObject({
        snapshotRoot: '/mock/backup',
        retain: { daily: 7, weekly: 4, monthly: 12 },
        samplers: [
          {
            type: 's5k',
            host: 'pi-scsi2.local',
            sourcePath: '/home/pi/images/',
            backupSubdir: 'pi-scsi2',
          },
        ],
      });
    });

    it('should preserve rsnapshot options from default config', async () => {
      const source = new RemoteSource(mockConfig);

      vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'daily',
        configPath: '/mock/.audiotools/rsnapshot.conf',
        errors: [],
      });

      await source.backup('daily');

      const configArg = vi.mocked(writeRsnapshotConfig).mock.calls[0][0];

      expect(configArg.options).toMatchObject({
        rsyncShortArgs: '-a',
        rsyncLongArgs: '--delete --numeric-ids',
      });
    });
  });
});
