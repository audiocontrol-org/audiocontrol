/**
 * Borg command execution utilities
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { BorgCommandResult, BorgProgress } from '@/lib/types/borg.js';

/**
 * Execute a borg command and return result
 *
 * @param command Borg subcommand (create, list, etc.)
 * @param args Command arguments
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to command result
 * @throws Error if command fails
 */
export async function executeBorgCommand(
  command: string,
  args: string[],
  onProgress?: (line: string) => void
): Promise<BorgCommandResult> {
  return new Promise((resolve, reject) => {
    const borg = spawn('borg', [command, ...args]);

    let stdout = '';
    let stderr = '';

    borg.stdout.on('data', (data) => {
      const line = data.toString();
      stdout += line;
      if (onProgress) {
        onProgress(line);
      }
    });

    borg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    borg.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
      } else {
        reject(new Error(
          `borg ${command} failed with exit code ${exitCode}: ${stderr}`
        ));
      }
    });

    borg.on('error', (error) => {
      reject(new Error(`Failed to spawn borg: ${error.message}`));
    });
  });
}

/**
 * Parse borg progress output into structured format
 *
 * Borg outputs progress in JSON format when using --progress --json flags
 *
 * @param line Output line from borg
 * @returns Parsed progress information, or null if not a progress line
 */
export function parseProgress(line: string): BorgProgress | null {
  try {
    const data = JSON.parse(line);
    if (data.type === 'archive_progress') {
      return {
        operation: 'Creating archive',
        bytesProcessed: data.original_size || 0,
        totalBytes: data.original_size || 0,
        filesProcessed: data.nfiles || 0,
        totalFiles: data.nfiles || 0,
        compressionRatio: data.compressed_size && data.original_size
          ? data.compressed_size / data.original_size
          : undefined,
        dedupRatio: data.deduplicated_size && data.original_size
          ? data.deduplicated_size / data.original_size
          : undefined
      };
    }
  } catch {
    // Not JSON, ignore
  }
  return null;
}

/**
 * Check if Borg is installed and available
 *
 * @returns Promise resolving to true if borg is available
 * @throws Error with installation instructions if borg is not found
 */
export async function ensureBorgInstalled(): Promise<void> {
  try {
    await executeBorgCommand('--version', []);
  } catch (error: any) {
    if (error.message.includes('spawn borg')) {
      throw new Error(
        'BorgBackup is not installed. Install it with:\n' +
        '  macOS: brew install borgbackup\n' +
        '  Linux: sudo apt install borgbackup\n' +
        'See: https://borgbackup.readthedocs.io/en/stable/installation.html'
      );
    }
    throw error;
  }
}

/**
 * Get installed Borg version
 *
 * @returns Borg version string (e.g., "1.2.4")
 */
export async function getBorgVersion(): Promise<string> {
  const { stdout } = await executeBorgCommand('--version', []);
  // Output: "borg 1.2.4"
  const match = stdout.match(/borg (\d+\.\d+\.\d+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Check if Borg version meets minimum requirement
 *
 * @param minVersion Minimum required version (e.g., "1.2.0")
 * @throws Error if version is too old
 */
export async function checkBorgVersion(minVersion: string = '1.2.0'): Promise<void> {
  const version = await getBorgVersion();
  const [major, minor] = version.split('.').map(Number);
  const [minMajor, minMinor] = minVersion.split('.').map(Number);

  if (major < minMajor || (major === minMajor && minor < minMinor)) {
    throw new Error(
      `Borg version ${version} is not supported. ` +
      `Please upgrade to ${minVersion} or higher: brew upgrade borgbackup`
    );
  }
}

/**
 * Expand tilde in path to home directory
 *
 * @param path Path potentially containing ~
 * @returns Expanded path
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return path.replace('~', process.env.HOME || '~');
  }
  return path;
}
