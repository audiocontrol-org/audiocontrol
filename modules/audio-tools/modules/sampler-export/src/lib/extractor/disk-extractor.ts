/**
 * Akai Disk Image Extractor
 *
 * Orchestrates extraction of Akai disk images and conversion to modern formats.
 * Supports both native Akai format disks and DOS/FAT32 formatted disks.
 *
 * @module extractor/disk-extractor
 */

import { mkdirSync, existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, basename, extname, dirname, relative } from "pathe";
import { newAkaitools, newAkaiToolsConfig } from "@oletizi/sampler-devices";
import type { Akaitools } from "@oletizi/sampler-devices";
import { convertA3PToSFZ } from "@/lib/converters/s3k-to-sfz.js";
import { convertA3PToDecentSampler } from "@/lib/converters/s3k-to-decentsampler.js";
import { convertAKPToSFZ } from "@/lib/converters/s5k-to-sfz.js";
import { convertAKPToDecentSampler } from "@/lib/converters/s5k-to-decentsampler.js";
import { isDosDisk, extractDosDisk } from "@/lib/extractor/dos-disk-extractor.js";
import { getAuditLogger } from "@/lib/utils/audit-logger.js";

/**
 * Configuration options for disk extraction
 *
 * @public
 */
export interface ExtractionOptions {
    /** Path to the disk image file (.hds, .img, etc.) */
    diskImage: string;

    /** Output directory for extracted files */
    outputDir: string;

    /** Whether to convert programs to SFZ format (default: true) */
    convertToSFZ?: boolean;

    /** Whether to convert programs to DecentSampler format (default: true) */
    convertToDecentSampler?: boolean;

    /** Suppress console output (default: false) */
    quiet?: boolean;
}

/**
 * Result of a disk extraction operation
 *
 * @public
 */
export interface ExtractionResult {
    /** Whether extraction completed successfully */
    success: boolean;

    /** Name of the disk (derived from filename) */
    diskName: string;

    /** Absolute path to output directory */
    outputDir: string;

    /** Statistics about extracted content */
    stats: {
        /** Number of samples extracted from disk */
        samplesExtracted: number;

        /** Number of samples successfully converted to WAV */
        samplesConverted: number;

        /** Number of program files found */
        programsFound: number;

        /** Number of SFZ files created */
        sfzCreated: number;

        /** Number of DecentSampler presets created */
        dspresetCreated: number;
    };

    /** Array of error messages encountered during extraction */
    errors: string[];
}

/**
 * Extract an Akai disk image and convert programs to modern formats
 *
 * This function automatically detects whether the disk is in native Akai format
 * or DOS/FAT32 format and uses the appropriate extraction method.
 *
 * The extraction creates the following directory structure:
 * ```
 * outputDir/
 *   diskName/
 *     raw/          - Original files from disk
 *     wav/          - Converted WAV samples
 *     sfz/          - SFZ instrument files
 *     decentsampler/ - DecentSampler preset files
 * ```
 *
 * @param options - Extraction configuration options
 * @returns Promise resolving to extraction result with statistics
 *
 * @throws Error if disk image file doesn't exist or is unreadable
 *
 * @example
 * ```typescript
 * // Extract with all conversions enabled
 * const result = await extractAkaiDisk({
 *   diskImage: '/path/to/disk.hds',
 *   outputDir: '/path/to/output',
 *   convertToSFZ: true,
 *   convertToDecentSampler: true
 * });
 *
 * console.log(`Extracted ${result.stats.samplesConverted} samples`);
 * console.log(`Created ${result.stats.sfzCreated} SFZ files`);
 * ```
 *
 * @example
 * ```typescript
 * // Extract without conversion (raw files only)
 * const result = await extractAkaiDisk({
 *   diskImage: '/backup/s5k-disk.hds',
 *   outputDir: '/output',
 *   convertToSFZ: false,
 *   convertToDecentSampler: false,
 *   quiet: true
 * });
 * ```
 *
 * @public
 */
