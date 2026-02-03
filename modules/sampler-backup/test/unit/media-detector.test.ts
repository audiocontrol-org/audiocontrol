import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaDetector, type FileSystemOperations } from '@/lib/media/media-detector.js';

/**
 * Mock filesystem for testing MediaDetector
 * Provides controlled filesystem behavior for comprehensive test coverage
 */
class MockFileSystem implements FileSystemOperations {
  private files: Map<string, { isDir: boolean; size: number; mtime: Date }> = new Map();
  private directories: Map<string, string[]> = new Map();
  private platformType: string = 'darwin';
  private readdirErrors: Map<string, Error> = new Map();
  private statErrors: Map<string, Error> = new Map();

  setPlatform(platform: string): void {
    this.platformType = platform;
  }

  setFile(path: string, size: number, mtime: Date): void {
    this.files.set(path, { isDir: false, size, mtime });
  }

  setDirectory(path: string, entries: string[]): void {
    this.files.set(path, { isDir: true, size: 0, mtime: new Date() });
    this.directories.set(path, entries);
  }

  setReaddirError(path: string, error: Error): void {
    this.readdirErrors.set(path, error);
  }

  setStatError(path: string, error: Error): void {
    this.statErrors.set(path, error);
  }

  setError(path: string, error: Error): void {
    // Convenience method that sets both readdir and stat errors
    this.readdirErrors.set(path, error);
    this.statErrors.set(path, error);
  }

  async readdir(path: string): Promise<string[]> {
    if (this.readdirErrors.has(path)) {
      throw this.readdirErrors.get(path);
    }
    const entries = this.directories.get(path);
    if (!entries) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    return entries;
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; size: number; mtime: Date }> {
    if (this.statErrors.has(path)) {
      throw this.statErrors.get(path);
    }
    const info = this.files.get(path);
    if (!info) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return {
      isDirectory: () => info.isDir,
      isFile: () => !info.isDir,
      size: info.size,
      mtime: info.mtime,
    };
  }

  platform(): string {
    return this.platformType;
  }
}

