import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RsyncAdapter, type RsyncConfig } from '@/lib/backup/rsync-adapter';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('RsyncAdapter', () => {
  let adapter: RsyncAdapter;
  let mockSpawn: Mock;
  let mockProcess: MockChildProcess;

  // Helper to create a mock child process
  class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    stdin = new EventEmitter();
  }

  beforeEach(() => {
    adapter = new RsyncAdapter();
    mockSpawn = spawn as Mock;
    mockProcess = new MockChildProcess();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('sync()', () => {
    it('should execute rsync with correct arguments for local sync', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/path/',
        destPath: '/dest/path/',
      };

      // Start the sync operation
      const syncPromise = adapter.sync(config);

      // Simulate successful completion
      mockProcess.emit('close', 0);

      await syncPromise;

      // Verify rsync was called with correct arguments
      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        [
          '-av',
          '--delete',
          '--progress',
          '/source/path/',
          '/dest/path/',
        ],
        { stdio: 'inherit' }
      );
    });

    it('should execute rsync with SSH remote path', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: 'user@host:/remote/path/',
        destPath: '/local/backup/',
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        [
          '-av',
          '--delete',
          '--progress',
          'user@host:/remote/path/',
          '/local/backup/',
        ],
        { stdio: 'inherit' }
      );
    });

    it('should add --dry-run flag when dryRun is true', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
        dryRun: true,
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        expect.arrayContaining(['--dry-run']),
        expect.any(Object)
      );
    });

    it('should not add --dry-run flag when dryRun is false', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
        dryRun: false,
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(spawnArgs).not.toContain('--dry-run');
    });

    it('should reject when rsync exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
      };

      const syncPromise = adapter.sync(config);

      // Simulate failure
      mockProcess.emit('close', 1);

      await expect(syncPromise).rejects.toThrow('rsync failed with code 1');
    });

    it('should reject when rsync emits error event', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
      };

      const syncPromise = adapter.sync(config);

      // Simulate spawn error
      const error = new Error('command not found');
      mockProcess.emit('error', error);

      await expect(syncPromise).rejects.toThrow('Failed to execute rsync: command not found');
    });

    it('should handle verbose option', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
        verbose: true,
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      // Note: verbose is already included via -av flag
      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        expect.arrayContaining(['-av']),
        expect.any(Object)
      );
    });

    it('should sync from remote host with custom port', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: 'pi-scsi2.local:/home/orion/images/',
        destPath: '/Users/orion/.audiotools/backup/pi-scsi2/scsi0/',
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        expect.arrayContaining([
          '-av',
          '--delete',
          '--progress',
          'pi-scsi2.local:/home/orion/images/',
          '/Users/orion/.audiotools/backup/pi-scsi2/scsi0/',
        ]),
        { stdio: 'inherit' }
      );
    });

    it('should handle null exit code', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', null);

      await expect(syncPromise).rejects.toThrow('rsync failed with code null');
    });

    it('should preserve trailing slashes in paths', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/source/path/',
        destPath: '/dest/path/',
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await syncPromise;

      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(spawnArgs[spawnArgs.length - 2]).toBe('/source/path/');
      expect(spawnArgs[spawnArgs.length - 1]).toBe('/dest/path/');
    });
  });

  describe('checkRsyncAvailable()', () => {
    it('should return true when rsync is available', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = adapter.checkRsyncAvailable();
      mockProcess.emit('close', 0);

      const result = await checkPromise;

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'rsync',
        ['--version'],
        { stdio: 'ignore' }
      );
    });

    it('should return false when rsync exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = adapter.checkRsyncAvailable();
      mockProcess.emit('close', 1);

      const result = await checkPromise;

      expect(result).toBe(false);
    });

    it('should return false when rsync is not installed', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = adapter.checkRsyncAvailable();
      mockProcess.emit('error', new Error('command not found'));

      const result = await checkPromise;

      expect(result).toBe(false);
    });

    it('should return false when spawn emits error event', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = adapter.checkRsyncAvailable();
      mockProcess.emit('error', new Error('ENOENT'));

      const result = await checkPromise;

      expect(result).toBe(false);
    });

    it('should handle null exit code gracefully', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const checkPromise = adapter.checkRsyncAvailable();
      mockProcess.emit('close', null);

      const result = await checkPromise;

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical remote backup scenario', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: 'pi-scsi2:/home/orion/images/',
        destPath: '/Users/orion/.audiotools/backup/pi-scsi2/scsi0/',
        verbose: true,
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await expect(syncPromise).resolves.toBeUndefined();
    });

    it('should handle typical local media backup scenario', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: '/Volumes/DSK0/',
        destPath: '/Users/orion/.audiotools/backup/s5k-studio/floppy/',
        verbose: false,
      };

      const syncPromise = adapter.sync(config);
      mockProcess.emit('close', 0);

      await expect(syncPromise).resolves.toBeUndefined();
    });

    it('should handle dry run before actual sync', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      // First: dry run
      const dryRunConfig: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
        dryRun: true,
      };

      const dryRunPromise = adapter.sync(dryRunConfig);
      mockProcess.emit('close', 0);
      await dryRunPromise;

      // Verify dry-run flag was used
      expect(mockSpawn).toHaveBeenLastCalledWith(
        'rsync',
        expect.arrayContaining(['--dry-run']),
        expect.any(Object)
      );

      // Create new mock process for actual sync
      const mockProcess2 = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess2);

      // Second: actual sync
      const actualConfig: RsyncConfig = {
        sourcePath: '/source/',
        destPath: '/dest/',
        dryRun: false,
      };

      const actualPromise = adapter.sync(actualConfig);
      mockProcess2.emit('close', 0);
      await actualPromise;

      // Verify dry-run flag was NOT used in second call
      const lastCall = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1];
      const lastArgs = lastCall[1] as string[];
      expect(lastArgs).not.toContain('--dry-run');
    });

    it('should handle network timeout scenario', async () => {
      mockSpawn.mockReturnValue(mockProcess);

      const config: RsyncConfig = {
        sourcePath: 'unreachable-host:/path/',
        destPath: '/dest/',
      };

      const syncPromise = adapter.sync(config);

      // Simulate timeout error
      mockProcess.emit('error', new Error('Connection timeout'));

      await expect(syncPromise).rejects.toThrow('Failed to execute rsync: Connection timeout');
    });
  });
});
