import { createDeviceDetector } from '@oletizi/lib-device-uuid';
import type { DeviceDetectorInterface, DeviceInfo } from '@oletizi/lib-device-uuid';
import type { BackupSource } from '@oletizi/audiotools-config';

export interface DeviceMatchResult {
  matched: boolean;
  source?: BackupSource;
  deviceInfo: DeviceInfo;
  reason?: 'uuid' | 'serial' | 'not-found' | 'conflict';
  conflictingSources?: BackupSource[];
}

/**
 * Service for matching detected devices to configured backup sources using UUIDs
 *
 * This service bridges lib-device-uuid (platform-specific detection) with
 * audiotools-config (backup source configuration) to provide device identity
 * tracking across backup sessions.
 *
 * Matching strategy:
 * 1. UUID match (most reliable, works for ext4, HFS+, APFS, NTFS)
 * 2. Serial match (fallback for FAT32 which lacks persistent UUIDs)
 * 3. Conflict detection (same UUID/serial on multiple sources)
 */
export class DeviceMatcher {
  private readonly detector: DeviceDetectorInterface;

  constructor(detector?: DeviceDetectorInterface) {
    this.detector = detector ?? createDeviceDetector();
  }

  /**
   * Attempts to match a mount path to an existing backup source by UUID
   *
   * @param mountPath - Path where device is mounted
   * @param sources - Array of configured backup sources
   * @returns Match result with device info and matched source (if any)
   */
  async matchDevice(
    mountPath: string,
    sources: BackupSource[]
  ): Promise<DeviceMatchResult> {
    // Detect device at mount path
    const deviceInfo = await this.detector.detectDevice(mountPath);

    // Try UUID match first (most reliable)
    if (deviceInfo.volumeUUID) {
      const uuidMatches = sources.filter(s => s.volumeUUID === deviceInfo.volumeUUID);

      if (uuidMatches.length === 1) {
        return {
          matched: true,
          source: uuidMatches[0],
          deviceInfo,
          reason: 'uuid'
        };
      }

      if (uuidMatches.length > 1) {
        return {
          matched: false,
          deviceInfo,
          reason: 'conflict',
          conflictingSources: uuidMatches
        };
      }
    }

    // Try serial match (fallback for FAT32 without UUID)
    if (deviceInfo.volumeSerial) {
      const serialMatches = sources.filter(s =>
        s.volumeSerial === deviceInfo.volumeSerial && !s.volumeUUID
      );

      if (serialMatches.length === 1) {
        return {
          matched: true,
          source: serialMatches[0],
          deviceInfo,
          reason: 'serial'
        };
      }

      if (serialMatches.length > 1) {
        return {
          matched: false,
          deviceInfo,
          reason: 'conflict',
          conflictingSources: serialMatches
        };
      }
    }

    // No match found
    return {
      matched: false,
      deviceInfo,
      reason: 'not-found'
    };
  }

  /**
   * Registers a new device by populating UUID fields in a backup source
   *
   * @param source - Backup source to register
   * @param deviceInfo - Device information from detection
   * @returns Updated backup source with UUID fields populated
   */
  registerDevice(source: BackupSource, deviceInfo: DeviceInfo): BackupSource {
    const now = new Date().toISOString();

    return {
      ...source,
      volumeUUID: deviceInfo.volumeUUID,
      volumeLabel: deviceInfo.volumeLabel,
      volumeSerial: deviceInfo.volumeSerial,
      lastSeen: now,
      registeredAt: source.registeredAt || now  // Preserve original if exists
    };
  }

  /**
   * Updates lastSeen timestamp for a recognized device
   *
   * @param source - Backup source to update
   * @returns Updated backup source with current lastSeen
   */
  updateLastSeen(source: BackupSource): BackupSource {
    return {
      ...source,
      lastSeen: new Date().toISOString()
    };
  }

  /**
   * Checks if a backup source has device UUID information
   *
   * @param source - Backup source to check
   * @returns true if source has UUID or serial
   */
  hasDeviceInfo(source: BackupSource): boolean {
    return !!(source.volumeUUID || source.volumeSerial);
  }
}
