/**
 * Configuration migration utilities.
 *
 * Provides utilities for migrating configurations between schema versions
 * and working with device UUID tracking fields.
 *
 * @module audiotools-config/migration
 */

import type { BackupSource, AudioToolsConfig } from '@/types.js';

/**
 * Migrates existing config to include device UUID tracking fields
 *
 * This is a no-op migration since all new fields are optional.
 * Existing configs remain valid without modification.
 *
 * @param config - Existing configuration
 * @returns Migrated configuration (same as input)
 *
 * @example
 * ```typescript
 * import { migrateConfig, loadConfig, saveConfig } from '@oletizi/audiotools-config';
 *
 * const config = await loadConfig();
 * const migrated = migrateConfig(config);
 * await saveConfig(migrated);
 * ```
 */
export function migrateConfig(config: AudioToolsConfig): AudioToolsConfig {
  // No migration needed - all new fields are optional
  // This function exists for future migration needs
  return config;
}

/**
 * Checks if a backup source has device UUID information
 *
 * @param source - Backup source to check
 * @returns true if source has UUID or serial, false otherwise
 *
 * @example
 * ```typescript
 * import { hasDeviceIdentifier } from '@oletizi/audiotools-config';
 *
 * const source = {
 *   name: 's5k-card',
 *   type: 'local',
 *   source: '/Volumes/SDCARD',
 *   device: 'sd-card',
 *   sampler: 's5000',
 *   enabled: true,
 *   volumeUUID: '12345678-1234-1234-1234-123456789012'
 * };
 *
 * if (hasDeviceIdentifier(source)) {
 *   console.log('Source has device tracking enabled');
 * }
 * ```
 */
export function hasDeviceIdentifier(source: BackupSource): boolean {
  return !!(source.volumeUUID || source.volumeSerial);
}

/**
 * Gets the primary device identifier for a source
 *
 * Prefers volumeUUID, falls back to volumeSerial
 *
 * @param source - Backup source
 * @returns Device identifier or undefined
 *
 * @example
 * ```typescript
 * import { getDeviceIdentifier } from '@oletizi/audiotools-config';
 *
 * const source = {
 *   name: 's5k-card',
 *   type: 'local',
 *   source: '/Volumes/SDCARD',
 *   device: 'sd-card',
 *   sampler: 's5000',
 *   enabled: true,
 *   volumeUUID: '12345678-1234-1234-1234-123456789012',
 *   volumeSerial: '12345678-02'
 * };
 *
 * const identifier = getDeviceIdentifier(source);
 * console.log(`Device ID: ${identifier}`);
 * // Output: Device ID: 12345678-1234-1234-1234-123456789012
 * ```
 */
export function getDeviceIdentifier(source: BackupSource): string | undefined {
  return source.volumeUUID || source.volumeSerial;
}
