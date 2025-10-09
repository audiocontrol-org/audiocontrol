import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceDetectorInterface, DeviceInfo } from '@/types.js';

const execAsync = promisify(exec);

/**
 * macOS device detector using diskutil
 *
 * This detector uses the diskutil command-line tool to extract device information
 * including volume UUID, label, device path, and filesystem type.
 */
export class MacOSDetector implements DeviceDetectorInterface {
  /**
   * Detect device information for a mount path on macOS
   * @param mountPath - The path where the device is mounted
   * @returns Device information extracted from diskutil
   * @throws Error if platform is not macOS or device cannot be detected
   */
  async detectDevice(mountPath: string): Promise<DeviceInfo> {
    if (!this.isSupported()) {
      throw new Error('MacOSDetector only works on macOS');
    }

    try {
      // Run diskutil info on the mount path
      const { stdout } = await execAsync(`diskutil info "${mountPath}"`);

      return this.parseDiskutilOutput(stdout, mountPath);
    } catch (error: any) {
      throw new Error(`Failed to detect device at ${mountPath}: ${error.message}`);
    }
  }

  /**
   * Parse diskutil info output and extract device information
   * @param output - Raw output from diskutil info command
   * @param mountPath - Original mount path for reference
   * @returns Structured device information
   */
  private parseDiskutilOutput(output: string, mountPath: string): DeviceInfo {
    const lines = output.split('\n');
    const info: DeviceInfo = { mountPath };

    for (const line of lines) {
      const trimmed = line.trim();

      // Volume UUID: 12345678-1234-1234-1234-123456789012
      if (trimmed.startsWith('Volume UUID:')) {
        const uuid = trimmed.split(':')[1]?.trim();
        if (uuid && uuid !== 'No Volume UUID') {
          info.volumeUUID = uuid;
        }
      }

      // Volume Name: SDCARD
      if (trimmed.startsWith('Volume Name:')) {
        const name = trimmed.split(':')[1]?.trim();
        if (name && name !== 'Not applicable') {
          info.volumeLabel = name;
        }
      }

      // Device Node: /dev/disk2s1
      if (trimmed.startsWith('Device Node:')) {
        const device = trimmed.split(':')[1]?.trim();
        if (device) {
          info.devicePath = device;
        }
      }

      // File System Personality: FAT32
      if (trimmed.startsWith('File System Personality:')) {
        const fs = trimmed.split(':')[1]?.trim();
        if (fs) {
          info.filesystem = fs;
        }
      }
    }

    return info;
  }

  /**
   * Check if macOS platform is supported
   * @returns true if running on darwin platform
   */
  isSupported(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Get the platform identifier
   * @returns 'darwin' platform constant
   */
  getPlatform() {
    return 'darwin' as const;
  }
}
