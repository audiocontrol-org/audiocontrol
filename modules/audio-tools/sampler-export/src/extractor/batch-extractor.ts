/**
 * Batch Akai Disk Extractor
 *
 * Automatically discovers and extracts Akai disk images from well-known directories,
 * with smart timestamp-based change detection.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, basename, extname, resolve } from "pathe";
import { homedir } from "os";
import { extractAkaiDisk, ExtractionResult } from "@/extractor/disk-extractor.js";

export type SamplerType = "s5k" | "s3k";

export interface BatchExtractionOptions {
    sourceDir?: string;
    destDir?: string;
    samplerTypes?: SamplerType[];
    force?: boolean;
    convertToSFZ?: boolean;
    convertToDecentSampler?: boolean;
}

export interface DiskInfo {
    path: string;
    name: string;
    samplerType: SamplerType;
    mtime: Date;
}

export type ExtractionStatus = "success" | "skipped" | "updated" | "failed";

export interface DiskExtractionStatus {
    disk: DiskInfo;
    status: ExtractionStatus;
    reason: string;
    result?: ExtractionResult;
}

export interface BatchExtractionResult {
    totalDisks: number;
    successful: number;
    updated: number;
    skipped: number;
    failed: number;
    aggregateStats: {
        totalSamples: number;
        totalPrograms: number;
        totalSFZ: number;
        totalDecentSampler: number;
    };
    details: DiskExtractionStatus[];
}

/**
 * Get default source directory
 */
function getDefaultSourceDir(): string {
    return resolve(homedir(), ".audiotools", "backup");
}

/**
 * Get default destination directory
 */
function getDefaultDestDir(): string {
    return resolve(homedir(), ".audiotools", "sampler-export", "extracted");
}

/**
 * Get the rsnapshot interval directory (defaults to daily.0 which is most recent)
 */
function getRsnapshotIntervalDir(backupRoot: string, interval: string = "daily.0"): string {
    return join(backupRoot, interval);
}

/**
 * Map sampler type to backup directory name
 */
function getSamplerBackupDir(samplerType: SamplerType): string {
    // Map s5k to pi-scsi2 (S5000/S6000 connected via PiSCSI)
    return samplerType === "s5k" ? "pi-scsi2" : "s3k";
}

/**
 * Recursively find disk images in a directory
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
 * Find all disk images in rsnapshot backup structure
 * Rsnapshot preserves full path structure, so we need to search recursively
 */
function findDiskImages(sourceDir: string, samplerType: SamplerType): string[] {
    // Rsnapshot structure: sourceDir/daily.0/pi-scsi2/home/orion/images/*.hds
    const intervalDir = getRsnapshotIntervalDir(sourceDir);
    const backupDir = getSamplerBackupDir(samplerType);
    const diskDir = join(intervalDir, backupDir);

    if (!existsSync(diskDir)) {
        return [];
    }

    // Recursively search for disk images
    const results = findDiskImagesRecursive(diskDir);
    return results.sort();
}

/**
 * Determine if a disk needs extraction based on timestamps
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
 * Extract a batch of Akai disk images
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
        console.log(`  Expected structure: ${sourceDir}/daily.0/pi-scsi2/**/*.hds (for S5K)`);
        console.log(`  Note: rsnapshot preserves full remote path structure`);
        console.log(`  Default location: ~/.audiotools/backup/ (rsnapshot backup root)`);
        console.log(`  Run 'akai-backup batch' to create backups first`);
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
                        status.status = "failed";
                        status.reason = extractResult.errors[0] || "unknown error";
                        result.failed++;
                        console.log(
                            `  [${i + 1}/${typeDisks.length}] ${disk.name} ✗ failed (${status.reason})`
                        );
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
