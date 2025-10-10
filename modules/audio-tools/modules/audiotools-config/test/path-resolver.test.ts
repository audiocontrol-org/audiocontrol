/**
 * Tests for path-resolver module
 */

import { describe, it, expect } from 'vitest';
import { resolveBackupPath, DEFAULT_BACKUP_ROOT } from '@/path-resolver.js';
import type { BackupSource } from '@/types.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('path-resolver', () => {
  describe('DEFAULT_BACKUP_ROOT', () => {
    it('should point to ~/.audiotools/backup', () => {
      expect(DEFAULT_BACKUP_ROOT).toBe(join(homedir(), '.audiotools', 'backup'));
    });
  });

  describe('resolveBackupPath', () => {
    describe('local sources', () => {
      it('should resolve path for local source with explicit sampler', () => {
        const source: BackupSource = {
          name: 's3k-hard-drive',
          type: 'local',
          source: '/Volumes/S3K',
          device: 'hard-drive',
          sampler: 's3k',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k', 'hard-drive'));
      });

      it('should sanitize sampler names for local sources', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 'My S5000 XL!!!',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 'my-s5000-xl', 'floppy'));
      });

      it('should throw error if local source missing sampler', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          enabled: true,
        };

        expect(() => resolveBackupPath(source)).toThrow(
          'Sampler name is required for local sources'
        );
      });

      it('should handle uppercase device names', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'FLOPPY',
          sampler: 's5k',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's5k', 'FLOPPY'));
      });
    });

    describe('remote sources', () => {
      it('should resolve path using hostname from source path', () => {
        const source: BackupSource = {
          name: 'pi-scsi2',
          type: 'remote',
          source: 'pi-scsi2.local:~/images/',
          device: 'images',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 'pi-scsi2', 'images'));
      });

      it('should use explicit sampler if provided for remote source', () => {
        const source: BackupSource = {
          name: 'pi-scsi2',
          type: 'remote',
          source: 'pi-scsi2.local:~/images/',
          device: 'scsi0',
          sampler: 's5k-studio',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's5k-studio', 'scsi0'));
      });

      it('should sanitize hostname from source path', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'remote',
          source: 'MY-HOST.local:~/data',
          device: 'scsi0',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 'my-host', 'scsi0'));
      });

      it('should remove .local suffix from hostname', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'remote',
          source: 'raspberrypi.local:~/images/',
          device: 'scsi0',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 'raspberrypi', 'scsi0'));
      });

      it('should throw error if remote source has invalid format', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'remote',
          source: 'invalid-format-no-colon',
          device: 'scsi0',
          enabled: true,
        };

        expect(() => resolveBackupPath(source)).toThrow(
          'Invalid remote source format'
        );
      });

      it('should handle IP addresses in remote source', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'remote',
          source: '192.168.1.100:~/images/',
          device: 'scsi0',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, '192-168-1-100', 'scsi0'));
      });
    });

    describe('device name handling', () => {
      it('should throw error if device name is missing', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: '',
          sampler: 's3k',
          enabled: true,
        };

        expect(() => resolveBackupPath(source)).toThrow(
          'Device name is required'
        );
      });

      it('should preserve device name exactly as provided', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'SD-Card_01',
          sampler: 's3k',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k', 'SD-Card_01'));
      });
    });

    describe('custom backup root', () => {
      it('should use custom backup root when provided', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 's3k',
          enabled: true,
        };

        const customRoot = '/custom/backup/location';
        const path = resolveBackupPath(source, customRoot);
        expect(path).toBe(join(customRoot, 's3k', 'floppy'));
      });

      it('should handle custom root with trailing slash', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 's3k',
          enabled: true,
        };

        const customRoot = '/custom/backup/location/';
        const path = resolveBackupPath(source, customRoot);
        // join() normalizes paths, so trailing slash doesn't matter
        expect(path).toBe(join(customRoot, 's3k', 'floppy'));
      });
    });

    describe('name sanitization edge cases', () => {
      it('should collapse multiple hyphens', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 'S3K---ZULU',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k-zulu', 'floppy'));
      });

      it('should remove leading and trailing hyphens', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: '-s3k-',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k', 'floppy'));
      });

      it('should handle names with special characters', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 'S3K @ Studio #1!',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k-studio-1', 'floppy'));
      });

      it('should handle names with unicode characters', () => {
        const source: BackupSource = {
          name: 'test',
          type: 'local',
          source: '/Volumes/TEST',
          device: 'floppy',
          sampler: 'Sämpler-3000',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's-mpler-3000', 'floppy'));
      });
    });

    describe('real-world examples', () => {
      it('should handle S3K hard drive backup', () => {
        const source: BackupSource = {
          name: 's3k-hard-drive-s3k',
          type: 'local',
          source: '/Volumes/S3K',
          device: 'hard-drive',
          sampler: 's3k',
          enabled: true,
          volumeUUID: '49A87D5C-3E2C-3689-A3B0-528944E0BA1E',
          volumeLabel: 'S3K',
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k', 'hard-drive'));
      });

      it('should handle PiSCSI remote backup', () => {
        const source: BackupSource = {
          name: 'pi-scsi2',
          type: 'remote',
          source: 'pi-scsi2.local:/home/orion/images/',
          device: 'images',
          sampler: 's5k',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        // Should use explicit sampler 's5k' instead of hostname
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's5k', 'images'));
      });

      it('should handle SD card backup', () => {
        const source: BackupSource = {
          name: 'sd-card',
          type: 'local',
          source: '/Volumes/AKAI_SD',
          device: 'sd-card',
          sampler: 's5000',
          enabled: true,
          volumeUUID: '12345678-1234-1234-1234-123456789012',
          volumeLabel: 'AKAI_SD',
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's5000', 'sd-card'));
      });

      it('should handle floppy disk backup', () => {
        const source: BackupSource = {
          name: 'floppy-01',
          type: 'local',
          source: '/Volumes/FLOPPY',
          device: 'floppy',
          sampler: 's3k-live',
          enabled: true,
        };

        const path = resolveBackupPath(source);
        expect(path).toBe(join(DEFAULT_BACKUP_ROOT, 's3k-live', 'floppy'));
      });
    });
  });
});
