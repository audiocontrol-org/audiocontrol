import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceResolver } from '@/lib/device/device-resolver.js';
import { DeviceMatcher } from '@/lib/device/device-matcher.js';
import type { AudioToolsConfig, BackupSource } from '@audiocontrol/audiotools-config';
import type { DeviceDetectorInterface, DeviceInfo } from '@audiocontrol/lib-device-uuid';

describe('DeviceResolver', () => {
  let resolver: DeviceResolver;
  let mockDetector: DeviceDetectorInterface;
  let mockDeviceInfo: DeviceInfo;
  let config: AudioToolsConfig;

  beforeEach(() => {
    mockDeviceInfo = {
      mountPath: '/Volumes/SDCARD',
      volumeUUID: '12345678-1234-1234-1234-123456789012',
      volumeLabel: 'SDCARD',
      devicePath: '/dev/disk2s1',
      filesystem: 'FAT32'
    };

    mockDetector = {
      detectDevice: async () => mockDeviceInfo,
      isSupported: () => true,
      getPlatform: () => 'darwin'
    };

    config = {
      version: '1.0',
      extractPath: '/extract',
      backup: {
        sources: [{
          name: 's5k-card',
          type: 'local',
          source: '/Volumes/SDCARD',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true
        }]
      }
    };

    const matcher = new DeviceMatcher(mockDetector);
    resolver = new DeviceResolver(matcher);
  });

  describe('Device Resolution', () => {
    it('should register new device when no UUID exists', async () => {
      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('registered');
      expect(result.source.volumeUUID).toBe('12345678-1234-1234-1234-123456789012');
      expect(result.source.registeredAt).toBeDefined();
      expect(result.message).toContain('Registered');
    });

    it('should recognize existing device and update lastSeen', async () => {
      config.backup!.sources[0].volumeUUID = '12345678-1234-1234-1234-123456789012';
      config.backup!.sources[0].registeredAt = '2025-10-01T00:00:00.000Z';

      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('recognized');
      expect(result.source.lastSeen).toBeDefined();
      expect(result.message).toContain('Recognized');
    });

    it('should throw on source not found', async () => {
      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 'nonexistent', config)
      ).rejects.toThrow('Backup source not found: nonexistent');
    });

    it('should throw on UUID conflict', async () => {
      // Add two sources with the same UUID (conflict)
      config.backup!.sources[0].volumeUUID = '12345678-1234-1234-1234-123456789012';
      config.backup!.sources.push({
        name: 's5k-card-2',
        type: 'local',
        source: '/Volumes/SDCARD2',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012'
      });

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow('Device UUID conflict');
    });

    it('should throw when device matches different source', async () => {
      // Set first source to have different UUID
      config.backup!.sources[0].volumeUUID = 'different-uuid';
      // Add second source with matching UUID
      config.backup!.sources.push({
        name: 's5k-card-2',
        type: 'local',
        source: '/Volumes/SDCARD2',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012'
      });

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow('Device mismatch');
    });

    it('should throw when UUIDs dont match', async () => {
      config.backup!.sources[0].volumeUUID = 'expected-uuid';

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow('Device mismatch');
    });

    it('should include UUID in mismatch error message', async () => {
      config.backup!.sources[0].volumeUUID = 'expected-uuid';

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow('12345678-1234-1234-1234-123456789012');
    });

    it('should handle serial-based registration', async () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = '12345678-02';

      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('registered');
      expect(result.source.volumeSerial).toBe('12345678-02');
      expect(result.message).toContain('12345678-02');
    });

    it('should handle serial-based recognition', async () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = '12345678-02';
      config.backup!.sources[0].volumeSerial = '12345678-02';

      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('recognized');
      expect(result.source.lastSeen).toBeDefined();
    });

    it('should preserve source name in result', async () => {
      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.source.name).toBe('s5k-card');
    });

    it('should preserve other source fields', async () => {
      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.source.type).toBe('local');
      expect(result.source.device).toBe('sd-card');
      expect(result.source.sampler).toBe('s5000');
      expect(result.source.enabled).toBe(true);
    });
  });

  describe('Conflict Error Messages', () => {
    it('should list all conflicting source names', async () => {
      // Create three sources with same UUID (including the first one)
      config.backup!.sources[0].volumeUUID = '12345678-1234-1234-1234-123456789012';
      config.backup!.sources.push(
        {
          name: 's5k-card-2',
          type: 'local',
          source: '/Volumes/SDCARD2',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeUUID: '12345678-1234-1234-1234-123456789012'
        },
        {
          name: 's5k-card-3',
          type: 'local',
          source: '/Volumes/SDCARD3',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeUUID: '12345678-1234-1234-1234-123456789012'
        }
      );

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow(/s5k-card.*s5k-card-2.*s5k-card-3/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle device with no UUID or serial', async () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = undefined;

      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('registered');
      expect(result.source.volumeUUID).toBeUndefined();
      expect(result.source.volumeSerial).toBeUndefined();
    });

    it('should handle empty backupSources array', async () => {
      config.backup!.sources = [];

      await expect(
        resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config)
      ).rejects.toThrow('Backup source not found');
    });

    it('should preserve existing volumeLabel when updating', async () => {
      config.backup!.sources[0].volumeUUID = '12345678-1234-1234-1234-123456789012';
      config.backup!.sources[0].volumeLabel = 'OLD_LABEL';

      const result = await resolver.resolveDevice('/Volumes/SDCARD', 's5k-card', config);

      expect(result.action).toBe('recognized');
      expect(result.source.volumeLabel).toBe('OLD_LABEL');
    });
  });
});
