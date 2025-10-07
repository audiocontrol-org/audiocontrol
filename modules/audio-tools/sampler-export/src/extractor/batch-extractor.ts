/**
 * Batch Akai Disk Extractor
 *
 * Automatically discovers and extracts Akai disk images from rsync-based backups
 * with smart timestamp-based change detection.
 *
 * Works with hierarchical rsync backup structure:
 * ~/.audiotools/backup/{sampler}/{device}/*.hds
 *
 * @module extractor/batch-extractor
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, basename, extname, resolve } from "pathe";
import { homedir } from "os";
import { extractAkaiDisk, ExtractionResult } from "@/extractor/disk-extractor.js";

/**
 * Supported Akai sampler types
 *
 * @public
 */
export type SamplerType = "s5k" | "s3k";

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

    /** Sampler types to process (default: ["s5k", "s3k"]) */
    samplerTypes?: SamplerType[];

    /** Force re-extraction even if unchanged (default: false) */
    force?: boolean;

    /** Convert programs to SFZ format (default: true) */
    convertToSFZ?: boolean;

    /** Convert programs to DecentSampler format (default: true) */
    convertToDecentSampler?: boolean;
}

/**
 * Information about a discovered disk image
 *
 * @public
 */
export interface DiskInfo {
    /** Absolute path to disk image file */
    path: string;

    /** Disk name (filename without extension) */
    name: string;

    /** Sampler type this disk belongs to */
    samplerType: SamplerType;

    /** Last modification time of disk image */
    mtime: Date;
}

/**
 * Status of individual disk extraction
 *
 * @public
 */
export type ExtractionStatus = "success" | "skipped" | "updated" | "failed" | "warning";

/**
 * Result of extracting a single disk
 *
 * @public
 */
export interface DiskExtractionStatus {
    /** Information about the disk */
    disk: DiskInfo;

    /** Extraction status */
    status: ExtractionStatus;

    /** Human-readable reason for status */
    reason: string;

    /** Detailed extraction result (if extraction was attempted) */
    result?: ExtractionResult;
}

/**
 * Result of batch extraction operation
 *
 * @public
 */
export interface BatchExtractionResult {
    /** Total number of disks found */
    totalDisks: number;

    /** Number of successfully extracted new disks */
    successful: number;

    /** Number of updated disks (re-extracted due to changes) */
    updated: number;

    /** Number of skipped disks (unchanged) */
    skipped: number;

    /** Number of failed extractions */
    failed: number;

    /** Number of warnings (unsupported formats) */
    warnings: number;

    /** Aggregate statistics across all extractions */
    aggregateStats: {
        /** Total samples extracted */
        totalSamples: number;

        /** Total programs found */
        totalPrograms: number;

        /** Total SFZ files created */
        totalSFZ: number;

        /** Total DecentSampler presets created */
        totalDecentSampler: number;
    };

    /** Detailed status for each disk */
    details: DiskExtractionStatus[];
}

/**
 * Get default source directory for batch extraction
 *
 * @returns Path to default backup directory (~/.audiotools/backup)
 *
 * @internal
 */
function getDefaultSourceDir(): string {
    return resolve(homedir(), ".audiotools", "backup");
}

/**
 * Get default destination directory for extracted files
 *
 * @returns Path to default extraction directory (~/.audiotools/sampler-export/extracted)
 *
 * @internal
 */
function getDefaultDestDir(): string {
    return resolve(homedir(), ".audiotools", "sampler-export", "extracted");
}


/**
 * Map sampler type to backup directory and device
 *
 * @param samplerType - Sampler type identifier
 * @returns Object with sampler and device directory names
 *
 * @remarks
 * Maps logical sampler types to actual backup directory structure:
 * - "s5k" → { sampler: "pi-scsi2", device: "images" } (S5000/S6000 connected via PiSCSI)
 * - "s3k" → { sampler: "s3k", device: "floppy" } (S3000 sampler with floppy)
 *
 * @internal
 */
function getSamplerBackupPath(samplerType: SamplerType): { sampler: string; device: string } {
    // Map s5k to pi-scsi2/images (S5000/S6000 connected via PiSCSI)
    // Map s3k to s3k/floppy (S3000 sampler with floppy emulator)
    return samplerType === "s5k"
        ? { sampler: "pi-scsi2", device: "images" }
        : { sampler: "s3k", device: "floppy" };
}

/**
 * Recursively find disk images in a directory
 *
 * @param dir - Directory to search
 * @param results - Accumulator array for results (used in recursion)
 * @returns Array of absolute paths to disk image files (.hds, .img)
 *
 * @remarks
 * Searches recursively for files with extensions:
 * - .hds - Hard disk image format
 * - .img - Generic disk image format
 *
 * @internal
 */
