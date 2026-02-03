/**
 * Batch Akai Disk Extractor
 *
 * Automatically discovers and extracts Akai disk images with smart
 * timestamp-based change detection.
 *
 * Uses shared disk discovery logic from sampler-backup to ensure consistency
 * between backup and export operations.
 *
 * @module extractor/batch-extractor
 */

import { existsSync, statSync } from "fs";
import { join, basename, resolve } from "pathe";
import { homedir } from "os";
import { extractAkaiDisk, type ExtractionResult } from "@/lib/extractor/disk-extractor.js";
import { discoverDiskImages, type DiskInfo, type SamplerType } from "@audiocontrol/sampler-backup";

/**
 * Configuration options for batch extraction
 *
 * @public
 */
export interface BatchExtractionOptions {
    /** Source directory containing disk images (default: ~/.audiotools/backup) */
    sourceDir?: string;

    /** Destination directory for extracted files (default: ~/.audiotools/sampler-export/extracted) */
    destDir?: string;

    /** Sampler types to process (default: all discovered types) */
    samplerTypes?: SamplerType[];

    /** Force re-extraction even if unchanged (default: false) */
    force?: boolean;

    /** Convert programs to SFZ format (default: true) */
    convertToSFZ?: boolean;

    /** Convert programs to DecentSampler format (default: true) */
    convertToDecentSampler?: boolean;
}

/**
 * Results from batch extraction
 *
 * @public
 */
export interface BatchExtractionResult {
    /** Number of successfully extracted disks */
    successful: number;

    /** Number of failed extractions */
    failed: number;

    /** Number of skipped disks (unchanged) */
    skipped: number;

    /** Total disks processed */
    total: number;

    /** Detailed results for each disk */
    details: DiskExtractionDetail[];
}

/**
 * Detailed result for a single disk extraction
 *
 * @public
 */
export interface DiskExtractionDetail {
    /** Disk image path */
    diskPath: string;

    /** Disk name */
    name: string;

    /** Detected sampler type */
    samplerType: SamplerType;

    /** Extraction status */
    status: 'success' | 'failed' | 'skipped';

    /** Error message if failed */
    error?: string;

    /** Extraction result if successful */
    result?: ExtractionResult;
}

/**
 * Default source directory for batch extraction
 */
const DEFAULT_SOURCE_DIR = join(homedir(), '.audiotools', 'backup');

/**
 * Default destination directory for extracted files
 */
const DEFAULT_DEST_DIR = join(homedir(), '.audiotools', 'sampler-export', 'extracted');

/**
 * Check if disk needs extraction based on timestamps
 *
 * @param diskPath - Path to source disk image
 * @param extractedPath - Path to extracted output directory
 * @returns true if extraction needed, false if can skip
 */
function needsExtraction(diskPath: string, extractedPath: string): boolean {
    if (!existsSync(extractedPath)) {
        return true;
    }

    try {
        const diskStat = statSync(diskPath);
        const extractedStat = statSync(extractedPath);

        // Extract if disk is newer than extraction
        return diskStat.mtime > extractedStat.mtime;
    } catch {
        // On error, assume we need extraction
        return true;
    }
}

/**
 * Extract a single disk image
 *
 * @param disk - Disk information from discovery
 * @param destDir - Destination directory base path
 * @param options - Extraction options
 * @returns Extraction detail result
 */
async function extractSingleDisk(
    disk: DiskInfo,
    destDir: string,
    options: BatchExtractionOptions
): Promise<DiskExtractionDetail> {
    const outputDir = join(destDir, disk.samplerType, disk.name);

    // Check if extraction needed
    if (!options.force && !needsExtraction(disk.path, outputDir)) {
        return {
            diskPath: disk.path,
            name: disk.name,
            samplerType: disk.samplerType,
            status: 'skipped',
        };
    }

    try {
        const result = await extractAkaiDisk({
            diskImage: disk.path,
            outputDir,
            convertToSFZ: options.convertToSFZ ?? true,
            convertToDecentSampler: options.convertToDecentSampler ?? true,
        });

        return {
            diskPath: disk.path,
            name: disk.name,
            samplerType: disk.samplerType,
            status: 'success',
            result,
        };
    } catch (error: any) {
        return {
            diskPath: disk.path,
            name: disk.name,
            samplerType: disk.samplerType,
            status: 'failed',
            error: error.message,
        };
    }
}

/**
 * Extract multiple Akai disk images in batch
 *
 * Discovers disk images using shared sampler-backup logic, then extracts
 * each one with optional format conversion.
 *
 * @param options - Batch extraction options
 * @returns Batch extraction results
 *
 * @example
 * ```typescript
 * const result = await extractBatch({
 *   sourceDir: '/Users/orion/.audiotools/backup/s5k/images',
 *   destDir: '/Users/orion/.audiotools/sampler-export/extracted',
 *   force: false
 * });
 *
 * console.log(`Extracted ${result.successful} disks, skipped ${result.skipped}`);
 * ```
 *
 * @public
 */
export async function extractBatch(
    options: BatchExtractionOptions = {}
): Promise<BatchExtractionResult> {
    const sourceDir = resolve(options.sourceDir || DEFAULT_SOURCE_DIR);
    const destDir = resolve(options.destDir || DEFAULT_DEST_DIR);

    if (!existsSync(sourceDir)) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    console.log(`Discovering disk images in: ${sourceDir}`);

    // Use shared discovery logic from sampler-backup
    const allDisks = discoverDiskImages(sourceDir);

    // Filter by sampler types if specified
    const disksToProcess = options.samplerTypes
        ? allDisks.filter(disk => options.samplerTypes!.includes(disk.samplerType))
        : allDisks;

    console.log(`Found ${disksToProcess.length} disk(s) to process`);

    const details: DiskExtractionDetail[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const disk of disksToProcess) {
        console.log(`\nProcessing: ${disk.name} (${disk.samplerType})`);
        console.log(`  Source: ${disk.path}`);

        const detail = await extractSingleDisk(disk, destDir, options);
        details.push(detail);

        if (detail.status === 'success') {
            successful++;
            console.log(`  ✓ Extraction successful`);
        } else if (detail.status === 'skipped') {
            skipped++;
            console.log(`  ⊘ Skipped (unchanged)`);
        } else {
            failed++;
            console.error(`  ✗ Extraction failed: ${detail.error}`);
        }
    }

    return {
        successful,
        failed,
        skipped,
        total: disksToProcess.length,
        details,
    };
}

// Re-export shared types for convenience
export type { SamplerType, DiskInfo };
