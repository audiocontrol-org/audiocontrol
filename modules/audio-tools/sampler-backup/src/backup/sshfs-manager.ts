/**
 * SSHFS Manager - Mount/unmount remote directories via SSHFS
 *
 * Provides interface for mounting remote directories over SSH using SSHFS,
 * enabling Borg to back up remote files with full incremental efficiency.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'pathe';
import { tmpdir } from 'os';

export interface SSHFSMountConfig {
  /** SSH host (user@hostname or just hostname) */
  host: string;

  /** Remote path to mount */
  remotePath: string;

  /** Local mount point (auto-generated if not provided) */
  mountPoint?: string;

  /** SSH port */
  port?: number;

  /** SSH identity file (private key path) */
  identityFile?: string;

  /** Additional SSHFS options */
  options?: string[];
}

export interface MountInfo {
  /** SSH host */
  host: string;

  /** Remote path */
  remotePath: string;

  /** Local mount point */
  mountPoint: string;

  /** Mount timestamp */
  mountedAt: Date;
}

/**
 * SSHFSManager - Manage SSHFS mounts for remote directory access
 */
export class SSHFSManager {
  private mounts: Map<string, MountInfo> = new Map();

  /**
   * Mount remote directory via SSHFS
   *
   * @param config Mount configuration
   * @returns Local mount point path
   */
  async mount(config: SSHFSMountConfig): Promise<string> {
    // Generate mount point if not provided
    const mountPoint = config.mountPoint ?? await this.createMountPoint(config.host);

    // Check if already mounted
    if (await this.isMounted(mountPoint)) {
      console.log(`Already mounted: ${mountPoint}`);
      return mountPoint;
    }

    // Ensure mount point exists
    await fs.mkdir(mountPoint, { recursive: true });

    // Build sshfs command
    const args = [
      `${config.host}:${config.remotePath}`,
      mountPoint,
    ];

    // Add SSH options
    if (config.port) {
      args.push('-p', config.port.toString());
    }
    if (config.identityFile) {
      args.push('-o', `IdentityFile=${config.identityFile}`);
    }

    // Add custom options
    if (config.options) {
      args.push(...config.options.flatMap(opt => ['-o', opt]));
    }

    // Default options for better performance and reliability
    args.push(
      '-o', 'auto_cache',              // Enable caching
      '-o', 'cache_timeout=300',       // Cache for 5 minutes
      '-o', 'Compression=yes',         // Enable SSH compression
      '-o', 'reconnect',               // Auto-reconnect on disconnect
      '-o', 'ServerAliveInterval=15',  // Keep connection alive
      '-o', 'ServerAliveCountMax=3'    // Retry count
    );

    try {
      await this.executeCommand('sshfs', args);

      // Verify mount successful
      if (!await this.isMounted(mountPoint)) {
        throw new Error('Mount reported success but directory not accessible');
      }

      // Track mount
      this.mounts.set(mountPoint, {
        host: config.host,
        remotePath: config.remotePath,
        mountPoint,
        mountedAt: new Date(),
      });

      console.log(`✓ Mounted ${config.host}:${config.remotePath} at ${mountPoint}`);
      return mountPoint;
    } catch (error: any) {
      throw new Error(`Failed to mount ${config.host}:${config.remotePath}: ${error.message}`);
    }
  }

  /**
   * Unmount directory
   *
   * @param mountPoint Path to unmount
   */
  async unmount(mountPoint: string): Promise<void> {
    if (!await this.isMounted(mountPoint)) {
      console.log(`Not mounted: ${mountPoint}`);
      return;
    }

    // Determine unmount command based on platform
    const unmountCmd = process.platform === 'darwin' ? 'umount' : 'fusermount';
    const unmountArgs = process.platform === 'darwin'
      ? [mountPoint]
      : ['-u', mountPoint];

    try {
      await this.executeCommand(unmountCmd, unmountArgs);

      // Remove from tracking
      this.mounts.delete(mountPoint);

      console.log(`✓ Unmounted ${mountPoint}`);
    } catch (error: any) {
      // Try force unmount
      console.warn('Normal unmount failed, trying force unmount...');
      try {
        const forceArgs = process.platform === 'darwin'
          ? ['-f', mountPoint]
          : ['-uz', mountPoint];

        await this.executeCommand(unmountCmd, forceArgs);
        this.mounts.delete(mountPoint);
        console.log(`✓ Force unmounted ${mountPoint}`);
      } catch (forceError: any) {
        throw new Error(
          `Failed to unmount ${mountPoint}: ${error.message}. ` +
          `Manual cleanup may be required: ${unmountCmd} ${unmountArgs.join(' ')}`
        );
      }
    }
  }

  /**
   * Check if path is mounted
   *
   * @param mountPoint Path to check
   * @returns True if mounted
   */
  async isMounted(mountPoint: string): Promise<boolean> {
    try {
      // Check mount table on all platforms
      const { stdout } = await this.executeCommandWithOutput('mount', []);
      return stdout.includes(mountPoint);
    } catch {
      return false;
    }
  }

  /**
   * Unmount all tracked mounts
   */
  async unmountAll(): Promise<void> {
    const mountPoints = Array.from(this.mounts.keys());

    for (const mountPoint of mountPoints) {
      try {
        await this.unmount(mountPoint);
      } catch (error: any) {
        console.error(`Failed to unmount ${mountPoint}: ${error.message}`);
      }
    }
  }

  /**
   * Get list of active mounts
   *
   * @returns Array of mount information
   */
  getMounts(): MountInfo[] {
    return Array.from(this.mounts.values());
  }

  /**
   * Create temporary mount point directory
   *
   * @param host SSH host for naming
   * @returns Mount point path
   */
  private async createMountPoint(host: string): Promise<string> {
    // Sanitize host for directory name
    const baseName = host.replace(/[^a-z0-9]/gi, '-');
    const mountPoint = join(tmpdir(), 'akai-backup', baseName);

    await fs.mkdir(mountPoint, { recursive: true });

    return mountPoint;
  }

  /**
   * Execute command and wait for completion
   *
   * @param command Command to execute
   * @param args Command arguments
   * @returns Promise that resolves when command completes
   */
  private executeCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} failed with exit code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Execute command and return stdout
   *
   * @param command Command to execute
   * @param args Command arguments
   * @returns Promise that resolves with stdout
   */
  private executeCommandWithOutput(command: string, args: string[]): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout });
        } else {
          reject(new Error(`${command} failed with exit code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }
}
