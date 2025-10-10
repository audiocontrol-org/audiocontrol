/**
 * Validation utilities for audio-tools configuration.
 *
 * Provides comprehensive validation for configuration objects, backup sources,
 * and export settings. Also includes connectivity testing for backup sources.
 *
 * Validation functions throw descriptive errors when validation fails, following
 * the codebase's error handling pattern.
 *
 * @module audiotools-config/validator
 */

import { access, constants } from 'node:fs/promises';
import type {
  AudioToolsConfig,
  BackupSource,
  ExportConfig,
} from '@/types.js';

/**
 * Validates ISO 8601 timestamp format
 *
 * @param timestamp - Timestamp string to validate
 * @returns true if valid ISO 8601 format, false otherwise
 */
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Validates a backup source configuration.
 *
 * Checks all required fields and validates type-specific requirements:
 * - Name must not be empty
 * - Type must be 'remote' or 'local'
 * - Source path must not be empty
 * - Device must not be empty
 * - For local sources, sampler must be provided
 * - Optional UUID fields must be strings if provided
 * - Optional timestamp fields must be valid ISO 8601 format if provided
 *
 * @param source - The backup source to validate
 * @throws {Error} If validation fails with a descriptive error message
 *
 * @example
 * ```typescript
 * const source: BackupSource = {
 *   name: 'pi-scsi2',
 *   type: 'remote',
 *   source: 'pi-scsi2.local:~/images/',
 *   device: 'images',
 *   enabled: true
 * };
 *
 * try {
 *   validateBackupSource(source);
 *   console.log('Source is valid');
 * } catch (error) {
 *   console.error('Validation failed:', error.message);
 * }
 * ```
 */
export function validateBackupSource(source: BackupSource): void {
  // Validate name
  if (!source.name || source.name.trim() === '') {
    throw new Error('Backup source name cannot be empty');
  }

  // Validate type
  if (source.type !== 'remote' && source.type !== 'local') {
    throw new Error(`Invalid source type: "${source.type}". Must be "remote" or "local"`);
  }

  // Validate source path
  if (!source.source || source.source.trim() === '') {
    throw new Error('Source path cannot be empty');
  }

  // Validate device
  if (!source.device || source.device.trim() === '') {
    throw new Error('Device name cannot be empty');
  }

  // Type-specific validation
  if (source.type === 'local') {
    if (!source.sampler || source.sampler.trim() === '') {
      throw new Error('Local sources must specify a sampler model');
    }
  }

  // Validate optional timestamp fields if present
  if (source.lastSeen !== undefined && source.lastSeen !== null) {
    if (typeof source.lastSeen !== 'string' || !isValidTimestamp(source.lastSeen)) {
      throw new Error(`Invalid lastSeen timestamp: "${source.lastSeen}". Must be ISO 8601 format.`);
    }
  }

  if (source.registeredAt !== undefined && source.registeredAt !== null) {
    if (typeof source.registeredAt !== 'string' || !isValidTimestamp(source.registeredAt)) {
      throw new Error(`Invalid registeredAt timestamp: "${source.registeredAt}". Must be ISO 8601 format.`);
    }
  }

  // Validate string fields if present (optional but must be strings)
  if (source.volumeUUID !== undefined && source.volumeUUID !== null) {
    if (typeof source.volumeUUID !== 'string') {
      throw new Error('volumeUUID must be a string if provided');
    }
  }

  if (source.volumeLabel !== undefined && source.volumeLabel !== null) {
    if (typeof source.volumeLabel !== 'string') {
      throw new Error('volumeLabel must be a string if provided');
    }
  }

  if (source.volumeSerial !== undefined && source.volumeSerial !== null) {
    if (typeof source.volumeSerial !== 'string') {
      throw new Error('volumeSerial must be a string if provided');
    }
  }
}

/**
 * Validates export configuration settings.
 *
 * Checks all required fields and validates values:
 * - outputRoot must not be empty
 * - formats array must not be empty
 * - formats must contain valid values ('sfz' or 'decentsampler')
 * - enabledSources must be an array
 *
 * @param exportConfig - The export configuration to validate
 * @throws {Error} If validation fails with a descriptive error message
 *
 * @example
 * ```typescript
 * const config: ExportConfig = {
 *   outputRoot: '~/.audiotools/sampler-export/extracted',
 *   formats: ['sfz', 'decentsampler'],
 *   skipUnchanged: true,
 *   enabledSources: ['pi-scsi2']
 * };
 *
 * try {
 *   validateExportConfig(config);
 * } catch (error) {
 *   console.error('Export config error:', error.message);
 * }
 * ```
 */