describe('MediaDetector', () => {
  let mockFs: MockFileSystem;
  let detector: MediaDetector;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    detector = new MediaDetector(mockFs);
  });

  describe('detectMedia - macOS', () => {
    beforeEach(() => {
      mockFs.setPlatform('darwin');
    });

    it('should detect external volumes on macOS', async () => {
      // Setup /Volumes with external drive
      mockFs.setDirectory('/Volumes', ['SDCARD', 'Macintosh HD']);
      mockFs.setDirectory('/Volumes/SDCARD', []);
      mockFs.setDirectory('/Volumes/Macintosh HD', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/Volumes/SDCARD');
      expect(media[0].volumeName).toBe('SDCARD');
      expect(media[0].diskImages).toEqual([]);
    });

    it('should exclude macOS system volumes', async () => {
      mockFs.setDirectory('/Volumes', [
        'Macintosh HD',
        'Data',
        'Preboot',
        'Recovery',
        'VM',
        'USB_DRIVE',
      ]);
      mockFs.setDirectory('/Volumes/Macintosh HD', []);
      mockFs.setDirectory('/Volumes/Data', []);
      mockFs.setDirectory('/Volumes/Preboot', []);
      mockFs.setDirectory('/Volumes/Recovery', []);
      mockFs.setDirectory('/Volumes/VM', []);
      mockFs.setDirectory('/Volumes/USB_DRIVE', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/Volumes/USB_DRIVE');
    });

    it('should exclude hidden files from mount points', async () => {
      mockFs.setDirectory('/Volumes', ['.DS_Store', '.hidden', 'SDCARD']);
      mockFs.setFile('/Volumes/.DS_Store', 100, new Date());
      mockFs.setDirectory('/Volumes/.hidden', []);
      mockFs.setDirectory('/Volumes/SDCARD', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].volumeName).toBe('SDCARD');
    });

    it('should find disk images on macOS volumes', async () => {
      const mtime = new Date('2025-01-01');
      mockFs.setDirectory('/Volumes', ['BACKUP']);
      mockFs.setDirectory('/Volumes/BACKUP', ['sampler.hds', 'other.txt']);
      mockFs.setFile('/Volumes/BACKUP/sampler.hds', 1024000, mtime);
      mockFs.setFile('/Volumes/BACKUP/other.txt', 100, mtime);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].diskImages).toHaveLength(1);
      expect(media[0].diskImages[0]).toEqual({
        path: '/Volumes/BACKUP/sampler.hds',
        name: 'sampler',
        size: 1024000,
        mtime,
      });
    });

    it('should handle permission errors when reading volumes', async () => {
      mockFs.setError('/Volumes', new Error('EACCES: permission denied'));

      await expect(detector.detectMedia()).rejects.toThrow('Failed to read macOS volumes directory');
    });

    it('should skip volumes with stat errors', async () => {
      mockFs.setDirectory('/Volumes', ['GOOD', 'BAD']);
      mockFs.setDirectory('/Volumes/GOOD', []);
      mockFs.setError('/Volumes/BAD', new Error('EACCES: permission denied'));

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].volumeName).toBe('GOOD');
    });

    it('should skip volumes with readdir errors', async () => {
      mockFs.setDirectory('/Volumes', ['VOLUME']);
      mockFs.setDirectory('/Volumes/VOLUME', []);
      mockFs.setReaddirError('/Volumes/VOLUME', new Error('EACCES: permission denied'));

      const media = await detector.detectMedia();

      // Volume appears but with empty disk images (readdir error during scanning)
      expect(media).toHaveLength(1);
      expect(media[0].diskImages).toEqual([]);
    });

    it('should handle errors when finding disk images on a volume', async () => {
      // This tests the catch block in detectMedia (lines 100-104)
      mockFs.setDirectory('/Volumes', ['BROKEN']);
      mockFs.setDirectory('/Volumes/BROKEN', ['subdir']);
      mockFs.setDirectory('/Volumes/BROKEN/subdir', ['file.hds']);
      // Make findDiskImages fail by making the initial stat fail
      mockFs.setStatError('/Volumes/BROKEN', new Error('I/O error'));

      const media = await detector.detectMedia();

      // The volume with errors is skipped
      expect(media).toHaveLength(0);
    });
  });

  describe('detectMedia - Linux', () => {
    beforeEach(() => {
      mockFs.setPlatform('linux');
      // Set username for /media paths
      process.env.USER = 'testuser';
    });

    it('should detect media from /media/$USER/', async () => {
      mockFs.setDirectory('/media/testuser', ['usb-drive']);
      mockFs.setDirectory('/media/testuser/usb-drive', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/media/testuser/usb-drive');
      expect(media[0].volumeName).toBe('usb-drive');
    });

    it('should detect media from /mnt/', async () => {
      mockFs.setDirectory('/media/testuser', []);
      mockFs.setDirectory('/mnt', ['backup']);
      mockFs.setDirectory('/mnt/backup', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/mnt/backup');
    });

    it('should combine media from both /media and /mnt', async () => {
      mockFs.setDirectory('/media/testuser', ['usb1']);
      mockFs.setDirectory('/media/testuser/usb1', []);
      mockFs.setDirectory('/mnt', ['usb2']);
      mockFs.setDirectory('/mnt/usb2', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(2);
      expect(media[0].mountPoint).toBe('/media/testuser/usb1');
      expect(media[1].mountPoint).toBe('/mnt/usb2');
    });

    it('should handle missing /media/$USER/ gracefully', async () => {
      mockFs.setError('/media/testuser', new Error('ENOENT: no such file or directory'));
      mockFs.setDirectory('/mnt', ['backup']);
      mockFs.setDirectory('/mnt/backup', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/mnt/backup');
    });

    it('should exclude hidden files on Linux', async () => {
      mockFs.setDirectory('/mnt', ['.hidden', 'backup']);
      mockFs.setDirectory('/mnt/.hidden', []);
      mockFs.setDirectory('/mnt/backup', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].volumeName).toBe('backup');
    });

    it('should use USERNAME env var as fallback', async () => {
      delete process.env.USER;
      process.env.USERNAME = 'fallbackuser';

      mockFs.setDirectory('/media/fallbackuser', ['drive']);
      mockFs.setDirectory('/media/fallbackuser/drive', []);
      mockFs.setDirectory('/mnt', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].mountPoint).toBe('/media/fallbackuser/drive');
    });

    it('should skip mount points with stat errors on Linux', async () => {
      mockFs.setDirectory('/media/testuser', ['good', 'bad']);
      mockFs.setDirectory('/media/testuser/good', []);
      mockFs.setStatError('/media/testuser/bad', new Error('EACCES: permission denied'));
      mockFs.setDirectory('/mnt', []);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].volumeName).toBe('good');
    });

    it('should handle both /media and /mnt being inaccessible', async () => {
      mockFs.setError('/media/testuser', new Error('ENOENT: no such file or directory'));
      mockFs.setError('/mnt', new Error('EACCES: permission denied'));

      const media = await detector.detectMedia();

      expect(media).toEqual([]);
    });
  });

  describe('findDiskImages', () => {
    it('should find .hds files', async () => {
      const mtime = new Date('2025-01-01');
      mockFs.setDirectory('/test', ['disk.hds']);
      mockFs.setFile('/test/disk.hds', 5000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0]).toEqual({
        path: '/test/disk.hds',
        name: 'disk',
        size: 5000,
        mtime,
      });
    });

    it('should find .img files', async () => {
      const mtime = new Date('2025-01-15');
      mockFs.setDirectory('/test', ['backup.img']);
      mockFs.setFile('/test/backup.img', 10000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('backup');
      expect(images[0].size).toBe(10000);
    });

    it('should find .iso files', async () => {
      const mtime = new Date('2025-02-01');
      mockFs.setDirectory('/test', ['cdrom.iso']);
      mockFs.setFile('/test/cdrom.iso', 700000000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('cdrom');
    });

    it('should handle case-insensitive extensions', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['disk.HDS', 'image.IMG', 'cd.ISO']);
      mockFs.setFile('/test/disk.HDS', 1000, mtime);
      mockFs.setFile('/test/image.IMG', 2000, mtime);
      mockFs.setFile('/test/cd.ISO', 3000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(3);
      expect(images.map(img => img.name)).toEqual(['disk', 'image', 'cd']);
    });

    it('should exclude non-disk-image files', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['disk.hds', 'readme.txt', 'config.json', 'script.sh']);
      mockFs.setFile('/test/disk.hds', 1000, mtime);
      mockFs.setFile('/test/readme.txt', 100, mtime);
      mockFs.setFile('/test/config.json', 200, mtime);
      mockFs.setFile('/test/script.sh', 300, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('disk');
    });

    it('should exclude hidden files', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['.hidden.hds', 'visible.hds']);
      mockFs.setFile('/test/.hidden.hds', 1000, mtime);
      mockFs.setFile('/test/visible.hds', 2000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('visible');
    });

    it('should scan recursively into subdirectories', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['subdir', 'root.hds']);
      mockFs.setFile('/test/root.hds', 1000, mtime);
      mockFs.setDirectory('/test/subdir', ['nested.img']);
      mockFs.setFile('/test/subdir/nested.img', 2000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(2);
      const paths = images.map(img => img.path).sort();
      expect(paths).toEqual(['/test/root.hds', '/test/subdir/nested.img']);
    });

    it('should scan deeply nested directories', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['level1']);
      mockFs.setDirectory('/test/level1', ['level2']);
      mockFs.setDirectory('/test/level1/level2', ['level3']);
      mockFs.setDirectory('/test/level1/level2/level3', ['deep.hds']);
      mockFs.setFile('/test/level1/level2/level3/deep.hds', 5000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].path).toBe('/test/level1/level2/level3/deep.hds');
    });

    it('should skip hidden directories', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['.hidden', 'visible']);
      mockFs.setDirectory('/test/.hidden', ['secret.hds']);
      mockFs.setFile('/test/.hidden/secret.hds', 1000, mtime);
      mockFs.setDirectory('/test/visible', ['public.hds']);
      mockFs.setFile('/test/visible/public.hds', 2000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('public');
    });

    it('should handle empty directories', async () => {
      mockFs.setDirectory('/test', []);

      const images = await detector.findDiskImages('/test');

      expect(images).toEqual([]);
    });

    it('should handle directories with only subdirectories', async () => {
      mockFs.setDirectory('/test', ['sub1', 'sub2']);
      mockFs.setDirectory('/test/sub1', []);
      mockFs.setDirectory('/test/sub2', []);

      const images = await detector.findDiskImages('/test');

      expect(images).toEqual([]);
    });

    it('should throw error for non-existent path', async () => {
      await expect(detector.findDiskImages('/nonexistent')).rejects.toThrow(
        'Failed to scan directory /nonexistent'
      );
    });

    it('should throw error with context for permission denied', async () => {
      mockFs.setError('/protected', new Error('EACCES: permission denied'));

      await expect(detector.findDiskImages('/protected')).rejects.toThrow(
        'Failed to scan directory /protected: EACCES: permission denied'
      );
    });

    it('should skip subdirectories with permission errors during readdir', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['accessible', 'protected']);
      mockFs.setDirectory('/test/accessible', ['file.hds']);
      mockFs.setFile('/test/accessible/file.hds', 1000, mtime);
      mockFs.setDirectory('/test/protected', []); // Directory exists but...
      mockFs.setReaddirError('/test/protected', new Error('EACCES: permission denied')); // ...can't read it

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('file');
    });

    it('should skip files with stat errors', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['good.hds', 'bad.hds']);
      mockFs.setFile('/test/good.hds', 1000, mtime);
      mockFs.setStatError('/test/bad.hds', new Error('EACCES: permission denied'));

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(1);
      expect(images[0].name).toBe('good');
    });

    it('should find multiple disk images in same directory', async () => {
      const mtime = new Date();
      mockFs.setDirectory('/test', ['disk1.hds', 'disk2.img', 'disk3.iso']);
      mockFs.setFile('/test/disk1.hds', 1000, mtime);
      mockFs.setFile('/test/disk2.img', 2000, mtime);
      mockFs.setFile('/test/disk3.iso', 3000, mtime);

      const images = await detector.findDiskImages('/test');

      expect(images).toHaveLength(3);
      expect(images.map(img => img.name).sort()).toEqual(['disk1', 'disk2', 'disk3']);
    });
  });

  describe('platform detection', () => {
    it('should throw error for unsupported platform', async () => {
      mockFs.setPlatform('win32');

      await expect(detector.detectMedia()).rejects.toThrow('Unsupported platform: win32');
    });

    it('should work with linux platform', async () => {
      mockFs.setPlatform('linux');
      process.env.USER = 'testuser';
      mockFs.setDirectory('/media/testuser', []);
      mockFs.setDirectory('/mnt', []);

      const media = await detector.detectMedia();

      expect(media).toBeDefined();
    });

    it('should work with darwin platform', async () => {
      mockFs.setPlatform('darwin');
      mockFs.setDirectory('/Volumes', ['Macintosh HD']);
      mockFs.setDirectory('/Volumes/Macintosh HD', []);

      const media = await detector.detectMedia();

      expect(media).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed content with subdirectories and files', async () => {
      const mtime = new Date();
      mockFs.setPlatform('darwin');
      mockFs.setDirectory('/Volumes', ['USB']);
      mockFs.setDirectory('/Volumes/USB', ['backups', 'docs', 'root.hds']);
      mockFs.setFile('/Volumes/USB/root.hds', 1000, mtime);
      mockFs.setDirectory('/Volumes/USB/backups', ['backup1.img', 'backup2.img']);
      mockFs.setFile('/Volumes/USB/backups/backup1.img', 2000, mtime);
      mockFs.setFile('/Volumes/USB/backups/backup2.img', 3000, mtime);
      mockFs.setDirectory('/Volumes/USB/docs', ['readme.txt']);
      mockFs.setFile('/Volumes/USB/docs/readme.txt', 100, mtime);

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].diskImages).toHaveLength(3);
      expect(media[0].diskImages.map(img => img.name).sort()).toEqual(['backup1', 'backup2', 'root']);
    });

    it('should return empty array for volume with no disk images', async () => {
      mockFs.setPlatform('darwin');
      mockFs.setDirectory('/Volumes', ['EMPTY']);
      mockFs.setDirectory('/Volumes/EMPTY', ['folder']);
      mockFs.setDirectory('/Volumes/EMPTY/folder', ['file.txt']);
      mockFs.setFile('/Volumes/EMPTY/folder/file.txt', 100, new Date());

      const media = await detector.detectMedia();

      expect(media).toHaveLength(1);
      expect(media[0].diskImages).toEqual([]);
    });

    it('should preserve file metadata correctly', async () => {
      const specificTime = new Date('2025-03-15T10:30:00Z');
      const specificSize = 987654321;
      mockFs.setDirectory('/test', ['important.hds']);
      mockFs.setFile('/test/important.hds', specificSize, specificTime);

      const images = await detector.findDiskImages('/test');

      expect(images[0].size).toBe(specificSize);
      expect(images[0].mtime).toEqual(specificTime);
    });
  });
});
