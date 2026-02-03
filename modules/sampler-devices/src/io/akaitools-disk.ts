import fs from "fs/promises";
import path from "pathe";
import { Writable } from "stream";
import {
    AkaiDisk,
    AkaiDiskResult,
    AkaiPartition,
    AkaiRecord,
    AkaiRecordResult,
    AkaiRecordType,
    AkaiToolsConfig
} from "@/index.js";
import { ExecutionResult } from '@/io/akaitools-core.js';
import { doSpawn } from '@/io/akaitools-process.js';

/**
 * Read an Akai disk and return its structure
 * @param c Configuration
 * @param listFunction Function to list disk contents (injected for testability)
 * @returns Promise resolving to disk structure with partitions and volumes
 */
export async function readAkaiDisk(
    c: AkaiToolsConfig,
    listFunction: (akaiPath: string, partition: number) => Promise<AkaiRecordResult>
): Promise<AkaiDiskResult> {
    const parsed = path.parse(c.diskFile);
    const disk: AkaiDisk = {
        timestamp: new Date().getTime(),
        name: parsed.name + parsed.ext,
        partitions: []
    };
    const rv: AkaiDiskResult = { data: disk, errors: [] };

    // Partitions start at 1. Asking for partition 0 is the same as asking for partition 1
    for (let i = 1; i < 50; i++) {
        const result = await listFunction('/', i);
        if (result.errors.length > 0) {
            // This is what akailist does when the partition doesn't exist
            if (result.errors[0].message.includes('Operation not supported by device')) {
                break;
            } else {
                rv.errors = rv.errors.concat(result.errors);
                return rv;
            }
        }

        const partition: AkaiPartition = {
            block: 0,
            name: String(i),
            size: 0,
            type: AkaiRecordType.PARTITION,
            volumes: []
        };
        disk.partitions.push(partition);

        for (const r of result.data) {
            switch (r.type) {
                case AkaiRecordType.VOLUME:
                    partition.volumes.push({
                        block: r.block,
                        name: r.name,
                        records: [],
                        size: r.size,
                        type: AkaiRecordType.VOLUME
                    });
                    break;
                case AkaiRecordType.PROGRAM:
                case AkaiRecordType.SAMPLE:
                    partition.volumes.forEach(v => {
                        if (r.name.startsWith(v.name)) {
                            console.log(`Pushing r: ${r.name} to v: ${v.name}`);
                            v.records.push(r);
                        }
                    });
                    break;
            }
        }
    }

    return rv;
}

/**
 * Parse akailist output into structured records
 * @param data Raw output from akailist command
 * @returns Array of parsed Akai records
 */
export function parseAkaiList(data: string): AkaiRecord[] {
    const rv: AkaiRecord[] = [];
    for (const line of String(data).split('\n')) {
        if (line.trim() === '') {
            continue;
        }
        const record: AkaiRecord = {
            block: 0,
            name: "",
            size: 0,
            type: AkaiRecordType.NULL
        };
        record.type = line.slice(0, 15).trim() as AkaiRecordType;
        record.block = Number.parseInt(line.slice(15, 25).trim());
        record.size = Number.parseInt(line.slice(25, 34).trim());
        record.name = line.slice(35).trim();
        rv.push(record);
    }
    return rv;
}

/**
 * List contents of an Akai disk partition
 * @param c Configuration
 * @param akaiPath Path within the Akai disk
 * @param partition Partition number (default: 1)
 * @returns Promise resolving to list of records
 */
export async function akaiList(
    c: AkaiToolsConfig,
    akaiPath: string = '/',
    partition = 1
): Promise<AkaiRecordResult> {
    await validateConfig(c);
    const rv: AkaiRecordResult = { data: [], errors: [] };
    const bin = path.join(c.akaiToolsPath, 'akailist');
    const args = ['-f', `${c.diskFile}`, '-l', '-R', '-p', String(partition), '-u', akaiPath];
    process.env['PERL5LIB'] = c.akaiToolsPath;

    const result = await doSpawn(bin, args, {
        onStart: () => {
            // No action needed on start
        },
        onData: (data) => {
            parseAkaiList(String(data)).forEach(r => rv.data.push(r));
        }
    });
    rv.errors = rv.errors.concat(result.errors);
    return rv;
}