function findDiskImagesRecursive(dir: string, results: string[] = []): string[] {
    try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recurse into subdirectories
                findDiskImagesRecursive(fullPath, results);
            } else if (entry.isFile()) {
                const ext = extname(entry.name).toLowerCase();
                if (ext === ".hds" || ext === ".img") {
                    results.push(fullPath);
                }
            }
        }
    } catch (err) {
        // Directory not readable, skip
    }

    return results;
}

/**
 * Find all disk images in rsync backup structure
 *
 * @param sourceDir - Root backup directory
 * @param samplerType - Type of sampler to search for
 * @returns Sorted array of disk image paths
 *
 * @remarks
 * Rsync structure: sourceDir/{sampler}/{device}/*.hds
 * Example: ~/.audiotools/backup/pi-scsi2/images/*.hds
 *
 * Returns empty array if backup directory doesn't exist.
 *
 * @internal
 */
function findDiskImages(sourceDir: string, samplerType: SamplerType): string[] {
    // Rsync structure: sourceDir/{sampler}/{device}/*.hds
    const { sampler, device } = getSamplerBackupPath(samplerType);
    const diskDir = join(sourceDir, sampler, device);

    if (!existsSync(diskDir)) {
        return [];
    }

    // Recursively search for disk images
    const results = findDiskImagesRecursive(diskDir);
    return results.sort();
}

/**
 * Check if output directory has extracted content
 *
 * @param outputDir - Output directory to check
 * @returns True if directory contains extracted files, false otherwise
 *
 * @remarks
 * Checks for presence of files in the raw/ subdirectory, which indicates
 * a successful previous extraction.
 *
 * @internal
 */
function hasExtractedContent(outputDir: string): boolean {
    try {
        // Check if raw subdirectory exists and has files
        const rawDir = join(outputDir, "raw");
        if (!existsSync(rawDir)) {
            return false;
        }

        const files = readdirSync(rawDir);
        return files.length > 0;
    } catch (err) {
        return false;
    }
}

/**
 * Check if conversions are incomplete (programs found but not all converted)
 *
 * @param outputDir - Path to output directory
 * @returns true if there are programs that haven't been converted
 *
 * @internal
 */
function hasIncompleteConversions(outputDir: string): boolean {
    try {
        const rawDir = join(outputDir, "raw");
        const sfzDir = join(outputDir, "sfz");
        const dsDir = join(outputDir, "decentsampler");

        if (!existsSync(rawDir)) {
            return false;
        }

        // Count program files (case-insensitive)
        let programCount = 0;
        const countPrograms = (dir: string): number => {
            let count = 0;
            if (!existsSync(dir)) return 0;

            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    count += countPrograms(fullPath);
                } else {
                    const lower = entry.name.toLowerCase();
                    if (lower.endsWith(".a3p") || lower.endsWith(".akp")) {
                        count++;
                    }
                }
            }
            return count;
        };

        programCount = countPrograms(rawDir);

        if (programCount === 0) {
            return false; // No programs to convert
        }

        // Count converted files
        const sfzCount = existsSync(sfzDir) ? countPrograms(sfzDir) : 0;
        const dsCount = existsSync(dsDir) ? countPrograms(dsDir) : 0;

        // If we have programs but no conversions, or conversions are fewer than programs
        return (sfzCount < programCount) || (dsCount < programCount);
    } catch (err) {
        return false; // If we can't check, assume complete
    }
}

/**
 * Determine if a disk needs extraction based on timestamps and content
 *
 * @param diskPath - Path to disk image file
 * @param outputDir - Path to output directory
 * @param force - Force extraction regardless of timestamps
 * @returns Object with extraction decision and reason
 *
 * @remarks
 * Decision logic:
 * 1. If force=true: always extract (reason: "forced")
 * 2. If output doesn't exist: extract (reason: "new")
 * 3. If output is empty: extract (reason: "empty (no content)")
 * 4. If disk mtime > output mtime: extract (reason: "modified (disk updated: YYYY-MM-DD)")
 * 5. Otherwise: skip (reason: "unchanged (last: YYYY-MM-DD)")
 *
 * @internal
 */
function needsExtraction(
    diskPath: string,
    outputDir: string,
    force: boolean
): { extract: boolean; reason: string } {
    // Force flag overrides everything
    if (force) {
        return { extract: true, reason: "forced" };
    }

    // Check if output exists
    if (!existsSync(outputDir)) {
        return { extract: true, reason: "new" };
    }

    // Check if output directory has actual content
    if (!hasExtractedContent(outputDir)) {
        return { extract: true, reason: "empty (no content)" };
    }

    // Check if conversions are incomplete
    if (hasIncompleteConversions(outputDir)) {
        return { extract: true, reason: "incomplete conversions" };
    }

    // Compare timestamps
    try {
        const diskStat = statSync(diskPath);
        const outputStat = statSync(outputDir);

        if (diskStat.mtime > outputStat.mtime) {
            const diskDate = diskStat.mtime.toISOString().split("T")[0];
            return { extract: true, reason: `modified (disk updated: ${diskDate})` };
        }

        const lastDate = outputStat.mtime.toISOString().split("T")[0];
        return { extract: false, reason: `unchanged (last: ${lastDate})` };
    } catch (err) {
        // Error reading stats, safer to extract
        return { extract: true, reason: "stat error" };
    }
}


