/**
 * Akai S3000/S1000 Program to SFZ Converter
 *
 * Converts Akai .a3p program files to SFZ format for use with modern samplers.
 * Handles keygroup mapping, velocity layers, tuning, and pan/volume settings.
 *
 * @module converters/s3k-to-sfz
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename, join, relative, extname, dirname } from "pathe";
import { glob } from "glob";
import {
    parseProgramHeader,
    parseKeygroupHeader,
    parseSampleHeader,
    ProgramHeader,
    KeygroupHeader,
    SampleHeader,
    readAkaiData,
} from "@oletizi/sampler-devices/s3k";

/**
 * Keygroup data extracted from S3K program
 *
 * @public
 */
export interface S3KKeygroupData {
    /** Lowest MIDI note number in key range (0-127) */
    lowKey: number;

    /** Highest MIDI note number in key range (0-127) */
    highKey: number;

    /** Fine tuning in semitones */
    tune: number;

    /** Name of sample file (Akai format) */
    sampleName: string;

    /** Lowest velocity value (0-127) */
    lowVel: number;

    /** Highest velocity value (0-127) */
    highVel: number;

    /** Volume offset in dB */
    volOffset: number;

    /** Pan offset (-50 to +50) */
    panOffset: number;

    /** Velocity zone tuning offset (-50.00 to +50.00) - NOT root pitch */
    zoneTuneOffset: number;
}

/**
 * Complete S3K program data
 *
 * @public
 */
export interface S3KProgramData {
    /** Program name */
    name: string;

    /** MIDI program number (0-127) */
    midiProg: number;

    /** MIDI channel (0-15) */
    midiChan: number;

    /** Program low key limit */
    lowKey: number;

    /** Program high key limit */
    highKey: number;

    /** Array of keygroup configurations */
    keygroups: S3KKeygroupData[];
}

/**
 * Parse an Akai .a3p program file
 *
 * Reads and parses S3000/S1000 program file format, extracting program header
 * and all keygroup definitions.
 *
 * @param filepath - Path to the .a3p file
 * @returns Promise resolving to parsed program data
 *
 * @throws Error if file cannot be read or parsed
 *
 * @remarks
 * S3K program file structure:
 * - Bytes 0x00-0xBF: Program header
 * - Bytes 0xC0+: Keygroup headers (0xC2 bytes each)
 *
 * Tuning values are stored as fixed-point (divide by 256 for semitones).
 *
 * @example
 * ```typescript
 * const program = await parseA3P('/path/to/program.a3p');
 * console.log(`Program: ${program.name}`);
 * console.log(`Keygroups: ${program.keygroups.length}`);
 * ```
 *
 * @public
 */
export async function parseA3P(filepath: string): Promise<S3KProgramData> {
    const data = await readAkaiData(filepath);

    const program = {} as ProgramHeader;
    // Offset 1 skips the file type byte at position 0
    parseProgramHeader(data, 1, program);

    // Program name is already converted to string by parser
    const programName = program.PRNAME;
    const numKeygroups = program.GROUPS;

    const keygroups: S3KKeygroupData[] = [];
    // Keygroups start at byte 192 (0xc0), matching CHUNK_LENGTH in readAkaiProgram
    let offset = 0xc0;

    for (let i = 0; i < numKeygroups; i++) {
        // Check if enough data remains for essential keygroup fields (sample name, key range, etc.)
        // Essential fields are within first ~160 bytes (0xA0), full keygroup is 194 bytes (0xC2)
        const minKeygroupSize = 0xa0;
        if ((offset + minKeygroupSize) * 2 > data.length) {
            break;
        }

        const keygroup = {} as KeygroupHeader;
        parseKeygroupHeader(data, offset, keygroup);

        // Sample name is already converted to string by parser
        const sampleName = keygroup.SNAME1;
        const tune = keygroup.KGTUNO / 256.0;

        keygroups.push({
            lowKey: keygroup.LONOTE,
            highKey: keygroup.HINOTE,
            tune,
            sampleName,
            lowVel: keygroup.LOVEL1,
            highVel: keygroup.HIVEL1,
            volOffset: keygroup.VLOUD1,
            panOffset: keygroup.VPANO1,
            zoneTuneOffset: keygroup.VTUNO1 / 256.0,
        });

        // Keygroups are CHUNK_LENGTH (192 bytes = 0xC0) apart, same as program header size
        offset += 0xc0;
    }

    return {
        name: programName,
        midiProg: program.PRGNUM,
        midiChan: program.PMCHAN,
        lowKey: program.PLAYLO,
        highKey: program.PLAYHI,
        keygroups,
    };
}