/**
 * Format an Akai disk with specified partitions
 * @param c Configuration
 * @param partitionSize Size of each partition in MB (default: 60)
 * @param partitionCount Number of partitions to create (default: 1)
 * @returns Promise resolving to execution result
 */
export async function akaiFormat(
    c: AkaiToolsConfig,
    partitionSize: number = 60,
    partitionCount = 1
): Promise<ExecutionResult> {
    process.env['PERL5LIB'] = c.akaiToolsPath;
    return doSpawn(
        path.join(c.akaiToolsPath, 'akaiformat'),
        ['-f', String(c.diskFile)].concat(new Array(partitionCount).fill(partitionSize)),
        {
            onData: () => {
                // No action needed on data
            },
            onStart: (child) => {
                if (child.stdin instanceof Writable) {
                    child.stdin.write('y\n');
                }
            }
        }
    );
}

/**
 * Write a file to an Akai disk
 * @param c Configuration
 * @param sourcePath Path to source file on local filesystem
 * @param targetPath Path on Akai disk
 * @param partition Partition number (default: 1)
 * @returns Promise resolving to execution result
 */
export async function akaiWrite(
    c: AkaiToolsConfig,
    sourcePath: string,
    targetPath: string,
    partition: number = 1
): Promise<ExecutionResult> {
    process.env['PERL5LIB'] = c.akaiToolsPath;
    console.log(`akaiwrite: sourcePath: ${sourcePath}`);
    console.log(`akaiwrite: targetPath: ${targetPath}`);
    return doSpawn(
        path.join(c.akaiToolsPath, 'akaiwrite'),
        ['-f', c.diskFile, '-p', String(partition), '-d', targetPath, sourcePath]
    );
}

/**
 * Read a file from an Akai disk
 * @param c Configuration
 * @param sourcePath Path on Akai disk
 * @param targetPath Path to write on local filesystem
 * @param partition Partition number (default: 1)
 * @param recursive Whether to read recursively (default: true)
 * @returns Promise resolving to execution result
 */
export async function akaiRead(
    c: AkaiToolsConfig,
    sourcePath: string,
    targetPath: string,
    partition: number = 1,
    recursive: boolean = true
): Promise<ExecutionResult> {
    process.env['PERL5LIB'] = c.akaiToolsPath;
    console.log(`akairead: sourcePath: ${sourcePath}`);
    console.log(`akairead: targetPath: ${targetPath}`);
    return doSpawn(
        path.join(c.akaiToolsPath, 'akairead'),
        ['-f', c.diskFile, '-p', String(partition), '-d', targetPath, recursive ? '-R' : '', sourcePath]
    );
}

/**
 * Validate Akai tools configuration
 * @param c Configuration to validate
 * @throws Error if configuration is invalid
 */
async function validateConfig(c: AkaiToolsConfig): Promise<void> {
    let s;
    try {
        s = await fs.stat(c.diskFile);
    } catch (e) {
        // Disk file may not exist yet
    }

    if (s?.isDirectory()) {
        throw new Error(`Akai disk file is a directory: ${c.diskFile}`);
    }

    s = await fs.stat(c.akaiToolsPath);
    if (!s.isDirectory()) {
        throw new Error(`Akai tools path is not a directory: ${c.akaiToolsPath}`);
    }

    const requiredTools = new Set([
        'akai2wav',
        'akailist',
        'akaiconv',
        'akaiformat',
        'akaimkdir',
        'akairead',
        'akaiwrite',
        'any2akai'
    ]);

    const availableTools = new Set(await fs.readdir(c.akaiToolsPath));
    if (!requiredTools.isSubsetOf(availableTools)) {
        throw new Error(`Akai tools path does not contain expected executables.`);
    }
}
