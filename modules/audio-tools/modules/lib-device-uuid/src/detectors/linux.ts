import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceDetectorInterface, DeviceInfo } from '@/types.js';

const execAsync = promisify(exec);

/**
 * Linux device detector using blkid and findmnt
 *
 * This detector uses findmnt to map mount paths to device paths,
 * and blkid to extract device UUID and filesystem information.
 */
export class LinuxDetector implements DeviceDetectorInterface {
  /**
   * Detect device information for a mount path on Linux
   * @param mountPath - The path where the device is mounted
   * @returns Device information extracted from blkid/findmnt
   * @throws Error if device cannot be detected or platform not supported
   */
  async detectDevice(mountPath: string): Promise<DeviceInfo> {
    if (!this.isSupported()) {
      throw new Error('LinuxDetector only works on Linux');
    }

    try {
      // First, use findmnt to get device path from mount point
      const devicePath = await this.getDevicePath(mountPath);

      // Then use blkid to get device UUID and other info
      const deviceInfo = await this.getDeviceInfo(devicePath);

      return {
        mountPath,
        devicePath,
        ...deviceInfo,
      };
    } catch (error: any) {
      throw new Error(`Failed to detect device at ${mountPath}: ${error.message}`);
    }
  }

  /**
   * Get device path from mount path using findmnt
   * @param mountPath - The mount path to resolve
   * @returns Device path (e.g., /dev/sdb1)
   * @throws Error if mount path not found
   */
  private async getDevicePath(mountPath: string): Promise<string> {
    try {
      // findmnt -n -o SOURCE /mount/path
      // -n: no header
      // -o SOURCE: output only device path
      const { stdout } = await execAsync(`findmnt -n -o SOURCE "${mountPath}"`);
      const devicePath = stdout.trim();

      if (!devicePath) {
        throw new Error(`No device found at mount path: ${mountPath}`);
      }

      return devicePath;
    } catch (error: any) {
      throw new Error(`Failed to find device path: ${error.message}`);
    }
  }

  /**
   * Get device information using blkid
   * @param devicePath - The device path (e.g., /dev/sdb1)
   * @returns Partial device information
   */
  private async getDeviceInfo(devicePath: string): Promise<Partial<DeviceInfo>> {
    try {
      // blkid -o export /dev/device
      // -o export: output as KEY=VALUE pairs
      const { stdout } = await execAsync(`blkid -o export "${devicePath}"`);

      return this.parseBlkidOutput(stdout);
    } catch (error: any) {
      // blkid may fail for some devices (e.g., no UUID), that's OK
      // Return partial info with what we have
      return {};
    }
  }

  /**
   * Parse blkid export format output
   * @param output - The output from blkid -o export
   * @returns Parsed device information
   */
  private parseBlkidOutput(output: string): Partial<DeviceInfo> {
    const lines = output.split('\n');
    const info: Partial<DeviceInfo> = {};

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || !trimmed.includes('=')) {
        continue;
      }

      const [key, value] = trimmed.split('=', 2);

      // UUID=12345678-1234-1234-1234-123456789012
      if (key === 'UUID') {
        info.volumeUUID = value;
      }

      // LABEL=SDCARD
      if (key === 'LABEL') {
        info.volumeLabel = value;
      }

      // TYPE=vfat (filesystem type)
      if (key === 'TYPE') {
        info.filesystem = value;
      }

      // PARTUUID=12345678-02 (partition UUID, fallback if no volume UUID)
      if (key === 'PARTUUID' && !info.volumeUUID) {
        info.volumeSerial = value;
      }
    }

    return info;
  }

  /**
   * Check if Linux platform is supported
   * @returns true if running on linux platform
   */
  isSupported(): boolean {
    return process.platform === 'linux';
  }

  /**
   * Get the platform identifier
   * @returns 'linux' platform constant
   */
  getPlatform() {
    return 'linux' as const;
  }
}
