import type { DeviceDetectorInterface } from '@/types.js';
import { detectPlatform } from '@/platform.js';
import { MacOSDetector } from '@/detectors/macos.js';
import { LinuxDetector } from '@/detectors/linux.js';

/**
 * Create a platform-appropriate device detector
 *
 * Factory function that returns the correct detector implementation
 * based on the current platform.
 *
 * @returns Platform-specific device detector
 * @throws Error if platform is not supported (win32, unknown)
 *
 * @example
 * ```typescript
 * const detector = createDeviceDetector();
 * const deviceInfo = await detector.detectDevice('/Volumes/MyDisk');
 * console.log(`Volume UUID: ${deviceInfo.volumeUUID}`);
 * ```
 */
export function createDeviceDetector(): DeviceDetectorInterface {
  const platform = detectPlatform();

  switch (platform) {
    case 'darwin':
      return new MacOSDetector();
    case 'linux':
      return new LinuxDetector();
    case 'win32':
      throw new Error(
        'Windows platform not yet supported for device UUID detection. ' +
        'Planned implementation will use WMI or PowerShell queries.'
      );
    default:
      throw new Error(
        `Unsupported platform: ${platform}. ` +
        'Device UUID detection is only supported on macOS (darwin) and Linux.'
      );
  }
}
