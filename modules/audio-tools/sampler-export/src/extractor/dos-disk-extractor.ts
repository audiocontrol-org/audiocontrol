/**
 * DOS/FAT Disk Image Extractor
 *
 * Extracts files from DOS/FAT32 formatted Akai disk images using mtools.
 */

import { mkdirSync, readFileSync, openSync, readSync, closeSync } from "fs";
import { join } from "pathe";
import { spawn } from "child_process";
import { getMcopyBinary } from "@/utils/mtools-binary.js";
import type { ExtractionResult } from "@/types/index.js";

/**
 * Detect DOS partition offset from MBR
 * Reads the partition table to find the start sector of the first partition
 */
function detectPartitionOffset(diskImage: string): number {
    try {
        // Read the MBR partition table entry (first partition at 0x1BE)
        // Start sector is at offset 0x1C6 (4 bytes, little-endian)
        const buffer = readFileSync(diskImage);

        // Read 4 bytes at offset 0x1C6
        const startSectorBytes = buffer.slice(0x1C6, 0x1CA);

        // Convert little-endian bytes to number
        const startSector = startSectorBytes[0] +
                           (startSectorBytes[1] << 8) +
                           (startSectorBytes[2] << 16) +
                           (startSectorBytes[3] << 24);

        // Calculate byte offset (sector * 512)
        return startSector * 512;
    } catch (err) {
        // Default to common offset if detection fails
        return 32256; // sector 63 * 512
    }
}

/**
 * Execute mcopy to extract files from DOS disk
 */
async function executeMcopy(
    diskImage: string,
    outputDir: string,
    partitionOffset: number
): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        // Get mcopy binary path (bundled or system)
        let mcopyBinary: string;
        try {
            mcopyBinary = getMcopyBinary();
        } catch (err: any) {
            resolve({
                success: false,
                output: "",
                error: err.message,
            });
            return;
        }

        // Format: diskimage@@offset
        const mtoolsImage = `${diskImage}@@${partitionOffset}`;

        const proc = spawn(mcopyBinary, [
            '-s',           // recursive (subdirectories)
            '-n',           // no overwrite confirmation
            '-i', mtoolsImage,
            '::',           // root of DOS filesystem
            outputDir
        ], {
            env: {
                ...process.env,
                MTOOLS_SKIP_CHECK: '1'  // Skip mtools.conf check
            }
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            const output = data.toString();
            stdout += output;
        });

        proc.stderr?.on("data", (data) => {
            const output = data.toString();
            // mcopy outputs warnings to stderr even on success, filter them out
            if (!output.includes("warning:")) {
                stderr += output;
            }
        });

        proc.on("close", (code) => {
            if (code === 0 || stderr.trim() === "") {
                resolve({ success: true, output: stdout });
            } else {
                resolve({
                    success: false,
                    output: stdout,
                    error: `mcopy exited with code ${code}: ${stderr}`,
                });
            }
        });

        proc.on("error", (err) => {
            resolve({
                success: false,
                output: stdout,
                error: `Failed to execute mcopy: ${err.message}. Is mtools installed?`,
            });
        });
    });
}

/**
 * Extract a DOS/FAT formatted Akai disk image
 */
export async function extractDosDisk(
    diskImage: string,
    diskName: string,
    outputDir: string,
    quiet: boolean = false
): Promise<ExtractionResult> {
    const result: ExtractionResult = {
        success: false,
        diskName,
        outputDir,
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
        // Create output directories
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

        // Detect partition offset
        const partitionOffset = detectPartitionOffset(diskImage);

        if (!quiet) {
            console.log(`Extracting DOS/FAT disk: ${diskImage}`);
            console.log(`  Partition offset: sector ${partitionOffset / 512} (${partitionOffset} bytes)`);
        }

        // Extract files using mcopy
        if (!quiet) {
            console.log("Copying files from DOS filesystem...");
        }

        const mcopyResult = await executeMcopy(diskImage, rawDir, partitionOffset);

        if (!mcopyResult.success) {
            result.errors.push(mcopyResult.error || "mcopy failed");
            return result;
        }

        // Copy WAV/AIF files to wav directory (DOS disks already have WAV files)
        if (!quiet) {
            console.log("Organizing audio files...");
        }

        const { readdirSync: readdir, copyFileSync: copyFile, statSync: stat } = await import("fs");
        const { join: joinPath } = await import("pathe");

        // Find all WAV and AIF files recursively
        const findAudioFiles = (dir: string, results: string[] = []): string[] => {
            try {
                const entries = readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = joinPath(dir, entry.name);

                    if (entry.isDirectory()) {
                        findAudioFiles(fullPath, results);
                    } else if (entry.isFile()) {
                        const ext = fullPath.toLowerCase();
                        if (ext.endsWith('.wav') || ext.endsWith('.aif') || ext.endsWith('.aiff')) {
                            results.push(fullPath);
                        }
                    }
                }
            } catch (err) {
                // Skip unreadable directories
            }

            return results;
        };

        const audioFiles = findAudioFiles(rawDir);

        for (const audioFile of audioFiles) {
            try {
                const filename = audioFile.split('/').pop() || 'unknown';
                const destPath = joinPath(wavDir, filename);
                copyFile(audioFile, destPath);
            } catch (err) {
                // Skip copy errors
            }
        }

        result.stats.samplesExtracted = audioFiles.length;
        result.stats.samplesConverted = audioFiles.length; // Already in WAV format

        if (!quiet) {
            console.log(`Found ${audioFiles.length} audio files`);
            console.log("DOS disk extraction complete!");
        }

        result.success = true;
    } catch (err: any) {
        result.errors.push(`DOS disk extraction failed: ${err.message}`);
    }

    return result;
}

/**
 * Check if a disk image is DOS/FAT formatted
 * Only reads the first 512 bytes (boot sector) for efficiency
 */
export function isDosDisk(diskImage: string): boolean {
    try {
        // Open file and read only first 512 bytes (boot sector)
        const fd = openSync(diskImage, 'r');
        const buffer = Buffer.alloc(512);
        readSync(fd, buffer, 0, 512, 0);
        closeSync(fd);

        // Check for DOS boot sector signature (0x55AA at offset 0x1FE)
        const bootSig = buffer.readUInt16LE(0x1FE);
        if (bootSig === 0xAA55) {
            return true;
        }

        // Additional check: look for FAT filesystem markers
        const fsType1 = buffer.toString('ascii', 0x36, 0x3B);  // FAT16
        const fsType2 = buffer.toString('ascii', 0x52, 0x5A);  // FAT32

        if (fsType1.includes('FAT') || fsType2.includes('FAT')) {
            return true;
        }

        return false;
    } catch (err) {
        return false;
    }
}
