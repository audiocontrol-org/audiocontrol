#!/usr/bin/env node
/**
 * Akai Disk Extraction CLI
 *
 * Command-line tool for extracting Akai disk images and converting
 * sampler programs to SFZ and DecentSampler formats.
 */

import { Command } from "commander";
import { extractAkaiDisk } from "@/extractor/disk-extractor.js";
import { extractBatch } from "@/extractor/batch-extractor.js";
import { convertA3PToSFZ } from "@/converters/s3k-to-sfz.js";
import { convertA3PToDecentSampler } from "@/converters/s3k-to-decentsampler.js";
import { convertAKPToSFZ } from "@/converters/s5k-to-sfz.js";
import { convertAKPToDecentSampler } from "@/converters/s5k-to-decentsampler.js";

const program = new Command();

program
    .name("akai-extract")
    .description("Extract Akai disk images and convert programs to modern formats")
    .version("1.0.0");

// Extract disk command
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

// Batch extraction command
program
    .command("batch")
    .description("Extract all disk images from well-known directories")
    .option("--source <path>", "Source directory (default: ~/.audio-tools/disk-images)")
    .option("--dest <path>", "Destination directory (default: ~/.audio-tools/extracted)")
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
