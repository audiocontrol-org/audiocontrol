/**
 * SSHFS availability checker
 *
 * Verifies SSHFS is installed and available on the system.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if SSHFS is installed and available
 *
 * @returns True if SSHFS is available
 */
export async function checkSSHFSInstalled(): Promise<boolean> {
  try {
    await execAsync('which sshfs');
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure SSHFS is installed, throw error with installation instructions if not
 *
 * @throws Error with installation instructions if SSHFS not found
 */
export async function ensureSSHFSInstalled(): Promise<void> {
  if (!await checkSSHFSInstalled()) {
    const platform = process.platform;
    let instructions = 'SSHFS not installed. Please install:\n';

    if (platform === 'darwin') {
      instructions += '  macOS:\n';
      instructions += '    1. Download and install macFUSE from: https://macfuse.github.io/\n';
      instructions += '    2. Allow macFUSE in System Preferences → Privacy & Security\n';
      instructions += '    3. Restart your Mac\n';
      instructions += '    4. Install SSHFS: brew install sshfs';
    } else if (platform === 'linux') {
      instructions += '  Linux: sudo apt install sshfs  (Debian/Ubuntu)\n';
      instructions += '         sudo yum install fuse-sshfs  (RHEL/CentOS)';
    } else {
      instructions += `  Platform ${platform}: Please install SSHFS manually`;
    }

    throw new Error(instructions);
  }
}

/**
 * Get SSHFS version information
 *
 * @returns Version string or null if not available
 */
export async function getSSHFSVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('sshfs --version');
    return stdout.trim();
  } catch {
    return null;
  }
}
