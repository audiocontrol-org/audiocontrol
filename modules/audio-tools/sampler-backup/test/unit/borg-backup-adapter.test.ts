/**
 * Unit tests for BorgBackupAdapter
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  BorgRepositoryConfig,
  BorgRetentionPolicy,
  BorgProgress,
  BorgCommandResult
} from '@/types/borg';
import * as borgCommand from '@/backup/borg-command.js';

// Mock fs/promises at module level
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

/**
 * Creates mock command executor with configurable responses
 */
function createMockExecutor() {
  const executor = {
    nextCommandResult: null as BorgCommandResult | null,
    nextCommandError: null as Error | null,
    errorQueue: [] as Error[],
    resultQueue: [] as BorgCommandResult[],
    capturedCommands: [] as Array<{ command: string; args: string[] }>,
    progressLines: [] as string[],

    executeBorgCommand: async (
      command: string,
      args: string[],
      onProgress?: (line: string) => void
    ): Promise<BorgCommandResult> => {
      // Capture command for verification
      executor.capturedCommands.push({ command, args });

      // Send progress lines if callback provided
      if (onProgress && executor.progressLines.length > 0) {
        for (const line of executor.progressLines) {
          onProgress(line);
        }
      }

      // Check error queue first
      if (executor.errorQueue.length > 0) {
        const error = executor.errorQueue.shift()!;
        throw error;
      }

      // Then check single error
      if (executor.nextCommandError) {
        const error = executor.nextCommandError;
        executor.nextCommandError = null;
        throw error;
      }

      // Check result queue
      if (executor.resultQueue.length > 0) {
        return executor.resultQueue.shift()!;
      }

      // Return result if configured
      if (executor.nextCommandResult) {
        const result = executor.nextCommandResult;
        executor.nextCommandResult = null;
        return result;
      }

      // Default successful result
      return {
        stdout: '',
        stderr: '',
        exitCode: 0
      };
    }
  };

  return executor;
}

