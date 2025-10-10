/**
 * Disk Scanner - Find disk images in backup directories
 *
 * This is the single source of truth for finding disk images.
 * Both backup and export tools must use this logic to ensure consistency.
 */

import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename, extname } from 'pathe';

/**
 * Sampler type determined from disk image header
 */
export type SamplerType = 's3k' | 's5k' | 'unknown';

/**
 * Information about a discovered disk image
 */
export interface DiskInfo {
  /** Absolute path to disk image file */
  path: string;
  /** Filename without extension */
  name: string;
  /** Detected sampler type from disk header */
  samplerType: SamplerType;
  /** Last modification time */
  mtime: Date;
}

/**
 * Detect sampler type by reading disk image header
 *
 * Reads only the first 4KB to identify:
 * - DOS/FAT boot sector (0xaa55 signature at offset 0x1fe)
 * - S3K native format ("AKAI" signature at offset 0)
 * - S5K native format ("VOL1" or "PART" signature in first 4KB)
 *
 * @param diskImage - Absolute path to disk image file
 * @returns Detected sampler type or 'unknown'
 */
export function detectSamplerType(diskImage: string): SamplerType {
  try {
    const fd = openSync(diskImage, 'r');
    const buffer = Buffer.alloc(4096);
    readSync(fd, buffer, 0, 4096, 0);
    closeSync(fd);

    // Check for DOS/FAT boot sector signature
    const bootSig = buffer.readUInt16LE(0x1fe);
    if (bootSig === 0xaa55) {
      return 'unknown'; // DOS/FAT disk - needs further analysis
    }

    // Check for S3K native format signature
    const akaiSig = buffer.toString('ascii', 0, 4);
    if (akaiSig === 'AKAI') {
      return 's3k';
    }

    // Check for S5K native format signature
    // S5K volumes can have signature at various 512-byte aligned offsets
    for (let offset = 0; offset < 4096; offset += 512) {
      const volSig = buffer.toString('ascii', offset, offset + 4);
      if (volSig === 'VOL1' || volSig === 'PART') {
        return 's5k';
      }
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Find all disk images recursively in a directory
 *
 * Searches for files with extensions: .hds, .img, .iso
 * Skips hidden directories (starting with .)
 *
 * @param dir - Directory to search
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Array of absolute paths to disk image files
 */
export function findDiskImagesRecursive(dir: string, maxDepth: number = 3): string[] {
  if (maxDepth <= 0 || !existsSync(dir)) {
    return [];
  }

  const results: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (
          lowerName.endsWith('.hds') ||
          lowerName.endsWith('.img') ||
          lowerName.endsWith('.iso')
        ) {
          results.push(fullPath);
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...findDiskImagesRecursive(fullPath, maxDepth - 1));
      }
    }
  } catch {
    // Ignore permission errors and other filesystem issues
  }

  return results;
}

/**
 * Discover all disk images in a directory with metadata
 *
 * Combines recursive search with sampler type detection.
 * This is the main entry point for discovering disk images.
 *
 * @param sourceDir - Root directory to search
 * @returns Array of disk information objects, sorted by path
 */
export function discoverDiskImages(sourceDir: string): DiskInfo[] {
  const diskPaths = findDiskImagesRecursive(sourceDir);
  const disks: DiskInfo[] = [];

  for (const diskPath of diskPaths) {
    try {
      const diskStat = statSync(diskPath);
      const samplerType = detectSamplerType(diskPath);

      disks.push({
        path: diskPath,
        name: basename(diskPath, extname(diskPath)),
        samplerType,
        mtime: diskStat.mtime,
      });
    } catch (error) {
      // Skip disk images we can't read
      console.warn(`Skipping unreadable disk: ${diskPath}`);
    }
  }

  return disks.sort((a, b) => a.path.localeCompare(b.path));
}
