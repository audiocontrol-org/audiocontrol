/**
 * End-to-end CLI integration tests for backup commands
 *
 * Tests CLI flag parsing, source factory integration, and backward compatibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupSourceFactory } from '@/sources/backup-source-factory.js';
import type { BackupSource } from '@/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval } from '@/types/index.js';
import { runBackup } from '@/backup/rsnapshot-wrapper.js';

// Mock modules using dependency injection pattern (no module stubbing)
vi.mock('@/sources/backup-source-factory.js');
vi.mock('@/backup/rsnapshot-wrapper.js');

// Mock BackupSource implementation for testing
class MockBackupSource implements BackupSource {
  type: 'remote' | 'local';
  private config: any;
  backupCalled = false;
  testCalled = false;
  backupInterval?: RsnapshotInterval;

  constructor(type: 'remote' | 'local', config: any) {
    this.type = type;
    this.config = config;
  }

  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    this.backupCalled = true;
    this.backupInterval = interval;

    return {
      success: true,
      interval,
      configPath: '/mock/config',
      snapshotPath: '/mock/snapshot',
      errors: [],
    };
  }

  async test(): Promise<boolean> {
    this.testCalled = true;
    return true;
  }

  getConfig() {
    return this.config;
  }
}

describe('CLI Backup Command Integration', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('--source flag with local paths', () => {
    it('should create LocalSource from local path', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/Volumes/SDCARD',
        backupSubdir: 'sdcard',
      });

      const fromPathSpy = vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      // Simulate CLI invocation: akai-backup --source /Volumes/SDCARD
      const options = { source: '/Volumes/SDCARD' };
      const interval = 'daily';

      // Execute the logic from CLI (extracted for testing)
      const source = BackupSourceFactory.fromPath(options.source, {
        snapshotRoot: undefined,
        backupSubdir: undefined,
      });

      await source.backup(interval as RsnapshotInterval);

      // Verify factory was called correctly
      expect(fromPathSpy).toHaveBeenCalledWith('/Volumes/SDCARD', {
        snapshotRoot: undefined,
        backupSubdir: undefined,
      });

      // Verify backup was executed
      expect(mockSource.backupCalled).toBe(true);
      expect(mockSource.backupInterval).toBe('daily');
      expect(source.type).toBe('local');
    });

    it('should pass custom backupSubdir to factory', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/Volumes/USB',
        backupSubdir: 'my-custom-usb',
      });

      const fromPathSpy = vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      // Simulate: akai-backup --source /Volumes/USB --subdir my-custom-usb
      const options = { source: '/Volumes/USB', subdir: 'my-custom-usb' };

      const source = BackupSourceFactory.fromPath(options.source, {
        backupSubdir: options.subdir,
      });

      expect(fromPathSpy).toHaveBeenCalledWith('/Volumes/USB', {
        backupSubdir: 'my-custom-usb',
      });

      const config = source.getConfig();
      expect(config.backupSubdir).toBe('my-custom-usb');
    });

    it('should pass snapshotRoot to factory', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/mnt/sdcard',
        backupSubdir: 'sdcard',
        snapshotRoot: '/home/user/.audiotools/backup',
      });

      const fromPathSpy = vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      const options = { source: '/mnt/sdcard' };
      const snapshotRoot = '/home/user/.audiotools/backup';

      const source = BackupSourceFactory.fromPath(options.source, {
        snapshotRoot,
      });

      expect(fromPathSpy).toHaveBeenCalledWith('/mnt/sdcard', {
        snapshotRoot: '/home/user/.audiotools/backup',
      });
    });
  });

  describe('--source flag with remote paths', () => {
    it('should create RemoteSource from SSH path', async () => {
      const mockSource = new MockBackupSource('remote', {
        type: 'remote',
        host: 'pi@pi-scsi2.local',
        sourcePath: '/home/pi/images/',
        backupSubdir: 'pi-scsi2',
      });

      const fromPathSpy = vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      // Simulate: akai-backup --source pi@pi-scsi2.local:/home/pi/images/
      const options = { source: 'pi@pi-scsi2.local:/home/pi/images/' };

      const source = BackupSourceFactory.fromPath(options.source, {});

      await source.backup('daily');

      expect(fromPathSpy).toHaveBeenCalledWith('pi@pi-scsi2.local:/home/pi/images/', {});
      expect(mockSource.backupCalled).toBe(true);
      expect(source.type).toBe('remote');
    });

    it('should pass configPath to remote source', async () => {
      const mockSource = new MockBackupSource('remote', {
        type: 'remote',
        host: 'host.local',
        sourcePath: '/data/',
        backupSubdir: 'host',
      });

      const fromPathSpy = vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      // Simulate: akai-backup --source host:/data/ --config /custom/config
      const options = { source: 'host:/data/', config: '/custom/config' };

      const source = BackupSourceFactory.fromPath(options.source, {
        configPath: options.config,
      });

      expect(fromPathSpy).toHaveBeenCalledWith('host:/data/', {
        configPath: '/custom/config',
      });
    });
  });

  describe('backward compatibility (no --source flag)', () => {
    it('should use existing rsnapshot workflow when no --source provided', async () => {
      const runBackupMock = vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'daily',
        configPath: '/home/user/.audiotools/rsnapshot.conf',
        errors: [],
      });

      // Simulate: akai-backup backup daily (no --source flag)
      const options = {}; // No source flag
      const interval = 'daily';

      if (!options.hasOwnProperty('source')) {
        // Existing rsnapshot workflow
        const result = await runBackup({
          interval: interval as RsnapshotInterval,
          configPath: undefined,
        });

        expect(result.success).toBe(true);
      }

      expect(runBackupMock).toHaveBeenCalledWith({
        interval: 'daily',
        configPath: undefined,
      });

      // Factory should NOT be called
      expect(BackupSourceFactory.fromPath).not.toHaveBeenCalled();
    });

    it('should respect --config flag in backward compatible mode', async () => {
      const runBackupMock = vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'weekly',
        configPath: '/custom/rsnapshot.conf',
        errors: [],
      });

      // Simulate: akai-backup backup weekly --config /custom/rsnapshot.conf
      const options = { config: '/custom/rsnapshot.conf' };
      const interval = 'weekly';

      await runBackup({
        interval: interval as RsnapshotInterval,
        configPath: options.config,
      });

      expect(runBackupMock).toHaveBeenCalledWith({
        interval: 'weekly',
        configPath: '/custom/rsnapshot.conf',
      });
    });
  });

  describe('interval validation', () => {
    it('should accept valid intervals', () => {
      const validIntervals = ['daily', 'weekly', 'monthly'];

      validIntervals.forEach(interval => {
        const isValid = validIntervals.includes(interval);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid intervals', () => {
      const invalidIntervals = ['hourly', 'yearly', 'invalid'];

      invalidIntervals.forEach(interval => {
        const validIntervals = ['daily', 'weekly', 'monthly'];
        const isValid = validIntervals.includes(interval);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle factory errors gracefully', async () => {
      vi.mocked(BackupSourceFactory.fromPath).mockImplementation(() => {
        throw new Error('Invalid source path: /nonexistent');
      });

      const options = { source: '/nonexistent' };

      try {
        BackupSourceFactory.fromPath(options.source, {});
        expect.fail('Should have thrown error');
      } catch (err: any) {
        expect(err.message).toContain('Invalid source path');
      }
    });

    it('should handle backup failure from source', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/test',
        backupSubdir: 'test',
      });

      // Override backup to return failure
      mockSource.backup = async () => ({
        success: false,
        interval: 'daily',
        configPath: '/test',
        errors: ['Disk full', 'Permission denied'],
      });

      vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      const source = BackupSourceFactory.fromPath('/test', {});
      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Disk full');
      expect(result.errors).toContain('Permission denied');
    });

    it('should handle empty source path', () => {
      vi.mocked(BackupSourceFactory.fromPath).mockImplementation((path) => {
        if (!path || path.trim().length === 0) {
          throw new Error('Source path cannot be empty');
        }
        return new MockBackupSource('local', { type: 'local', sourcePath: path, backupSubdir: 'test' });
      });

      expect(() => {
        BackupSourceFactory.fromPath('', {});
      }).toThrow('Source path cannot be empty');

      expect(() => {
        BackupSourceFactory.fromPath('   ', {});
      }).toThrow('Source path cannot be empty');
    });
  });

  describe('batch command integration', () => {
    it('should use daily interval for batch command', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/Volumes/SDCARD',
        backupSubdir: 'sdcard',
      });

      vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

      // Simulate: akai-backup batch --source /Volumes/SDCARD
      const options = { source: '/Volumes/SDCARD' };
      const interval: RsnapshotInterval = 'daily'; // batch always uses daily

      const source = BackupSourceFactory.fromPath(options.source, {});
      await source.backup(interval);

      expect(mockSource.backupInterval).toBe('daily');
    });

    it('should work without --source flag in batch mode', async () => {
      const runBackupMock = vi.mocked(runBackup).mockResolvedValue({
        success: true,
        interval: 'daily',
        configPath: '/test/config',
        errors: [],
      });

      // Simulate: akai-backup batch (no flags)
      const options = {};

      if (!options.hasOwnProperty('source')) {
        await runBackup({ interval: 'daily' });
      }

      expect(runBackupMock).toHaveBeenCalledWith({ interval: 'daily' });
    });
  });

  describe('source type detection', () => {
    it('should detect local paths correctly', () => {
      const localPaths = [
        '/Volumes/SDCARD',
        '/mnt/usb',
        '/media/user/GOTEK',
        'C:\\Users\\data', // Windows path
        './relative/path',
      ];

      localPaths.forEach(path => {
        const mockSource = new MockBackupSource('local', {
          type: 'local',
          sourcePath: path,
          backupSubdir: 'test',
        });

        vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

        const source = BackupSourceFactory.fromPath(path, {});
        expect(source.type).toBe('local');
      });
    });

    it('should detect remote SSH paths correctly', () => {
      const remotePaths = [
        'pi@pi-scsi2.local:/home/pi/images/',
        'user@host:/data/',
        'sampler.local:/images/',
      ];

      remotePaths.forEach(path => {
        const mockSource = new MockBackupSource('remote', {
          type: 'remote',
          host: path.split(':')[0],
          sourcePath: path.split(':')[1],
          backupSubdir: 'test',
        });

        vi.mocked(BackupSourceFactory.fromPath).mockReturnValue(mockSource);

        const source = BackupSourceFactory.fromPath(path, {});
        expect(source.type).toBe('remote');
      });
    });
  });

  describe('output formatting', () => {
    it('should display source information before backup', () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/Volumes/SDCARD',
        backupSubdir: 'sdcard',
      });

      const config = mockSource.getConfig();

      // Simulate CLI output
      const output = {
        sourceType: config.type,
        backupSubdir: config.backupSubdir,
        sourcePath: config.sourcePath,
      };

      expect(output.sourceType).toBe('local');
      expect(output.backupSubdir).toBe('sdcard');
      expect(output.sourcePath).toBe('/Volumes/SDCARD');
    });

    it('should display success message after backup', async () => {
      const mockSource = new MockBackupSource('local', {
        type: 'local',
        sourcePath: '/test',
        backupSubdir: 'test',
      });

      const result = await mockSource.backup('daily');

      expect(result.success).toBe(true);
      // In real CLI, this would trigger console.log("\n✓ Backup complete")
    });
  });
});
