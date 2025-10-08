#!/usr/bin/env node
/**
 * Akai Disk Extraction CLI
 *
 * Command-line tool for extracting Akai disk images and converting
 * sampler programs to SFZ and DecentSampler formats.
 */

import { Command } from "commander";
import { extractAkaiDisk } from "@/lib/extractor/disk-extractor.js";
import { extractBatch } from "@/lib/extractor/batch-extractor.js";
import { convertA3PToSFZ } from "@/lib/converters/s3k-to-sfz.js";
import { convertA3PToDecentSampler } from "@/lib/converters/s3k-to-decentsampler.js";
import { convertAKPToSFZ } from "@/lib/converters/s5k-to-sfz.js";
import { convertAKPToDecentSampler } from "@/lib/converters/s5k-to-decentsampler.js";
import { loadConfig, getEnabledExportSources, type BackupSource } from "@oletizi/audiotools-config";
import { homedir } from "os";
import { join } from "pathe";
import { existsSync } from "fs";
import { readdir } from "fs/promises";

const program = new Command();
const DEFAULT_BACKUP_ROOT = join(homedir(), '.audiotools', 'backup');
const DEFAULT_OUTPUT_ROOT = join(homedir(), '.audiotools', 'sampler-export', 'extracted');

/**
 * Handle config-based extraction
 */
async function handleExtractCommand(sourceName: string | undefined, options: any): Promise<void> {
    try {
        // If --input flag is provided, use flag-based logic (backward compatibility)
        if (options.input) {
            // Extract single disk image
            console.log(`Extracting Akai disk: ${options.input}`);

            const outputDir = options.output || DEFAULT_OUTPUT_ROOT;
            const result = await extractAkaiDisk({
                diskImage: options.input,
                outputDir,
                convertToSFZ: options.format ? options.format.includes('sfz') : true,
                convertToDecentSampler: options.format ? options.format.includes('decentsampler') : true,
            });

            if (!result.success) {
                console.error("Extraction failed:");
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
            }

            if (result.errors.length > 0) {
                console.warn("Extraction completed with warnings:");
                result.errors.forEach((err) => console.warn(`  - ${err}`));
            }
            return;
        }

        // Config-based extraction
        const config = await loadConfig();
        if (!config.backup) {
            console.error("Error: No backup configuration found");
            console.error("Run 'audiotools config' to set up configuration");
            process.exit(1);
        }

        const enabledSources = getEnabledExportSources(config);

        if (enabledSources.length === 0) {
            console.error("Error: No enabled export sources found in configuration");
            console.error("Run 'audiotools config' to configure export sources");
            process.exit(1);
        }

        // Determine formats to use
        const formats = config.export?.formats || ['sfz', 'decentsampler'];
        const convertToSFZ = formats.includes('sfz');
        const convertToDecentSampler = formats.includes('decentsampler');
        const outputRoot = config.export?.outputRoot || DEFAULT_OUTPUT_ROOT;

        // If sourceName is provided, extract only that source
        if (sourceName) {
            const sourceConfig = enabledSources.find(s => s.name === sourceName);
            if (!sourceConfig) {
                console.error(`Error: Source '${sourceName}' not found or not enabled for export`);
                console.error(`Available sources: ${enabledSources.map(s => s.name).join(', ')}`);
                process.exit(1);
            }

            console.log(`Extracting source: ${sourceConfig.name}`);
            console.log(`Sampler: ${sourceConfig.sampler || 'auto-detect'}`);
            console.log(`Device: ${sourceConfig.device}`);
            console.log(`Formats: ${formats.join(', ')}`);
            console.log("");

            await extractSource(sourceConfig, {
                outputRoot,
                convertToSFZ,
                convertToDecentSampler,
                force: options.force || false,
            });
            return;
        }

        // Extract all enabled sources
        console.log(`Found ${enabledSources.length} enabled export source(s)\n`);

        for (let i = 0; i < enabledSources.length; i++) {
            const sourceConfig = enabledSources[i];
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`[${i + 1}/${enabledSources.length}] ${sourceConfig.name}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Sampler: ${sourceConfig.sampler || 'auto-detect'}`);
            console.log(`Device: ${sourceConfig.device}`);
            console.log(`Formats: ${formats.join(', ')}`);
            console.log("");

            try {
                await extractSource(sourceConfig, {
                    outputRoot,
                    convertToSFZ,
                    convertToDecentSampler,
                    force: options.force || false,
                });
            } catch (err: any) {
                console.error(`Failed to extract ${sourceConfig.name}: ${err.message}`);
                // Continue with next source
            }

            console.log("");
        }

        console.log("✓ All extractions complete");
    } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Extract disk images from a backup source
 */