export async function extractAkaiDisk(
    options: ExtractionOptions
): Promise<ExtractionResult> {
    const { diskImage, outputDir, convertToSFZ = true, convertToDecentSampler = true, quiet = false } = options;

    const result: ExtractionResult = {
        success: false,
        diskName: "",
        outputDir: "",
        stats: {
            samplesExtracted: 0,
            samplesConverted: 0,
            programsFound: 0,
            sfzCreated: 0,
            dspresetCreated: 0,
        },
        errors: [],
    };

    const auditLogger = getAuditLogger();

    try {
        // Extract disk name from filename
        const diskName = basename(diskImage, extname(diskImage));
        result.diskName = diskName;

        auditLogger.info('EXTRACTION_START', `Starting extraction of disk image`, diskName, {
            diskImage,
            outputDir
        });

        // Check if this is a DOS/FAT disk
        if (isDosDisk(diskImage)) {
            if (!quiet) {
                console.log(`Detected DOS/FAT32 formatted disk: ${diskName}`);
            }

            // Use DOS extractor for FAT-formatted disks
            const dosResult = await extractDosDisk(diskImage, diskName, outputDir, quiet);

            // Copy results from DOS extraction
            result.outputDir = dosResult.outputDir;
            result.errors = dosResult.errors;
            result.stats = dosResult.stats;  // Preserve sample stats from DOS extraction

            // If DOS extraction failed, check if we have existing raw files to convert
            if (!dosResult.success) {
                const rawDir = join(dosResult.outputDir, "raw");
                if (!existsSync(rawDir) || !hasExtractedContent(rawDir)) {
                    // No existing files, can't proceed
                    return dosResult;
                }
                // Has existing raw files - log warning but continue with conversion
                if (!quiet) {
                    console.log(`Warning: Disk extraction failed, but found existing raw files. Proceeding with conversion...`);
                }
                dosResult.errors.push("Disk extraction failed, but converted existing raw files");
            }

            // Continue to convert samples and programs below
            // (using the same logic as Akai native disks)
        } else {
            // Native Akai format disk - use akaitools
            if (!quiet) {
                console.log(`Reading Akai disk: ${diskImage}`);
            }

            // Create output directories under disk-specific subdirectory
            const diskOutputDir = join(outputDir, diskName);
            result.outputDir = diskOutputDir;

            const rawDir = join(diskOutputDir, "raw");
            const wavDir = join(diskOutputDir, "wav");
            const sfzDir = join(diskOutputDir, "sfz");
            const dsDir = join(diskOutputDir, "decentsampler");

            mkdirSync(rawDir, { recursive: true });
            mkdirSync(wavDir, { recursive: true });
            mkdirSync(sfzDir, { recursive: true });
            mkdirSync(dsDir, { recursive: true });

            // Initialize akaitools
            const config = await newAkaiToolsConfig();
            config.diskFile = diskImage;
            const akaitools: Akaitools = newAkaitools(config);

            // Read disk contents
            const diskResult = await akaitools.readAkaiDisk();

            if (diskResult.errors.length > 0) {
                result.errors.push(...diskResult.errors.map((e) => e.message));
                return result;
            }

            // Extract all files from all partitions
            const partitions = diskResult.data.partitions;
            if (!quiet) {
                console.log(`Extracting files from ${partitions.length} partition(s)...`);
            }

            for (let i = 0; i < partitions.length; i++) {
                const partitionNum = i + 1; // Partitions are 1-indexed
                const partition = partitions[i];

                // Create partition-specific subdirectory if more than one partition
                const partitionDir = partitions.length > 1
                    ? join(rawDir, `partition_${String(partitionNum).padStart(3, '0')}`)
                    : rawDir;

                if (partitions.length > 1) {
                    mkdirSync(partitionDir, { recursive: true });
                }

                if (!quiet && partitions.length > 1) {
                    console.log(`  Partition ${partitionNum}: ${partition.volumes.length} volume(s)`);
                }

                const extractResult = await akaitools.akaiRead("/", partitionDir, partitionNum, true);

                if (extractResult.errors.length > 0) {
                    result.errors.push(...extractResult.errors.map((e) => e.message));
                }
            }
        }

        // Common conversion logic for both DOS and Akai disks
        const diskOutputDir = result.outputDir;
        const rawDir = join(diskOutputDir, "raw");
        const wavDir = join(diskOutputDir, "wav");
        const sfzDir = join(diskOutputDir, "sfz");
        const dsDir = join(diskOutputDir, "decentsampler");

        // Convert .a3s samples to WAV (only for native Akai disks)
        const a3sFiles = findFiles(rawDir, ".a3s");

        if (a3sFiles.length > 0) {
            // Native Akai disk with .a3s files - convert using akaitools
            if (!quiet) {
                console.log("Converting Akai samples to WAV...");
            }

            // Akaitools is only available for native Akai disks
            const config = await newAkaiToolsConfig();
            config.diskFile = diskImage;
            const akaitools: Akaitools = newAkaitools(config);

            result.stats.samplesExtracted = a3sFiles.length;

            for (const a3sFile of a3sFiles) {
                try {
                    // Preserve directory structure from raw/ in wav/
                    const relPath = relative(rawDir, a3sFile);
                    const relDir = dirname(relPath);
                    const sampleName = basename(a3sFile, extname(a3sFile));

                    // Create corresponding subdirectory in wav/
                    const wavSubDir = join(wavDir, relDir);
                    mkdirSync(wavSubDir, { recursive: true });

                    const wavFile = join(wavSubDir, `${sampleName}.wav`);

                    if (existsSync(wavFile)) {
                        // Check if WAV is newer than source .a3s file
                        const a3sStat = statSync(a3sFile);
                        const wavStat = statSync(wavFile);

                        if (wavStat.mtime >= a3sStat.mtime) {
                            // WAV file is up-to-date, skip conversion
                            result.stats.samplesConverted++;
                            continue;
                        }
                    }

                    // akai2wav outputs to cwd, so we need to cd to the target subdirectory
                    const origCwd = process.cwd();
                    process.chdir(wavSubDir);

                    await akaitools.akai2Wav(a3sFile);
                    result.stats.samplesConverted++;

                    process.chdir(origCwd);
                } catch (err: any) {
                    result.errors.push(`Failed to convert ${basename(a3sFile)}: ${err.message}`);
                }
            }
        } else if (isDosDisk(diskImage)) {
            // DOS disk stats already set by DOS extractor
            // (samplesExtracted and samplesConverted already populated)
        }

        // Find and convert programs
        const a3pFiles = findFiles(rawDir, ".a3p");
        const akpFiles = findFiles(rawDir, ".akp");
        result.stats.programsFound = a3pFiles.length + akpFiles.length;

        // Check existing conversions
        const existingSfz = convertToSFZ ? findFiles(sfzDir, ".sfz") : [];
        const existingDs = convertToDecentSampler ? findFiles(dsDir, ".dspreset") : [];

        // Convert S3K programs (.a3p)
        if (a3pFiles.length > 0) {
            const toConvert = findMissingConversions(a3pFiles, existingSfz, existingDs, rawDir, sfzDir, dsDir, convertToSFZ, convertToDecentSampler);

            if (toConvert.length > 0 && !quiet) {
                console.log(`Converting ${toConvert.length} S3K programs (${existingSfz.length} SFZ, ${existingDs.length} DS already exist)...`);
            }

            for (const a3pFile of toConvert) {
                try {
                    // Preserve directory structure from raw/ in sfz/ and decentsampler/
                    const relPath = relative(rawDir, a3pFile);
                    const relDir = dirname(relPath);

                    if (convertToSFZ) {
                        const sfzSubDir = join(sfzDir, relDir);
                        mkdirSync(sfzSubDir, { recursive: true });

                        // WAV files are in corresponding subdirectory
                        const wavSubDir = join(wavDir, relDir);

                        await convertA3PToSFZ(a3pFile, sfzSubDir, wavSubDir);
                        result.stats.sfzCreated++;
                    }
                    if (convertToDecentSampler) {
                        const dsSubDir = join(dsDir, relDir);
                        mkdirSync(dsSubDir, { recursive: true });

                        // WAV files are in corresponding subdirectory
                        const wavSubDir = join(wavDir, relDir);

                        await convertA3PToDecentSampler(a3pFile, dsSubDir, wavSubDir);
                        result.stats.dspresetCreated++;
                    }
                } catch (err: any) {
                    const errorMsg = `Failed to convert ${basename(a3pFile)}: ${err.message}`;
                    result.errors.push(errorMsg);

                    // Read file header for audit log
                    try {
                        const header = readFileSync(a3pFile).slice(0, 16);
                        const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        auditLogger.conversionFailure(diskName, a3pFile, err.message, headerHex);
                    } catch {
                        auditLogger.conversionFailure(diskName, a3pFile, err.message);
                    }
                }
            }
        }

        // Convert S5K programs (.akp)
        if (akpFiles.length > 0) {
            const toConvert = findMissingConversions(akpFiles, existingSfz, existingDs, rawDir, sfzDir, dsDir, convertToSFZ, convertToDecentSampler);

            if (toConvert.length > 0 && !quiet) {
                console.log(`Converting ${toConvert.length} S5K programs (${existingSfz.length} SFZ, ${existingDs.length} DS already exist)...`);
            }

            for (const akpFile of toConvert) {
                try {
                    // Preserve directory structure from raw/ in sfz/ and decentsampler/
                    const relPath = relative(rawDir, akpFile);
                    const relDir = dirname(relPath);

                    if (convertToSFZ) {
                        const sfzSubDir = join(sfzDir, relDir);
                        mkdirSync(sfzSubDir, { recursive: true });

                        // WAV files are in corresponding subdirectory
                        const wavSubDir = join(wavDir, relDir);

                        convertAKPToSFZ(akpFile, sfzSubDir, wavSubDir);
                        result.stats.sfzCreated++;
                    }
                    if (convertToDecentSampler) {
                        const dsSubDir = join(dsDir, relDir);
                        mkdirSync(dsSubDir, { recursive: true });

                        // WAV files are in corresponding subdirectory
                        const wavSubDir = join(wavDir, relDir);

                        convertAKPToDecentSampler(akpFile, dsSubDir, wavSubDir);
                        result.stats.dspresetCreated++;
                    }
                } catch (err: any) {
                    const errorMsg = `Failed to convert ${basename(akpFile)}: ${err.message}`;
                    result.errors.push(errorMsg);

                    // Read file header for audit log
                    try {
                        const header = readFileSync(akpFile).slice(0, 16);
                        const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        auditLogger.conversionFailure(diskName, akpFile, err.message, headerHex);
                    } catch {
                        auditLogger.conversionFailure(diskName, akpFile, err.message);
                    }
                }
            }
        }

        // Add existing conversions to the count
        result.stats.sfzCreated += existingSfz.length;
        result.stats.dspresetCreated += existingDs.length;

        result.success = true;

        // Log extraction summary to audit log
        auditLogger.extractionSummary(diskName, {
            programsFound: result.stats.programsFound,
            programsConverted: Math.max(result.stats.sfzCreated, result.stats.dspresetCreated),
            programsFailed: result.stats.programsFound - Math.max(result.stats.sfzCreated, result.stats.dspresetCreated),
            samplesFound: result.stats.samplesExtracted,
            samplesConverted: result.stats.samplesConverted
        });

        if (!quiet) {
            console.log("Extraction complete!");
            console.log(`  Samples: ${result.stats.samplesConverted}/${result.stats.samplesExtracted}`);
            console.log(`  Programs: ${result.stats.programsFound}`);
            console.log(`  SFZ files: ${result.stats.sfzCreated}${result.stats.sfzCreated !== result.stats.programsFound && convertToSFZ ? ` (${result.stats.programsFound - result.stats.sfzCreated} missing)` : ""}`);
            console.log(`  DecentSampler presets: ${result.stats.dspresetCreated}${result.stats.dspresetCreated !== result.stats.programsFound && convertToDecentSampler ? ` (${result.stats.programsFound - result.stats.dspresetCreated} missing)` : ""}`);
        }

    } catch (err: any) {
        result.errors.push(`Extraction failed: ${err.message}`);
        result.success = false;
    }

    return result;
}