/**
 * Extract a batch of Akai disk images with smart change detection
 *
 * Automatically discovers disk images in rsync backup directory structure and extracts
 * only changed disks using timestamp comparison. Supports both S3K and S5K samplers.
 *
 * The function performs:
 * 1. Disk discovery from rsync backup directories
 * 2. Timestamp-based change detection
 * 3. Parallel extraction of changed disks
 * 4. Aggregate statistics reporting
 * 5. Detailed per-disk status tracking
 *
 * @param options - Batch extraction configuration options
 * @returns Promise resolving to batch extraction results with statistics
 *
 * @remarks
 * Expected rsync backup structure:
 * ```
 * ~/.audiotools/backup/
 *   pi-scsi2/            # S5K/S6K backups
 *     images/*.hds
 *   s3k/                 # S3K backups
 *     floppy/*.img
 * ```
 *
 * Output directory structure:
 * ```
 * ~/.audiotools/sampler-export/extracted/
 *   s5k/                 # S5K disks
 *     disk-name/
 *       raw/
 *       wav/
 *       sfz/
 *       decentsampler/
 *   s3k/                 # S3K disks
 *     disk-name/
 *       ...
 * ```
 *
 * Status icons in output:
 * - ✓ New disk extracted
 * - ↻ Updated disk (modified since last extraction)
 * - ⊘ Skipped (unchanged)
 * - ⚠ Warning (unsupported format)
 * - ✗ Failed (extraction error)
 *
 * @example
 * ```typescript
 * // Extract all changed disks with default settings
 * const result = await extractBatch();
 * console.log(`Processed ${result.totalDisks} disks:`);
 * console.log(`  New: ${result.successful}`);
 * console.log(`  Updated: ${result.updated}`);
 * console.log(`  Skipped: ${result.skipped}`);
 * console.log(`  Total samples: ${result.aggregateStats.totalSamples}`);
 * ```
 *
 * @example
 * ```typescript
 * // Force re-extraction of all S5K disks only
 * const result = await extractBatch({
 *   samplerTypes: ['s5k'],
 *   force: true,
 *   convertToSFZ: true,
 *   convertToDecentSampler: false
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Extract from custom backup location
 * const result = await extractBatch({
 *   sourceDir: '/mnt/backups/samplers',
 *   destDir: '/mnt/extracted',
 *   samplerTypes: ['s3k']
 * });
 * ```
 *
 * @public
 */
