/**
 * Akai S5000/S6000 Program to SFZ Converter
 *
 * Converts Akai .AKP program files to SFZ format for use with modern samplers.
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, join, relative, extname } from "pathe";
import { newProgramFromBuffer } from "@oletizi/sampler-devices/s5k";
import type { AkaiS56kProgram } from "@oletizi/sampler-devices/s5k";

/**
 * Convert an Akai S5000/S6000 .AKP program file to SFZ format
 *
 * @param akpPath - Path to .AKP file
 * @param sfzOutputDir - Output directory for SFZ file
 * @param wavOutputDir - Directory containing WAV samples
 * @returns Path to created SFZ file
 */
export function convertAKPToSFZ(
    akpPath: string,
    sfzOutputDir: string,
    wavOutputDir: string
): string {
    // Read AKP file
    const akpBuffer = readFileSync(akpPath);
    const program: AkaiS56kProgram = newProgramFromBuffer(akpBuffer);

    // Extract program name from filename
    const programName = basename(akpPath, extname(akpPath));

    // Build SFZ content
    const lines: string[] = [];
    lines.push(`// Converted from ${basename(akpPath)}`);
    lines.push(`// Akai S5000/S6000 Program`);
    lines.push("");

    // Global settings
    const tune = program.getTune();
    const output = program.getOutput();

    lines.push("<global>");
    if (tune.semiToneTune !== 0) {
        lines.push(`transpose=${tune.semiToneTune}`);
    }
    if (tune.fineTune !== 0) {
        lines.push(`tune=${tune.fineTune}`);
    }
    if (output.loudness !== 85) {
        // 85 is default; Convert 0-100 to dB (approximation)
        const volumeDb = (output.loudness - 85) * 0.2;
        lines.push(`volume=${volumeDb.toFixed(2)}`);
    }
    lines.push("");

    // Process keygroups
    const keygroups = program.getKeygroups();

    for (const keygroup of keygroups) {
        const kloc = keygroup.kloc;

        // Process each zone in the keygroup
        const zones = [
            keygroup.zone1,
            keygroup.zone2,
            keygroup.zone3,
            keygroup.zone4,
        ];

        for (const zone of zones) {
            // Skip empty zones
            if (!zone.sampleName || zone.sampleName.length === 0) {
                continue;
            }

            lines.push("<region>");

            // Key range
            lines.push(`lokey=${kloc.lowNote}`);
            lines.push(`hikey=${kloc.highNote}`);
            lines.push(`pitch_keycenter=${kloc.lowNote}`);

            // Velocity range
            const lovel = Math.max(0, Math.min(127, zone.lowVelocity || 0));
            const hivel = Math.max(0, Math.min(127, zone.highVelocity || 127));
            lines.push(`lovel=${lovel}`);
            lines.push(`hivel=${hivel}`);

            // Tuning
            if (zone.semiToneTune !== 0) {
                lines.push(`transpose=${zone.semiToneTune}`);
            }
            if (zone.fineTune !== 0) {
                lines.push(`tune=${zone.fineTune}`);
            }
            if (kloc.semiToneTune !== 0) {
                lines.push(`transpose=${kloc.semiToneTune}`);
            }
            if (kloc.fineTune !== 0) {
                lines.push(`tune=${kloc.fineTune}`);
            }

            // Pan (convert -50 to 50 to -100 to 100)
            if (zone.panBalance !== 0) {
                const pan = Math.max(
                    -100,
                    Math.min(100, zone.panBalance * 2)
                );
                lines.push(`pan=${pan.toFixed(1)}`);
            }

            // Volume (zone level is -100 to 100)
            if (zone.level !== 0) {
                lines.push(`volume=${zone.level * 0.2}`);
            }

            // Filter
            const filter = keygroup.filter;
            if (filter && filter.cutoff !== 100) {
                // Convert 0-100 to Hz (approximate)
                const cutoffHz = Math.round(20 + (filter.cutoff / 100) * 19980);
                lines.push(`cutoff=${cutoffHz}`);
            }
            if (filter && filter.resonance > 0) {
                lines.push(`resonance=${filter.resonance * 2}`);
            }

            // Envelope
            const ampEnv = keygroup.ampEnvelope;
            if (ampEnv) {
                if (ampEnv.attack > 0) {
                    lines.push(`ampeg_attack=${ampEnv.attack / 100}`);
                }
                if (ampEnv.decay > 0) {
                    lines.push(`ampeg_decay=${ampEnv.decay / 100}`);
                }
                if (ampEnv.sustain !== 100) {
                    lines.push(`ampeg_sustain=${ampEnv.sustain}`);
                }
                if (ampEnv.release > 0) {
                    lines.push(`ampeg_release=${ampEnv.release / 100}`);
                }
            }

            // Sample path (relative to SFZ file)
            const sampleName = zone.sampleName.trim();
            const relPath = relative(sfzOutputDir, wavOutputDir);
            const samplePath = join(relPath, `${sampleName}.wav`).replace(
                /\\/g,
                "/"
            );
            lines.push(`sample=${samplePath}`);

            lines.push("");
        }
    }

    // Write SFZ file
    const sfzPath = join(sfzOutputDir, `${programName}.sfz`);
    writeFileSync(sfzPath, lines.join("\n"));

    return sfzPath;
}