/**
 * Recursively find files with a specific extension
 *
 * @param dir - Directory to search
 * @param extension - File extension to match (e.g., ".a3p", ".wav")
 * @returns Array of absolute file paths
 *
 * @internal
 */
function findFiles(dir: string, extension: string): string[] {
    const results: string[] = [];

    if (!existsSync(dir)) {
        return results;
    }

    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = join(dir, file.name);

        if (file.isDirectory()) {
            results.push(...findFiles(fullPath, extension));
        } else if (file.name.toLowerCase().endsWith(extension.toLowerCase())) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * Check if a directory has extracted content
 *
 * @param dir - Directory to check
 * @returns true if directory exists and has files
 *
 * @internal
 */
function hasExtractedContent(dir: string): boolean {
    try {
        if (!existsSync(dir)) {
            return false;
        }
        const files = readdirSync(dir);
        return files.length > 0;
    } catch (err) {
        return false;
    }
}

/**
 * Find programs that need conversion by checking which conversions are missing
 *
 * @param programFiles - Source program files (.a3p or .akp)
 * @param existingSfz - Existing SFZ files
 * @param existingDs - Existing DecentSampler files
 * @param rawDir - Raw extraction directory
 * @param sfzDir - SFZ output directory
 * @param dsDir - DecentSampler output directory
 * @param needsSfz - Whether SFZ conversion is enabled
 * @param needsDs - Whether DecentSampler conversion is enabled
 * @returns Array of program files that need conversion
 *
 * @internal
 */
function findMissingConversions(
    programFiles: string[],
    existingSfz: string[],
    existingDs: string[],
    rawDir: string,
    sfzDir: string,
    dsDir: string,
    needsSfz: boolean | undefined,
    needsDs: boolean | undefined
): string[] {
    const missing: string[] = [];

    for (const programFile of programFiles) {
        const relPath = relative(rawDir, programFile);
        const programName = basename(programFile, extname(programFile));
        const relDir = dirname(relPath);

        let hasSfz = !needsSfz;
        let hasDs = !needsDs;

        if (needsSfz) {
            const expectedSfz = join(sfzDir, relDir, `${programName}.sfz`);
            hasSfz = existingSfz.some(sfz => sfz === expectedSfz);
        }

        if (needsDs) {
            const expectedDs = join(dsDir, relDir, `${programName}.dspreset`);
            hasDs = existingDs.some(ds => ds === expectedDs);
        }

        if (!hasSfz || !hasDs) {
            missing.push(programFile);
        }
    }

    return missing;
}
