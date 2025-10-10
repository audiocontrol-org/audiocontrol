#!/usr/bin/env node

/**
 * Backup Directory Migration Tool
 *
 * Migrates legacy backup directory structures to the new path convention:
 * - Legacy: {sampler}/scsi0/, {sampler}/scsi1/, etc.
 * - New: {sampler}/images/
 *
 * Usage:
 *   sampler-migrate                    # Dry-run: show what would be migrated
 *   sampler-migrate --execute          # Actually perform migration
 *   sampler-migrate --backup-root PATH # Use custom backup root
 *
 * @module cli/migrate
 */

import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PATH_CONVENTIONS,
  getActualSubdirectory,
  type BackupPathConventions,
} from '@/lib/backup/path-conventions.js';

interface MigrationCandidate {
  sampler: string;
  currentSubdirectory: string;
  currentPath: string;
  targetPath: string;
  diskImages: string[];
}

interface MigrationOptions {
  backupRoot?: string;
  dryRun: boolean;
}

/**
 * Find all samplers that need migration
 *
 * Scans backup root for samplers using legacy subdirectories.
 *
 * @param conventions - Path conventions to use
 * @returns Array of migration candidates
 */
function findMigrationCandidates(
  conventions: BackupPathConventions
): MigrationCandidate[] {
  const candidates: MigrationCandidate[] = [];

  if (!existsSync(conventions.backupRoot)) {
    return candidates;
  }

  try {
    const samplers = readdirSync(conventions.backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const sampler of samplers) {
      const actualSubdir = getActualSubdirectory(sampler, conventions);

      // Only migrate if using legacy convention
      if (actualSubdir && conventions.legacySubdirectories.includes(actualSubdir)) {
        const currentPath = join(conventions.backupRoot, sampler, actualSubdir);
        const targetPath = join(
          conventions.backupRoot,
          sampler,
          conventions.defaultSubdirectory
        );

        // Find disk images in legacy location
        const diskImages = findDiskImages(currentPath);

        candidates.push({
          sampler,
          currentSubdirectory: actualSubdir,
          currentPath,
          targetPath,
          diskImages,
        });
      }
    }
  } catch (err: any) {
    console.error(`Error scanning backup root: ${err.message}`);
  }

  return candidates;
}

/**
 * Find disk images in a directory
 *
 * @param directory - Directory to search
 * @returns Array of disk image file paths
 */
function findDiskImages(directory: string): string[] {
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
 * Perform migration for a single sampler
 *
 * Renames legacy subdirectory to new convention.
 *
 * @param candidate - Migration candidate
 * @param dryRun - If true, only simulate migration
 * @returns True if migration successful
 */
function migrateSampler(candidate: MigrationCandidate, dryRun: boolean): boolean {
  try {
    // Check if target already exists
    if (existsSync(candidate.targetPath)) {
      console.error(
        `  ✗ Target directory already exists: ${candidate.targetPath}`
      );
      return false;
    }

    if (dryRun) {
      console.log(`  ✓ Would rename: ${candidate.currentPath}`);
      console.log(`              to: ${candidate.targetPath}`);
      return true;
    } else {
      renameSync(candidate.currentPath, candidate.targetPath);
      console.log(`  ✓ Migrated: ${candidate.currentPath}`);
      console.log(`          to: ${candidate.targetPath}`);
      return true;
    }
  } catch (err: any) {
    console.error(`  ✗ Migration failed: ${err.message}`);
    return false;
  }
}

/**
 * Display migration summary
 *
 * Shows what will be migrated and requires confirmation for execution.
 *
 * @param candidates - Migration candidates
 * @param dryRun - Whether this is a dry run
 */
function displaySummary(candidates: MigrationCandidate[], dryRun: boolean): void {
  console.log('\n=== Backup Directory Migration ===\n');

  if (candidates.length === 0) {
    console.log('✓ No migration needed - all backups use current convention\n');
    return;
  }

  console.log(`Found ${candidates.length} sampler(s) using legacy directory structure:\n`);

  for (const candidate of candidates) {
    console.log(`${candidate.sampler}/`);
    console.log(`  Current:  ${candidate.currentSubdirectory}/`);
    console.log(`  New:      images/`);
    console.log(`  Disk images: ${candidate.diskImages.length}`);
    console.log('');
  }

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('Run with --execute to perform migration\n');
  }
}

/**
 * Parse command line arguments
 *
 * @param args - Command line arguments
 * @returns Migration options
 */
function parseArgs(args: string[]): MigrationOptions {
  const options: MigrationOptions = {
    dryRun: true, // Default to dry run for safety
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--execute') {
      options.dryRun = false;
    } else if (arg === '--backup-root' && i + 1 < args.length) {
      options.backupRoot = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Backup Directory Migration Tool

Migrates legacy backup directory structures to the new path convention.

Usage:
  sampler-migrate                    # Dry-run: show what would be migrated
  sampler-migrate --execute          # Actually perform migration
  sampler-migrate --backup-root PATH # Use custom backup root

Options:
  --execute              Perform migration (default is dry-run)
  --backup-root PATH     Use custom backup root directory
  -h, --help             Show this help message

Legacy convention:  {sampler}/scsi0/,  {sampler}/scsi1/, etc.
New convention:     {sampler}/images/

Examples:
  # Preview migration
  sampler-migrate

  # Perform migration
  sampler-migrate --execute

  # Migrate custom backup location
  sampler-migrate --backup-root /custom/path --execute
`);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main migration entry point
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  // Build conventions
  const conventions: BackupPathConventions = {
    ...DEFAULT_PATH_CONVENTIONS,
    ...(options.backupRoot && { backupRoot: options.backupRoot }),
  };

  console.log(`Scanning backup root: ${conventions.backupRoot}`);

  // Find candidates
  const candidates = findMigrationCandidates(conventions);

  // Display summary
  displaySummary(candidates, options.dryRun);

  if (candidates.length === 0) {
    process.exit(0);
  }

  if (options.dryRun) {
    process.exit(0);
  }

  // Perform migration
  console.log('=== Starting Migration ===\n');

  let successCount = 0;
  let failureCount = 0;

  for (const candidate of candidates) {
    console.log(`Migrating ${candidate.sampler}...`);
    const success = migrateSampler(candidate, false);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    console.log('');
  }

  // Final summary
  console.log('=== Migration Complete ===');
  console.log(`✓ Successful: ${successCount}`);
  if (failureCount > 0) {
    console.log(`✗ Failed: ${failureCount}`);
  }
  console.log('');

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
