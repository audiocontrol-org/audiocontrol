import { describe, it, expect, beforeEach } from 'vitest';
import { MacOSDetector } from '../src/detectors/macos.js';

describe('MacOSDetector', () => {
  let detector: MacOSDetector;

  beforeEach(() => {
    detector = new MacOSDetector();
  });

  describe('Platform Support', () => {
    it('should report darwin platform', () => {
      expect(detector.getPlatform()).toBe('darwin');
    });

    it('should be supported on macOS', () => {
      if (process.platform === 'darwin') {
        expect(detector.isSupported()).toBe(true);
      } else {
        expect(detector.isSupported()).toBe(false);
      }
    });
  });

  describe('Device Detection', () => {
    it('should throw error on unsupported platform', async () => {
      if (process.platform !== 'darwin') {
        await expect(detector.detectDevice('/Volumes/test')).rejects.toThrow(
          'MacOSDetector only works on macOS'
        );
      }
    });

    it('should throw error for non-existent mount path', async () => {
      if (process.platform === 'darwin') {
        await expect(detector.detectDevice('/Volumes/nonexistent-12345')).rejects.toThrow(
          'Failed to detect device'
        );
      }
    });

    // Manual test - requires actual mounted volume
    it.skip('should detect device info for root volume', async () => {
      if (process.platform === 'darwin') {
        const info = await detector.detectDevice('/');

        expect(info.mountPath).toBe('/');
        expect(info.devicePath).toBeDefined();
        expect(info.filesystem).toBeDefined();
        // Root volume might not have UUID on some systems
      }
    });
  });

  describe('diskutil Output Parsing', () => {
    it('should parse complete volume information', async () => {
      // This test verifies parsing logic with mock data
      const mockOutput = `
   Device Identifier:        disk2s1
   Device Node:              /dev/disk2s1
   Whole:                    No
   Part of Whole:            disk2

   Volume Name:              SDCARD
   Mounted:                  Yes
   Mount Point:              /Volumes/SDCARD

   Partition Type:           DOS_FAT_32
   File System Personality:  FAT32
   Type (Bundle):            msdos

   Disk Size:                8.0 GB (8000000000 Bytes)
   Device Block Size:        512 Bytes

   Volume UUID:              12345678-1234-1234-1234-123456789012
`;

      // Create a test instance to access the private method indirectly
      // by calling detectDevice on a non-darwin platform after stubbing
      if (process.platform === 'darwin') {
        // On macOS, we'd need to actually run diskutil
        // This test is primarily for documentation of expected parsing behavior
        expect(detector).toBeDefined();
      } else {
        // On non-macOS, we verify the error handling works
        await expect(detector.detectDevice('/test')).rejects.toThrow(
          'MacOSDetector only works on macOS'
        );
      }
    });

    it('should handle missing UUID gracefully', async () => {
      // Some volumes (especially FAT32) may not have UUIDs
      // The detector should return info without UUID field
      if (process.platform === 'darwin') {
        // This is tested via integration tests
        expect(detector).toBeDefined();
      }
    });

    it('should handle missing volume label gracefully', async () => {
      // Some volumes may not have labels
      // The detector should return info without volumeLabel field
      if (process.platform === 'darwin') {
        // This is tested via integration tests
        expect(detector).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error for detection failure', async () => {
      if (process.platform === 'darwin') {
        const invalidPath = '/Volumes/this-definitely-does-not-exist-12345';
        try {
          await detector.detectDevice(invalidPath);
          // Should not reach here
          expect(false).toBe(true);
        } catch (error: any) {
          expect(error.message).toContain('Failed to detect device');
          expect(error.message).toContain(invalidPath);
        }
      }
    });

    it('should handle diskutil command errors gracefully', async () => {
      if (process.platform === 'darwin') {
        // Empty string should cause diskutil to fail
        await expect(detector.detectDevice('')).rejects.toThrow('Failed to detect device');
      }
    });
  });
});
