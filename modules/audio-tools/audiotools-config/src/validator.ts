/**
 * Validation utilities for audio-tools configuration.
 *
 * Provides comprehensive validation for configuration objects, backup sources,
 * and export settings. Also includes connectivity testing for backup sources.
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
 * Result of a validation operation.
 *
 * Contains a boolean indicating validity and a list of error messages
 * for any validation failures.
 *
 * @example
 * ```typescript
 * const result = validateBackupSource(source);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors.join('\n'));
 * }
 * ```
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** List of validation error messages (empty if valid) */
  errors: string[];
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
 *
 * @param source - The backup source to validate
 * @returns Validation result with any errors found
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
 * const result = validateBackupSource(source);
 * if (result.valid) {
 *   console.log('Source is valid');
 * }
 * ```
 */
export function validateBackupSource(source: BackupSource): ValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!source.name || source.name.trim() === '') {
    errors.push('Backup source name cannot be empty');
  }

  // Validate type
  if (source.type !== 'remote' && source.type !== 'local') {
    errors.push(`Invalid source type: "${source.type}". Must be "remote" or "local"`);
  }

  // Validate source path
  if (!source.source || source.source.trim() === '') {
    errors.push('Source path cannot be empty');
  }

  // Validate device
  if (!source.device || source.device.trim() === '') {
    errors.push('Device name cannot be empty');
  }

  // Type-specific validation
  if (source.type === 'local') {
    if (!source.sampler || source.sampler.trim() === '') {
      errors.push('Local sources must specify a sampler model');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
 * @returns Validation result with any errors found
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
 * const result = validateExportConfig(config);
 * if (!result.valid) {
 *   console.error('Export config errors:', result.errors);
 * }
 * ```
 */
export function validateExportConfig(exportConfig: ExportConfig): ValidationResult {
  const errors: string[] = [];

  // Validate outputRoot
  if (!exportConfig.outputRoot || exportConfig.outputRoot.trim() === '') {
    errors.push('Export outputRoot cannot be empty');
  }

  // Validate formats array exists and is not empty
  if (!Array.isArray(exportConfig.formats)) {
    errors.push('Export formats must be an array');
  } else if (exportConfig.formats.length === 0) {
    errors.push('Export formats array cannot be empty');
  } else {
    // Validate each format value
    const validFormats = ['sfz', 'decentsampler'];
    const invalidFormats = exportConfig.formats.filter(
      (format) => !validFormats.includes(format)
    );

    if (invalidFormats.length > 0) {
      errors.push(
        `Invalid export formats: ${invalidFormats.join(', ')}. ` +
          `Valid formats are: ${validFormats.join(', ')}`
      );
    }
  }

  // Validate enabledSources is an array
  if (!Array.isArray(exportConfig.enabledSources)) {
    errors.push('Export enabledSources must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
 * @returns Validation result with aggregated errors from all sections
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const result = validateUnifiedConfig(config);
 *
 * if (!result.valid) {
 *   console.error('Configuration errors:');
 *   result.errors.forEach(error => console.error(`  - ${error}`));
 *   process.exit(1);
 * }
 * ```
 */
export function validateUnifiedConfig(config: AudioToolsConfig): ValidationResult {
  const errors: string[] = [];

  // Validate version is present
  if (!config.version || config.version.trim() === '') {
    errors.push('Configuration version is required');
  }

  // Validate backup configuration if present
  if (config.backup) {
    // Validate backupRoot
    if (!config.backup.backupRoot || config.backup.backupRoot.trim() === '') {
      errors.push('Backup backupRoot cannot be empty');
    }

    // Validate sources array
    if (!Array.isArray(config.backup.sources)) {
      errors.push('Backup sources must be an array');
    } else {
      // Validate each backup source
      config.backup.sources.forEach((source, index) => {
        const sourceResult = validateBackupSource(source);
        if (!sourceResult.valid) {
          sourceResult.errors.forEach((error) => {
            errors.push(`Backup source "${source.name || `at index ${index}`}": ${error}`);
          });
        }
      });

      // Check for duplicate source names
      const sourceNames = config.backup.sources.map((s) => s.name);
      const duplicates = sourceNames.filter(
        (name, index) => sourceNames.indexOf(name) !== index
      );
      if (duplicates.length > 0) {
        errors.push(`Duplicate backup source names: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
  }

  // Validate export configuration if present
  if (config.export) {
    const exportResult = validateExportConfig(config.export);
    if (!exportResult.valid) {
      exportResult.errors.forEach((error) => {
        errors.push(`Export config: ${error}`);
      });
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
        errors.push(
          `Export enabledSources references unknown backup sources: ${unknownSources.join(', ')}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