export function validateExportConfig(exportConfig: ExportConfig): void {
  // Validate outputRoot
  if (!exportConfig.outputRoot || exportConfig.outputRoot.trim() === '') {
    throw new Error('Export outputRoot cannot be empty');
  }

  // Validate formats array exists and is not empty
  if (!Array.isArray(exportConfig.formats)) {
    throw new Error('Export formats must be an array');
  }

  if (exportConfig.formats.length === 0) {
    throw new Error('Export formats array cannot be empty');
  }

  // Validate each format value
  const validFormats = ['sfz', 'decentsampler'];
  const invalidFormats = exportConfig.formats.filter(
    (format) => !validFormats.includes(format)
  );

  if (invalidFormats.length > 0) {
    throw new Error(
      `Invalid export formats: ${invalidFormats.join(', ')}. ` +
        `Valid formats are: ${validFormats.join(', ')}`
    );
  }

  // Validate enabledSources is an array
  if (!Array.isArray(exportConfig.enabledSources)) {
    throw new Error('Export enabledSources must be an array');
  }
}

/**
 * Validates the complete unified configuration.
 *
 * Performs comprehensive validation of the entire configuration structure:
 * - Version must be present
 * - Backup config is validated if present
 * - Export config is validated if present
 * - All backup sources are validated
 * - Cross-references between export enabledSources and backup sources are checked
 *
 * @param config - The complete audio-tools configuration to validate
 * @throws {Error} If validation fails with a descriptive error message
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 *
 * try {
 *   validateUnifiedConfig(config);
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 *   process.exit(1);
 * }
 * ```
 */
export function validateUnifiedConfig(config: AudioToolsConfig): void {
  // Validate version is present
  if (!config.version || config.version.trim() === '') {
    throw new Error('Configuration version is required');
  }

  // Validate backup configuration if present
  if (config.backup) {
    // Validate backupRoot
    if (!config.backup.backupRoot || config.backup.backupRoot.trim() === '') {
      throw new Error('Backup backupRoot cannot be empty');
    }

    // Validate sources array
    if (!Array.isArray(config.backup.sources)) {
      throw new Error('Backup sources must be an array');
    }

    // Validate each backup source
    config.backup.sources.forEach((source, index) => {
      try {
        validateBackupSource(source);
      } catch (error) {
        const sourceName = source.name || `at index ${index}`;
        throw new Error(`Backup source "${sourceName}": ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Check for duplicate source names
    const sourceNames = config.backup.sources.map((s) => s.name);
    const duplicates = sourceNames.filter(
      (name, index) => sourceNames.indexOf(name) !== index
    );
    if (duplicates.length > 0) {
      throw new Error(`Duplicate backup source names: ${[...new Set(duplicates)].join(', ')}`);
    }
  }

  // Validate export configuration if present
  if (config.export) {
    try {
      validateExportConfig(config.export);
    } catch (error) {
      throw new Error(`Export config: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Validate cross-references between export enabledSources and backup sources
    if (
      config.backup &&
      Array.isArray(config.backup.sources) &&
      Array.isArray(config.export.enabledSources)
    ) {
      const backupSourceNames = config.backup.sources.map((s) => s.name);
      const unknownSources = config.export.enabledSources.filter(
        (name) => !backupSourceNames.includes(name)
      );

      if (unknownSources.length > 0) {
        throw new Error(
          `Export enabledSources references unknown backup sources: ${unknownSources.join(', ')}`
        );
      }
    }
  }
}

/**
 * Tests connectivity to a backup source.
 *
 * Performs actual connectivity tests to verify that a backup source is accessible:
 * - For remote sources: Tests SSH connection (placeholder - returns true for now)
 * - For local sources: Checks if the path exists and is readable
 *
 * @param source - The backup source to test
 * @returns Promise resolving to true if accessible, false otherwise
 *
 * @example
 * ```typescript
 * const source: BackupSource = {
 *   name: 'sd-card',
 *   type: 'local',
 *   source: '/Volumes/AKAI_SD',
 *   device: 'sd-card',
 *   sampler: 's5000',
 *   enabled: true
 * };
 *
 * const accessible = await testBackupSourceConnection(source);
 * if (!accessible) {
 *   console.error('Source is not accessible');
 * }
 * ```
 */
export async function testBackupSourceConnection(
  source: BackupSource
): Promise<boolean> {
  try {
    if (source.type === 'remote') {
      // TODO: Implement SSH connection test
      // For now, return true (assume remote is accessible)
      // Future: Use ssh command or ssh2 library to test connection
      return true;
    } else if (source.type === 'local') {
      // Test if local path exists and is readable
      await access(source.source, constants.R_OK);
      return true;
    }

    return false;
  } catch (error) {
    // Path doesn't exist or is not readable
    return false;
  }
}
