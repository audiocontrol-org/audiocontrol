/**
 * Unit tests for RemoteSource (rsync implementation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RemoteSource } from '@/lib/sources/remote-source.js';
import type { RemoteSourceConfig } from '@/lib/sources/backup-source.js';
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

describe('RemoteSource', () => {
  const baseConfig: RemoteSourceConfig = {
    type: 'remote',
    host: 'pi-scsi2.local',
    sourcePath: '/home/pi/images/',
    device: 'scsi0',
  };

  let mockRsyncAdapter: MockRsyncAdapter;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRsyncAdapter = new MockRsyncAdapter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create RemoteSource with config and rsync adapter', () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      expect(source.type).toBe('remote');
      expect(source.getConfig()).toEqual(baseConfig);
    });

    it('should throw error if device is missing', () => {
      const invalidConfig = {
        ...baseConfig,
        device: '',
      };

      expect(() => new RemoteSource(invalidConfig, mockRsyncAdapter)).toThrow(
        'Device name is required'
      );
    });

    it('should use hostname as sampler name by default', () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      // Expect backup path to use sanitized hostname
      const expectedPath = join(homedir(), '.audiotools', 'backup', 'pi-scsi2', 'scsi0');
      expect(source.getBackupPath()).toBe(expectedPath);
    });

    it('should use explicit sampler name when provided', () => {
      const configWithSampler: RemoteSourceConfig = {
        ...baseConfig,
        sampler: 's5k-studio',
      };

      const source = new RemoteSource(configWithSampler, mockRsyncAdapter);

      // Expect backup path to use explicit sampler name
      const expectedPath = join(homedir(), '.audiotools', 'backup', 's5k-studio', 'scsi0');
      expect(source.getBackupPath()).toBe(expectedPath);
    });

    it('should create hierarchical backup path with sampler/device', () => {
      const configWithDevice: RemoteSourceConfig = {
        ...baseConfig,
        device: 'scsi1',
      };

      const source = new RemoteSource(configWithDevice, mockRsyncAdapter);

      const expectedPath = join(homedir(), '.audiotools', 'backup', 'pi-scsi2', 'scsi1');
      expect(source.getBackupPath()).toBe(expectedPath);
    });

    it('should sanitize hostname for backup path', () => {
      const configWithComplexHost: RemoteSourceConfig = {
        ...baseConfig,
        host: 'My-S5000.local',
      };

      const source = new RemoteSource(configWithComplexHost, mockRsyncAdapter);

      // Expect sanitized hostname (lowercase, .local removed)
      const expectedPath = join(homedir(), '.audiotools', 'backup', 'my-s5000', 'scsi0');
      expect(source.getBackupPath()).toBe(expectedPath);
    });
  });

  describe('getConfig()', () => {
    it('should return the source configuration', () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      expect(source.getConfig()).toEqual(baseConfig);
    });
  });

  describe('getBackupPath()', () => {
    it('should return the resolved backup path', () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);
      const expectedPath = join(homedir(), '.audiotools', 'backup', 'pi-scsi2', 'scsi0');

      expect(source.getBackupPath()).toBe(expectedPath);
    });
  });

  describe('backup()', () => {
    it('should call rsync with correct paths', async () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      const result = await source.backup('daily');

      expect(mockRsyncAdapter.syncCalled).toBe(true);
      expect(mockRsyncAdapter.lastSyncConfig).toEqual({
        sourcePath: 'pi-scsi2.local:/home/pi/images/',
        destPath: join(homedir(), '.audiotools', 'backup', 'pi-scsi2', 'scsi0'),
      });
      expect(result.success).toBe(true);
      expect(result.interval).toBe('daily');
    });

    it('should support weekly interval', async () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      const result = await source.backup('weekly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('weekly');
    });

    it('should support monthly interval', async () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      const result = await source.backup('monthly');

      expect(result.success).toBe(true);
      expect(result.interval).toBe('monthly');
    });

    it('should handle rsync errors', async () => {
      const errorAdapter = new MockRsyncAdapter();
      errorAdapter.sync = async () => {
        throw new Error('rsync failed');
      };

      const source = new RemoteSource(baseConfig, errorAdapter);
      const result = await source.backup('daily');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('rsync failed');
    });

    it('should include backup path in successful result', async () => {
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);

      const result = await source.backup('daily');
      const expectedPath = join(homedir(), '.audiotools', 'backup', 'pi-scsi2', 'scsi0');

      expect(result.success).toBe(true);
      expect(result.snapshotPath).toBe(expectedPath);
    });
  });

  describe('test()', () => {
    // Note: test() method requires actual SSH connectivity
    // These are integration tests that should be run in an E2E environment
    it.skip('should test SSH connection - requires SSH setup', async () => {
      // Skip in unit tests - requires real SSH connection
      const source = new RemoteSource(baseConfig, mockRsyncAdapter);
      const result = await source.test();
      expect(result).toBeDefined();
    });
  });

  describe('backward compatibility', () => {
    it('should accept deprecated backupSubdir field', () => {
      const legacyConfig: RemoteSourceConfig = {
        ...baseConfig,
        backupSubdir: 'pi-scsi2',
      };

      const source = new RemoteSource(legacyConfig, mockRsyncAdapter);
      expect(source.getConfig()).toEqual(legacyConfig);
    });
  });
});