async function extractSource(
    source: BackupSource,
    options: {
        outputRoot: string;
        convertToSFZ: boolean;
        convertToDecentSampler: boolean;
        force: boolean;
    }
): Promise<void> {
    // Find backup directory for this source
    const backupDir = join(
        DEFAULT_BACKUP_ROOT,
        source.sampler || 'unknown',
        source.device
    );

    if (!existsSync(backupDir)) {
        console.warn(`  ⚠ Backup directory not found: ${backupDir}`);
        console.warn(`  Skipping ${source.name}`);
        return;
    }

    console.log(`  Scanning: ${backupDir}`);

    // Find all disk images in backup directory
    const entries = await readdir(backupDir, { withFileTypes: true });
    const diskImages = entries
        .filter(entry => entry.isFile())
        .filter(entry => {
            const name = entry.name.toLowerCase();
            return name.endsWith('.hds') ||
                   name.endsWith('.img') ||
                   name.endsWith('.iso');
        })
        .map(entry => join(backupDir, entry.name));

    if (diskImages.length === 0) {
        console.log(`  No disk images found in ${backupDir}`);
        return;
    }

    console.log(`  Found ${diskImages.length} disk image(s)`);
    console.log("");

    // Extract each disk image
    for (const diskImage of diskImages) {
        const diskName = diskImage.split('/').pop()?.replace(/\.(hds|img|iso)$/i, '') || 'unknown';
        console.log(`  Extracting: ${diskName}`);

        // Output directory: {outputRoot}/{sampler}/{device}/{diskName}
        const outputDir = join(
            options.outputRoot,
            source.sampler || 'unknown',
            source.device,
            diskName
        );

        try {
            const result = await extractAkaiDisk({
                diskImage,
                outputDir,
                convertToSFZ: options.convertToSFZ,
                convertToDecentSampler: options.convertToDecentSampler,
            });

            if (!result.success) {
                console.error(`    ✗ Extraction failed:`);
                result.errors.forEach((err) => console.error(`      - ${err}`));
            } else if (result.errors.length > 0) {
                console.warn(`    ⚠ Extraction completed with warnings:`);
                result.errors.forEach((err) => console.warn(`      - ${err}`));
            } else {
                console.log(`    ✓ Extracted to: ${outputDir}`);
            }
        } catch (err: any) {
            console.error(`    ✗ Error: ${err.message}`);
        }
    }
}

program
    .name("akai-extract")
    .description("Extract Akai disk images and convert programs to modern formats")
    .version("1.0.0");

// Extract command (config-based with flag override)
program
    .command("extract [source]")
    .description("Extract from config (all enabled sources or specific source by name)")
    .option("-i, --input <path>", "Override: extract single disk image (flag-based mode)")
    .option("-o, --output <path>", "Override: output directory (requires --input)")
    .option("-f, --format <formats>", "Override: output formats (comma-separated: sfz,decentsampler)")
    .option("--force", "Force re-extraction even if unchanged")
    .action(handleExtractCommand);

