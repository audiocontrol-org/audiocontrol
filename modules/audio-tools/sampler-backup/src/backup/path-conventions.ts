/**
 * Filesystem Path Conventions for Backup Storage
 *
 * Centralized configuration for backup directory structure.
 * Defines the standard convention: ~/.audiotools/backup/{sampler}/images/
 *
 * @module backup/path-conventions
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

/**
 * Filesystem path conventions for backup storage
 *
 * Defines the hierarchical structure: {backupRoot}/{sampler}/{subdirectory}/
 */
export interface BackupPathConventions {
  /** Base backup directory root */
  backupRoot: string;

  /** Default subdirectory for storing disk images */
  defaultSubdirectory: string;

  /** Legacy subdirectory names for backward compatibility */
  legacySubdirectories: string[];
}

/**
 * Default path conventions
 *
 * Structure: ~/.audiotools/backup/{sampler}/images/
 * Legacy support: scsi0, scsi1, scsi2, scsi3, scsi4, scsi5, scsi6, floppy
 */
export const DEFAULT_PATH_CONVENTIONS: BackupPathConventions = {
  backupRoot: join(homedir(), '.audiotools', 'backup'),
  defaultSubdirectory: 'images',
  legacySubdirectories: [
    'scsi0',
    'scsi1',
    'scsi2',
    'scsi3',
    'scsi4',
    'scsi5',
    'scsi6',
    'floppy',
  ],
};

/**
 * Resolve backup path using conventions
 *
 * Creates path: {backupRoot}/{sampler}/{defaultSubdirectory}/
 *
 * @param sampler - Sampler name (e.g., 'pi-scsi2', 's5k-studio')
 * @param conventions - Path conventions (defaults to DEFAULT_PATH_CONVENTIONS)
 * @returns Absolute path to backup directory
 *
 * @example
 * ```typescript
 * resolveBackupPath('pi-scsi2')
 * // => '/Users/user/.audiotools/backup/pi-scsi2/images'
 *
 * resolveBackupPath('s5k-studio')
 * // => '/Users/user/.audiotools/backup/s5k-studio/images'
 * ```
 */
export function resolveBackupPath(
  sampler: string,
  conventions: BackupPathConventions = DEFAULT_PATH_CONVENTIONS
): string {
  return join(conventions.backupRoot, sampler, conventions.defaultSubdirectory);
}

/**
 * Find disk images with fallback to legacy paths
 *
 * Searches for disk images in:
 * 1. New convention: {sampler}/images/
 * 2. Legacy convention: {sampler}/scsi0/, {sampler}/scsi1/, etc.
 *
 * Returns disk images from the first non-empty directory found.
 *
 * @param sampler - Sampler name
 * @param conventions - Path conventions (defaults to DEFAULT_PATH_CONVENTIONS)
 * @returns Array of absolute paths to disk image files
 *
 * @example
 * ```typescript
 * // Find disk images (tries new path first, then legacy)
 * const images = findBackupDiskImages('pi-scsi2');
 * // => ['/Users/user/.audiotools/backup/pi-scsi2/images/HD0.hds', ...]
 * ```
 */
export function findBackupDiskImages(
  sampler: string,
  conventions: BackupPathConventions = DEFAULT_PATH_CONVENTIONS
): string[] {
  // Build search paths: new convention first, then legacy
  const searchPaths = [
    join(conventions.backupRoot, sampler, conventions.defaultSubdirectory),
    ...conventions.legacySubdirectories.map((legacy) =>
      join(conventions.backupRoot, sampler, legacy)
    ),
  ];

  // Search all paths, return disk images from first non-empty directory
  for (const path of searchPaths) {
    const images = findDiskImagesInDirectory(path);
    if (images.length > 0) {
      return images;
    }
  }

  return [];
}

/**
 * Find disk images in a specific directory
 *
 * Searches for files matching common Akai disk image extensions:
 * .hds, .img, .iso
 *
 * @param directory - Directory to search
 * @returns Array of absolute paths to disk image files
 *
 * @internal
 */
function findDiskImagesInDirectory(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  try {
    const entries = readdirSync(directory, { withFileTypes: true });
    const images: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (
          lowerName.endsWith('.hds') ||
          lowerName.endsWith('.img') ||
          lowerName.endsWith('.iso')
        ) {
          images.push(join(directory, entry.name));
        }
      }
    }

    return images;
  } catch {
    return [];
  }
}

/**
 * Get backup subdirectory for a sampler (new or legacy)
 *
 * Determines which subdirectory is actually being used for a sampler.
 * Useful for migration detection and backward compatibility.
 *
 * @param sampler - Sampler name
 * @param conventions - Path conventions
 * @returns Subdirectory name being used, or null if none found
 *
 * @example
 * ```typescript
 * getActualSubdirectory('pi-scsi2')
 * // => 'images' (if using new convention)
 * // => 'scsi0' (if using legacy convention)
 * // => null (if no backups found)
 * ```
 */
export function getActualSubdirectory(
  sampler: string,
  conventions: BackupPathConventions = DEFAULT_PATH_CONVENTIONS
): string | null {
  const samplerPath = join(conventions.backupRoot, sampler);

  if (!existsSync(samplerPath)) {
    return null;
  }

  // Check new convention first
  const newPath = join(samplerPath, conventions.defaultSubdirectory);
  if (existsSync(newPath)) {
    try {
      const stat = statSync(newPath);
      if (stat.isDirectory()) {
        return conventions.defaultSubdirectory;
      }
    } catch {
      // Ignore
    }
  }

  // Check legacy conventions
  for (const legacy of conventions.legacySubdirectories) {
    const legacyPath = join(samplerPath, legacy);
    if (existsSync(legacyPath)) {
      try {
        const stat = statSync(legacyPath);
        if (stat.isDirectory()) {
          const images = findDiskImagesInDirectory(legacyPath);
          if (images.length > 0) {
            return legacy;
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return null;
}
