/**
 * Remote Borg command executor
 *
 * Executes Borg commands on remote hosts via SSH
 */

import { spawn } from 'child_process';
import type { BorgArchive, BorgRetentionPolicy, BorgProgress } from '@/types/borg.js';

export interface RemoteBorgConfig {
  /** SSH host (e.g., "pi@pi-scsi2.local") */
  sshHost: string;
  /** Remote repository path (e.g., "/home/pi/.audiotools/borg-repo") */
  repoPath: string;
  /** Compression algorithm */
  compression?: string;
  /** Encryption mode */
  encryption?: string;
}

/**
 * Execute a borg command on remote host via SSH
 */
async function executeRemoteBorgCommand(
  sshHost: string,
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // Use full path to Homebrew-installed borg on Raspberry Pi
    const borgPath = '/home/linuxbrew/.linuxbrew/bin/borg';

    // Build the full borg command with absolute path
    const borgCommand = [borgPath, command, ...args].join(' ');

    // Execute via SSH
    const ssh = spawn('ssh', [sshHost, borgCommand]);

    let stdout = '';
    let stderr = '';

    ssh.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ssh.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ssh.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
      } else {
        reject(new Error(
          `Remote borg ${command} failed with exit code ${exitCode}: ${stderr}`
        ));
      }
    });

    ssh.on('error', (error) => {
      reject(new Error(`Failed to execute SSH command: ${error.message}`));
    });
  });
}

/**
 * Initialize Borg repository on remote host
 */
export async function initRemoteRepository(config: RemoteBorgConfig): Promise<void> {
  const args = [
    '--encryption', config.encryption || 'none',
    '--make-parent-dirs',
    config.repoPath
  ];

  try {
    // Check if repository exists first
    await executeRemoteBorgCommand(config.sshHost, 'info', [config.repoPath]);
    console.log('Remote repository already exists, skipping initialization');
    return;
  } catch {
    // Repository doesn't exist, create it
  }

  try {
    await executeRemoteBorgCommand(config.sshHost, 'init', args);
    console.log(`✓ Initialized remote Borg repository: ${config.sshHost}:${config.repoPath}`);
  } catch (error: any) {
    throw new Error(`Failed to initialize remote repository: ${error.message}`);
  }
}

/**
 * Create backup archive on remote host
 */
export async function createRemoteArchive(
  config: RemoteBorgConfig,
  archiveName: string,
  sourcePath: string,
  onProgress?: (progress: BorgProgress) => void
): Promise<BorgArchive> {
  const args = [
    '--stats',
    '--json',
    '--progress',
    '--compression', config.compression || 'zstd',
    `${config.repoPath}::${archiveName}`,
    sourcePath
  ];

  try {
    const { stdout } = await executeRemoteBorgCommand(config.sshHost, 'create', args);

    // Parse stats from JSON output
    const lines = stdout.split('\n').filter(line => line.trim().startsWith('{'));
    const stats = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : {};

    return {
      name: archiveName,
      timestamp: new Date(),
      stats: {
        originalSize: stats.archive?.stats?.original_size || 0,
        compressedSize: stats.archive?.stats?.compressed_size || 0,
        dedupedSize: stats.archive?.stats?.deduplicated_size || 0,
        nfiles: stats.archive?.stats?.nfiles || 0
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to create remote archive: ${error.message}`);
  }
}

/**
 * List archives in remote repository
 */
export async function listRemoteArchives(config: RemoteBorgConfig): Promise<BorgArchive[]> {
  const args = [
    '--json',
    config.repoPath
  ];

  try {
    const { stdout } = await executeRemoteBorgCommand(config.sshHost, 'list', args);
    const data = JSON.parse(stdout);

    return (data.archives || []).map((archive: any) => ({
      name: archive.name,
      timestamp: new Date(archive.time),
      stats: {
        originalSize: 0,
        compressedSize: 0,
        dedupedSize: 0,
        nfiles: archive.nfiles || 0
      }
    }));
  } catch (error: any) {
    throw new Error(`Failed to list remote archives: ${error.message}`);
  }
}

/**
 * Prune old archives on remote host
 */
export async function pruneRemoteArchives(
  config: RemoteBorgConfig,
  policy: BorgRetentionPolicy
): Promise<void> {
  const args = [
    '--stats',
    '--list',
    `--keep-daily=${policy.daily}`,
    `--keep-weekly=${policy.weekly}`,
    `--keep-monthly=${policy.monthly}`,
    config.repoPath
  ];

  try {
    await executeRemoteBorgCommand(config.sshHost, 'prune', args);
  } catch (error: any) {
    throw new Error(`Failed to prune remote archives: ${error.message}`);
  }
}

/**
 * Check if archive exists for today
 */
export async function hasRemoteArchiveForToday(
  config: RemoteBorgConfig,
  interval: string,
  source: string
): Promise<boolean> {
  const archives = await listRemoteArchives(config);

  const today = new Date().toISOString().split('T')[0];
  const prefix = `${interval}-${today}`;

  return archives.some(archive =>
    archive.name.startsWith(prefix) &&
    archive.name.includes(source)
  );
}