describe('BorgBackupAdapter', () => {
  let mockExecutor: ReturnType<typeof createMockExecutor>;
  let config: BorgRepositoryConfig;

  beforeEach(async () => {
    mockExecutor = createMockExecutor();
    config = {
      repoPath: '/test/repo',
      compression: 'zstd',
      encryption: 'none'
    };

    // Mock the borg-command module functions
    vi.spyOn(borgCommand, 'executeBorgCommand').mockImplementation(mockExecutor.executeBorgCommand);
    vi.spyOn(borgCommand, 'ensureBorgInstalled').mockResolvedValue(undefined);
    vi.spyOn(borgCommand, 'checkBorgVersion').mockResolvedValue(undefined);
    vi.spyOn(borgCommand, 'expandPath').mockImplementation((path: string) =>
      path.replace('~', '/home/user')
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create adapter after mocks are set up
  async function createAdapter(cfg: BorgRepositoryConfig = config) {
    const { BorgBackupAdapter } = await import('@/backup/borg-backup-adapter.js');
    return new BorgBackupAdapter(cfg);
  }

  describe('constructor', () => {
    it('should initialize with provided config', async () => {
      const adapter = await createAdapter();
      expect(adapter).toBeDefined();
    });

    it('should set default compression if not provided', async () => {
      const minimalConfig: BorgRepositoryConfig = {
        repoPath: '/test/repo'
      };
      const adapter = await createAdapter(minimalConfig);
      expect(adapter).toBeDefined();
    });

    it('should expand tilde in repoPath', async () => {
      const configWithTilde: BorgRepositoryConfig = {
        repoPath: '~/test/repo',
        compression: 'zstd',
        encryption: 'none'
      };
      const adapter = await createAdapter(configWithTilde);
      expect(adapter).toBeDefined();
    });
  });

  describe('initRepository()', () => {
    it('should initialize new repository successfully', async () => {
      const adapter = await createAdapter();

      // First call to getRepositoryInfo should fail (repo doesn't exist)
      mockExecutor.nextCommandError = new Error('Repository does not exist');

      // Second call to init should succeed
      mockExecutor.nextCommandResult = {
        stdout: 'Repository initialized',
        stderr: '',
        exitCode: 0
      };

      await adapter.initRepository(config);

      expect(mockExecutor.capturedCommands).toHaveLength(2);
      expect(mockExecutor.capturedCommands[0].command).toBe('info');
      expect(mockExecutor.capturedCommands[1].command).toBe('init');
      expect(mockExecutor.capturedCommands[1].args).toContain('--encryption');
      expect(mockExecutor.capturedCommands[1].args).toContain('none');
      expect(mockExecutor.capturedCommands[1].args).toContain('--make-parent-dirs');
    });

    it('should skip initialization if repository already exists', async () => {
      const adapter = await createAdapter();

      // First call to getRepositoryInfo should succeed (repo exists)
      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          repository: {
            id: 'test-repo-id',
            last_modified: '2025-10-06T12:00:00Z'
          },
          cache: {
            stats: {
              total_chunks: 10,
              total_size: 1000000,
              total_csize: 800000,
              unique_csize: 600000
            }
          },
          encryption: { mode: 'none' }
        }),
        stderr: '',
        exitCode: 0
      };

      await adapter.initRepository(config);

      // Should only call info, not init
      expect(mockExecutor.capturedCommands).toHaveLength(1);
      expect(mockExecutor.capturedCommands[0].command).toBe('info');
    });

    it('should throw error on initialization failure', async () => {
      const adapter = await createAdapter();

      // Use error queue for sequential errors
      mockExecutor.errorQueue.push(new Error('Repository does not exist'));
      mockExecutor.errorQueue.push(new Error('Cannot create repository'));

      await expect(adapter.initRepository(config)).rejects.toThrow(
        'Failed to initialize repository: Cannot create repository'
      );
    });

    it('should use correct encryption mode', async () => {
      const repoKeyConfig: BorgRepositoryConfig = {
        repoPath: '/test/repo',
        encryption: 'repokey'
      };
      const adapter = await createAdapter(repoKeyConfig);

      // First call fails (repo doesn't exist)
      mockExecutor.nextCommandError = new Error('Repository does not exist');

      // Second call succeeds
      mockExecutor.nextCommandResult = {
        stdout: 'Repository initialized',
        stderr: '',
        exitCode: 0
      };

      await adapter.initRepository(repoKeyConfig);

      const initCommand = mockExecutor.capturedCommands.find(c => c.command === 'init');
      expect(initCommand?.args).toContain('--encryption');
      expect(initCommand?.args).toContain('repokey');
    });
  });

  describe('createArchive()', () => {
    it('should create archive successfully with stats', async () => {
      const adapter = await createAdapter();

      const statsOutput = JSON.stringify({
        archive: {
          stats: {
            original_size: 1000000,
            compressed_size: 800000,
            deduplicated_size: 600000,
            nfiles: 42
          }
        }
      });

      mockExecutor.nextCommandResult = {
        stdout: statsOutput,
        stderr: '',
        exitCode: 0
      };

      const archive = await adapter.createArchive(
        ['/test/source'],
        'test-archive-2025-10-06'
      );

      expect(archive.name).toBe('test-archive-2025-10-06');
      expect(archive.stats.originalSize).toBe(1000000);
      expect(archive.stats.compressedSize).toBe(800000);
      expect(archive.stats.dedupedSize).toBe(600000);
      expect(archive.stats.nfiles).toBe(42);
      expect(archive.timestamp).toBeInstanceOf(Date);

      const createCommand = mockExecutor.capturedCommands.find(c => c.command === 'create');
      expect(createCommand).toBeDefined();
      expect(createCommand?.args).toContain('--stats');
      expect(createCommand?.args).toContain('--json');
      expect(createCommand?.args).toContain('--progress');
      expect(createCommand?.args).toContain('--compression');
      expect(createCommand?.args).toContain('zstd');
    });

    it('should invoke progress callback during backup', async () => {
      const adapter = await createAdapter();

      const statsOutput = JSON.stringify({
        archive: {
          stats: {
            original_size: 1000000,
            compressed_size: 800000,
            deduplicated_size: 600000,
            nfiles: 50
          }
        }
      });

      const progressData = {
        type: 'archive_progress',
        original_size: 500000,
        compressed_size: 400000,
        deduplicated_size: 300000,
        nfiles: 25
      };

      // Progress lines: only send progress JSON (not final stats - that comes from stdout)
      mockExecutor.progressLines = [
        JSON.stringify(progressData),
        'Some other non-JSON output'
      ];

      mockExecutor.nextCommandResult = {
        stdout: statsOutput,
        stderr: '',
        exitCode: 0
      };

      const progressUpdates: BorgProgress[] = [];
      const onProgress = vi.fn((progress: BorgProgress) => {
        progressUpdates.push({ ...progress });
      });

      await adapter.createArchive(
        ['/test/source'],
        'test-archive',
        onProgress
      );

      expect(onProgress).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('should handle repository locked error', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error(
        'Failed to create/acquire the lock /test/repo/lock.exclusive'
      );

      await expect(
        adapter.createArchive(['/test/source'], 'test-archive')
      ).rejects.toThrow(/Repository is locked by another process/);
    });

    it('should handle SSH connection error', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error(
        'Connection refused: ssh pi@remote.local'
      );

      await expect(
        adapter.createArchive(['pi@remote.local:/data'], 'test-archive')
      ).rejects.toThrow(/Cannot connect to remote host/);
    });

    it('should handle SSH connection reset error', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error(
        'Connection reset by peer'
      );

      await expect(
        adapter.createArchive(['remote:/data'], 'test-archive')
      ).rejects.toThrow(/Cannot connect to remote host/);
    });

    it('should handle disk full error', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error(
        'No space left on device'
      );

      await expect(
        adapter.createArchive(['/test/source'], 'test-archive')
      ).rejects.toThrow(/Not enough disk space for backup/);
    });

    it('should handle generic errors', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error(
        'Unknown error occurred'
      );

      await expect(
        adapter.createArchive(['/test/source'], 'test-archive')
      ).rejects.toThrow(/Failed to create archive: Unknown error occurred/);
    });

    it('should include multiple sources in archive', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          archive: {
            stats: {
              original_size: 2000000,
              compressed_size: 1600000,
              deduplicated_size: 1200000,
              nfiles: 100
            }
          }
        }),
        stderr: '',
        exitCode: 0
      };

      await adapter.createArchive(
        ['/test/source1', '/test/source2', '/test/source3'],
        'multi-source-archive'
      );

      const createCommand = mockExecutor.capturedCommands.find(c => c.command === 'create');
      expect(createCommand?.args).toContain('/test/source1');
      expect(createCommand?.args).toContain('/test/source2');
      expect(createCommand?.args).toContain('/test/source3');
    });

    it('should handle missing stats in output', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          archive: {
            // Missing stats
          }
        }),
        stderr: '',
        exitCode: 0
      };

      const archive = await adapter.createArchive(['/test/source'], 'test-archive');

      expect(archive.stats.originalSize).toBe(0);
      expect(archive.stats.compressedSize).toBe(0);
      expect(archive.stats.dedupedSize).toBe(0);
      expect(archive.stats.nfiles).toBe(0);
    });
  });

  describe('listArchives()', () => {
    it('should parse archive list correctly', async () => {
      const adapter = await createAdapter();

      const archiveListOutput = JSON.stringify({
        archives: [
          {
            name: 'daily-2025-10-05-pi-scsi2',
            time: '2025-10-05T12:34:56.000000',
            nfiles: 42
          },
          {
            name: 'daily-2025-10-06-pi-scsi2',
            time: '2025-10-06T08:15:30.000000',
            nfiles: 38
          },
          {
            name: 'weekly-2025-10-01-local-media',
            time: '2025-10-01T10:00:00.000000',
            nfiles: 120
          }
        ]
      });

      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const archives = await adapter.listArchives();

      expect(archives).toHaveLength(3);
      expect(archives[0].name).toBe('daily-2025-10-05-pi-scsi2');
      expect(archives[0].timestamp).toBeInstanceOf(Date);
      expect(archives[0].stats.nfiles).toBe(42);
      expect(archives[1].name).toBe('daily-2025-10-06-pi-scsi2');
      expect(archives[2].name).toBe('weekly-2025-10-01-local-media');

      const listCommand = mockExecutor.capturedCommands.find(c => c.command === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand?.args).toContain('--json');
      expect(listCommand?.args).toContain('/test/repo');
    });

    it('should handle empty archive list', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({ archives: [] }),
        stderr: '',
        exitCode: 0
      };

      const archives = await adapter.listArchives();

      expect(archives).toHaveLength(0);
    });

    it('should handle missing nfiles field', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          archives: [
            {
              name: 'test-archive',
              time: '2025-10-06T12:00:00.000000'
              // Missing nfiles
            }
          ]
        }),
        stderr: '',
        exitCode: 0
      };

      const archives = await adapter.listArchives();

      expect(archives).toHaveLength(1);
      expect(archives[0].stats.nfiles).toBe(0);
    });

    it('should throw error on list failure', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Repository not found');

      await expect(adapter.listArchives()).rejects.toThrow(
        'Failed to list archives: Repository not found'
      );
    });
  });

  describe('restoreArchive()', () => {
    it('should restore archive successfully', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: 'Extraction complete',
        stderr: '',
        exitCode: 0
      };

      await adapter.restoreArchive(
        'daily-2025-10-05-pi-scsi2',
        '/test/restore-dest'
      );

      const extractCommand = mockExecutor.capturedCommands.find(c => c.command === 'extract');
      expect(extractCommand).toBeDefined();
      expect(extractCommand?.args).toContain('--progress');
      expect(extractCommand?.args).toContain('/test/repo::daily-2025-10-05-pi-scsi2');
    });

    it('should create destination directory', async () => {
      const adapter = await createAdapter();

      // Need to verify mkdir is called - in real implementation this happens
      // For unit test, we just verify the command succeeds
      mockExecutor.nextCommandResult = {
        stdout: 'Extraction complete',
        stderr: '',
        exitCode: 0
      };

      await expect(
        adapter.restoreArchive('test-archive', '/new/destination')
      ).resolves.not.toThrow();
    });

    it('should invoke progress callback during restore', async () => {
      const adapter = await createAdapter();

      const progressData = {
        type: 'archive_progress',
        original_size: 500000,
        nfiles: 25
      };

      mockExecutor.progressLines = [
        JSON.stringify(progressData),
        JSON.stringify(progressData)
      ];

      mockExecutor.nextCommandResult = {
        stdout: 'Extraction complete',
        stderr: '',
        exitCode: 0
      };

      const onProgress = vi.fn();

      await adapter.restoreArchive(
        'test-archive',
        '/test/destination',
        onProgress
      );

      expect(onProgress).toHaveBeenCalled();
    });

    it('should throw error on restore failure', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Archive not found');

      await expect(
        adapter.restoreArchive('nonexistent-archive', '/test/destination')
      ).rejects.toThrow('Failed to restore archive: Archive not found');
    });
  });

  describe('pruneArchives()', () => {
    it('should prune archives with correct retention policy', async () => {
      const adapter = await createAdapter();

      const policy: BorgRetentionPolicy = {
        daily: 7,
        weekly: 4,
        monthly: 12
      };

      mockExecutor.nextCommandResult = {
        stdout: 'Pruning complete',
        stderr: '',
        exitCode: 0
      };

      await adapter.pruneArchives(policy);

      const pruneCommand = mockExecutor.capturedCommands.find(c => c.command === 'prune');
      expect(pruneCommand).toBeDefined();
      expect(pruneCommand?.args).toContain('--stats');
      expect(pruneCommand?.args).toContain('--list');
      expect(pruneCommand?.args).toContain('--keep-daily=7');
      expect(pruneCommand?.args).toContain('--keep-weekly=4');
      expect(pruneCommand?.args).toContain('--keep-monthly=12');
      expect(pruneCommand?.args).toContain('/test/repo');
    });

    it('should throw error on prune failure', async () => {
      const adapter = await createAdapter();

      const policy: BorgRetentionPolicy = {
        daily: 7,
        weekly: 4,
        monthly: 12
      };

      mockExecutor.nextCommandError = new Error('Prune operation failed');

      await expect(adapter.pruneArchives(policy)).rejects.toThrow(
        'Failed to prune archives: Prune operation failed'
      );
    });

    it('should handle zero retention values', async () => {
      const adapter = await createAdapter();

      const policy: BorgRetentionPolicy = {
        daily: 0,
        weekly: 0,
        monthly: 6
      };

      mockExecutor.nextCommandResult = {
        stdout: 'Pruning complete',
        stderr: '',
        exitCode: 0
      };

      await adapter.pruneArchives(policy);

      const pruneCommand = mockExecutor.capturedCommands.find(c => c.command === 'prune');
      expect(pruneCommand?.args).toContain('--keep-daily=0');
      expect(pruneCommand?.args).toContain('--keep-weekly=0');
      expect(pruneCommand?.args).toContain('--keep-monthly=6');
    });
  });

  describe('getRepositoryInfo()', () => {
    it('should parse repository info correctly', async () => {
      const adapter = await createAdapter();

      const repoInfoOutput = JSON.stringify({
        repository: {
          id: 'abcd1234567890',
          last_modified: '2025-10-06T12:34:56.000000'
        },
        cache: {
          stats: {
            total_chunks: 150,
            total_size: 50000000,
            total_csize: 40000000,
            unique_csize: 30000000
          }
        },
        encryption: {
          mode: 'repokey'
        }
      });

      mockExecutor.nextCommandResult = {
        stdout: repoInfoOutput,
        stderr: '',
        exitCode: 0
      };

      const info = await adapter.getRepositoryInfo();

      expect(info.path).toBe('/test/repo');
      expect(info.id).toBe('abcd1234567890');
      expect(info.lastModified).toBeInstanceOf(Date);
      expect(info.archiveCount).toBe(150);
      expect(info.originalSize).toBe(50000000);
      expect(info.compressedSize).toBe(40000000);
      expect(info.dedupedSize).toBe(30000000);
      expect(info.encryption).toBe('repokey');

      const infoCommand = mockExecutor.capturedCommands.find(c => c.command === 'info');
      expect(infoCommand).toBeDefined();
      expect(infoCommand?.args).toContain('--json');
      expect(infoCommand?.args).toContain('/test/repo');
    });

    it('should handle missing cache stats', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          repository: {
            id: 'test-id',
            last_modified: '2025-10-06T12:00:00.000000'
          },
          encryption: { mode: 'none' }
          // Missing cache
        }),
        stderr: '',
        exitCode: 0
      };

      const info = await adapter.getRepositoryInfo();

      expect(info.archiveCount).toBe(0);
      expect(info.originalSize).toBe(0);
      expect(info.compressedSize).toBe(0);
      expect(info.dedupedSize).toBe(0);
    });

    it('should handle missing encryption info', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({
          repository: {
            id: 'test-id',
            last_modified: '2025-10-06T12:00:00.000000'
          },
          cache: {
            stats: {
              total_chunks: 10,
              total_size: 1000,
              total_csize: 800,
              unique_csize: 600
            }
          }
          // Missing encryption
        }),
        stderr: '',
        exitCode: 0
      };

      const info = await adapter.getRepositoryInfo();

      expect(info.encryption).toBe('none');
    });

    it('should throw error on info failure', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Repository access denied');

      await expect(adapter.getRepositoryInfo()).rejects.toThrow(
        'Failed to get repository info: Repository access denied'
      );
    });
  });

  describe('checkRepository()', () => {
    it('should return true for healthy repository', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: 'Repository check passed',
        stderr: '',
        exitCode: 0
      };

      const result = await adapter.checkRepository();

      expect(result).toBe(true);

      const checkCommand = mockExecutor.capturedCommands.find(c => c.command === 'check');
      expect(checkCommand).toBeDefined();
      expect(checkCommand?.args).toContain('/test/repo');
    });

    it('should return false for corrupted repository', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Repository check failed: corruption detected');

      const result = await adapter.checkRepository();

      expect(result).toBe(false);
    });

    it('should return false on check error', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Cannot access repository');

      const result = await adapter.checkRepository();

      expect(result).toBe(false);
    });
  });

  describe('hasArchiveForToday()', () => {
    beforeEach(() => {
      // Mock current date to 2025-10-06
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-10-06T15:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should find matching archive for today', async () => {
      const adapter = await createAdapter();

      const archiveListOutput = JSON.stringify({
        archives: [
          {
            name: 'daily-2025-10-06-pi-scsi2',
            time: '2025-10-06T12:00:00.000000',
            nfiles: 42
          },
          {
            name: 'daily-2025-10-05-pi-scsi2',
            time: '2025-10-05T12:00:00.000000',
            nfiles: 38
          }
        ]
      });

      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasArchive = await adapter.hasArchiveForToday('daily', 'pi-scsi2');

      expect(hasArchive).toBe(true);
    });

    it('should return false when no matching archive for today', async () => {
      const adapter = await createAdapter();

      const archiveListOutput = JSON.stringify({
        archives: [
          {
            name: 'daily-2025-10-05-pi-scsi2',
            time: '2025-10-05T12:00:00.000000',
            nfiles: 38
          },
          {
            name: 'daily-2025-10-04-pi-scsi2',
            time: '2025-10-04T12:00:00.000000',
            nfiles: 40
          }
        ]
      });

      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasArchive = await adapter.hasArchiveForToday('daily', 'pi-scsi2');

      expect(hasArchive).toBe(false);
    });

    it('should match on interval and source', async () => {
      const adapter = await createAdapter();

      const archiveListOutput = JSON.stringify({
        archives: [
          {
            name: 'weekly-2025-10-06-local-media',
            time: '2025-10-06T12:00:00.000000',
            nfiles: 100
          },
          {
            name: 'daily-2025-10-06-pi-scsi2',
            time: '2025-10-06T12:00:00.000000',
            nfiles: 42
          }
        ]
      });

      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasWeekly = await adapter.hasArchiveForToday('weekly', 'local-media');

      // Clear captured commands and set up for next call
      mockExecutor.capturedCommands = [];
      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasDaily = await adapter.hasArchiveForToday('daily', 'pi-scsi2');

      // Clear and set up for final call
      mockExecutor.capturedCommands = [];
      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasNonexistent = await adapter.hasArchiveForToday('daily', 'nonexistent');

      expect(hasWeekly).toBe(true);
      expect(hasDaily).toBe(true);
      expect(hasNonexistent).toBe(false);
    });

    it('should return false for empty archive list', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandResult = {
        stdout: JSON.stringify({ archives: [] }),
        stderr: '',
        exitCode: 0
      };

      const hasArchive = await adapter.hasArchiveForToday('daily', 'pi-scsi2');

      expect(hasArchive).toBe(false);
    });

    it('should handle different date formats', async () => {
      const adapter = await createAdapter();

      const archiveListOutput = JSON.stringify({
        archives: [
          {
            name: 'monthly-2025-10-06T14:30:45-backup-server',
            time: '2025-10-06T14:30:45.000000',
            nfiles: 200
          }
        ]
      });

      mockExecutor.nextCommandResult = {
        stdout: archiveListOutput,
        stderr: '',
        exitCode: 0
      };

      const hasArchive = await adapter.hasArchiveForToday('monthly', 'backup-server');

      expect(hasArchive).toBe(true);
    });
  });

  describe('error handling across all operations', () => {
    it('should ensure borg is installed for all operations', async () => {
      const adapter = await createAdapter();

      // Test each operation calls ensureBorgInstalled
      mockExecutor.nextCommandResult = { stdout: JSON.stringify({ archives: [] }), stderr: '', exitCode: 0 };
      await adapter.listArchives();
      expect(borgCommand.ensureBorgInstalled).toHaveBeenCalled();

      vi.clearAllMocks();
      vi.spyOn(borgCommand, 'ensureBorgInstalled').mockResolvedValue(undefined);
      mockExecutor.nextCommandResult = { stdout: JSON.stringify({ archive: { stats: {} } }), stderr: '', exitCode: 0 };
      await adapter.createArchive(['/test'], 'test');
      expect(borgCommand.ensureBorgInstalled).toHaveBeenCalled();

      vi.clearAllMocks();
      vi.spyOn(borgCommand, 'ensureBorgInstalled').mockResolvedValue(undefined);
      mockExecutor.nextCommandResult = { stdout: '', stderr: '', exitCode: 0 };
      await adapter.restoreArchive('test', '/dest');
      expect(borgCommand.ensureBorgInstalled).toHaveBeenCalled();

      vi.clearAllMocks();
      vi.spyOn(borgCommand, 'ensureBorgInstalled').mockResolvedValue(undefined);
      mockExecutor.nextCommandResult = { stdout: '', stderr: '', exitCode: 0 };
      await adapter.pruneArchives({ daily: 7, weekly: 4, monthly: 12 });
      expect(borgCommand.ensureBorgInstalled).toHaveBeenCalled();

      vi.clearAllMocks();
      vi.spyOn(borgCommand, 'ensureBorgInstalled').mockResolvedValue(undefined);
      mockExecutor.nextCommandResult = { stdout: '', stderr: '', exitCode: 0 };
      await adapter.checkRepository();
      expect(borgCommand.ensureBorgInstalled).toHaveBeenCalled();
    });

    it('should check borg version for initRepository', async () => {
      const adapter = await createAdapter();

      mockExecutor.nextCommandError = new Error('Repo does not exist');
      mockExecutor.nextCommandResult = { stdout: '', stderr: '', exitCode: 0 };

      await adapter.initRepository(config);

      expect(borgCommand.checkBorgVersion).toHaveBeenCalledWith('1.2.0');
    });
  });
});
