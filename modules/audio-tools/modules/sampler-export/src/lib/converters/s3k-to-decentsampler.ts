/**
 * Akai S3000/S1000 Program to DecentSampler Converter
 *
 * Converts Akai .a3p program files to DecentSampler .dspreset format with
 * XML-based configuration including groups, samples, and effects.
 *
 * @module converters/s3k-to-decentsampler
 */

import { writeFileSync } from "fs";
import { basename, join, relative, extname, dirname } from "pathe";
import { create } from "xmlbuilder2";
import { parseA3P, findSampleFile, getSamplePitch } from "@/lib/converters/s3k-to-sfz.js";
import type { S3KProgramData } from "@/lib/converters/s3k-to-sfz.js";

/**
 * Create DecentSampler XML document from program data
 *
 * Generates complete DecentSampler preset XML with proper structure:
 * groups, samples with all parameters, and basic effects chain.
 *
 * @param program - Parsed S3K program data
 * @param outputDir - Output directory for dspreset file
 * @param wavDir - Directory containing WAV samples
 * @param sourcePath - Path to source .a3p file (also used to find raw .a3s files)
 * @returns Promise resolving to XML string with pretty formatting
 *
 * @remarks
 * DecentSampler XML structure:
 * ```xml
 * <DecentSampler minVersion="1.0.0">
 *   <groups attack="0.0" decay="0.0" sustain="1.0" release="0.1">
 *     <group name="program-name">
 *       <sample path="..." rootNote="..." loNote="..." hiNote="..." .../>
 *     </group>
 *   </groups>
 *   <effects>
 *     <effect type="lowpass" frequency="22000.0"/>
 *     <effect type="reverb" wetLevel="0.0"/>
 *   </effects>
 * </DecentSampler>
 * ```
 *
 * Pan conversion: Akai (-50 to +50) → DecentSampler (-100 to +100)
 * Tuning: Akai semitones → DecentSampler tuning attribute
 * Volume: Akai dB offset → DecentSampler volume="XdB"
 *
 * @internal
 */
async function createDecentSamplerXML(
    program: S3KProgramData,
    outputDir: string,
    wavDir: string,
    sourcePath: string
): Promise<string> {
    const baseName = basename(sourcePath, extname(sourcePath));
    const rawDir = dirname(sourcePath);

    // Build XML structure
    const root = create({ version: "1.0" }).ele("DecentSampler", {
        minVersion: "1.0.0",
    });

    // Add groups element with default ADSR
    const groups = root.ele("groups", {
        attack: "0.0",
        decay: "0.0",
        sustain: "1.0",
        release: "0.1",
    });

    // Create a single group for all samples
    const group = groups.ele("group", { name: program.name });

    for (const kg of program.keygroups) {
        // Validate and fix key range
        let lokey = kg.lowKey;
        let hikey = kg.highKey;

        // Skip invalid keygroups (hikey = 0 with lokey > 0 indicates unused)
        if (hikey === 0 && lokey > 0) {
            continue;
        }

        // Ensure valid MIDI key range
        lokey = Math.max(0, Math.min(127, lokey));
        hikey = Math.max(0, Math.min(127, hikey));

        // If hikey is still 0 and lokey is 0, set hikey to 127
        if (hikey === 0 && lokey === 0) {
            hikey = 127;
        }

        // Skip if range is still invalid
        if (lokey > hikey) {
            continue;
        }

        // Clamp velocity to valid MIDI range (0-127)
        let lovel = Math.max(0, Math.min(127, kg.lowVel));
        let hivel = Math.max(0, Math.min(127, kg.highVel));

        // Fix reversed velocity ranges
        if (lovel > hivel) {
            [lovel, hivel] = [hivel, lovel];
        }

        // Convert pan offset from unsigned byte to signed (-50 to +50)
        // Values >= 128 are negative (e.g., 206 = -50)
        let panOffset = kg.panOffset;
        if (panOffset > 127) {
            panOffset = panOffset - 256;
        }
        // Calculate pan (-100 to 100 for DecentSampler)
        const pan = Math.max(-100, Math.min(100, Math.round((panOffset / 50.0) * 100)));

        // Get pitch_keycenter from sample's original pitch (SPITCH)
        // Fall back to center of key range if sample header unavailable
        let pitch = await getSamplePitch(kg.sampleName, rawDir);
        if (pitch === null) {
            // Default to middle of key range as fallback
            pitch = Math.round((lokey + hikey) / 2);
        }
        pitch = Math.max(0, Math.min(127, pitch));

        // Calculate tuning in semitones (kg.tune is already in semitones from Akai format)
        const tuneSemitones = kg.tune;

        // Calculate volume (Akai volume offset is in dB)
        const volOffset = kg.volOffset;

        // Find sample file
        const wavFile = findSampleFile(kg.sampleName, wavDir, baseName);
        if (!wavFile) {
            console.warn(`Sample not found: ${kg.sampleName}`);
            continue;
        }

        // Create relative path from output_dir to wav_dir
        const relPath = relative(outputDir, join(wavDir, wavFile));

        // Create sample element
        const sampleAttrs: Record<string, string> = {
            path: relPath,
            rootNote: String(pitch),
            loNote: String(lokey),
            hiNote: String(hikey),
        };

        if (lovel > 0 || hivel < 127) {
            sampleAttrs.loVel = String(lovel);
            sampleAttrs.hiVel = String(hivel);
        }

        if (tuneSemitones !== 0) {
            sampleAttrs.tuning = tuneSemitones.toFixed(2);
        }

        if (volOffset !== 0) {
            sampleAttrs.volume = `${volOffset}dB`;
        }

        if (pan !== 0) {
            sampleAttrs.pan = String(pan);
        }

        group.ele("sample", sampleAttrs);
    }

    // Add basic effects section
    const effects = root.ele("effects");
    effects.ele("effect", { type: "lowpass", frequency: "22000.0" });
    effects.ele("effect", { type: "reverb", wetLevel: "0.0" });

    // Convert to pretty-printed XML
    return root.end({ prettyPrint: true, indent: "  " });
}

