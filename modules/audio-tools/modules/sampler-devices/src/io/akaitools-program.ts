import fs from "fs/promises";
import path from "pathe";
import { byte2nibblesLE, nibbles2byte } from "@oletizi/sampler-lib";
import {
    AkaiProgramFile,
    AkaiToolsConfig,
    KeygroupHeader,
    parseKeygroupHeader,
    parseProgramHeader,
    ProgramHeader,
    SampleHeader
} from "@/index.js";
import { CHUNK_LENGTH, ExecutionResult, RAW_LEADER } from '@/io/akaitools-core.js';
import { doSpawn } from '@/io/akaitools-process.js';

/**
 * Read Akai data from a file and convert to nibbles
 * @param file Path to Akai file
 * @returns Promise resolving to array of nibbles
 */
export async function readAkaiData(file: string): Promise<number[]> {
    const buffer = await fs.readFile(file);
    const data = [];
    for (let i = 0; i < buffer.length; i++) {
        const nibbles = byte2nibblesLE(buffer[i]);
        data.push(nibbles[0]);
        data.push(nibbles[1]);
    }
    return data;
}

/**
 * Write Akai data from nibbles to a file
 * @param file Path to write to
 * @param nibbles Array of nibbles to convert and write
 */
export async function writeAkaiData(file: string, nibbles: number[]): Promise<void> {
    const outdata = [];
    for (let i = 0; i < nibbles.length; i += 2) {
        outdata.push(nibbles2byte(nibbles[i], nibbles[i + 1]));
    }
    await fs.writeFile(file, Buffer.from(outdata));
}

/**
 * Read an Akai program file (.a3p)
 * @param file Path to program file
 * @returns Promise resolving to parsed program file with keygroups
 */
export async function readAkaiProgram(file: string): Promise<AkaiProgramFile> {
    const data = await readAkaiData(file);
    const program = {} as ProgramHeader;
    const keygroups: KeygroupHeader[] = [];

    parseProgramHeader(data, 1, program);
    program.raw = new Array(RAW_LEADER).fill(0).concat(data);

    for (let i = 0; i < program.GROUPS; i++) {
        const kg = {} as KeygroupHeader;
        const kgData = data.slice(CHUNK_LENGTH + CHUNK_LENGTH * i);
        parseKeygroupHeader(kgData, 0, kg);
        kg.raw = new Array(RAW_LEADER).fill(0).concat(kgData);
        keygroups.push(kg);
    }

    return {
        keygroups: keygroups,
        program: program
    };
}

/**
 * Write an Akai program file (.a3p)
 * @param file Path to write to
 * @param p Program file data with keygroups
 */
export async function writeAkaiProgram(file: string, p: AkaiProgramFile): Promise<void> {
    const nibbles = p.program.raw.slice(RAW_LEADER);
    for (let i = 0; i < p.keygroups.length; i++) {
        const kgData = p.keygroups[i].raw.slice(RAW_LEADER);
        for (let j = 0; j < kgData.length; j++) {
            nibbles[CHUNK_LENGTH + CHUNK_LENGTH * i + j] = kgData[j];
        }
    }
    await writeAkaiData(file, nibbles);
}

/**
 * Write an Akai sample file (.a3s)
 * @param file Path to write to
 * @param s Sample header data
 */
export async function writeAkaiSample(file: string, s: SampleHeader): Promise<void> {
    const nibbles = s.raw.slice(RAW_LEADER);
    await writeAkaiData(file, nibbles);
}

/**
 * Convert WAV file to Akai sample format
 * @param c Configuration
 * @param sourcePath Path to WAV file to convert
 * @param targetPath Path to output directory on local filesystem (NOT in an Akai disk)
 * @param targetName Name of the converted sample (must obey Akai naming: <= 12 characters, alphanumeric)
 * @returns Promise resolving to execution result
 */
export async function wav2Akai(
    c: AkaiToolsConfig,
    sourcePath: string,
    targetPath: string,
    targetName: string
): Promise<ExecutionResult> {
    process.env['PERL5LIB'] = c.akaiToolsPath;
    return doSpawn(
        path.join(c.akaiToolsPath, 'wav2akai'),
        ['-n', targetName, '-d', `"${targetPath}"`, `"${sourcePath}"`]
    );
}

/**
 * Convert an Akai .a3s sample file to WAV format
 * Note: Outputs to current working directory with same basename + .wav extension
 * @param c Akai tools configuration
 * @param sourcePath Path to .a3s file
 * @returns Promise resolving to execution result
 */
export async function akai2Wav(c: AkaiToolsConfig, sourcePath: string): Promise<ExecutionResult> {
    process.env['PERL5LIB'] = c.akaiToolsPath;
    return doSpawn(
        path.join(c.akaiToolsPath, 'akai2wav'),
        [`"${sourcePath}"`]
    );
}
