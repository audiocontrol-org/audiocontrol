/**
 * Akai Disk Image Extractor
 *
 * Orchestrates extraction of Akai disk images and conversion to modern formats.
 * Supports both native Akai format disks and DOS/FAT32 formatted disks.
 *
 * @module extractor/disk-extractor
 */

import { mkdirSync, existsSync, readdirSync } from "fs";
import { join, basename, extname } from "pathe";
import { newAkaitools, newAkaiToolsConfig } from "@oletizi/sampler-devices";
import type { Akaitools } from "@oletizi/sampler-devices";
import { convertA3PToSFZ } from "@/converters/s3k-to-sfz.js";
import { convertA3PToDecentSampler } from "@/converters/s3k-to-decentsampler.js";
import { convertAKPToSFZ } from "@/converters/s5k-to-sfz.js";
import { convertAKPToDecentSampler } from "@/converters/s5k-to-decentsampler.js";
import { isDosDisk, extractDosDisk } from "@/extractor/dos-disk-extractor.js";

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

    try {
        // Extract disk name from filename
        const diskName = basename(diskImage, extname(diskImage));
        result.diskName = diskName;

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

            // If DOS extraction succeeded, continue with format conversions
            if (!dosResult.success) {
                return dosResult;
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

            // Extract all files from the disk
            if (!quiet) {
                console.log("Extracting files from disk...");
            }
            const extractResult = await akaitools.akaiRead("/", rawDir, undefined, true);

            if (extractResult.errors.length > 0) {
                result.errors.push(...extractResult.errors.map((e) => e.message));
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
                    // akai2wav outputs to cwd, so we need to cd to wavDir first
                    const origCwd = process.cwd();
                    process.chdir(wavDir);

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

        // Convert S3K programs (.a3p)
        if (a3pFiles.length > 0) {
            if (!quiet) {
                console.log(`Converting ${a3pFiles.length} S3K programs...`);
            }

            for (const a3pFile of a3pFiles) {
                try {
                    if (convertToSFZ) {
                        await convertA3PToSFZ(a3pFile, sfzDir, wavDir);
                        result.stats.sfzCreated++;
                    }
                    if (convertToDecentSampler) {
                        await convertA3PToDecentSampler(a3pFile, dsDir, wavDir);
                        result.stats.dspresetCreated++;
                    }
                } catch (err: any) {
                    result.errors.push(`Failed to convert ${basename(a3pFile)}: ${err.message}`);
                }
            }
        }

        // Convert S5K programs (.akp)
        if (akpFiles.length > 0) {
            if (!quiet) {
                console.log(`Converting ${akpFiles.length} S5K programs...`);
            }

            for (const akpFile of akpFiles) {
                try {
                    if (convertToSFZ) {
                        convertAKPToSFZ(akpFile, sfzDir, wavDir);
                        result.stats.sfzCreated++;
                    }
                    if (convertToDecentSampler) {
                        convertAKPToDecentSampler(akpFile, dsDir, wavDir);
                        result.stats.dspresetCreated++;
                    }
                } catch (err: any) {
                    result.errors.push(`Failed to convert ${basename(akpFile)}: ${err.message}`);
                }
            }
        }

        result.success = true;
        if (!quiet) {
            console.log("Extraction complete!");
            console.log(`  Samples: ${result.stats.samplesConverted}/${result.stats.samplesExtracted}`);
            console.log(`  Programs: ${result.stats.programsFound}`);
            console.log(`  SFZ files: ${result.stats.sfzCreated}`);
            console.log(`  DecentSampler presets: ${result.stats.dspresetCreated}`);
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
