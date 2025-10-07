/**
 * DOS/FAT Disk Image Extractor
 *
 * Extracts files from DOS/FAT32 formatted Akai disk images using mtools.
 * Handles partition offset detection and file organization.
 *
 * @module extractor/dos-disk-extractor
 */

import { mkdirSync, readFileSync, openSync, readSync, closeSync, existsSync, readdirSync } from "fs";
import { join } from "pathe";
import { spawn } from "child_process";
import { getMcopyBinary } from "@/utils/mtools-binary.js";
import type { ExtractionResult } from "@/types/index.js";

/**
 * Detect DOS partition offset from MBR
 *
 * Reads the partition table to find the start sector of the first partition.
 * The MBR partition table entry for the first partition is at offset 0x1BE,
 * with the start sector stored at offset 0x1C6 (4 bytes, little-endian).
 *
 * @param diskImage - Path to disk image file
 * @returns Byte offset to first partition, defaults to 32256 (sector 63) if detection fails
 *
 * @remarks
 * Common DOS partition offsets:
 * - 32256 bytes (sector 63) - Traditional DOS partition start
 * - 1048576 bytes (sector 2048) - Modern partition alignment
 *
 * @internal
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
 *
 * Uses the mtools mcopy utility to recursively copy files from a DOS/FAT filesystem.
 * Supports partition offset specification using mtools' "@@offset" syntax.
 *
 * @param diskImage - Path to disk image file
 * @param outputDir - Destination directory for extracted files
 * @param partitionOffset - Byte offset to partition start
 * @returns Promise resolving to execution result with output/error information
 *
 * @throws Never throws - errors are returned in result object
 *
 * @remarks
 * The MTOOLS_SKIP_CHECK environment variable is set to bypass mtools.conf validation.
 * mcopy warnings are filtered from stderr as they don't indicate actual failures.
 *
 * @internal
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
            // mcopy may report non-fatal errors but still copy files successfully
            // Check if files were actually copied before marking as failed
            const filesExist = existsSync(outputDir) && readdirSync(outputDir).length > 0;

            if (code === 0 || stderr.trim() === "" || filesExist) {
                // Success if: clean exit, no errors, OR files were copied
                const success = code === 0 || stderr.trim() === "";
                if (!success && filesExist) {
                    // Files copied but mcopy reported errors - treat as warning
                    resolve({
                        success: true,
                        output: stdout,
                        error: `Warning: mcopy reported errors but files were copied successfully: ${stderr}`
                    });
                } else {
                    resolve({ success: true, output: stdout });
                }
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
 *
 * Performs complete extraction of a DOS/FAT32 formatted disk image, including:
 * - Automatic partition offset detection
 * - Recursive file extraction using mcopy
 * - Audio file organization (WAV, AIF, AIFF files copied to wav/ directory)
 * - Directory structure creation matching native Akai disk layout
 *
 * @param diskImage - Path to disk image file
 * @param diskName - Name to use for output directory
 * @param outputDir - Parent output directory
 * @param quiet - Suppress console output (default: false)
 * @returns Promise resolving to extraction result with statistics
 *
 * @remarks
 * DOS/FAT disks already contain WAV files, unlike native Akai disks which use
 * proprietary .a3s format. Therefore, samplesExtracted equals samplesConverted.
 *
 * Output directory structure:
 * ```
 * outputDir/
 *   diskName/
 *     raw/          - All files from DOS filesystem
 *     wav/          - WAV/AIF audio files (copies from raw/)
 *     sfz/          - Empty, populated by caller
 *     decentsampler/ - Empty, populated by caller
 * ```
 *
 * @example
 * ```typescript
 * const result = await extractDosDisk(
 *   '/path/to/disk.hds',
 *   'my-disk',
 *   '/output',
 *   false
 * );
 * console.log(`Extracted ${result.stats.samplesExtracted} audio files`);
 * ```
 *
 * @public
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
 *
 * Efficiently detects DOS/FAT filesystems by reading only the first 512 bytes
 * (boot sector) and checking for DOS boot signatures and filesystem markers.
 *
 * @param diskImage - Path to disk image file
 * @returns True if disk appears to be DOS/FAT formatted, false otherwise
 *
 * @remarks
 * Detection checks:
 * 1. Boot signature 0x55AA at offset 0x1FE (mandatory for valid boot sectors)
 * 2. FAT16 filesystem marker at offset 0x36-0x3B
 * 3. FAT32 filesystem marker at offset 0x52-0x5A
 *
 * Only reads first 512 bytes for performance - critical for handling large disk images.
 *
 * @example
 * ```typescript
 * if (isDosDisk('/path/to/disk.hds')) {
 *   console.log('DOS/FAT disk detected');
 *   await extractDosDisk(...);
 * } else {
 *   console.log('Native Akai disk detected');
 *   await extractAkaiDisk(...);
 * }
 * ```
 *
 * @public
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
