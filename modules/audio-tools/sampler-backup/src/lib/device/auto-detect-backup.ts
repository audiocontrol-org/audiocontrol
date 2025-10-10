/**
 * Auto-detect backup integration service.
 *
 * Integrates device detection, smart defaults, and interactive prompts
 * to create a seamless auto-detect backup flow. This is the Phase 2
 * implementation that connects all the auto-detect components.
 *
 * Flow:
 * 1. Detect device info (UUID, label, filesystem)
 * 2. Infer device type from filesystem if not provided
 * 3. Prompt for missing device type if needed
 * 4. Prompt for sampler if needed
 * 5. Return complete BackupSource ready to use
 *
 * @module device/auto-detect-backup
 */

import type { BackupSource, AudioToolsConfig } from '@oletizi/audiotools-config';
import type { DeviceInfo, DeviceDetectorInterface } from '@oletizi/lib-device-uuid';
import type { InteractivePromptInterface } from '@/lib/prompt/interactive-prompt.js';
import type { DeviceResolver } from '@/lib/device/device-resolver.js';

/**
 * Options for auto-detect backup operation.
 */
export interface AutoDetectOptions {
  /** Override device type inference (e.g., 'floppy', 'hard-drive') */
  deviceType?: string;
  /** Override sampler selection (e.g., 's5000', 's3000xl') */
  sampler?: string;
}

/**
 * Result of auto-detect backup operation.
 */
export interface AutoDetectResult {
  /** Complete backup source ready to use */
  source: BackupSource;
  /** Action taken: registered (new), recognized (existing), created (new without UUID) */
  action: 'registered' | 'recognized' | 'created';
  /** Detected device information */
  deviceInfo: DeviceInfo;
  /** Whether user was prompted for any information */
  wasPrompted: boolean;
}

/**
 * Interface for auto-detect backup operations.
 *
 * Defines the contract for auto-detecting and resolving backup sources
 * from mounted devices. Use this interface for dependency injection.
 */
export interface AutoDetectBackupInterface {
  /**
   * Detect device and resolve to complete backup source.
   *
   * Performs complete auto-detection workflow:
   * 1. Detects device info using lib-device-uuid
   * 2. Infers device type from filesystem if not provided
   * 3. Prompts for missing device type if needed
   * 4. Prompts for sampler if needed
   * 5. Checks if device is already registered
   * 6. Returns complete BackupSource ready to use
   *
   * @param mountPath - Path where device is mounted
   * @param config - Current audio-tools configuration
   * @param options - Optional overrides for device type and sampler
   * @returns Auto-detect result with complete source and metadata
   * @throws Error if device detection fails or user cancels
   */
  detectAndResolve(
    mountPath: string,
    config: AudioToolsConfig,
    options?: AutoDetectOptions
  ): Promise<AutoDetectResult>;
}

/**
 * Auto-detect backup service implementation.
 *
 * Integrates device detection, smart defaults, and interactive prompts
 * to create a seamless auto-detect backup flow.
 *
 * @example
 * ```typescript
 * const detector = createDeviceDetector();
 * const promptService = new InteractivePrompt();
 * const resolver = new DeviceResolver();
 * const autoDetect = new AutoDetectBackup(detector, promptService, resolver);
 *
 * // Auto-detect with full prompting
 * const result = await autoDetect.detectAndResolve('/Volumes/SDCARD', config);
 * console.log(`Action: ${result.action}, Source: ${result.source.name}`);
 *
 * // Auto-detect with overrides (skip prompts)
 * const result2 = await autoDetect.detectAndResolve(
 *   '/Volumes/SDCARD',
 *   config,
 *   { deviceType: 'floppy', sampler: 's5000' }
 * );
 * ```
 */
export class AutoDetectBackup implements AutoDetectBackupInterface {
  constructor(
    private readonly deviceDetector: DeviceDetectorInterface,
    private readonly promptService: InteractivePromptInterface,
    private readonly deviceResolver: DeviceResolver
  ) {}

  async detectAndResolve(
    mountPath: string,
    config: AudioToolsConfig,
    options: AutoDetectOptions = {}
  ): Promise<AutoDetectResult> {
    let wasPrompted = false;

    // Step 1: Detect device info (may fail gracefully)
    const deviceInfo = await this.detectDeviceInfo(mountPath);

    // Step 2: Determine device type (infer or prompt)
    let deviceType = options.deviceType;
    if (!deviceType) {
      deviceType = this.inferDeviceType(deviceInfo);
      if (!deviceType) {
        deviceType = await this.promptService.promptDeviceType();
        wasPrompted = true;
      }
    }

    // Step 3: Determine sampler (prompt if needed)
    let sampler = options.sampler;
    if (!sampler) {
      sampler = await this.determineSampler(config);
      wasPrompted = true;
    }

    // Step 4: Check if device is already registered
    const existingSource = this.findExistingSource(deviceInfo, config);
    if (existingSource) {
      return {
        source: existingSource,
        action: 'recognized',
        deviceInfo,
        wasPrompted,
      };
    }

    // Step 5: Create new backup source
    const sourceName = this.generateSourceName(sampler, deviceType, deviceInfo);
    const newSource = this.createBackupSource(
      sourceName,
      mountPath,
      deviceType,
      sampler,
      deviceInfo
    );

    // Step 6: Determine action type
    const action = this.hasDeviceIdentifiers(deviceInfo) ? 'registered' : 'created';

    return {
      source: newSource,
      action,
      deviceInfo,
      wasPrompted,
    };
  }

