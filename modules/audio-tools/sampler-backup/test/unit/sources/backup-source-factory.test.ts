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
        device: 'scsi0',
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
        sampler: 's5k-studio',
        device: 'floppy',
        backupSubdir: 'floppy',
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
        sampler: 's5k-studio',
        device: 'floppy',
        backupSubdir: 'floppy',
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
        const source = BackupSourceFactory.fromPath(
          'pi@pi-scsi2.local:/home/pi/images/',
          { device: 'scsi0' }
        );

        expect(source).toBeInstanceOf(RemoteSource);
        expect(source.type).toBe('remote');

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('pi@pi-scsi2.local');
        expect(config.sourcePath).toBe('/home/pi/images/');
        expect(config.device).toBe('scsi0');
      });

      it('should detect remote path with host:path format', () => {
        const source = BackupSourceFactory.fromPath(
          'sampler.local:/data/images/',
          { device: 'scsi1' }
        );

        expect(source).toBeInstanceOf(RemoteSource);
        expect(source.type).toBe('remote');

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('sampler.local');
        expect(config.sourcePath).toBe('/data/images/');
        expect(config.device).toBe('scsi1');
      });

      it('should use custom backupSubdir as device fallback', () => {
        const source = BackupSourceFactory.fromPath(
          'host:/path/',
          { backupSubdir: 'custom-name' }
        );

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.device).toBe('custom-name');
        expect(config.backupSubdir).toBe('custom-name');
      });

      it('should pass configPath option to RemoteSource', () => {
        const source = BackupSourceFactory.fromPath(
          'host:/path/',
          { device: 'scsi0', configPath: '/custom/rsnapshot.conf' }
        );

        expect(source).toBeInstanceOf(RemoteSource);
      });

      it('should pass optional sampler override to RemoteSource', () => {
        const source = BackupSourceFactory.fromPath(
          'pi@host:/path/',
          { device: 'scsi0', sampler: 'custom-sampler' }
        );

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.sampler).toBe('custom-sampler');
      });
    });

    describe('local path detection', () => {
      it('should detect local absolute path', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { sampler: 's5k-studio', device: 'floppy' }
        );

        expect(source).toBeInstanceOf(LocalSource);
        expect(source.type).toBe('local');

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('/Volumes/SDCARD');
        expect(config.sampler).toBe('s5k-studio');
        expect(config.device).toBe('floppy');
      });

      it('should detect local relative path', () => {
        const source = BackupSourceFactory.fromPath(
          'local-media',
          { sampler: 's3k-zulu', device: 'floppy' }
        );

        expect(source).toBeInstanceOf(LocalSource);

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('local-media');
        expect(config.sampler).toBe('s3k-zulu');
        expect(config.device).toBe('floppy');
      });

      it('should use custom backupSubdir as device fallback', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { sampler: 's5k-studio', backupSubdir: 'custom-backup' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.device).toBe('custom-backup');
        expect(config.backupSubdir).toBe('custom-backup');
      });

      it('should handle paths with spaces', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/My Disk',
          { sampler: 's5k-studio', device: 'floppy' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('/Volumes/My Disk');
      });

      it('should use custom backupSubdir if provided', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { sampler: 's5k-studio', backupSubdir: 'my-custom-dir' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.device).toBe('my-custom-dir');
      });

      it('should pass snapshotRoot option to LocalSource', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD',
          { sampler: 's5k-studio', device: 'floppy', snapshotRoot: '/custom/backup' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.snapshotRoot).toBe('/custom/backup');
      });
    });

    describe('Windows path handling', () => {
      it('should not treat Windows paths as remote', () => {
        const source = BackupSourceFactory.fromPath(
          'C:\\Users\\Documents',
          { sampler: 's5k-studio', device: 'floppy' }
        );

        expect(source).toBeInstanceOf(LocalSource);
        expect(source.type).toBe('local');
      });

      it('should handle Windows UNC paths', () => {
        const source = BackupSourceFactory.fromPath(
          'D:\\backup\\files',
          { sampler: 's3k-zulu', device: 'floppy' }
        );

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
          BackupSourceFactory.fromPath('host:', { device: 'scsi0' });
        }).toThrow('Invalid remote path format');
      });

      it('should throw on invalid remote path format (missing host)', () => {
        expect(() => {
          BackupSourceFactory.fromPath(':/path', { device: 'scsi0' });
        }).toThrow('Invalid remote path format');
      });

      it('should throw when remote source missing device', () => {
        expect(() => {
          BackupSourceFactory.fromPath('host:/path/');
        }).toThrow('Device name is required (use --device flag)');
      });

      it('should throw when local source missing sampler', () => {
        expect(() => {
          BackupSourceFactory.fromPath('/Volumes/SDCARD', { device: 'floppy' });
        }).toThrow('Sampler name is required for local sources (use --sampler flag)');
      });

      it('should throw when local source missing device', () => {
        expect(() => {
          BackupSourceFactory.fromPath('/Volumes/SDCARD', { sampler: 's5k-studio' });
        }).toThrow('Device name is required (use --device flag)');
      });
    });

    describe('edge cases', () => {
      it('should handle paths ending with slash', () => {
        const source = BackupSourceFactory.fromPath(
          '/Volumes/SDCARD/',
          { sampler: 's5k-studio', device: 'floppy' }
        );

        const config = source.getConfig() as LocalSourceConfig;
        expect(config.sourcePath).toBe('/Volumes/SDCARD/');
        expect(config.device).toBe('floppy');
      });

      it('should handle complex hostnames', () => {
        const source = BackupSourceFactory.fromPath(
          'user@sub.domain.example.com:/path/',
          { device: 'scsi0' }
        );

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('user@sub.domain.example.com');
        expect(config.device).toBe('scsi0');
      });

      it('should handle IP addresses in remote paths', () => {
        const source = BackupSourceFactory.fromPath(
          '192.168.1.100:/data/',
          { device: 'scsi1' }
        );

        const config = source.getConfig() as RemoteSourceConfig;
        expect(config.host).toBe('192.168.1.100');
        expect(config.sourcePath).toBe('/data/');
        expect(config.device).toBe('scsi1');
      });
    });
  });
});