/**
 * Find sample file with various naming patterns
 *
 * Searches for sample files using multiple naming strategies to handle
 * different conversion scenarios (stereo pairs, name transformations, etc.).
 *
 * @param sampleName - Base sample name from program file
 * @param wavDir - Directory containing WAV files
 * @param baseName - Base name of the source .a3p file
 * @returns Sample filename if found, null otherwise
 *
 * @remarks
 * Search strategy:
 * 1. Direct match: samplename.wav
 * 2. Stereo pairs: samplename_-l.wav, samplename_-r.wav
 * 3. Pattern match: basename*_-l.wav
 *
 * Sample names are normalized (lowercase, spaces to underscores).
 *
 * @example
 * ```typescript
 * const wavFile = findSampleFile('Piano C3', '/samples/wav', 'piano-program');
 * // Returns: 'piano_c3.wav' or 'piano_c3_-l.wav' if found
 * ```
 *
 * @public
 */
export function findSampleFile(
    sampleName: string,
    wavDir: string,
    baseName: string
): string | null {
    // Trim whitespace, convert to lowercase, replace internal spaces with underscores
    const safeName = sampleName.trim().toLowerCase().replace(/\s+/g, "_");
    let wavFile = `${safeName}.wav`;

    // Check if file exists as-is
    if (existsSync(join(wavDir, wavFile))) {
        return wavFile;
    }

    // Try with -l or -r suffix (stereo pairs)
    for (const suffix of ["_-l", "_-r"]) {
        const testFile = `${safeName}${suffix}.wav`;
        if (existsSync(join(wavDir, testFile))) {
            return testFile;
        }
    }

    // Try base_name pattern (e.g., moogb3600_-l.wav)
    const pattern = join(wavDir, `${baseName}*_-l.wav`);
    const matches = glob.sync(pattern);
    if (matches.length > 0) {
        return basename(matches[0]);
    }

    return null;
}

/**
 * Get sample's original pitch (root note) from .a3s file
 *
 * Reads the sample header to extract SPITCH - the original recorded pitch.
 * This is used for pitch_keycenter in SFZ output.
 *
 * @param sampleName - Sample name from keygroup
 * @param rawDir - Directory containing raw .a3s files
 * @returns MIDI note number (21-127), or null if sample not found
 *
 * @remarks
 * SPITCH range: 21 (A1) to 127 (G8)
 * Returns null if sample file cannot be read or doesn't exist.
 *
 * @example
 * ```typescript
 * const pitch = await getSamplePitch('OBXA4', '/path/to/raw');
 * // Returns 60 for a sample recorded at C3
 * ```
 *
 * @public
 */
export async function getSamplePitch(
    sampleName: string,
    rawDir: string
): Promise<number | null> {
    // Trim whitespace, convert to lowercase, replace internal spaces with underscores
    const safeName = sampleName.trim().toLowerCase().replace(/\s+/g, "_");

    // Try to find the .a3s sample file
    const sampleFile = `${safeName}.a3s`;
    const samplePath = join(rawDir, sampleFile);

    if (!existsSync(samplePath)) {
        return null;
    }

    try {
        const data = await readAkaiData(samplePath);
        const sample = {} as SampleHeader;
        // Sample files (.a3s) start directly with sample header at offset 0
        // (unlike program files which have a file type byte at position 0)
        parseSampleHeader(data, 0, sample);
        return sample.SPITCH;
    } catch {
        return null;
    }
}

