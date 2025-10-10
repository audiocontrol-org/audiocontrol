/**
 * Tests for auto-detect backup integration service.
 *
 * Tests all inference paths, prompting combinations, and edge cases.
 * Uses dependency injection to mock all external dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { AutoDetectBackup } from './auto-detect-backup.js';
import type {
  AutoDetectOptions,
  AutoDetectResult,
} from './auto-detect-backup.js';
import type {
  DeviceDetectorInterface,
  DeviceInfo,
} from '@oletizi/lib-device-uuid';
import type { InteractivePromptInterface } from '@/lib/prompt/interactive-prompt.js';
import type { DeviceResolver } from './device-resolver.js';
import type { AudioToolsConfig, BackupSource } from '@oletizi/audiotools-config';

/**
 * Create mock device detector
 */
function createMockDetector(): DeviceDetectorInterface {
  return {
    detectDevice: vi.fn(),
    isSupported: vi.fn(() => true),
    getPlatform: vi.fn(() => 'darwin'),
  };
}

/**
 * Create mock prompt service
 */
function createMockPrompt(): InteractivePromptInterface {
  return {
    promptDeviceType: vi.fn(),
    promptSampler: vi.fn(),
    promptNewSamplerName: vi.fn(),
  };
}

/**
 * Create mock device resolver
 */
function createMockResolver(): DeviceResolver {
  return {} as DeviceResolver;
}

/**
 * Create default test config
 */
function createTestConfig(sources: BackupSource[] = []): AudioToolsConfig {
  return {
    version: '1.0',
    backup: {
      backupRoot: '~/.audiotools/backup',
      sources,
    },
    export: {
      outputRoot: '~/.audiotools/sampler-export/extracted',
      formats: ['sfz'],
      skipUnchanged: true,
      enabledSources: [],
    },
  };
}

/**
 * Create sample device info
 */
function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    mountPath: '/Volumes/SDCARD',
    volumeUUID: '12345678-1234-1234-1234-123456789012',
    volumeLabel: 'SDCARD',
    volumeSerial: '12345678-02',
    filesystem: 'vfat',
    devicePath: '/dev/disk2s1',
    ...overrides,
  };
}

