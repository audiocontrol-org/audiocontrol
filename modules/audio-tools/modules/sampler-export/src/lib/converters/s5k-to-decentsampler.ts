/**
 * Akai S5000/S6000 Program to DecentSampler Converter
 *
 * Converts Akai .AKP program files to DecentSampler .dspreset format with
 * XML structure including multi-zone support and envelope parameters.
 *
 * @module converters/s5k-to-decentsampler
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, join, relative, extname } from "pathe";
import { create } from "xmlbuilder2";
import { newProgramFromBuffer } from "@oletizi/sampler-devices/s5k";
import type { AkaiS56kProgram } from "@oletizi/sampler-devices/s5k";

/**
 * Convert an Akai S5000/S6000 .AKP program file to DecentSampler format
 *
 * Parses S5K/S6K program file and generates DecentSampler preset with
 * complete parameter mapping including global tuning, multi-zone keygroups,
 * and amplitude envelopes.
 *
 * @param akpPath - Path to .AKP file
 * @param dsOutputDir - Output directory for dspreset file
 * @param wavOutputDir - Directory containing WAV samples
 * @returns Path to created dspreset file
 *
 * @throws Error if file cannot be read, parsed, or written
 *
 * @remarks
 * Parameter mapping from S5K to DecentSampler:
 * - Global tune → group tuning attribute (semitones)
 * - Output loudness → group volume (0-1 normalized)
 * - Keygroup → group element
 * - Zones → sample elements with velocity layers
 * - Tuning → combined semitone + fine tune
 * - Pan: Akai (-50 to +50) → DecentSampler (-1 to +1)
 * - Volume: Akai level (-100 to +100) → dB offset * 0.2
 * - Envelope: Akai values / 100 → seconds
 *
 * DecentSampler XML structure:
 * ```xml
 * <DecentSampler>
 *   <ui>...</ui>
 *   <groups>
 *     <group tuning="..." volume="...">
 *       <sample path="..." rootNote="..." loNote="..." hiNote="..."
 *               loVel="..." hiVel="..." tuning="..." volume="..." pan="..."
 *               attack="..." decay="..." sustain="..." release="..."/>
 *     </group>
 *   </groups>
 * </DecentSampler>
 * ```
 *
 * A basic UI is included with a volume control.
 * Empty zones (no sample name) are automatically skipped.
 *
 * @example
 * ```typescript
 * const dsPath = convertAKPToDecentSampler(
 *   '/disks/s5k/raw/synth.akp',
 *   '/disks/s5k/decentsampler',
 *   '/disks/s5k/wav'
 * );
 * console.log(`Created DecentSampler preset: ${dsPath}`);
 * ```
 *
 * @example
 * ```typescript
 * // Batch convert directory
 * import { glob } from 'glob';
 *
 * const akpFiles = glob.sync('/raw/**\/*.akp');
 * for (const akp of akpFiles) {
 *   convertAKPToDecentSampler(akp, '/decentsampler', '/wav');
 * }
 * ```
 *
 * @public
 */
export function convertAKPToDecentSampler(
    akpPath: string,
    dsOutputDir: string,
    wavOutputDir: string
): string {
    // Read AKP file
    const akpBuffer = readFileSync(akpPath);
    const program: AkaiS56kProgram = newProgramFromBuffer(akpBuffer);

    // Extract program name from filename
    const programName = basename(akpPath, extname(akpPath));

    // Build XML structure
    const root = create({ version: "1.0" }).ele("DecentSampler");

    // Global settings
    const tune = program.getTune();
    const output = program.getOutput();

    // Add basic UI
    const ui = root.ele("ui", { width: "812", height: "375" });
    const tab = ui.ele("tab", { name: "Main" });
    tab.ele("labeled-knob", {
        x: "10",
        y: "20",
        label: "Volume",
        type: "float",
        minValue: "0",
        maxValue: "1",
        value: "0.5",
    });

    // Add groups element
    const groups = root.ele("groups");

    // Process keygroups
    const keygroups = program.getKeygroups();

    for (const keygroup of keygroups) {
        const kloc = keygroup.kloc;
        const ampEnv = keygroup.ampEnvelope;
        const filter = keygroup.filter;

        // Create group
        const groupAttrs: Record<string, string> = {};
        if (tune.semiToneTune !== 0) {
            groupAttrs.tuning = String(tune.semiToneTune);
        }
        if (output.loudness !== 85) {
            const volume = output.loudness / 100;
            groupAttrs.volume = volume.toFixed(3);
        }

        const group = groups.ele("group", groupAttrs);

        // Process zones
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

            const sampleName = zone.sampleName.trim();
            const relPath = relative(dsOutputDir, wavOutputDir);
            const samplePath = join(relPath, `${sampleName}.wav`).replace(
                /\\/g,
                "/"
            );

            const sampleAttrs: Record<string, string> = {
                path: samplePath,
                rootNote: String(kloc.lowNote),
                loNote: String(kloc.lowNote),
                hiNote: String(kloc.highNote),
            };

            // Velocity range
            const lovel = Math.max(0, Math.min(127, zone.lowVelocity || 0));
            const hivel = Math.max(0, Math.min(127, zone.highVelocity || 127));
            if (lovel > 0 || hivel < 127) {
                sampleAttrs.loVel = String(lovel);
                sampleAttrs.hiVel = String(hivel);
            }

            // Tuning (combine all tuning sources)
            let totalTune = 0;
            if (zone.semiToneTune !== 0) totalTune += zone.semiToneTune;
            if (kloc.semiToneTune !== 0) totalTune += kloc.semiToneTune;
            if (zone.fineTune !== 0) totalTune += zone.fineTune / 100;
            if (kloc.fineTune !== 0) totalTune += kloc.fineTune / 100;
            if (totalTune !== 0) {
                sampleAttrs.tuning = totalTune.toFixed(2);
            }

            // Volume
            if (zone.level !== 0) {
                const volumeDb = zone.level * 0.2;
                sampleAttrs.volume = volumeDb.toFixed(2);
            }

            // Pan (convert -50 to 50 to -1 to 1)
            if (zone.panBalance !== 0) {
                const pan = zone.panBalance / 50;
                sampleAttrs.pan = pan.toFixed(3);
            }

            // Envelope
            if (ampEnv) {
                if (ampEnv.attack > 0) {
                    sampleAttrs.attack = (ampEnv.attack / 100).toFixed(3);
                }
                if (ampEnv.decay > 0) {
                    sampleAttrs.decay = (ampEnv.decay / 100).toFixed(3);
                }
                if (ampEnv.sustain !== 100) {
                    sampleAttrs.sustain = (ampEnv.sustain / 100).toFixed(3);
                }
                if (ampEnv.release > 0) {
                    sampleAttrs.release = (ampEnv.release / 100).toFixed(3);
                }
            }

            group.ele("sample", sampleAttrs);
        }
    }

    // Convert to XML and write
    const xml = root.end({ prettyPrint: true, indent: "  " });
    const dsPath = join(dsOutputDir, `${programName}.dspreset`);
    writeFileSync(dsPath, xml);

    return dsPath;
}