/**
 * Create SFZ file from program data
 *
 * Generates SFZ instrument definition from parsed S3K program data.
 * Creates region definitions with proper key/velocity mapping, tuning,
 * pan, and volume settings.
 *
 * @param program - Parsed program data
 * @param outputDir - Output directory for SFZ file
 * @param wavDir - Directory containing WAV samples
 * @param sourcePath - Path to source .a3p file (also used to find raw .a3s files)
 * @returns Promise resolving to path of created SFZ file
 *
 * @throws Error if unable to write SFZ file
 *
 * @remarks
 * SFZ features generated:
 * - Region key ranges (lokey/hikey)
 * - Velocity layers (lovel/hivel)
 * - Pitch center (pitch_keycenter from sample's SPITCH)
 * - Fine tuning (tune in cents)
 * - Volume (volume in dB)
 * - Pan (pan -100 to +100)
 *
 * Invalid keygroups are automatically filtered:
 * - hikey=0 with lokey>0 (unused keygroup)
 * - Invalid key ranges (lokey > hikey)
 * - Missing sample files
 *
 * @example
 * ```typescript
 * const program = await parseA3P('/path/to/program.a3p');
 * const sfzPath = await createSFZ(
 *   program,
 *   '/output/sfz',
 *   '/output/wav',
 *   '/path/to/program.a3p'
 * );
 * console.log(`Created: ${sfzPath}`);
 * ```
 *
 * @public
 */
export async function createSFZ(
    program: S3KProgramData,
    outputDir: string,
    wavDir: string,
    sourcePath: string
): Promise<string> {
    const baseName = basename(sourcePath, extname(sourcePath));
    const sfzPath = join(outputDir, `${baseName}.sfz`);
    const rawDir = dirname(sourcePath);

    const lines: string[] = [];
    lines.push(`// ${program.name}`);
    lines.push(`// Source: ${basename(sourcePath)}`);
    lines.push(
        `// MIDI Program: ${program.midiProg}, Channel: ${program.midiChan}`
    );
    lines.push("");

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
        // Convert to SFZ range (-100 to 100)
        const panPercent = Math.max(
            -100.0,
            Math.min(100.0, (panOffset / 50.0) * 100)
        );

        // Find sample file
        const wavFile = findSampleFile(kg.sampleName, wavDir, baseName);
        if (!wavFile) {
            console.warn(`Sample not found: ${kg.sampleName}`);
            continue;
        }

        // Get pitch_keycenter from sample's original pitch (SPITCH)
        // Fall back to center of key range if sample header unavailable
        let pitch = await getSamplePitch(kg.sampleName, rawDir);
        if (pitch === null) {
            // Default to middle of key range as fallback
            pitch = Math.round((lokey + hikey) / 2);
        }
        pitch = Math.max(0, Math.min(127, pitch));

        // Create relative path from output_dir to wav_dir
        const relPath = relative(outputDir, join(wavDir, wavFile));

        lines.push("<region>");
        lines.push(`sample=${relPath}`);
        lines.push(`lokey=${lokey}`);
        lines.push(`hikey=${hikey}`);
        lines.push(`pitch_keycenter=${pitch}`);

        if (lovel > 0 || hivel < 127) {
            lines.push(`lovel=${lovel}`);
            lines.push(`hivel=${hivel}`);
        }

        if (kg.tune !== 0) {
            lines.push(`tune=${Math.round(kg.tune * 100)}`);
        }

        if (kg.volOffset !== 0) {
            lines.push(`volume=${kg.volOffset}`);
        }

        if (panOffset !== 0) {
            lines.push(`pan=${panPercent.toFixed(1)}`);
        }

        lines.push("");
    }

    writeFileSync(sfzPath, lines.join("\n"));
    return sfzPath;
}

/**
 * Convert an Akai .a3p program file to SFZ format
 *
 * Complete conversion pipeline from S3K program to SFZ instrument.
 * Parses program file and generates SFZ with sample references.
 *
 * @param a3pFile - Path to .a3p file
 * @param outputDir - Output directory for SFZ file
 * @param wavDir - Directory containing WAV samples
 * @returns Promise resolving to path of created SFZ file
 *
 * @throws Error if parsing or file writing fails
 *
 * @example
 * ```typescript
 * const sfzPath = await convertA3PToSFZ(
 *   '/disks/mydisk/raw/program.a3p',
 *   '/disks/mydisk/sfz',
 *   '/disks/mydisk/wav'
 * );
 * console.log(`SFZ created: ${sfzPath}`);
 * ```
 *
 * @public
 */
export async function convertA3PToSFZ(
    a3pFile: string,
    outputDir: string,
    wavDir: string
): Promise<string> {
    const program = await parseA3P(a3pFile);
    return createSFZ(program, outputDir, wavDir, a3pFile);
}