// Extract disk command (backward compatible)
program
    .command("disk")
    .description("Extract an Akai disk image")
    .argument("<disk-image>", "Path to the Akai disk image (.hds, .img, etc.)")
    .argument("<output-dir>", "Output directory for extracted files")
    .option("--no-sfz", "Skip SFZ conversion")
    .option("--no-decentsampler", "Skip DecentSampler conversion")
    .action(async (diskImage: string, outputDir: string, options: any) => {
        try {
            console.log(`Extracting Akai disk: ${diskImage}`);

            const result = await extractAkaiDisk({
                diskImage,
                outputDir,
                convertToSFZ: options.sfz !== false,
                convertToDecentSampler: options.decentsampler !== false,
            });

            if (!result.success) {
                console.error("Extraction failed:");
                result.errors.forEach((err) => console.error(`  - ${err}`));
                process.exit(1);
            }

            if (result.errors.length > 0) {
                console.warn("Extraction completed with warnings:");
                result.errors.forEach((err) => console.warn(`  - ${err}`));
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Batch extraction command (backward compatible)
program
    .command("batch")
    .description("Extract all disk images from backup directories")
    .option("--source <path>", "Source directory (default: ~/.audiotools/backup)")
    .option("--dest <path>", "Destination directory (default: ~/.audiotools/sampler-export/extracted)")
    .option("--samplers <types>", "Comma-separated sampler types: s5k,s3k (default: s5k,s3k)")
    .option("--force", "Force re-extraction of all disks")
    .option("--no-sfz", "Skip SFZ conversion")
    .option("--no-decentsampler", "Skip DecentSampler conversion")
    .action(async (options: any) => {
        try {
            const samplerTypes = options.samplers
                ? options.samplers.split(",").map((s: string) => s.trim())
                : undefined;

            const result = await extractBatch({
                sourceDir: options.source,
                destDir: options.dest,
                samplerTypes,
                force: options.force || false,
                convertToSFZ: options.sfz !== false,
                convertToDecentSampler: options.decentsampler !== false,
            });

            // Exit with error code only for actual failures, not warnings
            if (result.failed > 0) {
                process.exit(1);
            }
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Convert S3K program to SFZ
program
    .command("s3k-to-sfz")
    .description("Convert S3K (.a3p) program to SFZ")
    .argument("<a3p-file>", "Path to .a3p program file")
    .argument("<sfz-dir>", "Output directory for SFZ file")
    .argument("<wav-dir>", "Directory containing WAV samples")
    .action(async (a3pFile: string, sfzDir: string, wavDir: string) => {
        try {
            const sfzPath = await convertA3PToSFZ(a3pFile, sfzDir, wavDir);
            console.log(`Created: ${sfzPath}`);
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Convert S3K program to DecentSampler
program
    .command("s3k-to-ds")
    .description("Convert S3K (.a3p) program to DecentSampler")
    .argument("<a3p-file>", "Path to .a3p program file")
    .argument("<ds-dir>", "Output directory for .dspreset file")
    .argument("<wav-dir>", "Directory containing WAV samples")
    .action(async (a3pFile: string, dsDir: string, wavDir: string) => {
        try {
            const dsPath = await convertA3PToDecentSampler(a3pFile, dsDir, wavDir);
            console.log(`Created: ${dsPath}`);
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Convert S5K program to SFZ
program
    .command("s5k-to-sfz")
    .description("Convert S5K (.akp) program to SFZ")
    .argument("<akp-file>", "Path to .akp program file")
    .argument("<sfz-dir>", "Output directory for SFZ file")
    .argument("<wav-dir>", "Directory containing WAV samples")
    .action((akpFile: string, sfzDir: string, wavDir: string) => {
        try {
            const sfzPath = convertAKPToSFZ(akpFile, sfzDir, wavDir);
            console.log(`Created: ${sfzPath}`);
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

// Convert S5K program to DecentSampler
program
    .command("s5k-to-ds")
    .description("Convert S5K (.akp) program to DecentSampler")
    .argument("<akp-file>", "Path to .akp program file")
    .argument("<ds-dir>", "Output directory for .dspreset file")
    .argument("<wav-dir>", "Directory containing WAV samples")
    .action((akpFile: string, dsDir: string, wavDir: string) => {
        try {
            const dsPath = convertAKPToDecentSampler(akpFile, dsDir, wavDir);
            console.log(`Created: ${dsPath}`);
        } catch (err: any) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