/**
 * Create DecentSampler .dspreset file from program data
 *
 * Wrapper function that generates XML and writes to .dspreset file.
 *
 * @param program - Parsed S3K program data
 * @param outputDir - Output directory for dspreset file
 * @param wavDir - Directory containing WAV samples
 * @param sourcePath - Path to source .a3p file (also used to find raw .a3s files)
 * @returns Promise resolving to path of created dspreset file
 *
 * @throws Error if unable to write file
 *
 * @example
 * ```typescript
 * const program = await parseA3P('/path/to/program.a3p');
 * const dsPath = await createDecentSampler(
 *   program,
 *   '/output/decentsampler',
 *   '/output/wav',
 *   '/path/to/program.a3p'
 * );
 * console.log(`DecentSampler preset: ${dsPath}`);
 * ```
 *
 * @public
 */
export async function createDecentSampler(
    program: S3KProgramData,
    outputDir: string,
    wavDir: string,
    sourcePath: string
): Promise<string> {
    const baseName = basename(sourcePath, extname(sourcePath));
    const dspresetPath = join(outputDir, `${baseName}.dspreset`);

    const xml = await createDecentSamplerXML(program, outputDir, wavDir, sourcePath);
    writeFileSync(dspresetPath, xml);

    return dspresetPath;
}

/**
 * Convert an Akai .a3p program file to DecentSampler format
 *
 * Complete conversion pipeline from S3K program to DecentSampler preset.
 * Parses program file and generates .dspreset XML with sample references.
 *
 * @param a3pFile - Path to .a3p file
 * @param outputDir - Output directory for dspreset file
 * @param wavDir - Directory containing WAV samples
 * @returns Promise resolving to path of created dspreset file
 *
 * @throws Error if parsing or file writing fails
 *
 * @remarks
 * DecentSampler is a free sampler plugin that uses XML-based preset files.
 * This converter creates presets compatible with DecentSampler 1.0.0+.
 *
 * Generated features:
 * - Sample regions with key/velocity mapping
 * - Root note and tuning
 * - Pan and volume settings
 * - Basic lowpass filter
 * - Reverb effect (disabled by default)
 *
 * @example
 * ```typescript
 * const dsPath = await convertA3PToDecentSampler(
 *   '/disks/mydisk/raw/program.a3p',
 *   '/disks/mydisk/decentsampler',
 *   '/disks/mydisk/wav'
 * );
 * console.log(`DecentSampler preset: ${dsPath}`);
 * ```
 *
 * @public
 */
export async function convertA3PToDecentSampler(
    a3pFile: string,
    outputDir: string,
    wavDir: string
): Promise<string> {
    const program = await parseA3P(a3pFile);
    return createDecentSampler(program, outputDir, wavDir, a3pFile);
}