describe('AutoDetectBackup', () => {
  let mockDetector: DeviceDetectorInterface;
  let mockPrompt: InteractivePromptInterface;
  let mockResolver: DeviceResolver;
  let autoDetect: AutoDetectBackup;

  beforeEach(() => {
    mockDetector = createMockDetector();
    mockPrompt = createMockPrompt();
    mockResolver = createMockResolver();
    autoDetect = new AutoDetectBackup(mockDetector, mockPrompt, mockResolver);
  });

  describe('detectAndResolve', () => {
    it('should auto-detect with all overrides (no prompts)', async () => {
      const deviceInfo = createDeviceInfo();
      const config = createTestConfig();
      const options: AutoDetectOptions = {
        deviceType: 'floppy',
        sampler: 's5000',
      };

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config, options);

      expect(result.wasPrompted).toBe(false);
      expect(result.action).toBe('registered');
      expect(result.source.name).toBe('s5000-floppy-sdcard');
      expect(result.source.type).toBe('local');
      expect(result.source.device).toBe('floppy');
      expect(result.source.sampler).toBe('s5000');
      expect(result.source.volumeUUID).toBe(deviceInfo.volumeUUID);
      expect(result.deviceInfo).toEqual(deviceInfo);

      // Should not call prompts
      expect(mockPrompt.promptDeviceType).not.toHaveBeenCalled();
      expect(mockPrompt.promptSampler).not.toHaveBeenCalled();
    });

    it('should prompt for device type when not provided or inferred', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: undefined }); // Cannot infer
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptDeviceType as Mock).mockResolvedValue('hard-drive');
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config);

      expect(result.wasPrompted).toBe(true);
      expect(mockPrompt.promptDeviceType).toHaveBeenCalledOnce();
      expect(result.source.device).toBe('hard-drive');
    });

    it('should prompt for sampler when not provided', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' }); // Can infer device type
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s3000xl');

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      expect(result.wasPrompted).toBe(true);
      expect(mockPrompt.promptNewSamplerName).toHaveBeenCalledOnce();
      expect(result.source.sampler).toBe('s3000xl');
    });

    it('should recognize existing device by UUID', async () => {
      const deviceInfo = createDeviceInfo();
      const existingSource: BackupSource = {
        name: 'existing-source',
        type: 'local',
        source: '/Volumes/OLD_PATH',
        device: 'hard-drive',
        sampler: 's5000',
        enabled: true,
        volumeUUID: deviceInfo.volumeUUID,
      };
      const config = createTestConfig([existingSource]);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(result.action).toBe('recognized');
      expect(result.source).toEqual(existingSource);
      expect(result.wasPrompted).toBe(false);
    });

    it('should recognize existing device by serial when UUID not available', async () => {
      const deviceInfo = createDeviceInfo({ volumeUUID: undefined });
      const existingSource: BackupSource = {
        name: 'existing-source',
        type: 'local',
        source: '/Volumes/OLD_PATH',
        device: 'hard-drive',
        sampler: 's5000',
        enabled: true,
        volumeSerial: deviceInfo.volumeSerial,
      };
      const config = createTestConfig([existingSource]);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(result.action).toBe('recognized');
      expect(result.source).toEqual(existingSource);
    });

    it('should create new source when device not recognized', async () => {
      const deviceInfo = createDeviceInfo();
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(result.action).toBe('registered');
      expect(result.source.name).toBe('s5000-floppy-sdcard');
      expect(result.source.volumeUUID).toBe(deviceInfo.volumeUUID);
      expect(result.source.registeredAt).toBeDefined();
      expect(result.source.lastSeen).toBeDefined();
    });

    it('should return "created" action when device has no identifiers', async () => {
      const deviceInfo = createDeviceInfo({
        volumeUUID: undefined,
        volumeSerial: undefined,
      });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(result.action).toBe('created');
      expect(result.source.volumeUUID).toBeUndefined();
      expect(result.source.volumeSerial).toBeUndefined();
    });

    it('should handle device detection failure gracefully', async () => {
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockRejectedValue(
        new Error('diskutil failed')
      );
      (mockPrompt.promptDeviceType as Mock).mockResolvedValue('hard-drive');
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config);

      expect(result.action).toBe('created');
      expect(result.deviceInfo.mountPath).toBe('/Volumes/SDCARD');
      expect(result.deviceInfo.volumeLabel).toBe('SDCARD');
      expect(result.deviceInfo.volumeUUID).toBeUndefined();
    });
  });

  describe('device type inference', () => {
    it('should infer "floppy" from FAT12 filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'fat12' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/FLOPPY', config);

      expect(result.source.device).toBe('floppy');
      expect(mockPrompt.promptDeviceType).not.toHaveBeenCalled();
    });

    it('should infer "floppy" from FAT16 filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'fat16' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/FLOPPY', config);

      expect(result.source.device).toBe('floppy');
    });

    it('should infer "hard-drive" from FAT32 filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'fat32' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should infer "hard-drive" from vfat filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should infer "cd-rom" from ISO9660 filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'iso9660' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/CDROM', config);

      expect(result.source.device).toBe('cd-rom');
    });

    it('should infer "cd-rom" from CDFS filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'cdfs' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/CDROM', config);

      expect(result.source.device).toBe('cd-rom');
    });

    it('should infer "hard-drive" from exFAT filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'exfat' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/USB', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should infer "hard-drive" from NTFS filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'ntfs' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/EXTERNAL', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should infer "hard-drive" from ext4 filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'ext4' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/mnt/usb', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should infer "hard-drive" from HFS+ filesystem', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'hfs+' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/MAC_DISK', config);

      expect(result.source.device).toBe('hard-drive');
    });

    it('should prompt when filesystem is unknown', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'unknown-fs' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptDeviceType as Mock).mockResolvedValue('other');
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve('/Volumes/UNKNOWN', config);

      expect(mockPrompt.promptDeviceType).toHaveBeenCalledOnce();
      expect(result.source.device).toBe('other');
    });
  });

  describe('sampler selection', () => {
    it('should prompt for new sampler when none exist', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const config = createTestConfig([]); // No existing sources

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      expect(mockPrompt.promptNewSamplerName).toHaveBeenCalledOnce();
      expect(mockPrompt.promptSampler).not.toHaveBeenCalled();
      expect(result.source.sampler).toBe('s5000');
    });

    it('should prompt to select from existing samplers', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const existingSources: BackupSource[] = [
        {
          name: 'src1',
          type: 'local',
          source: '/path1',
          device: 'floppy',
          sampler: 's5000',
          enabled: true,
        },
        {
          name: 'src2',
          type: 'local',
          source: '/path2',
          device: 'hard-drive',
          sampler: 's3000xl',
          enabled: true,
        },
      ];
      const config = createTestConfig(existingSources);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptSampler as Mock).mockResolvedValue({
        sampler: 's5000',
        isNew: false,
      });

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      expect(mockPrompt.promptSampler).toHaveBeenCalledWith(['s5000', 's3000xl']);
      expect(result.source.sampler).toBe('s5000');
    });

    it('should deduplicate sampler list', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const existingSources: BackupSource[] = [
        {
          name: 'src1',
          type: 'local',
          source: '/path1',
          device: 'floppy',
          sampler: 's5000',
          enabled: true,
        },
        {
          name: 'src2',
          type: 'local',
          source: '/path2',
          device: 'hard-drive',
          sampler: 's5000', // Duplicate
          enabled: true,
        },
      ];
      const config = createTestConfig(existingSources);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptSampler as Mock).mockResolvedValue({
        sampler: 's5000',
        isNew: false,
      });

      await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      expect(mockPrompt.promptSampler).toHaveBeenCalledWith(['s5000']);
    });

    it('should handle new sampler from existing list', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const existingSources: BackupSource[] = [
        {
          name: 'src1',
          type: 'local',
          source: '/path1',
          device: 'floppy',
          sampler: 's5000',
          enabled: true,
        },
      ];
      const config = createTestConfig(existingSources);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptSampler as Mock).mockResolvedValue({
        sampler: 's1000',
        isNew: true,
      });

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      expect(result.source.sampler).toBe('s1000');
    });

    it('should skip sampler prompt when provided in options', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(mockPrompt.promptSampler).not.toHaveBeenCalled();
      expect(mockPrompt.promptNewSamplerName).not.toHaveBeenCalled();
      expect(result.source.sampler).toBe('s5000');
      expect(result.wasPrompted).toBe(false);
    });
  });

  describe('source naming', () => {
    it('should generate source name from components', async () => {
      const deviceInfo = createDeviceInfo({
        volumeLabel: 'MY_SDCARD',
        filesystem: 'vfat',
      });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/MY_SDCARD',
        config,
        { deviceType: 'hard-drive', sampler: 's5000' }
      );

      expect(result.source.name).toBe('s5000-hard-drive-my_sdcard');
    });

    it('should use "device" when volume label not available', async () => {
      const deviceInfo = createDeviceInfo({
        volumeLabel: undefined,
        filesystem: 'vfat',
      });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/NONAME',
        config,
        { deviceType: 'floppy', sampler: 's3000xl' }
      );

      expect(result.source.name).toBe('s3000xl-floppy-device');
    });

    it('should normalize name to lowercase with hyphens', async () => {
      const deviceInfo = createDeviceInfo({
        volumeLabel: 'My SD Card',
        filesystem: 'vfat',
      });
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/My SD Card',
        config,
        { deviceType: 'hard-drive', sampler: 'S5000' }
      );

      expect(result.source.name).toBe('s5000-hard-drive-my-sd-card');
    });
  });

  describe('timestamps', () => {
    it('should set registeredAt and lastSeen for new source', async () => {
      const deviceInfo = createDeviceInfo();
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const beforeTime = new Date().toISOString();
      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );
      const afterTime = new Date().toISOString();

      expect(result.source.registeredAt).toBeDefined();
      expect(result.source.lastSeen).toBeDefined();
      expect(result.source.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.source.lastSeen).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Timestamp should be between before and after
      expect(result.source.registeredAt! >= beforeTime).toBe(true);
      expect(result.source.registeredAt! <= afterTime).toBe(true);
    });

    it('should preserve existing timestamps for recognized source', async () => {
      const originalTimestamp = '2025-10-01T12:00:00.000Z';
      const deviceInfo = createDeviceInfo();
      const existingSource: BackupSource = {
        name: 'existing-source',
        type: 'local',
        source: '/Volumes/OLD_PATH',
        device: 'hard-drive',
        sampler: 's5000',
        enabled: true,
        volumeUUID: deviceInfo.volumeUUID,
        registeredAt: originalTimestamp,
        lastSeen: originalTimestamp,
      };
      const config = createTestConfig([existingSource]);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy', sampler: 's5000' }
      );

      expect(result.action).toBe('recognized');
      expect(result.source.registeredAt).toBe(originalTimestamp);
      expect(result.source.lastSeen).toBe(originalTimestamp);
    });
  });

  describe('edge cases', () => {
    it('should handle sources without sampler field', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const existingSources: BackupSource[] = [
        {
          name: 'src1',
          type: 'local',
          source: '/path1',
          device: 'floppy',
          // No sampler field
          enabled: true,
        },
      ];
      const config = createTestConfig(existingSources);

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        config,
        { deviceType: 'floppy' }
      );

      // Should prompt for new sampler since no existing samplers
      expect(mockPrompt.promptNewSamplerName).toHaveBeenCalledOnce();
      expect(result.source.sampler).toBe('s5000');
    });

    it('should handle empty config', async () => {
      const deviceInfo = createDeviceInfo({ filesystem: 'vfat' });
      const emptyConfig: AudioToolsConfig = { version: '1.0' };

      (mockDetector.detectDevice as Mock).mockResolvedValue(deviceInfo);
      (mockPrompt.promptNewSamplerName as Mock).mockResolvedValue('s5000');

      const result = await autoDetect.detectAndResolve(
        '/Volumes/SDCARD',
        emptyConfig,
        { deviceType: 'floppy' }
      );

      expect(result.action).toBe('registered');
      expect(result.source.sampler).toBe('s5000');
    });

    it('should extract volume name from mount path when detection fails', async () => {
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockRejectedValue(
        new Error('Detection failed')
      );

      const result = await autoDetect.detectAndResolve(
        '/Volumes/MY_DISK',
        config,
        { deviceType: 'hard-drive', sampler: 's5000' }
      );

      expect(result.deviceInfo.volumeLabel).toBe('MY_DISK');
      expect(result.source.name).toBe('s5000-hard-drive-my_disk');
    });

    it('should handle Linux mount paths', async () => {
      const config = createTestConfig();

      (mockDetector.detectDevice as Mock).mockRejectedValue(
        new Error('Detection failed')
      );

      const result = await autoDetect.detectAndResolve(
        '/mnt/usb/sdcard',
        config,
        { deviceType: 'hard-drive', sampler: 's5000' }
      );

      expect(result.deviceInfo.volumeLabel).toBe('sdcard');
    });
  });
});
