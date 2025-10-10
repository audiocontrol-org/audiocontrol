/**
 * Auto-discovery of existing backup structures.
 *
 * Scans the backup directory for existing sampler backup structures and
 * provides utilities to import them into the unified configuration system.
 *
 * @module audiotools-config/discovery
 */

import { homedir } from 'node:os';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'pathe';
import type { DiscoveredBackup, BackupSource } from '@/types.js';

/**
 * Recursively count files and calculate total size in a directory.
 *
 * @param dirPath - Absolute path to directory
 * @returns Object with fileCount and totalSize in bytes
 */
async function analyzeDirectory(
  dirPath: string
): Promise<{ fileCount: number; totalSize: number; lastModified: Date }> {
  let fileCount = 0;
  let totalSize = 0;
  let lastModified = new Date(0); // Epoch start

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      try {
        const stats = await stat(fullPath);

        if (entry.isFile()) {
          fileCount++;
          totalSize += stats.size;

          // Track most recent modification
          if (stats.mtime > lastModified) {
            lastModified = stats.mtime;
          }
        } else if (entry.isDirectory()) {
          // Recurse into subdirectories
          const subAnalysis = await analyzeDirectory(fullPath);
          fileCount += subAnalysis.fileCount;
          totalSize += subAnalysis.totalSize;

          if (subAnalysis.lastModified > lastModified) {
            lastModified = subAnalysis.lastModified;
          }
        }
      } catch (error: any) {
        // Skip entries we can't access (permissions, broken symlinks, etc.)
        console.warn(`Skipping ${fullPath}: ${error.message}`);
        continue;
      }
    }
  } catch (error: any) {
    // Directory doesn't exist or can't be read
    throw new Error(`Cannot analyze directory ${dirPath}: ${error.message}`);
  }

  return { fileCount, totalSize, lastModified };
}

/**
 * Infer backup type from sampler or device name.
 *
 * Uses heuristics to determine if a backup is likely from a remote SSH source
 * or local media (SD card, USB drive).
 *
 * @param samplerName - Name of sampler or device (e.g., 'pi-scsi2.local', 's5k')
 * @returns Inferred backup type
 *
 * @example
 * ```typescript
 * inferBackupType('pi-scsi2.local'); // 'remote'
 * inferBackupType('s5k@192.168.1.10'); // 'remote'
 * inferBackupType('s5k'); // 'local'
 * inferBackupType('s3000xl'); // 'local'
 * inferBackupType('sd-card'); // 'local'
 * ```
 */
export function inferBackupType(samplerName: string): 'remote' | 'local' {
  const name = samplerName.toLowerCase();

  // Indicators of remote SSH backup
  if (name.includes('.local') || name.includes('.lan') || name.includes('@')) {
    return 'remote';
  }

  // Common sampler model names suggest local media
  const localPatterns = [
    's1000',
    's2000',
    's3000',
    's5000',
    's6000',
    's5k',
    's6k',
    's3k',
    'mpc',
    'akai',
    'sd-card',
    'usb',
    'floppy',
  ];

  if (localPatterns.some((pattern) => name.includes(pattern))) {
    return 'local';
  }

  // Default to remote for unknown patterns
  return 'remote';
}

/**
 * Discover existing backups in the backup root directory.
 *
 * Scans for sampler/device directory structures and analyzes each backup
 * to provide metadata for import into the configuration system.
 *
 * Expected directory structure:
 * ```
 * ~/.audiotools/backup/
 * ├── sampler1/
 * │   ├── device1/
 * │   └── device2/
 * └── sampler2/
 *     └── device1/
 * ```
 *
 * @param backupRoot - Optional backup root path (defaults to `~/.audiotools/backup`)
 * @returns Array of discovered backups (empty if directory doesn't exist)
 *
 * @example
 * ```typescript
 * const discovered = await discoverExistingBackups();
 * for (const backup of discovered) {
 *   console.log(`Found: ${backup.sampler}/${backup.device}`);
 *   console.log(`  Files: ${backup.fileCount}`);
 *   console.log(`  Size: ${(backup.totalSize / 1024 / 1024).toFixed(2)} MB`);
 *   console.log(`  Type: ${backup.inferredType}`);
 * }
 * ```
 */
export async function discoverExistingBackups(
  backupRoot?: string
): Promise<DiscoveredBackup[]> {
  const root = backupRoot ?? join(homedir(), '.audiotools', 'backup');
  const discovered: DiscoveredBackup[] = [];

  try {
    const samplerEntries = await readdir(root, { withFileTypes: true });

    for (const samplerEntry of samplerEntries) {
      // Skip hidden directories and non-directories
      if (!samplerEntry.isDirectory() || samplerEntry.name.startsWith('.')) {
        continue;
      }

      const samplerPath = join(root, samplerEntry.name);
      const samplerName = samplerEntry.name;

      try {
        const deviceEntries = await readdir(samplerPath, { withFileTypes: true });

        for (const deviceEntry of deviceEntries) {
          // Skip hidden directories and non-directories
          if (!deviceEntry.isDirectory() || deviceEntry.name.startsWith('.')) {
            continue;
          }

          const devicePath = join(samplerPath, deviceEntry.name);
          const deviceName = deviceEntry.name;

          try {
            // Analyze the backup directory
            const analysis = await analyzeDirectory(devicePath);

            // Only include if there are files
            if (analysis.fileCount > 0) {
              discovered.push({
                sampler: samplerName,
                device: deviceName,
                path: devicePath,
                fileCount: analysis.fileCount,
                totalSize: analysis.totalSize,
                lastModified: analysis.lastModified,
                inferredType: inferBackupType(samplerName),
              });
            }
          } catch (error: any) {
            console.warn(
              `Skipping ${samplerName}/${deviceName}: ${error.message}`
            );
            continue;
          }
        }
      } catch (error: any) {
        console.warn(`Skipping sampler ${samplerName}: ${error.message}`);
        continue;
      }
    }
  } catch (error: any) {
    // Backup root doesn't exist or can't be read - return empty array
    console.debug(`Backup root not accessible: ${error.message}`);
    return [];
  }

  return discovered;
}

/**
 * Convert discovered backups to BackupSource configurations.
 *
 * Transforms auto-discovered backup metadata into BackupSource objects
 * ready to be added to the unified configuration. All sources are enabled
 * by default.
 *
 * @param discovered - Array of discovered backups
 * @returns Array of BackupSource configurations
 *
 * @example
 * ```typescript
 * const discovered = await discoverExistingBackups();
 * const sources = await importDiscoveredBackups(discovered);
 *
 * // Add to config
 * let config = await loadConfig();
 * for (const source of sources) {
 *   config = addBackupSource(config, source);
 * }
 * await saveConfig(config);
 * ```
 */
export async function importDiscoveredBackups(
  discovered: DiscoveredBackup[]
): Promise<BackupSource[]> {
  return discovered.map((backup) => {
    // Generate source name from sampler-device
    const name = `${backup.sampler}-${backup.device}`;

    // For remote sources, construct SSH path placeholder
    // For local sources, use the backup path as a hint
    const source =
      backup.inferredType === 'remote'
        ? `${backup.sampler}:~/` // Placeholder - user will need to configure actual path
        : backup.path; // Use discovered path as hint

    return {
      name,
      type: backup.inferredType,
      source,
      device: backup.device,
      sampler: backup.sampler,
      enabled: true,
    };
  });
}
