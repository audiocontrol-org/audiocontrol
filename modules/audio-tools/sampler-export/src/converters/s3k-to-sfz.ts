/**
 * Akai S3000/S1000 Program to SFZ Converter
 *
 * Converts Akai .a3p program files to SFZ format for use with modern samplers.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename, join, relative, extname } from "pathe";
import { glob } from "glob";
import {
    parseProgramHeader,
    parseKeygroupHeader,
    ProgramHeader,
    KeygroupHeader,
} from "@oletizi/sampler-devices/s3k";
import { readAkaiData } from "@oletizi/sampler-devices";

export interface S3KKeygroupData {
    lowKey: number;
    highKey: number;
    tune: number;
    sampleName: string;
    lowVel: number;
    highVel: number;
    volOffset: number;
    panOffset: number;
    pitch: number;
}

export interface S3KProgramData {
    name: string;
    midiProg: number;
    midiChan: number;
    lowKey: number;
    highKey: number;
    keygroups: S3KKeygroupData[];
}

/**
 * Parse an Akai .a3p program file
 *
 * @param filepath - Path to the .a3p file
 * @returns Parsed program data
 */
export async function parseA3P(filepath: string): Promise<S3KProgramData> {
    const data = await readAkaiData(filepath);

    const program = {} as ProgramHeader;
    parseProgramHeader(data, 0, program);

    // Program name is already converted to string by parser
    const programName = program.PRNAME;
    const numKeygroups = program.GROUPS;

    const keygroups: S3KKeygroupData[] = [];
    let offset = 0xc0;

    for (let i = 0; i < numKeygroups; i++) {
        if (offset + 0xc2 > data.length) {
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
 * @param sampleName - Base sample name
 * @param wavDir - Directory containing WAV files
 * @param baseName - Base name of the source .a3p file
 * @returns Sample filename or null if not found
 */
export function findSampleFile(
    sampleName: string,
    wavDir: string,
    baseName: string
): string | null {
    const safeName = sampleName.toLowerCase().replace(/\s+/g, "_");
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
 * @param program - Parsed program data
 * @param outputDir - Output directory for SFZ file
 * @param wavDir - Directory containing WAV samples
 * @param sourcePath - Path to source .a3p file
 * @returns Path to created SFZ file
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
 * @param a3pFile - Path to .a3p file
 * @param outputDir - Output directory for SFZ file
 * @param wavDir - Directory containing WAV samples
 * @returns Path to created SFZ file
 */
export async function convertA3PToSFZ(
    a3pFile: string,
    outputDir: string,
    wavDir: string
): Promise<string> {
    const program = await parseA3P(a3pFile);
    return createSFZ(program, outputDir, wavDir, a3pFile);
}
