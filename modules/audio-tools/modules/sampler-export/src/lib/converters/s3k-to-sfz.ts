/**
 * Akai S3000/S1000 Program to SFZ Converter
 *
 * Converts Akai .a3p program files to SFZ format for use with modern samplers.
 * Handles keygroup mapping, velocity layers, tuning, and pan/volume settings.
 *
 * @module converters/s3k-to-sfz
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename, join, relative, extname } from "pathe";
import { glob } from "glob";
import {
    parseProgramHeader,
    parseKeygroupHeader,
    ProgramHeader,
    KeygroupHeader,
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

    /** Root pitch/note number */
    pitch: number;
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
        // Check if enough nibbles remain (offset and size are in bytes, data.length is in nibbles)
        if ((offset + 0xc2) * 2 > data.length) {
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
            pitch: keygroup.VTUNO1,
        });

        offset += 0xc2;
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
 * Create SFZ file from program data
 *
 * Generates SFZ instrument definition from parsed S3K program data.
 * Creates region definitions with proper key/velocity mapping, tuning,
 * pan, and volume settings.
 *
 * @param program - Parsed program data
 * @param outputDir - Output directory for SFZ file
 * @param wavDir - Directory containing WAV samples
 * @param sourcePath - Path to source .a3p file
 * @returns Path to created SFZ file
 *
 * @throws Error if unable to write SFZ file
 *
 * @remarks
 * SFZ features generated:
 * - Region key ranges (lokey/hikey)
 * - Velocity layers (lovel/hivel)
 * - Pitch center (pitch_keycenter)
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
 * const sfzPath = createSFZ(
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
export function createSFZ(
    program: S3KProgramData,
    outputDir: string,
    wavDir: string,
    sourcePath: string
): string {
    const baseName = basename(sourcePath, extname(sourcePath));
    const sfzPath = join(outputDir, `${baseName}.sfz`);

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

        // Clamp pan to valid SFZ range (-100 to 100)
        const panOffset = kg.panOffset;
        const panPercent = Math.max(
            -100.0,
            Math.min(100.0, (panOffset / 50.0) * 100)
        );

        // Clamp pitch to valid MIDI range
        const pitch = Math.max(0, Math.min(127, kg.pitch));

        // Find sample file
        const wavFile = findSampleFile(kg.sampleName, wavDir, baseName);
        if (!wavFile) {
            console.warn(`Sample not found: ${kg.sampleName}`);
            continue;
        }

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
