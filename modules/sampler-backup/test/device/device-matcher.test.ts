import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceMatcher } from '@/lib/device/device-matcher.js';
import type { DeviceDetectorInterface, DeviceInfo } from '@audiocontrol/lib-device-uuid';
import type { BackupSource } from '@audiocontrol/audiotools-config';

describe('DeviceMatcher', () => {
  let matcher: DeviceMatcher;
  let mockDetector: DeviceDetectorInterface;
  let mockDeviceInfo: DeviceInfo;

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

    matcher = new DeviceMatcher(mockDetector);
  });

  describe('Device Matching', () => {
    it('should match device by UUID', async () => {
      const sources: BackupSource[] = [{
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012'
      }];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(true);
      expect(result.source?.name).toBe('s5k-card');
      expect(result.reason).toBe('uuid');
    });

    it('should match device by serial when no UUID', async () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = '12345678-02';

      const sources: BackupSource[] = [{
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeSerial: '12345678-02'
      }];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(true);
      expect(result.source?.name).toBe('s5k-card');
      expect(result.reason).toBe('serial');
    });

    it('should return not-found when no match', async () => {
      const sources: BackupSource[] = [{
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: 'different-uuid'
      }];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(false);
      expect(result.reason).toBe('not-found');
    });

    it('should detect UUID conflicts', async () => {
      const sources: BackupSource[] = [
        {
          name: 's5k-card-1',
          type: 'local',
          source: '/Volumes/SDCARD',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeUUID: '12345678-1234-1234-1234-123456789012'
        },
        {
          name: 's5k-card-2',
          type: 'local',
          source: '/Volumes/SDCARD2',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeUUID: '12345678-1234-1234-1234-123456789012'
        }
      ];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(false);
      expect(result.reason).toBe('conflict');
      expect(result.conflictingSources).toHaveLength(2);
    });

    it('should not match serial when source has UUID', async () => {
      mockDeviceInfo.volumeSerial = '12345678-02';

      const sources: BackupSource[] = [{
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: 'some-uuid',
        volumeSerial: '12345678-02'
      }];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(false);
      expect(result.reason).toBe('not-found');
    });

    it('should detect serial conflicts', async () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = '12345678-02';

      const sources: BackupSource[] = [
        {
          name: 's5k-card-1',
          type: 'local',
          source: '/Volumes/SDCARD',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeSerial: '12345678-02'
        },
        {
          name: 's5k-card-2',
          type: 'local',
          source: '/Volumes/SDCARD2',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeSerial: '12345678-02'
        }
      ];

      const result = await matcher.matchDevice('/Volumes/SDCARD', sources);

      expect(result.matched).toBe(false);
      expect(result.reason).toBe('conflict');
      expect(result.conflictingSources).toHaveLength(2);
    });
  });

  describe('Device Registration', () => {
    it('should populate UUID fields when registering', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true
      };

      const registered = matcher.registerDevice(source, mockDeviceInfo);

      expect(registered.volumeUUID).toBe('12345678-1234-1234-1234-123456789012');
      expect(registered.volumeLabel).toBe('SDCARD');
      expect(registered.lastSeen).toBeDefined();
      expect(registered.registeredAt).toBeDefined();
    });

    it('should preserve existing registeredAt', () => {
      const originalTimestamp = '2025-10-01T00:00:00.000Z';
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        registeredAt: originalTimestamp
      };

      const registered = matcher.registerDevice(source, mockDeviceInfo);

      expect(registered.registeredAt).toBe(originalTimestamp);
    });

    it('should handle device with serial but no UUID', () => {
      mockDeviceInfo.volumeUUID = undefined;
      mockDeviceInfo.volumeSerial = '12345678-02';

      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true
      };

      const registered = matcher.registerDevice(source, mockDeviceInfo);

      expect(registered.volumeUUID).toBeUndefined();
      expect(registered.volumeSerial).toBe('12345678-02');
      expect(registered.lastSeen).toBeDefined();
    });
  });

  describe('Update Last Seen', () => {
    it('should update lastSeen timestamp', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012',
        lastSeen: '2025-10-01T00:00:00.000Z'
      };

      const updated = matcher.updateLastSeen(source);

      expect(updated.lastSeen).not.toBe('2025-10-01T00:00:00.000Z');
      expect(new Date(updated.lastSeen!).getTime()).toBeGreaterThan(
        new Date('2025-10-01T00:00:00.000Z').getTime()
      );
    });

    it('should not modify other fields', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012',
        registeredAt: '2025-10-01T00:00:00.000Z',
        lastSeen: '2025-10-01T00:00:00.000Z'
      };

      const updated = matcher.updateLastSeen(source);

      expect(updated.name).toBe('s5k-card');
      expect(updated.volumeUUID).toBe('12345678-1234-1234-1234-123456789012');
      expect(updated.registeredAt).toBe('2025-10-01T00:00:00.000Z');
    });
  });

  describe('Device Info Check', () => {
    it('should detect UUID presence', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012'
      };

      expect(matcher.hasDeviceInfo(source)).toBe(true);
    });

    it('should detect serial presence', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeSerial: '12345678-02'
      };

      expect(matcher.hasDeviceInfo(source)).toBe(true);
    });

    it('should return false when no device info', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true
      };

      expect(matcher.hasDeviceInfo(source)).toBe(false);
    });

    it('should detect UUID when both UUID and serial present', () => {
      const source: BackupSource = {
        name: 's5k-card',
        type: 'local',
        source: '/Volumes/SDCARD',
        device: 'sd-card',
        sampler: 's5000',
        enabled: true,
        volumeUUID: '12345678-1234-1234-1234-123456789012',
        volumeSerial: '12345678-02'
      };

      expect(matcher.hasDeviceInfo(source)).toBe(true);
    });
  });
});
