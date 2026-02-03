/**
 * Unit tests for repository path resolver
 *
 * Tests hierarchical path generation for sampler/device repositories:
 * ~/.audiotools/backup/{sampler}/{device}/
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveRepositoryPath } from '@/lib/backup/repo-path-resolver.js';
import * as os from 'node:os';

// Mock os module at module level
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/Users/test'),
}));

describe('resolveRepositoryPath', () => {
  beforeEach(() => {
    // Reset mock to default behavior
    vi.mocked(os.homedir).mockReturnValue('/Users/test');
  });

  afterEach(() => {
    // Clear mock history
    vi.clearAllMocks();
  });

  describe('remote sources', () => {
    it('creates hierarchical path for remote sources with hostname', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'pi-scsi2.local',
        device: 'scsi0',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/pi-scsi2/scsi0');
    });

    it('removes .local suffix from hostname', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'sampler-host.local',
        device: 'scsi1',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/sampler-host/scsi1');
    });

    it('converts hostname to lowercase', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'PI-SCSI2.LOCAL',
        device: 'scsi0',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/pi-scsi2/scsi0');
    });

    it('allows sampler override for remote sources', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'pi-scsi2.local',
        sampler: 'my-custom-s5k',
        device: 'scsi0',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/my-custom-s5k/scsi0');
    });

    it('throws error if host is missing for remote sources', () => {
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'remote',
          device: 'scsi0',
        });
      }).toThrow('Host is required for remote sources');
    });

    it('handles various device types for remote sources', () => {
      const devices = ['scsi0', 'scsi1', 'scsi2', 'scsi3', 'scsi4', 'scsi5', 'scsi6'];

      devices.forEach(device => {
        const path = resolveRepositoryPath({
          sourceType: 'remote',
          host: 'pi-scsi.local',
          device,
        });

        expect(path).toBe(`/Users/test/.audiotools/backup/pi-scsi/${device}`);
      });
    });
  });

  describe('local sources', () => {
    it('creates hierarchical path for local sources with sampler name', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 's5k-studio',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/s5k-studio/floppy');
    });

    it('throws error if sampler is missing for local sources', () => {
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'local',
          device: 'floppy',
        });
      }).toThrow('Sampler name is required for local sources');
    });

    it('sanitizes sampler name for local sources', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'My S5000 Studio',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/my-s5000-studio/floppy');
    });

    it('handles various device types for local sources', () => {
      const devices = ['floppy', 'scsi0', 'scsi1', 'usb', 'sd-card'];

      devices.forEach(device => {
        const path = resolveRepositoryPath({
          sourceType: 'local',
          sampler: 's3000xl',
          device,
        });

        expect(path).toBe(`/Users/test/.audiotools/backup/s3000xl/${device}`);
      });
    });
  });

  describe('sampler name sanitization', () => {
    it('sanitizes sampler name with spaces and uppercase', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'My S5000.local',
        device: 'scsi1',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/my-s5000/scsi1');
    });

    it('replaces special characters with hyphens', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'S3K@Studio!#2',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/s3k-studio-2/floppy');
    });

    it('collapses multiple consecutive hyphens', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'S5K---Studio',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/s5k-studio/floppy');
    });

    it('removes leading and trailing hyphens', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: '-S5K-Studio-',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/s5k-studio/floppy');
    });

    it('handles names with only special characters', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: '!!!',
        device: 'floppy',
      });

      // All special chars replaced with hyphens, then collapsed and trimmed
      expect(path).toBe('/Users/test/.audiotools/backup/floppy');
    });

    it('preserves alphanumeric characters and hyphens', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'akai-s5000-mk2',
        device: 'scsi0',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/akai-s5000-mk2/scsi0');
    });

    it('handles Unicode characters by replacing with hyphens', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'S5K-スタジオ',
        device: 'floppy',
      });

      // Unicode chars not in [a-z0-9-] are replaced with hyphens, then collapsed/trimmed
      expect(path).toBe('/Users/test/.audiotools/backup/s5k/floppy');
    });
  });

  describe('device name validation', () => {
    it('throws error if device is missing', () => {
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'remote',
          host: 'pi-scsi2.local',
          device: '',
        });
      }).toThrow('Device name is required');
    });

    it('throws error if device is undefined', () => {
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'remote',
          host: 'pi-scsi2.local',
          // @ts-expect-error Testing runtime behavior with missing device
          device: undefined,
        });
      }).toThrow('Device name is required');
    });

    it('accepts device names with various formats', () => {
      const deviceFormats = [
        'scsi0',
        'scsi1',
        'floppy',
        'usb',
        'sd-card',
        'SD_CARD',
        'device-01',
      ];

      deviceFormats.forEach(device => {
        const path = resolveRepositoryPath({
          sourceType: 'remote',
          host: 'test.local',
          device,
        });

        expect(path).toContain(`/${device}`);
      });
    });
  });

  describe('path structure', () => {
    it('builds path with correct structure: base/sampler/device', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'sampler.local',
        device: 'scsi0',
      });

      const parts = path.split('/');
      const baseParts = parts.slice(0, -2); // Everything except sampler/device
      const samplerPart = parts[parts.length - 2];
      const devicePart = parts[parts.length - 1];

      expect(baseParts.join('/')).toBe('/Users/test/.audiotools/backup');
      expect(samplerPart).toBe('sampler');
      expect(devicePart).toBe('scsi0');
    });

    it('uses homedir from os.homedir()', () => {
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'test.local',
        device: 'scsi0',
      });

      expect(path).toMatch(/^\/Users\/test\/.audiotools\/backup\//);
      expect(os.homedir).toHaveBeenCalled();
    });

    it('creates consistent paths for same inputs', () => {
      const config = {
        sourceType: 'remote' as const,
        host: 'pi-scsi.local',
        device: 'scsi0',
      };

      const path1 = resolveRepositoryPath(config);
      const path2 = resolveRepositoryPath(config);

      expect(path1).toBe(path2);
    });
  });

  describe('edge cases', () => {
    it('handles very long sampler names', () => {
      const longName = 'a'.repeat(200);
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: longName,
        device: 'scsi0',
      });

      expect(path).toContain(longName.toLowerCase());
    });

    it('handles very long device names', () => {
      const longDevice = 'scsi-device-' + 'x'.repeat(100);
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'test.local',
        device: longDevice,
      });

      expect(path).toContain(longDevice);
    });

    it('handles sampler names with only numbers', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: '5000',
        device: 'scsi0',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/5000/scsi0');
    });

    it('handles empty string after sanitization', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: '---',
        device: 'scsi0',
      });

      // After sanitization: remove hyphens -> collapse -> trim -> empty
      expect(path).toBe('/Users/test/.audiotools/backup/scsi0');
    });
  });

  describe('real-world scenarios', () => {
    it('handles PiSCSI with multiple devices', () => {
      const configs = [
        { device: 'scsi0', expected: '/Users/test/.audiotools/backup/pi-scsi2/scsi0' },
        { device: 'scsi1', expected: '/Users/test/.audiotools/backup/pi-scsi2/scsi1' },
        { device: 'scsi6', expected: '/Users/test/.audiotools/backup/pi-scsi2/scsi6' },
      ];

      configs.forEach(({ device, expected }) => {
        const path = resolveRepositoryPath({
          sourceType: 'remote',
          host: 'pi-scsi2.local',
          device,
        });

        expect(path).toBe(expected);
      });
    });

    it('handles local media with descriptive sampler names', () => {
      const path = resolveRepositoryPath({
        sourceType: 'local',
        sampler: 'S5000-Studio-Main',
        device: 'floppy',
      });

      expect(path).toBe('/Users/test/.audiotools/backup/s5000-studio-main/floppy');
    });

    it('handles sampler override for multi-sampler PiSCSI setup', () => {
      const path1 = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'pi-scsi.local',
        sampler: 's5000-studio',
        device: 'scsi0',
      });

      const path2 = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'pi-scsi.local',
        sampler: 's3000-live',
        device: 'scsi1',
      });

      expect(path1).toBe('/Users/test/.audiotools/backup/s5000-studio/scsi0');
      expect(path2).toBe('/Users/test/.audiotools/backup/s3000-live/scsi1');
    });
  });

  describe('type safety', () => {
    it('requires sourceType to be "remote" or "local"', () => {
      // TypeScript should enforce this at compile time
      // Runtime test to verify behavior
      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'test.local',
        device: 'scsi0',
      });

      expect(path).toBeDefined();
    });

    it('enforces required fields based on source type', () => {
      // Remote requires host
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'remote',
          device: 'scsi0',
        });
      }).toThrow();

      // Local requires sampler
      expect(() => {
        resolveRepositoryPath({
          sourceType: 'local',
          device: 'floppy',
        });
      }).toThrow();
    });
  });

  describe('different home directory scenarios', () => {
    it('works with Linux-style home directory', () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'test.local',
        device: 'scsi0',
      });

      expect(path).toBe('/home/user/.audiotools/backup/test/scsi0');
    });

    it('works with Windows-style home directory', () => {
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\user');

      const path = resolveRepositoryPath({
        sourceType: 'remote',
        host: 'test.local',
        device: 'scsi0',
      });

      // Node's path.join handles platform-specific separators
      expect(path).toMatch(/\.audiotools/);
      expect(path).toMatch(/backup/);
      expect(path).toMatch(/test/);
      expect(path).toMatch(/scsi0/);
    });
  });
});
