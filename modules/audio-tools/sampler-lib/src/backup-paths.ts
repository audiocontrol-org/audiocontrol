/**
 * Backup Path Conventions and Discovery
 *
 * Centralized configuration and discovery for backup directory structures.
 * Supports dynamic sampler discovery and legacy path fallback.
 *
 * Standard convention: ~/.audiotools/backup/{sampler}/images/
 * Legacy support: scsi0, scsi1, scsi2, scsi3, scsi4, scsi5, scsi6, floppy
 *
 * @module backup-paths
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';

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
 * Sampler type identifier
 */
export type SamplerType = 's3k' | 's5k' | 'unknown';

/**
 * Resolve backup path using conventions
 *
 * Creates path: {backupRoot}/{sampler}/{defaultSubdirectory}/
 *
 * @param sampler - Sampler name (e.g., 'pi-scsi2', 's3000')
 * @param conventions - Path conventions (defaults to DEFAULT_PATH_CONVENTIONS)
 * @returns Absolute path to backup directory
 *
 * @example
 * ```typescript
 * resolveBackupPath('pi-scsi2')
 * // => '/Users/user/.audiotools/backup/pi-scsi2/images'
 * ```
 */
export function resolveBackupPath(
  sampler: string,
  conventions: BackupPathConventions = DEFAULT_PATH_CONVENTIONS
): string {
  return join(conventions.backupRoot, sampler, conventions.defaultSubdirectory);
}

/**
 * Find disk images in a specific directory
 *
 * Searches for files matching common disk image extensions:
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

/**
 * Discover all sampler backup directories
 *
 * Scans backup root for sampler directories containing disk images.
 * Returns array of sampler names that have backups.
 *
 * @param conventions - Path conventions (defaults to DEFAULT_PATH_CONVENTIONS)
 * @returns Array of sampler names with existing backups
 *
 * @example
 * ```typescript
 * discoverBackupSamplers()
 * // => ['pi-scsi2', 's3000', 's3k']
 * ```
 */
export function discoverBackupSamplers(
  conventions: BackupPathConventions = DEFAULT_PATH_CONVENTIONS
): string[] {
  const samplers: string[] = [];

  if (!existsSync(conventions.backupRoot)) {
    return samplers;
  }

  try {
    const entries = readdirSync(conventions.backupRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if this sampler directory has any disk images
        const diskImages = findBackupDiskImages(entry.name, conventions);
        if (diskImages.length > 0) {
          samplers.push(entry.name);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return samplers.sort();
}

/**
 * Detect sampler type from disk image format
 *
 * Reads disk image header to identify S3K or S5K format.
 * Checks for Akai volume signatures in the first 512 bytes.
 *
 * @param diskImage - Path to disk image file
 * @returns Detected sampler type or 'unknown'
 *
 * @remarks
 * Detection strategy:
 * - S3000: Look for "AKAI" signature at specific offsets
 * - S5000/S6000: Look for different volume header markers
 * - Unknown: DOS/FAT or unrecognized format
 *
 * @example
 * ```typescript
 * detectSamplerType('/path/to/HD0.hds')
 * // => 's3k' | 's5k' | 'unknown'
 * ```
 */
export function detectSamplerType(diskImage: string): SamplerType {
  try {
    const fd = openSync(diskImage, 'r');
    const buffer = Buffer.alloc(4096);
    readSync(fd, buffer, 0, 4096, 0);
    closeSync(fd);

    // Check for DOS/FAT boot signature first (0x55AA at offset 0x1FE)
    const bootSig = buffer.readUInt16LE(0x1fe);
    if (bootSig === 0xaa55) {
      // This is a DOS/FAT disk, likely S5K with DOS format
      // Check for FAT filesystem markers
      const fsType1 = buffer.toString('ascii', 0x36, 0x3b);
      const fsType2 = buffer.toString('ascii', 0x52, 0x5a);
      if (fsType1.includes('FAT') || fsType2.includes('FAT')) {
        return 'unknown'; // Let DOS extractor handle it
      }
    }

    // S3000 native format detection
    // Look for "AKAI" signature in first sector
    const akaiSig = buffer.toString('ascii', 0, 4);
    if (akaiSig === 'AKAI') {
      // Check for S3000-specific markers
      // S3000 uses different volume structure than S5K
      return 's3k';
    }

    // S5000/S6000 native format detection
    // Look for volume header at sector boundaries
    // S5K volumes have specific partition structure
    for (let offset = 0; offset < 4096; offset += 512) {
      const volSig = buffer.toString('ascii', offset, offset + 4);
      if (volSig === 'VOL1' || volSig === 'PART') {
        return 's5k';
      }
    }

    // Check for S5K partition table markers
    const partSig = buffer.toString('ascii', 0x100, 0x104);
    if (partSig === 'PART') {
      return 's5k';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}