  /**
   * Detect device info with graceful fallback.
   * Returns partial info if detection fails.
   */
  private async detectDeviceInfo(mountPath: string): Promise<DeviceInfo> {
    try {
      return await this.deviceDetector.detectDevice(mountPath);
    } catch (error: any) {
      // Graceful fallback: return minimal info
      return {
        mountPath,
        volumeLabel: this.extractVolumeNameFromPath(mountPath),
      };
    }
  }

  /**
   * Infer device type from filesystem type.
   *
   * Logic:
   * - FAT12/FAT16 → 'floppy' (typical for floppy disks)
   * - FAT32 → 'hard-drive' (typical for SD cards, USB drives)
   * - ISO9660/CDFS → 'cd-rom'
   * - exFAT, NTFS → 'hard-drive'
   * - Unknown → undefined (will prompt)
   */
  private inferDeviceType(deviceInfo: DeviceInfo): string | undefined {
    const fs = deviceInfo.filesystem?.toLowerCase();
    if (!fs) {
      return undefined;
    }

    // FAT variants
    if (fs.includes('fat12') || fs.includes('fat16')) {
      return 'floppy';
    }
    if (fs.includes('fat32') || fs.includes('vfat')) {
      return 'hard-drive';
    }

    // Optical media
    if (fs.includes('iso9660') || fs.includes('cdfs') || fs.includes('udf')) {
      return 'cd-rom';
    }

    // Modern filesystems
    if (fs.includes('exfat') || fs.includes('ntfs') || fs.includes('ext4')) {
      return 'hard-drive';
    }

    // HFS+ (macOS)
    if (fs.includes('hfs')) {
      return 'hard-drive';
    }

    // Unknown - prompt user
    return undefined;
  }

  /**
   * Determine sampler from config or prompt.
   *
   * If no existing samplers, prompts for new sampler name.
   * If existing samplers, prompts to select or add new.
   */
  private async determineSampler(config: AudioToolsConfig): Promise<string> {
    const existingSamplers = this.getExistingSamplers(config);

    if (existingSamplers.length === 0) {
      // No existing samplers - prompt for new name
      return await this.promptService.promptNewSamplerName();
    }

    // Existing samplers - prompt to select or add new
    const result = await this.promptService.promptSampler(existingSamplers);
    return result.sampler;
  }

  /**
   * Get list of unique sampler names from config.
   */
  private getExistingSamplers(config: AudioToolsConfig): string[] {
    const sources = config.backup?.sources || [];
    const samplers = sources
      .map((s) => s.sampler)
      .filter((s): s is string => !!s);

    // Return unique values
    return Array.from(new Set(samplers));
  }

  /**
   * Find existing source that matches the device info.
   *
   * Matches by UUID or serial number if available.
   */
  private findExistingSource(
    deviceInfo: DeviceInfo,
    config: AudioToolsConfig
  ): BackupSource | undefined {
    const sources = config.backup?.sources || [];

    // Try to match by UUID
    if (deviceInfo.volumeUUID) {
      const match = sources.find((s) => s.volumeUUID === deviceInfo.volumeUUID);
      if (match) {
        return match;
      }
    }

    // Try to match by serial
    if (deviceInfo.volumeSerial) {
      const match = sources.find((s) => s.volumeSerial === deviceInfo.volumeSerial);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  /**
   * Generate source name from components.
   *
   * Format: ${sampler}-${deviceType}-${volumeLabel || 'device'}
   * Example: 's5000-floppy-SDCARD'
   *
   * Ensures uniqueness by appending number if needed.
   */
  private generateSourceName(
    sampler: string,
    deviceType: string,
    deviceInfo: DeviceInfo
  ): string {
    const volumePart = deviceInfo.volumeLabel || 'device';
    const baseName = `${sampler}-${deviceType}-${volumePart}`;

    // Normalize name (lowercase, replace spaces with hyphens)
    return baseName.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Create a new BackupSource from components.
   */
  private createBackupSource(
    name: string,
    mountPath: string,
    deviceType: string,
    sampler: string,
    deviceInfo: DeviceInfo
  ): BackupSource {
    const now = new Date().toISOString();

    return {
      name,
      type: 'local',
      source: mountPath,
      device: deviceType,
      sampler,
      enabled: true,
      volumeUUID: deviceInfo.volumeUUID,
      volumeLabel: deviceInfo.volumeLabel,
      volumeSerial: deviceInfo.volumeSerial,
      registeredAt: now,
      lastSeen: now,
    };
  }

  /**
   * Check if device info has UUID or serial identifiers.
   */
  private hasDeviceIdentifiers(deviceInfo: DeviceInfo): boolean {
    return !!(deviceInfo.volumeUUID || deviceInfo.volumeSerial);
  }

  /**
   * Extract volume name from mount path.
   * E.g., '/Volumes/SDCARD' → 'SDCARD'
   */
  private extractVolumeNameFromPath(mountPath: string): string {
    const parts = mountPath.split('/').filter((p) => p);
    return parts[parts.length - 1] || 'unknown';
  }
}

/**
 * Factory function to create an auto-detect backup service.
 *
 * @param deviceDetector - Device detector instance
 * @param promptService - Interactive prompt service instance
 * @param deviceResolver - Device resolver instance
 * @returns New AutoDetectBackup instance
 */
export function createAutoDetectBackup(
  deviceDetector: DeviceDetectorInterface,
  promptService: InteractivePromptInterface,
  deviceResolver: DeviceResolver
): AutoDetectBackupInterface {
  return new AutoDetectBackup(deviceDetector, promptService, deviceResolver);
}
