/**
 * Export Command
 *
 * Extract and convert Akai disk images to modern formats.
 * Supports both config-based (zero-flag) and flag-based (backward compatible) workflows.
 */

import { Command } from 'commander';
import {
  loadConfig,
  getEnabledExportSources,
  resolveBackupPath,
  type BackupSource,
  type ExportConfig
} from '@oletizi/audiotools-config';
import { extractBatch, type SamplerType } from '@oletizi/sampler-export';
import { homedir } from 'os';
import { join } from 'pathe';
import { existsSync, statSync } from 'node:fs';

const DEFAULT_OUTPUT_ROOT = join(homedir(), '.audiotools', 'sampler-export', 'extracted');
const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');

/**
 * Get backup directory for a specific source.
 *
 * Reads backupPath from source config if available (new behavior).
 * Falls back to computing path for backward compatibility with old configs.
 */
function getSourceBackupDir(source: BackupSource, backupRoot: string): string {
  // New behavior: use backupPath from config if available
  if (source.backupPath && existsSync(source.backupPath)) {
    return source.backupPath;
  }

  // Fallback for old configs without backupPath
  console.warn(`  ⚠️  Source "${source.name}" missing backupPath, using fallback`);
  const computedPath = resolveBackupPath(source, backupRoot);

  if (existsSync(computedPath)) {
    return computedPath;
  }

  throw new Error(
    `Backup directory not found for source "${source.name}".\n` +
    `  Expected: ${source.backupPath || computedPath}\n` +
    `  Run 'audiotools backup ${source.name}' to create a backup first.`
  );
}

/**
 * Extract a single source using config
 */
async function extractFromConfig(
  source: BackupSource,
  exportConfig: ExportConfig,
  backupRoot: string
): Promise<void> {
  console.log(`\nExtracting: ${source.name}`);
  console.log(`  Device: ${source.device}`);
  console.log(`  Formats: ${exportConfig.formats.join(', ')}`);

  try {
    const sourceDir = getSourceBackupDir(source, backupRoot);
    // Use same structure as backup: sampler/device instead of source-name/device
    const sampler = source.sampler || 'unknown';
    const destDir = join(exportConfig.outputRoot, sampler, source.device);

    console.log(`  Source: ${sourceDir}`);
    console.log(`  Output: ${destDir}`);

    // Don't filter by samplerTypes - we already know this backup came from the configured sampler.
    // The detected samplerType from disk headers is used to determine extraction method,
    // not to filter which disks to process. DOS/FAT formatted S3K disks will show as 'unknown'.
    const result = await extractBatch({
      sourceDir,
      destDir,
      force: !exportConfig.skipUnchanged,
      convertToSFZ: exportConfig.formats.includes('sfz'),
      convertToDecentSampler: exportConfig.formats.includes('decentsampler'),
    });

    if (result.failed > 0) {
      console.error(`  ✗ Extraction completed with ${result.failed} failure(s)`);
    } else {
      console.log(`  ✓ Extraction completed successfully`);
      console.log(`    Successful: ${result.successful}`);
      console.log(`    Skipped: ${result.skipped}`);
    }
  } catch (error: any) {
    console.error(`  ✗ Extraction failed: ${error.message}`);
    throw error;
  }
}

/**
 * Extract using flags (backward compatible mode)
 */
async function extractWithFlags(options: any): Promise<void> {
  const { input, output, format } = options;

  if (!input) {
    throw new Error('--input flag is required when not using config');
  }

  const outputDir = output || DEFAULT_OUTPUT_ROOT;
  const formats = format ? format.split(',').map((f: string) => f.trim()) : ['sfz', 'decentsampler'];

  console.log('\nExtraction (flag-based mode):');
  console.log(`  Input: ${input}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Formats: ${formats.join(', ')}`);

  const isDirectory = existsSync(input) && statSync(input).isDirectory();

  if (isDirectory) {
    // Batch extraction from directory
    const result = await extractBatch({
      sourceDir: input,
      destDir: outputDir,
      force: options.force || false,
      convertToSFZ: formats.includes('sfz'),
      convertToDecentSampler: formats.includes('decentsampler'),
    });

    if (result.failed > 0) {
      console.error(`\n✗ Extraction completed with ${result.failed} failure(s)`);
      process.exit(1);
    } else {
      console.log(`\n✓ Extraction completed successfully`);
      console.log(`  Successful: ${result.successful}`);
      console.log(`  Skipped: ${result.skipped}`);
    }
  } else {
    // Single disk image extraction
    throw new Error('Single disk extraction via flags not yet implemented. Please use batch mode or config-based workflow.');
  }
}

/**
 * Export command - extract and convert disk images
 */
export const exportCommand = new Command('export')
  .description('Extract and convert disk images to modern formats')
  .argument('[source-name]', 'Specific source name to export (from config)')
  .option('-i, --input <path>', 'Input disk image or directory')
  .option('-o, --output <path>', `Output directory (default: ${DEFAULT_OUTPUT_ROOT})`)
  .option('-f, --format <formats>', 'Output formats: sfz,decentsampler (comma-separated)')
  .option('--force', 'Force re-extraction of all disks (ignore skipUnchanged setting)')
  .option('--backup-root <path>', `Backup root directory (default: ${DEFAULT_BACKUP_ROOT})`)
  .action(async (sourceName: string | undefined, options) => {
    try {
      // Flag-based mode (backward compatible)
      if (options.input) {
        await extractWithFlags(options);
        return;
      }

      // Config-based mode (new unified workflow)
      const config = await loadConfig();

      if (!config.export) {
        console.error('\nNo export configuration found.');
        console.error('Run "audiotools config" to configure export settings.');
        process.exit(1);
      }

      if (!config.backup) {
        console.error('\nNo backup configuration found.');
        console.error('Export requires backup sources. Run "audiotools config" to configure.');
        process.exit(1);
      }

      const backupRoot = options.backupRoot || config.backup.backupRoot || DEFAULT_BACKUP_ROOT;
      const enabledSources = getEnabledExportSources(config);

      if (enabledSources.length === 0) {
        console.log('\nNo enabled export sources found.');
        console.log('Run "audiotools config" to enable sources for export.');
        return;
      }

      // Apply force flag if provided (overrides skipUnchanged setting)
      const exportConfig: ExportConfig = {
        ...config.export,
        skipUnchanged: options.force ? false : config.export.skipUnchanged,
      };

      // Export specific source by name
      if (sourceName) {
        const source = enabledSources.find(s => s.name === sourceName);

        if (!source) {
          console.error(`\nSource not found: ${sourceName}`);
          console.error('\nAvailable sources:');
          enabledSources.forEach(s => {
            console.error(`  - ${s.name}`);
          });
          process.exit(1);
        }

        await extractFromConfig(source, exportConfig, backupRoot);
      } else {
        // Export all enabled sources
        console.log(`\nExtracting ${enabledSources.length} source(s)...`);

        let succeeded = 0;
        let failed = 0;

        for (const source of enabledSources) {
          try {
            await extractFromConfig(source, exportConfig, backupRoot);
            succeeded++;
          } catch (error) {
            failed++;
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`Export Summary:`);
        console.log(`  Succeeded: ${succeeded}`);
        console.log(`  Failed: ${failed}`);
        console.log('='.repeat(60));

        if (failed > 0) {
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error(`\nExport error: ${error.message}`);
      process.exit(1);
    }
  });