export async function extractBatch(
    options: BatchExtractionOptions = {}
): Promise<BatchExtractionResult> {
    const {
        sourceDir = getDefaultSourceDir(),
        destDir = getDefaultDestDir(),
        samplerTypes = ["s5k", "s3k"],
        force = false,
        convertToSFZ = true,
        convertToDecentSampler = true,
    } = options;

    const result: BatchExtractionResult = {
        totalDisks: 0,
        successful: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        warnings: 0,
        aggregateStats: {
            totalSamples: 0,
            totalPrograms: 0,
            totalSFZ: 0,
            totalDecentSampler: 0,
        },
        details: [],
    };

    console.log("Scanning for disk images...");

    // Discover all disks
    const disks: DiskInfo[] = [];

    for (const samplerType of samplerTypes) {
        const diskFiles = findDiskImages(sourceDir, samplerType);

        for (const diskPath of diskFiles) {
            const diskStat = statSync(diskPath);
            disks.push({
                path: diskPath,
                name: basename(diskPath, extname(diskPath)),
                samplerType,
                mtime: diskStat.mtime,
            });
        }
    }

    result.totalDisks = disks.length;

    if (disks.length === 0) {
        console.log("No disk images found.");
        console.log(`  Looking in: ${sourceDir}`);
        console.log(`  Expected structure: ${sourceDir}/pi-scsi2/images/*.hds (for S5K)`);
        console.log(`                      ${sourceDir}/s3k/floppy/*.img (for S3K)`);
        console.log(`  Default location: ~/.audiotools/backup/`);
        console.log(`  Run 'pnpm backup:batch' in sampler-backup to create backups first`);
        return result;
    }

    // Count by type
    const s5kCount = disks.filter((d) => d.samplerType === "s5k").length;
    const s3kCount = disks.filter((d) => d.samplerType === "s3k").length;
    console.log(`Found ${disks.length} disks (${s5kCount} S5K, ${s3kCount} S3K)\n`);

    // Group by sampler type for organized output
    const disksByType = new Map<SamplerType, DiskInfo[]>();
    for (const samplerType of samplerTypes) {
        disksByType.set(
            samplerType,
            disks.filter((d) => d.samplerType === samplerType)
        );
    }

    // Extract each group
    for (const [samplerType, typeDisks] of disksByType) {
        if (typeDisks.length === 0) continue;

        const label = samplerType === "s5k" ? "S5K" : "S3K";
        console.log(`Extracting ${label} disks:`);

        for (let i = 0; i < typeDisks.length; i++) {
            const disk = typeDisks[i];
            const outputDir = join(destDir, samplerType);

            // Check if extraction needed
            const diskOutputDir = join(outputDir, disk.name);
            const { extract, reason } = needsExtraction(disk.path, diskOutputDir, force);

            const status: DiskExtractionStatus = {
                disk,
                status: "skipped",
                reason,
            };

            if (!extract) {
                // Skip this disk
                result.skipped++;
                status.status = "skipped";
                console.log(`  [${i + 1}/${typeDisks.length}] ${disk.name} ⊘ ${reason}`);
            } else {
                // Extract this disk
                try {
                    const extractResult = await extractAkaiDisk({
                        diskImage: disk.path,
                        outputDir,
                        convertToSFZ,
                        convertToDecentSampler,
                    });

                    status.result = extractResult;

                    if (extractResult.success) {
                        const isUpdate = reason.startsWith("modified");
                        status.status = isUpdate ? "updated" : "success";

                        if (isUpdate) {
                            result.updated++;
                            console.log(
                                `  [${i + 1}/${typeDisks.length}] ${disk.name} ↻ ${reason} ` +
                                `(${extractResult.stats.samplesConverted} samples, ${extractResult.stats.programsFound} programs)`
                            );
                        } else {
                            result.successful++;
                            const icon = reason === "new" ? "✓" : "↻";
                            console.log(
                                `  [${i + 1}/${typeDisks.length}] ${disk.name} ${icon} ${reason} ` +
                                `(${extractResult.stats.samplesConverted} samples, ${extractResult.stats.programsFound} programs)`
                            );
                        }

                        // Aggregate stats
                        result.aggregateStats.totalSamples +=
                            extractResult.stats.samplesConverted;
                        result.aggregateStats.totalPrograms +=
                            extractResult.stats.programsFound;
                        result.aggregateStats.totalSFZ += extractResult.stats.sfzCreated;
                        result.aggregateStats.totalDecentSampler +=
                            extractResult.stats.dspresetCreated;
                    } else {
                        // Check if this is an unsupported format (warning) vs actual error (failure)
                        const errorMsg = extractResult.errors[0] || "unknown error";
                        const isUnsupportedFormat =
                            errorMsg.includes("non DOS media") ||
                            errorMsg.includes("not supported") ||
                            errorMsg.includes("DR16 format");

                        if (isUnsupportedFormat) {
                            status.status = "warning";
                            status.reason = errorMsg;
                            result.warnings++;
                            console.log(
                                `  [${i + 1}/${typeDisks.length}] ${disk.name} ⚠ unsupported format (${status.reason})`
                            );
                        } else {
                            status.status = "failed";
                            status.reason = errorMsg;
                            result.failed++;
                            console.log(
                                `  [${i + 1}/${typeDisks.length}] ${disk.name} ✗ failed (${status.reason})`
                            );
                        }
                    }
                } catch (err: any) {
                    status.status = "failed";
                    status.reason = err.message;
                    result.failed++;
                    console.log(
                        `  [${i + 1}/${typeDisks.length}] ${disk.name} ✗ failed (${err.message})`
                    );
                }
            }

            result.details.push(status);
        }

        console.log(""); // Blank line between groups
    }

    // Print summary
    console.log("Summary:");
    if (result.successful > 0) {
        console.log(`  New: ${result.successful}`);
    }
    if (result.updated > 0) {
        console.log(`  Updated: ${result.updated}`);
    }
    if (result.skipped > 0) {
        console.log(`  Unchanged: ${result.skipped}`);
    }
    if (result.warnings > 0) {
        console.log(`  Warnings: ${result.warnings} (unsupported formats)`);
    }
    if (result.failed > 0) {
        console.log(`  Failed: ${result.failed}`);
    }
    if (result.aggregateStats.totalSamples > 0) {
        console.log(`  Total samples: ${result.aggregateStats.totalSamples}`);
    }
    if (result.aggregateStats.totalPrograms > 0) {
        console.log(`  Total programs: ${result.aggregateStats.totalPrograms}`);
    }

    return result;
}
