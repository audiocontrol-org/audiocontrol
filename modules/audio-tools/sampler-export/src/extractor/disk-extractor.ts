/**
 * Akai Disk Image Extractor
 *
 * Orchestrates extraction of Akai disk images and conversion to modern formats.
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

export interface ExtractionOptions {
    diskImage: string;
    outputDir: string;
    convertToSFZ?: boolean;
    convertToDecentSampler?: boolean;
    quiet?: boolean;
}

export interface ExtractionResult {
    success: boolean;
    diskName: string;
    outputDir: string;
    stats: {
        samplesExtracted: number;
        samplesConverted: number;
        programsFound: number;
        sfzCreated: number;
        dspresetCreated: number;
    };
    errors: string[];
}

/**
 * Extract an Akai disk image and convert programs to modern formats
 *
 * @param options - Extraction options
 * @returns Extraction result with statistics
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
