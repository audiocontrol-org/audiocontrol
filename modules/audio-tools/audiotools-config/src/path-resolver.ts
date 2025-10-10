/**
 * Centralized path resolution for backup operations.
 *
 * This module provides the SINGLE source of truth for all backup path resolution.
 * All consumers (backup, export, CLI commands) should use this module instead of
 * implementing their own path logic.
 *
 * @module audiotools-config/path-resolver
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { BackupSource } from '@/types.js';

/**
 * Default backup root directory
 */
export const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');

/**
 * Resolve the backup path for a given source.
 *
 * This is the single function that determines where backup data is stored.
 * Path structure: {backupRoot}/{sampler}/{device}/
 *
 * For remote sources:
 * - Uses hostname (without .local suffix) as sampler name
 * - Example: pi-scsi2.local:~/images/ → ~/.audiotools/backup/pi-scsi2/images
 *
 * For local sources:
 * - Uses explicit sampler name from config
 * - Example: /Volumes/S3K with sampler="s3k" → ~/.audiotools/backup/s3k/hard-drive
 *
 * @param source - Backup source configuration
 * @param backupRoot - Optional backup root directory (defaults to ~/.audiotools/backup)
 * @returns Absolute path to backup directory
 * @throws Error if required fields are missing
 *
 * @example
 * ```typescript
 * const source: BackupSource = {
 *   name: 's3k-hard-drive',
 *   type: 'local',
 *   source: '/Volumes/S3K',
 *   device: 'hard-drive',
 *   sampler: 's3k',
 *   enabled: true
 * };
 *
 * const path = resolveBackupPath(source);
 * // => '/Users/orion/.audiotools/backup/s3k/hard-drive'
 * ```
 */
export function resolveBackupPath(
  source: BackupSource,
  backupRoot: string = DEFAULT_BACKUP_ROOT
): string {
  // Validate device name
  if (!source.device) {
    throw new Error('Device name is required for backup path resolution');
  }

  // Determine sampler name
  const samplerName = resolveSamplerName(source);

  // Build hierarchical path: {backupRoot}/{sampler}/{device}/
  return join(backupRoot, samplerName, source.device);
}

/**
 * Resolve sampler name from backup source configuration.
 *
 * For remote sources:
 * - Uses explicit sampler if provided
 * - Otherwise extracts hostname from source path
 * - Sanitizes the name for filesystem use
 *
 * For local sources:
 * - Requires explicit sampler field
 * - Sanitizes the name for filesystem use
 *
 * @param source - Backup source configuration
 * @returns Sanitized sampler name safe for filesystem use
 * @throws Error if required sampler information is missing
 *
 * @internal
 */
function resolveSamplerName(source: BackupSource): string {
  if (source.type === 'remote') {
    // Remote: allow sampler override, otherwise extract hostname from source
    if (source.sampler) {
      return sanitizeSamplerName(source.sampler);
    }

    // Extract hostname from source path (format: "host:path")
    const colonIndex = source.source.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(
        `Invalid remote source format: "${source.source}". Expected "host:path"`
      );
    }

    const host = source.source.substring(0, colonIndex);
    return sanitizeSamplerName(host);
  } else {
    // Local: require explicit sampler field
    if (!source.sampler) {
      throw new Error(
        'Sampler name is required for local sources. ' +
          'This should have been caught by validation.'
      );
    }
    return sanitizeSamplerName(source.sampler);
  }
}

/**
 * Sanitize sampler name for use in filesystem paths.
 *
 * Sanitization rules:
 * - Remove .local suffix from hostnames
 * - Convert to lowercase
 * - Replace special characters with hyphens
 * - Collapse multiple consecutive hyphens
 * - Remove leading/trailing hyphens
 *
 * @param name - Raw sampler name or hostname
 * @returns Sanitized sampler name safe for filesystem use
 *
 * @example
 * ```typescript
 * sanitizeSamplerName('pi-scsi2.local') // => 'pi-scsi2'
 * sanitizeSamplerName('My S5000')       // => 'my-s5000'
 * sanitizeSamplerName('S3K--Zulu!')     // => 's3k-zulu'
 * ```
 *
 * @internal
 */
function sanitizeSamplerName(name: string): string {
  return name
    .replace(/\.local$/i, '') // Remove .local suffix (case-insensitive)
    .toLowerCase() // Lowercase
    .replace(/[^a-z0-9-]/g, '-') // Replace special chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
