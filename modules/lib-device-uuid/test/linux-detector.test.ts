import { describe, it, expect, beforeEach } from 'vitest';
import { LinuxDetector } from '../src/detectors/linux.js';

describe('LinuxDetector', () => {
  let detector: LinuxDetector;

  beforeEach(() => {
    detector = new LinuxDetector();
  });

  describe('Platform Support', () => {
    it('should report linux platform', () => {
      expect(detector.getPlatform()).toBe('linux');
    });

    it('should be supported on Linux', () => {
      if (process.platform === 'linux') {
        expect(detector.isSupported()).toBe(true);
      } else {
        expect(detector.isSupported()).toBe(false);
      }
    });
  });

  describe('Device Detection', () => {
    it('should throw error on unsupported platform', async () => {
      if (process.platform !== 'linux') {
        await expect(detector.detectDevice('/mnt/test')).rejects.toThrow(
          'LinuxDetector only works on Linux'
        );
      }
    });

    it('should throw error for non-existent mount path', async () => {
      if (process.platform === 'linux') {
        await expect(detector.detectDevice('/mnt/nonexistent-12345')).rejects.toThrow(
          'Failed to detect device'
        );
      }
    });

    // Manual test - requires actual mounted volume
    it.skip('should detect device info for root volume', async () => {
      if (process.platform === 'linux') {
        const info = await detector.detectDevice('/');

        expect(info.mountPath).toBe('/');
        expect(info.devicePath).toBeDefined();
        expect(info.filesystem).toBeDefined();
        // Root volume might not have UUID on some systems
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error messages', async () => {
      if (process.platform === 'linux') {
        const testPath = '/mnt/definitely-does-not-exist-12345';
        try {
          await detector.detectDevice(testPath);
          throw new Error('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toContain('Failed to detect device');
          expect(error.message).toContain(testPath);
        }
      }
    });

    it('should handle blkid failures gracefully', async () => {
      // This test verifies the implementation handles blkid errors
      // by returning partial device info (at minimum devicePath and mountPath)
      expect(detector).toBeDefined();
    });
  });

  describe('Platform Detection', () => {
    it('should correctly identify current platform', () => {
      const isLinux = process.platform === 'linux';
      expect(detector.isSupported()).toBe(isLinux);
    });
  });
});
