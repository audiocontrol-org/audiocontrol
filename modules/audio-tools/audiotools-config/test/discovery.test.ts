import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'pathe';
import { tmpdir } from 'os';
import {
  discoverExistingBackups,
  inferBackupType,
  importDiscoveredBackups,
} from '@/discovery.js';
import type { DiscoveredBackup, BackupSource } from '@/types.js';

describe('discovery', () => {
  let testBackupRoot: string;

  beforeEach(async () => {
    testBackupRoot = join(tmpdir(), `audiotools-discovery-test-${Date.now()}`);
    await mkdir(testBackupRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testBackupRoot, { recursive: true, force: true });
  });

  describe('inferBackupType', () => {
    it('should infer remote type for hostname patterns', () => {
      expect(inferBackupType('pi-scsi2')).toBe('remote');
      expect(inferBackupType('raspberrypi')).toBe('remote');
      expect(inferBackupType('server-name')).toBe('remote');
      expect(inferBackupType('host.local')).toBe('remote');
    });

    it('should infer local type for device patterns', () => {
      expect(inferBackupType('s5k-gotek')).toBe('local');
      expect(inferBackupType('s3k-zulu')).toBe('local');
      expect(inferBackupType('sampler-usb')).toBe('local');
      expect(inferBackupType('my-s5000')).toBe('local');
    });

    it('should default to remote for ambiguous names', () => {
      expect(inferBackupType('unknown')).toBe('remote');
      expect(inferBackupType('test123')).toBe('remote');
    });
  });

  describe('discoverExistingBackups', () => {
    it('should discover backups in nested directory structure', async () => {
      // Create test backup structure
      const sampler1 = join(testBackupRoot, 'pi-scsi2', 'images');
      const sampler2 = join(testBackupRoot, 's5k-gotek', 'floppy');

      await mkdir(sampler1, { recursive: true });
      await mkdir(sampler2, { recursive: true });

      await writeFile(join(sampler1, 'HD0.hds'), 'fake disk image');
      await writeFile(join(sampler1, 'HD1.hds'), 'fake disk image');
      await writeFile(join(sampler2, 'DSK0.img'), 'fake disk image');

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toHaveLength(2);

      const piScsi = discovered.find((d) => d.sampler === 'pi-scsi2');
      expect(piScsi).toBeDefined();
      expect(piScsi?.device).toBe('images');
      expect(piScsi?.fileCount).toBe(2);
      expect(piScsi?.inferredType).toBe('remote');

      const gotek = discovered.find((d) => d.sampler === 's5k-gotek');
      expect(gotek).toBeDefined();
      expect(gotek?.device).toBe('floppy');
      expect(gotek?.fileCount).toBe(1);
      expect(gotek?.inferredType).toBe('local');
    });

    it('should handle empty backup root', async () => {
      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toEqual([]);
    });

    it('should skip directories without disk images', async () => {
      const sampler = join(testBackupRoot, 'pi-scsi2', 'images');
      await mkdir(sampler, { recursive: true });
      await writeFile(join(sampler, 'README.txt'), 'not a disk image');

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toEqual([]);
    });

    it('should calculate file counts and sizes correctly', async () => {
      const sampler = join(testBackupRoot, 'test-sampler', 'device');
      await mkdir(sampler, { recursive: true });

      const content1 = 'a'.repeat(1024); // 1KB
      const content2 = 'b'.repeat(2048); // 2KB

      await writeFile(join(sampler, 'disk1.hds'), content1);
      await writeFile(join(sampler, 'disk2.img'), content2);

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].fileCount).toBe(2);
      expect(discovered[0].totalSize).toBe(3072); // 1KB + 2KB
    });

    it('should include lastModified timestamp', async () => {
      const sampler = join(testBackupRoot, 'test-sampler', 'device');
      await mkdir(sampler, { recursive: true });
      await writeFile(join(sampler, 'disk.hds'), 'content');

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].lastModified).toBeInstanceOf(Date);
      expect(discovered[0].lastModified.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle non-existent backup root', async () => {
      const nonExistent = join(tmpdir(), `non-existent-${Date.now()}`);

      const discovered = await discoverExistingBackups(nonExistent);

      expect(discovered).toEqual([]);
    });

    it('should discover multiple devices for single sampler', async () => {
      const device1 = join(testBackupRoot, 'pi-scsi2', 'scsi0');
      const device2 = join(testBackupRoot, 'pi-scsi2', 'scsi1');

      await mkdir(device1, { recursive: true });
      await mkdir(device2, { recursive: true });

      await writeFile(join(device1, 'HD0.hds'), 'disk');
      await writeFile(join(device2, 'HD1.hds'), 'disk');

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toHaveLength(2);

      const scsi0 = discovered.find((d) => d.device === 'scsi0');
      const scsi1 = discovered.find((d) => d.device === 'scsi1');

      expect(scsi0?.sampler).toBe('pi-scsi2');
      expect(scsi1?.sampler).toBe('pi-scsi2');
    });

    it('should only count disk image files', async () => {
      const sampler = join(testBackupRoot, 'test-sampler', 'device');
      await mkdir(sampler, { recursive: true });

      await writeFile(join(sampler, 'disk1.hds'), 'disk');
      await writeFile(join(sampler, 'disk2.img'), 'disk');
      await writeFile(join(sampler, 'disk3.iso'), 'disk');
      await writeFile(join(sampler, 'README.txt'), 'not a disk');
      await writeFile(join(sampler, 'backup.log'), 'not a disk');

      const discovered = await discoverExistingBackups(testBackupRoot);

      expect(discovered).toHaveLength(1);
      expect(discovered[0].fileCount).toBe(3); // Only .hds, .img, .iso
    });
  });

  describe('importDiscoveredBackups', () => {
    it('should convert discovered backups to backup sources', async () => {
      const discovered: DiscoveredBackup[] = [
        {
          sampler: 'pi-scsi2',
          device: 'images',
          path: join(testBackupRoot, 'pi-scsi2', 'images'),
          fileCount: 2,
          totalSize: 2048,
          lastModified: new Date(),
          inferredType: 'remote',
        },
        {
          sampler: 's5k-gotek',
          device: 'floppy',
          path: join(testBackupRoot, 's5k-gotek', 'floppy'),
          fileCount: 1,
          totalSize: 1024,
          lastModified: new Date(),
          inferredType: 'local',
        },
      ];

      const sources = await importDiscoveredBackups(discovered);

      expect(sources).toHaveLength(2);

      const remoteSource = sources.find((s) => s.name === 'pi-scsi2');
      expect(remoteSource).toBeDefined();
      expect(remoteSource?.type).toBe('remote');
      expect(remoteSource?.device).toBe('images');
      expect(remoteSource?.enabled).toBe(false); // Disabled by default

      const localSource = sources.find((s) => s.name === 's5k-gotek');
      expect(localSource).toBeDefined();
      expect(localSource?.type).toBe('local');
      expect(localSource?.device).toBe('floppy');
      expect(localSource?.sampler).toBe('s5k-gotek');
      expect(localSource?.enabled).toBe(false);
    });

    it('should handle empty discovered backups array', async () => {
      const sources = await importDiscoveredBackups([]);

      expect(sources).toEqual([]);
    });

    it('should generate unique names for duplicate samplers', async () => {
      const discovered: DiscoveredBackup[] = [
        {
          sampler: 'pi-scsi2',
          device: 'scsi0',
          path: join(testBackupRoot, 'pi-scsi2', 'scsi0'),
          fileCount: 1,
          totalSize: 1024,
          lastModified: new Date(),
          inferredType: 'remote',
        },
        {
          sampler: 'pi-scsi2',
          device: 'scsi1',
          path: join(testBackupRoot, 'pi-scsi2', 'scsi1'),
          fileCount: 1,
          totalSize: 1024,
          lastModified: new Date(),
          inferredType: 'remote',
        },
      ];

      const sources = await importDiscoveredBackups(discovered);

      expect(sources).toHaveLength(2);
      expect(sources[0].name).toBe('pi-scsi2-scsi0');
      expect(sources[1].name).toBe('pi-scsi2-scsi1');
    });

    it('should set source path placeholder for remote sources', async () => {
      const discovered: DiscoveredBackup[] = [
        {
          sampler: 'pi-scsi2',
          device: 'images',
          path: join(testBackupRoot, 'pi-scsi2', 'images'),
          fileCount: 1,
          totalSize: 1024,
          lastModified: new Date(),
          inferredType: 'remote',
        },
      ];

      const sources = await importDiscoveredBackups(discovered);

      expect(sources[0].source).toContain('pi-scsi2');
      expect(sources[0].source).toContain('~/images');
    });

    it('should set source path placeholder for local sources', async () => {
      const discovered: DiscoveredBackup[] = [
        {
          sampler: 's5k-gotek',
          device: 'floppy',
          path: join(testBackupRoot, 's5k-gotek', 'floppy'),
          fileCount: 1,
          totalSize: 1024,
          lastModified: new Date(),
          inferredType: 'local',
        },
      ];

      const sources = await importDiscoveredBackups(discovered);

      expect(sources[0].source).toContain('/Volumes/');
    });
  });
});
