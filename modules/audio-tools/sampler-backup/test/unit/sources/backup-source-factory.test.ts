/**
 * Unit tests for BackupSourceFactory
 */

import { describe, it, expect } from 'vitest';
import { BackupSourceFactory } from '@/sources/backup-source-factory.js';
import { RemoteSource } from '@/sources/remote-source.js';
import { LocalSource } from '@/sources/local-source.js';
import type { RemoteSourceConfig, LocalSourceConfig } from '@/sources/backup-source.js';

describe('BackupSourceFactory', () => {
  describe('create()', () => {
    it('should create RemoteSource from remote config', () => {
      const config: RemoteSourceConfig = {
        type: 'remote',
        host: 'pi-scsi2.local',
        sourcePath: '/home/pi/images/',
        backupSubdir: 'pi-scsi2',
      };

      const source = BackupSourceFactory.create(config);

      expect(source).toBeInstanceOf(RemoteSource);
      expect(source.type).toBe('remote');
      expect(source.getConfig()).toEqual(config);
    });

    it('should create LocalSource from local config', () => {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: '/Volumes/SDCARD',
        backupSubdir: 'local-media',
      };

      const source = BackupSourceFactory.create(config);

      expect(source).toBeInstanceOf(LocalSource);
      expect(source.type).toBe('local');
      expect(source.getConfig()).toEqual(config);
    });

    it('should pass optional snapshotRoot to LocalSource', () => {
      const config: LocalSourceConfig = {
        type: 'local',
        sourcePath: '/Volumes/SDCARD',
        backupSubdir: 'local-media',
        snapshotRoot: '/custom/backup/path',
      };

      const source = BackupSourceFactory.create(config);

      expect(source).toBeInstanceOf(LocalSource);
      expect(source.getConfig()).toEqual(config);
    });
  });

  describe('fromPath()', () => {
    describe('remote path detection', () => {
      it('should detect remote path with user@host:path format', () => {
        const source = BackupSourceFactory.fromPath('pi@pi-scsi2.local:/home/pi/images/');

        expect(source).toBeInstanceOf(RemoteSource);
        expect(source.type).toBe('remote');

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('pi@pi-scsi2.local');
        expect(config.sourcePath).toBe('/home/pi/images/');
        expect(config.backupSubdir).toBe('pi-scsi2');
      });

      it('should detect remote path with host:path format', () => {
        const source = BackupSourceFactory.fromPath('sampler.local:/data/images/');

        expect(source).toBeInstanceOf(RemoteSource);
        expect(source.type).toBe('remote');

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('sampler.local');
        expect(config.sourcePath).toBe('/data/images/');
      });

      it('should generate backup subdir from hostname', () => {
        const source = BackupSourceFactory.fromPath('pi-scsi2.local:/images/');
        const config = source.getConfig() as RemoteSourceConfig;

        expect(config.backupSubdir).toBe('pi-scsi2');
      });

      it('should use custom backupSubdir if provided', () => {
        const source = BackupSourceFactory.fromPath(
          'host:/path/',
          { backupSubdir: 'custom-name' }
        );

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.backupSubdir).toBe('custom-name');
      });

      it('should pass configPath option to RemoteSource', () => {
        const source = BackupSourceFactory.fromPath(
          'host:/path/',
          { configPath: '/custom/rsnapshot.conf' }
        );

        expect(source).toBeInstanceOf(RemoteSource);
      });
    });

    describe('local path detection', () => {
      it('should detect local absolute path', () => {
        const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');

        expect(source).toBeInstanceOf(LocalSource);
        expect(source.type).toBe('local');

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('/Volumes/SDCARD');
        expect(config.backupSubdir).toBe('sdcard');
      });

      it('should detect local relative path', () => {
        const source = BackupSourceFactory.fromPath('local-media');

        expect(source).toBeInstanceOf(LocalSource);

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('local-media');
        expect(config.backupSubdir).toBe('local-media');
      });

      it('should generate backup subdir from path', () => {
        const testCases = [
          { path: '/Volumes/SDCARD', expected: 'sdcard' },
          { path: '/media/user/USB', expected: 'usb' },
          { path: '/mnt/external-drive', expected: 'external-drive' },
          { path: 'gotek-backups', expected: 'gotek-backups' },
        ];

        for (const { path, expected } of testCases) {
          const source = BackupSourceFactory.fromPath(path);
          const config = source.getConfig() as LocalSourceConfig;
          expect(config.backupSubdir).toBe(expected);
        }
      });

      it('should handle paths with spaces', () => {
        const source = BackupSourceFactory.fromPath('/Volumes/My SD Card');
        const config = source.getConfig() as LocalSourceConfig;

        expect(config.backupSubdir).toBe('my-sd-card');
      });

      it('should use custom backupSubdir if provided', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { backupSubdir: 'custom-backup' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.backupSubdir).toBe('custom-backup');
      });

      it('should pass snapshotRoot option to LocalSource', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { snapshotRoot: '/custom/backup' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.snapshotRoot).toBe('/custom/backup');
      });
    });

    describe('Windows path handling', () => {
      it('should not treat Windows paths as remote', () => {
        const source = BackupSourceFactory.fromPath('C:\\Users\\Documents');

        expect(source).toBeInstanceOf(LocalSource);
        expect(source.type).toBe('local');
      });

      it('should handle Windows UNC paths', () => {
        const source = BackupSourceFactory.fromPath('D:\\backup\\files');

        expect(source).toBeInstanceOf(LocalSource);
      });
    });

    describe('error handling', () => {
      it('should throw on empty path', () => {
        expect(() => {
          BackupSourceFactory.fromPath('');
        }).toThrow('Source path cannot be empty');
      });

      it('should throw on whitespace-only path', () => {
        expect(() => {
          BackupSourceFactory.fromPath('   ');
        }).toThrow('Source path cannot be empty');
      });

      it('should throw on invalid remote path format (missing path)', () => {
        expect(() => {
          BackupSourceFactory.fromPath('host:');
        }).toThrow('Invalid remote path format');
      });

      it('should throw on invalid remote path format (missing host)', () => {
        expect(() => {
          BackupSourceFactory.fromPath(':/path');
        }).toThrow('Invalid remote path format');
      });
    });

    describe('edge cases', () => {
      it('should handle paths ending with slash', () => {
        const source = BackupSourceFactory.fromPath('/Volumes/SDCARD/');
        const config = source.getConfig() as LocalSourceConfig;

        expect(config.sourcePath).toBe('/Volumes/SDCARD/');
        expect(config.backupSubdir).toBe('sdcard');
      });

      it('should handle complex hostnames', () => {
        const source = BackupSourceFactory.fromPath('user@sub.domain.example.com:/path/');
        const config = source.getConfig() as RemoteSourceConfig;

        expect(config.host).toBe('user@sub.domain.example.com');
        expect(config.backupSubdir).toBe('sub-domain-example-com');
      });

      it('should handle IP addresses in remote paths', () => {
        const source = BackupSourceFactory.fromPath('192.168.1.100:/data/');
        const config = source.getConfig() as RemoteSourceConfig;

        expect(config.host).toBe('192.168.1.100');
        expect(config.sourcePath).toBe('/data/');
      });
    });
  });
});
