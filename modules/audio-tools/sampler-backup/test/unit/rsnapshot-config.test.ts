import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDefaultRsnapshotConfig,
  generateRsnapshotConfig,
  writeRsnapshotConfig,
  getDefaultConfigPath,
} from '@/config/rsnapshot-config.js';
import type { RsnapshotConfig } from '@/types/index.js';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';

// Mock modules
vi.mock('fs');
vi.mock('os');
vi.mock('child_process');

describe('Rsnapshot Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/testuser');
  });

  describe('getDefaultRsnapshotConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultRsnapshotConfig();

      expect(config).toBeDefined();
      expect(config.snapshotRoot).toContain('.audiotools/backup');
      expect(config.retain).toBeDefined();
      expect(config.samplers).toBeDefined();
      expect(config.options).toBeDefined();
    });

    it('should include retain intervals', () => {
      const config = getDefaultRsnapshotConfig();

      expect(config.retain.daily).toBe(7);
      expect(config.retain.weekly).toBe(4);
      expect(config.retain.monthly).toBe(12);
    });

    it('should include default sampler configurations', () => {
      const config = getDefaultRsnapshotConfig();

      expect(config.samplers).toHaveLength(2);
      expect(config.samplers[0].type).toBe('s5k');
      expect(config.samplers[0].host).toBe('pi-scsi2.local');
      expect(config.samplers[1].type).toBe('s3k');
    });

    it('should include rsync options', () => {
      const config = getDefaultRsnapshotConfig();

      expect(config.options.rsyncShortArgs).toBe('-a');
      expect(config.options.rsyncLongArgs).toContain('--delete');
      expect(config.options.verbose).toBe(2);
    });

    it('should use home directory in snapshot root', () => {
      vi.mocked(os.homedir).mockReturnValue('/custom/home');

      const config = getDefaultRsnapshotConfig();

      expect(config.snapshotRoot).toBe('/custom/home/.audiotools/backup');
    });
  });

  describe('generateRsnapshotConfig', () => {
    const mockConfig: RsnapshotConfig = {
      snapshotRoot: '/backup/root',
      retain: {
        daily: 7,
        weekly: 4,
        monthly: 12,
      },
      samplers: [
        {
          type: 's5k',
          host: 'sampler.local',
          sourcePath: '/data/',
          backupSubdir: 'sampler1',
        },
      ],
      options: {
        rsyncShortArgs: '-a',
        rsyncLongArgs: '--delete --numeric-ids',
        verbose: 2,
      },
    };

    beforeEach(() => {
      // Mock which command
      vi.mocked(child_process.execSync).mockReturnValue('/usr/bin/rsync\n');
    });

    it('should generate valid rsnapshot configuration', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('config_version\t1.2');
      expect(content).toContain('snapshot_root\t/backup/root/');
      expect(content).toContain('rsnapshot configuration file');
    });

    it('should include retain intervals', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('retain\t\tdaily\t7');
      expect(content).toContain('retain\t\tweekly\t4');
      expect(content).toContain('retain\t\tmonthly\t12');
    });

    it('should include command paths', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('cmd_rsync');
      expect(content).toContain('cmd_ssh');
      expect(content).toContain('cmd_cp');
      expect(content).toContain('cmd_rm');
    });

    it('should find rsync command with which', () => {
      vi.mocked(child_process.execSync).mockReturnValue('/custom/path/rsync\n');

      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('/custom/path/rsync');
      expect(vi.mocked(child_process.execSync)).toHaveBeenCalledWith(
        'which rsync',
        expect.any(Object)
      );
    });

    it('should use fallback when which fails', () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error('command not found');
      });

      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('cmd_rsync\t/usr/bin/rsync');
    });

    it('should include rsync options', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('rsync_short_args\t-a');
      expect(content).toContain('rsync_long_args\t\t--delete --numeric-ids');
    });

    it('should include verbose level', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('verbose\t\t2');
    });

    it('should include backup points for samplers', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('backup\t\tsampler.local:/data/\tsampler1/');
    });

    it('should handle multiple samplers', () => {
      const multiConfig: RsnapshotConfig = {
        ...mockConfig,
        samplers: [
          mockConfig.samplers[0],
          {
            type: 's3k',
            host: 'sampler2.local',
            sourcePath: '/images/',
            backupSubdir: 'sampler2',
          },
        ],
      };

      const content = generateRsnapshotConfig(multiConfig);

      expect(content).toContain('backup\t\tsampler.local:/data/\tsampler1/');
      expect(content).toContain('backup\t\tsampler2.local:/images/\tsampler2/');
    });

    it('should use tabs for formatting', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toMatch(/config_version\t/);
      expect(content).toMatch(/snapshot_root\t/);
      expect(content).toMatch(/retain\t\t/);
    });

    it('should include section comments', () => {
      const content = generateRsnapshotConfig(mockConfig);

      expect(content).toContain('# Backup destination');
      expect(content).toContain('# Backup intervals and retention');
      expect(content).toContain('# External programs');
    });

    it('should handle custom verbosity levels', () => {
      const customConfig = {
        ...mockConfig,
        options: {
          ...mockConfig.options,
          verbose: 5,
        },
      };

      const content = generateRsnapshotConfig(customConfig);

      expect(content).toContain('verbose\t\t5');
    });

    it('should handle different retain intervals', () => {
      const customConfig: RsnapshotConfig = {
        ...mockConfig,
        retain: {
          hourly: 24,
          daily: 30,
          weekly: 8,
          monthly: 24,
          yearly: 5,
        },
      };

      const content = generateRsnapshotConfig(customConfig as any);

      expect(content).toMatch(/retain\t\t(hourly|daily|weekly|monthly|yearly)/);
    });
  });

  describe('writeRsnapshotConfig', () => {
    const mockConfig: RsnapshotConfig = {
      snapshotRoot: '/backup',
      retain: { daily: 7, weekly: 4, monthly: 12 },
      samplers: [],
      options: {
        rsyncShortArgs: '-a',
        rsyncLongArgs: '--delete',
        verbose: 2,
      },
    };

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
      vi.mocked(child_process.execSync).mockReturnValue('/usr/bin/rsync\n');
    });

    it('should write config to specified path', () => {
      writeRsnapshotConfig(mockConfig, '/custom/path/rsnapshot.conf');

      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        '/custom/path/rsnapshot.conf',
        expect.any(String),
        'utf-8'
      );
    });

    it('should write file without creating directories', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      writeRsnapshotConfig(mockConfig, '/new/path/rsnapshot.conf');

      // writeRsnapshotConfig doesn't create directories - caller's responsibility
      expect(vi.mocked(fs.mkdirSync)).not.toHaveBeenCalled();
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();
    });

    it('should write generated config content', () => {
      writeRsnapshotConfig(mockConfig, '/path/rsnapshot.conf');

      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('config_version\t1.2');
      expect(writtenContent).toContain('snapshot_root\t/backup/');
    });
  });

  describe('getDefaultConfigPath', () => {
    it('should return config path in home directory', () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const path = getDefaultConfigPath();

      expect(path).toBe('/home/user/.audiotools/rsnapshot.conf');
    });

    it('should use different home directory', () => {
      vi.mocked(os.homedir).mockReturnValue('/Users/testuser');

      const path = getDefaultConfigPath();

      expect(path).toBe('/Users/testuser/.audiotools/rsnapshot.conf');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      vi.mocked(child_process.execSync).mockReturnValue('/usr/bin/rsync\n');
    });

    it('should handle empty samplers array', () => {
      const config: RsnapshotConfig = {
        snapshotRoot: '/backup',
        retain: { daily: 7, weekly: 4, monthly: 12 },
        samplers: [],
        options: {
          rsyncShortArgs: '-a',
          rsyncLongArgs: '--delete',
          verbose: 2,
        },
      };

      const content = generateRsnapshotConfig(config);

      expect(content).toContain('config_version');
      expect(content).not.toContain('backup\t');
    });

    it('should handle trailing slashes in paths', () => {
      const config: RsnapshotConfig = {
        snapshotRoot: '/backup/',
        retain: { daily: 7, weekly: 4, monthly: 12 },
        samplers: [
          {
            type: 's5k',
            host: 'sampler.local',
            sourcePath: '/data/',
            backupSubdir: 'sampler1/',
          },
        ],
        options: {
          rsyncShortArgs: '-a',
          rsyncLongArgs: '--delete',
          verbose: 2,
        },
      };

      const content = generateRsnapshotConfig(config);

      expect(content).toContain('snapshot_root\t/backup//');
      expect(content).toContain('backup\t\tsampler.local:/data/\tsampler1//');
    });

    it('should handle empty which output', () => {
      vi.mocked(child_process.execSync).mockReturnValue('');

      const config = getDefaultRsnapshotConfig();
      const content = generateRsnapshotConfig(config);

      expect(content).toContain('cmd_rsync\t/usr/bin/rsync');
    });

    it('should handle whitespace in which output', () => {
      vi.mocked(child_process.execSync).mockReturnValue('  /usr/bin/rsync  \n');

      const config = getDefaultRsnapshotConfig();
      const content = generateRsnapshotConfig(config);

      expect(content).toContain('cmd_rsync\t/usr/bin/rsync');
    });
  });
});
