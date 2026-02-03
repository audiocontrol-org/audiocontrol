import type { BackupSource, AudioToolsConfig } from '@audiocontrol/audiotools-config';
import { DeviceMatcher } from './device-matcher.js';
import type { DeviceMatchResult } from './device-matcher.js';

export interface ResolutionResult {
  source: BackupSource;
  action: 'registered' | 'recognized' | 'updated' | 'no-change';
  message: string;
}

/**
 * Orchestrates device UUID registration and recognition workflows
 *
 * This service provides the main entry point for device identity tracking.
 * It handles the complete workflow from device detection through config updates.
 *
 * Workflows:
 * 1. First-time registration: Detects and stores UUID for new devices
 * 2. Recognition: Matches devices by UUID and updates lastSeen
 * 3. Conflict resolution: Detects and reports UUID conflicts
 * 4. Mismatch detection: Warns when expected vs actual device differs
 */
export class DeviceResolver {
  private readonly matcher: DeviceMatcher;

  constructor(matcher?: DeviceMatcher) {
    this.matcher = matcher ?? new DeviceMatcher();
  }

  /**
   * Resolves a mount path to a backup source, registering or recognizing as needed
   *
   * This is the main entry point for device UUID tracking. It:
   * 1. Tries to match by UUID/serial to existing sources
   * 2. If matched, updates lastSeen timestamp
   * 3. If not matched and source doesn't have UUID, registers device
   * 4. Handles conflicts by throwing descriptive errors
   *
   * @param mountPath - Path where device is mounted
   * @param sourceName - Name of the backup source in config
   * @param config - Full audio-tools configuration
   * @returns Resolution result with updated source and action taken
   */
  async resolveDevice(
    mountPath: string,
    sourceName: string,
    config: AudioToolsConfig
  ): Promise<ResolutionResult> {
    const sources = config.backup?.sources || [];
    const source = sources.find((s: BackupSource) => s.name === sourceName);

    if (!source) {
      throw new Error(`Backup source not found: ${sourceName}`);
    }

    // Try to match device by UUID
    const matchResult = await this.matcher.matchDevice(mountPath, sources);

    // Handle conflicts
    if (matchResult.reason === 'conflict') {
      const sourceNames = matchResult.conflictingSources?.map((s: BackupSource) => s.name).join(', ');
      throw new Error(
        `Device UUID conflict: Device at ${mountPath} matches multiple sources: ${sourceNames}. ` +
        `Please check your configuration.`
      );
    }

    // Device matched to a different source
    if (matchResult.matched && matchResult.source && matchResult.source.name !== sourceName) {
      throw new Error(
        `Device mismatch: Device at ${mountPath} is registered as '${matchResult.source.name}', ` +
        `but you're trying to back it up as '${sourceName}'. ` +
        `Use the correct source name or update your configuration.`
      );
    }

    // Device matched to this source - update lastSeen
    if (matchResult.matched && matchResult.source?.name === sourceName) {
      const updatedSource = this.matcher.updateLastSeen(source);
      return {
        source: updatedSource,
        action: 'recognized',
        message: `Recognized device '${source.name}' at ${mountPath} (UUID: ${matchResult.deviceInfo.volumeUUID || matchResult.deviceInfo.volumeSerial})`
      };
    }

    // Device not matched and source doesn't have UUID - register it
    if (!matchResult.matched && !this.matcher.hasDeviceInfo(source)) {
      const registeredSource = this.matcher.registerDevice(source, matchResult.deviceInfo);
      return {
        source: registeredSource,
        action: 'registered',
        message: `Registered new device '${source.name}' at ${mountPath} (UUID: ${matchResult.deviceInfo.volumeUUID || matchResult.deviceInfo.volumeSerial})`
      };
    }

    // Source has UUID but device doesn't match - potential issue
    if (!matchResult.matched && this.matcher.hasDeviceInfo(source)) {
      throw new Error(
        `Device mismatch: Source '${sourceName}' expects UUID ${source.volumeUUID || source.volumeSerial}, ` +
        `but device at ${mountPath} has UUID ${matchResult.deviceInfo.volumeUUID || matchResult.deviceInfo.volumeSerial}. ` +
        `This may be a different physical device. Check your configuration.`
      );
    }

    // No changes needed
    return {
      source,
      action: 'no-change',
      message: `No device UUID changes for '${source.name}'`
    };
  }
}
