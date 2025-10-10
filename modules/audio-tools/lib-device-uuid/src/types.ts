/**
 * Supported platforms for device detection
 */
export type Platform = 'darwin' | 'linux' | 'win32' | 'unknown';

/**
 * Device information extracted from platform-specific tools
 */
export interface DeviceInfo {
  /** Volume UUID (macOS) or filesystem UUID (Linux) */
  volumeUUID?: string;
  /** Volume label/name */
  volumeLabel?: string;
  /** Volume serial number (alternative to UUID on some systems) */
  volumeSerial?: string;
  /** Current mount path */
  mountPath: string;
  /** Device path (e.g., /dev/disk2s1, /dev/sdb1) */
  devicePath?: string;
  /** Filesystem type (e.g., exfat, vfat, hfs+) */
  filesystem?: string;
}

/**
 * Platform-specific device detector interface
 */
export interface DeviceDetectorInterface {
  /**
   * Detect device information for a given mount path
   * @param mountPath - The path where the device is mounted
   * @returns Device information including UUID and metadata
   * @throws Error if device cannot be detected or platform not supported
   */
  detectDevice(mountPath: string): Promise<DeviceInfo>;

  /**
   * Check if this detector is supported on the current platform
   * @returns true if the current platform is supported
   */
  isSupported(): boolean;

  /**
   * Get the platform this detector supports
   * @returns Platform identifier
   */
  getPlatform(): Platform;
}
