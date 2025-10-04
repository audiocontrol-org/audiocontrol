import fs from "fs/promises";
import {ChildProcess, spawn} from 'child_process'
import path from "pathe";
import {byte2nibblesLE, nibbles2byte, newServerConfig} from "@oletizi/sampler-lib"
import {
    KeygroupHeader,
    parseKeygroupHeader,
    parseProgramHeader,
    ProgramHeader,
    SampleHeader,
    AkaiDisk,
    AkaiDiskResult,
    AkaiPartition,
    AkaiProgramFile,
    AkaiRecord,
    AkaiRecordResult,
    AkaiRecordType,
    AkaiToolsConfig,
    RemoteDisk,
    RemoteVolumeResult
} from "@/index.js";
import {Writable} from "stream";


export const CHUNK_LENGTH = 384
// export const KEYGROUP1_START_OFFSET = 384
// export const KEYGROUP2_START_OFFSET = 768
// export const KEYGROUP_LENGTH = KEYGROUP2_START_OFFSET - KEYGROUP1_START_OFFSET

// number of bytes before header start in the raw data backing each header.
// This is an artifact of the auto-generated code assuming a sysex environment which has 7 bytes of midi and housekeeping
// data in the raw midi data. This should probably sorted out in the auto-generated code.
export const RAW_LEADER = 7


export interface ExecutionResult {
    errors: Error[];
    code: number;
}

export async function newAkaiToolsConfig() {
    const cfg = await newServerConfig()
    const rv: AkaiToolsConfig = {
        piscsiHost: cfg.piscsiHost, scsiId: cfg.s3kScsiId,
        akaiToolsPath: cfg.akaiTools,
        diskFile: cfg.akaiDisk
    }
    return rv
}

export interface Akaitools {
    readAkaiDisk: () => Promise<AkaiDiskResult>
    readAkaiProgram: (file: string) => Promise<AkaiProgramFile>
    writeAkaiProgram: (file: string, p: AkaiProgramFile) => Promise<void>
    writeAkaiSample: (file: string, s: SampleHeader) => Promise<void>
    akaiFormat: (partitionSize?: number, partitionCount?: number) => Promise<ExecutionResult>
    akaiWrite: (sourcePath: string, targetPath: string, partition?: number) => Promise<ExecutionResult>
    akaiRead: (sourcePath: string, targetPath: string, partition?: number, recursive?: boolean) => Promise<ExecutionResult>
    wav2Akai: (sourcePath: string, targetPath: string, targetName: string) => Promise<ExecutionResult>
    akaiList: (akaiPath: string, partition?: number) => Promise<AkaiRecordResult>
    remoteSync: () => Promise<ExecutionResult>

    parseAkaiList(data: string): AkaiRecord[]

    parseRemoteVolumes(data: string): RemoteDisk[]

    remoteVolumes(): Promise<RemoteVolumeResult>

    remoteUnmount(v: RemoteDisk): Promise<ExecutionResult>;

    remoteMount(v: RemoteDisk): Promise<ExecutionResult>;
}

export function newAkaitools(c: AkaiToolsConfig): Akaitools {
    return new BasicAkaiTools(c)
}

class BasicAkaiTools implements Akaitools {
    private c: AkaiToolsConfig

    constructor(c: AkaiToolsConfig) {
        this.c = c
    }


    remoteMount(v: RemoteDisk): Promise<ExecutionResult> {
        return remoteMount(this.c, v)
    }

    remoteUnmount(v: RemoteDisk): Promise<ExecutionResult> {
        return remoteUnmount(this.c, v)
    }

    remoteVolumes(): Promise<RemoteVolumeResult> {
        return remoteVolumes(this.c)
    }

    parseRemoteVolumes(data: string): RemoteDisk[] {
        return parseRemoteVolumes(data)
    }

    readAkaiDisk(): Promise<AkaiDiskResult> {
        return readAkaiDisk(this.c, this.akaiList.bind(this));
    }

    readAkaiProgram(file: string): Promise<AkaiProgramFile> {
        return readAkaiProgram(file);
    }

    writeAkaiProgram(file: string, p: AkaiProgramFile): Promise<void> {
        return writeAkaiProgram(file, p);
    }

    writeAkaiSample(file: string, s: SampleHeader): Promise<void> {
        return writeAkaiSample(file, s)
    }

    akaiFormat(partitionSize: number = 60, partitionCount: number = 1): Promise<ExecutionResult> {
        return akaiFormat(this.c, partitionSize, partitionCount);
    }

    akaiWrite(sourcePath: string, targetPath: string, partition?: number): Promise<ExecutionResult> {
        return akaiWrite(this.c, sourcePath, targetPath, partition);
    }

    akaiRead(sourcePath: string, targetPath: string, partition?: number, recursive?: boolean): Promise<ExecutionResult> {
        return akaiRead(this.c, sourcePath, targetPath, partition, recursive);
    }

    wav2Akai(sourcePath: string, targetPath: string, targetName: string): Promise<ExecutionResult> {
        return wav2Akai(this.c, sourcePath, targetPath, targetName);
    }

    akaiList(akaiPath: string, partition?: number): Promise<AkaiRecordResult> {
        return akaiList(this.c, akaiPath, partition);
    }

    remoteSync(): Promise<ExecutionResult> {
        return remoteSync(this.c);
    }

    parseAkaiList(data: string): AkaiRecord[] {
        return parseAkaiList(data);
    }
}

async function remoteSync(c: AkaiToolsConfig) {
    const rv: ExecutionResult = {code: -1, errors: []}
    if (!c.piscsiHost || c.scsiId === undefined) {
        rv.errors.push(new Error('Remote host not defined.'))
        return rv
    }
    console.log(`Listing remote volumes...`)
    let result = await remoteVolumes(c)
    rv.errors = rv.errors.concat(result.errors)
    if (result.errors.length !== 0) {
        return rv
    }
    let targetVolume: RemoteDisk | undefined
    for (const v of result.data) {
        if (v.scsiId === c.scsiId) {
            targetVolume = v
            break
        }
    }

    const parsedPath = path.parse(c.diskFile);
    const imagePath = `"~/images/${parsedPath.name}${parsedPath.ext}"`;
    if (targetVolume) {
        let r = await remoteUnmount(c, targetVolume)
        if (r.errors.length !== 0) {
            rv.errors = rv.errors.concat(r.errors)
            return rv
        }
    }
    targetVolume = {image: imagePath, scsiId: c.scsiId}

    const syncResult = await doSpawn('scp', [`"${c.diskFile}"`, `${c.piscsiHost}:${targetVolume.image}`])
    if (syncResult.errors.length !== 0) {
        rv.errors = rv.errors.concat(syncResult.errors)
    }

    const mountResult = await remoteMount(c, targetVolume)
    if (mountResult.errors.length !== 0) {
        rv.errors = rv.errors.concat(mountResult.errors)
        return rv
    }

    rv.code = rv.errors.length
    return rv

}

async function remoteUnmount(c: AkaiToolsConfig, v: RemoteDisk) {
    const rv: ExecutionResult = {code: -1, errors: []}
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined.'))
    } else {
        const result = await doSpawn('ssh', [c.piscsiHost, `"scsictl -c d -i ${v.scsiId}"`])
        rv.code = result.code
        rv.errors = rv.errors.concat(result.errors)
    }
    return rv
}

async function remoteMount(c: AkaiToolsConfig, v: RemoteDisk) {
    const rv: ExecutionResult = {code: -1, errors: []}
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined'))
    } else {
        const result = await doSpawn('ssh', [c.piscsiHost, `"scsictl -c a -i ${v.scsiId} -f ${v.image}"`])
        rv.code = result.code
        rv.errors = rv.errors.concat(result.errors)
    }
    return rv
}

function parseRemoteVolumes(data: string): RemoteDisk[] {
    const rv: RemoteDisk[] = []
    data.split('\n').forEach(i => {
        const match = i.match(/\|\s*(\d+).*/)
        if (match) {
            rv.push({
                scsiId: Number.parseInt(i.substring(2, 4)),
                lun: Number.parseInt(i.substring(6, 10)),
                image: i.substring(19).trim()
            })
        }
    })
    return rv
}

async function remoteVolumes(c: AkaiToolsConfig) {
    const rv: RemoteVolumeResult = {data: [], errors: []}
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined.'))
    } else {
        await doSpawn('ssh', [c.piscsiHost, '"scsictl -l"'], {
            onData: data => {
                rv.data = rv.data.concat(parseRemoteVolumes(String(data)))
            },
            onStart: () => {
            }
        });
    }
    return rv
}

export async function readAkaiData(file: string) {
    const buffer = await fs.readFile(file)
    const data = []
    for (let i = 0; i < buffer.length; i++) {
        const nibbles = byte2nibblesLE(buffer[i])
        data.push(nibbles[0])
        data.push(nibbles[1])
    }
    return data;
}

export async function writeAkaiData(file: string, nibbles: number[]) {
    const outdata = []
    for (let i = 0; i < nibbles.length; i += 2) {
        outdata.push(nibbles2byte(nibbles[i], nibbles[i + 1]))
    }
    await fs.writeFile(file, Buffer.from(outdata))
}

async function readAkaiDisk(c: AkaiToolsConfig, listFunction: Function) {
    let parsed = path.parse(c.diskFile);
    const disk: AkaiDisk = {timestamp: new Date().getTime(), name: parsed.name + parsed.ext, partitions: []}
    const rv: AkaiDiskResult = {data: disk, errors: []}
    // const rv: AkaiDiskResult = {data: disk}

    for (let i = 1; i < 50; i++) { // partitions start at 1. Asking for partition 0 is the same as asking for partition 1
        const result = await listFunction(c, '/', i)//akaiList(c, '/', i)
        if (result.errors.length > 0) {
            // This is what akailist does when the partition doesn't exist
            if (result.errors[0].message.includes('Operation not supported by device')) {
                break
            } else {
                rv.errors = rv.errors.concat(result.errors)
                return rv
            }
        }
        const partition: AkaiPartition = {
            block: 0,
            name: String(i),
            size: 0,
            type: AkaiRecordType.PARTITION,
            volumes: []
        }
        disk.partitions.push(partition)
        for (const r of result.data) {
            switch (r.type) {
                case AkaiRecordType.VOLUME:
                    partition.volumes.push({
                        block: r.block,
                        name: r.name,
                        records: [],
                        size: r.size,
                        type: AkaiRecordType.VOLUME
                    })
                    break
                case AkaiRecordType.PROGRAM:
                case AkaiRecordType.SAMPLE:
                    partition.volumes.forEach(v => {
                        if (r.name.startsWith(v.name)) {
                            console.log(`Pushing r: ${r.name} to v: ${v.name}`)
                            v.records.push(r)

                        }
                    })
                    break
            }
        }
    }

    return rv
}

async function readAkaiProgram(file: string): Promise<AkaiProgramFile> {
    const data = await readAkaiData(file)
    const program= {} as ProgramHeader
    const keygroups: KeygroupHeader[] = []
    // const rv: AkaiProgramFile = {keygroups: [], program: {} as ProgramHeader}
    parseProgramHeader(data, 1, program)
    program.raw = new Array(RAW_LEADER).fill(0).concat(data)
    for (let i = 0; i < program.GROUPS; i++) {
        const kg = {} as KeygroupHeader
        // const kgData = data.slice(KEYGROUP1_START_OFFSET + KEYGROUP_LENGTH * i);
        const kgData = data.slice(CHUNK_LENGTH + CHUNK_LENGTH * i)
        parseKeygroupHeader(kgData, 0, kg)
        kg.raw = new Array(RAW_LEADER).fill(0).concat(kgData)
        keygroups.push(kg)
    }

    const rv: AkaiProgramFile = {
        keygroups: keygroups,
        program: program
    }
    return rv
}

async function writeAkaiProgram(file: string, p: AkaiProgramFile) {

    const nibbles = p.program.raw.slice(RAW_LEADER)
    for (let i = 0; i < p.keygroups.length; i++) {
        const kgData = p.keygroups[i].raw.slice(RAW_LEADER)
        for (let j = 0; j < kgData.length; j++) {
            // nibbles[KEYGROUP1_START_OFFSET + KEYGROUP_LENGTH * i  + j] = kgData[j]
            nibbles[CHUNK_LENGTH + CHUNK_LENGTH * i + j] = kgData[j]
        }
    }
    // const outdata = []
    // for (let i = 0; i < nibbles.length; i += 2) {
    //     outdata.push(nibbles2byte(nibbles[i], nibbles[i + 1]))
    // }
    // await fs.writeFile(file, Buffer.from(outdata))
    await writeAkaiData(file, nibbles)
}

async function writeAkaiSample(file: string, s: SampleHeader) {
    const nibbles = s.raw.slice(RAW_LEADER)
    await writeAkaiData(file, nibbles)
}

async function akaiFormat(c: AkaiToolsConfig, partitionSize: number = 1, partitionCount = 1) {
    process.env['PERL5LIB'] = c.akaiToolsPath
    return doSpawn(
        path.join(c.akaiToolsPath, 'akaiformat'),
        ['-f', String(c.diskFile)].concat(new Array(partitionCount).fill(partitionSize)),
        {
            onData: voidFunction,
            onStart: (child) => {
                if (child.stdin instanceof Writable) {
                    child.stdin.write('y\n')
                }
            }
        }
    )
}

async function akaiWrite(c: AkaiToolsConfig, sourcePath: string, targetPath: string, partition: number = 1) {
    process.env['PERL5LIB'] = c.akaiToolsPath
    console.log(`akaiwrite: sourcePath: ${sourcePath}`)
    console.log(`akaiwrite: targetPath: ${targetPath}`)
    return doSpawn(
        path.join(c.akaiToolsPath, 'akaiwrite'),
        ['-f', c.diskFile, '-p', String(partition), '-d', `"${targetPath}"`, `"${sourcePath}"`])
}

async function akaiRead(c: AkaiToolsConfig, sourcePath: string, targetPath: string, partition: number = 1, recursive: boolean = true) {
    process.env['PERL5LIB'] = c.akaiToolsPath
    console.log(`akairead: sourcePath: ${sourcePath}`)
    console.log(`akairead: targetPath: ${targetPath}`)
    return doSpawn(
        path.join(c.akaiToolsPath, 'akairead'),
        ['-f', c.diskFile, '-p', String(partition), '-d', `"${targetPath}"`, recursive ? '-R' : '', `"${sourcePath}"`])

}

/**
 *
 * @param c configuration
 * @param sourcePath path to wav file to convert
 * @param targetPath path to output directory on local filesystem (**not** in an Akai disk) to write converted sample files to
 * @param targetName name of the converted sample. Should obey Akai name requirements (<= 12 characters, alpha+a few extra characters)
 */
async function wav2Akai(c: AkaiToolsConfig, sourcePath: string, targetPath: string, targetName: string) {
    process.env['PERL5LIB'] = c.akaiToolsPath
    return doSpawn(
        path.join(c.akaiToolsPath, 'wav2akai'),
        ['-n', targetName, '-d', `"${targetPath}"`, `"${sourcePath}"`]
    )
}

function parseAkaiList(data: string) {
    const rv: AkaiRecord[] = []
    for (const line of String(data).split('\n')) {
        if (line.trim() === '') {
            continue
        }
        const record: AkaiRecord = {block: 0, name: "", size: 0, type: AkaiRecordType.NULL}
        record.type = line.slice(0, 15).trim() as AkaiRecordType
        record.block = Number.parseInt(line.slice(15, 25).trim())
        record.size = Number.parseInt(line.slice(25, 34).trim())
        record.name = line.slice(35).trim()
        rv.push(record)
    }
    return rv
}

async function akaiList(c: AkaiToolsConfig, akaiPath: string = '/', partition = 1) {
    await validateConfig(c)
    const rv: AkaiRecordResult = {data: [], errors: []}
    const bin = path.join(c.akaiToolsPath, 'akailist')
    const args = ['-f', `${c.diskFile}`, '-l', '-R', '-p', String(partition), '-u', `"${akaiPath}"`]
    process.env['PERL5LIB'] = c.akaiToolsPath

    const result = await doSpawn(bin, args, {
        onStart: () => {
        },
        onData: (data) => {
            parseAkaiList(String(data)).forEach(r => rv.data.push(r))
        }
    })
    rv.errors = rv.errors.concat(result.errors)
    return rv
}


function voidFunction() {
}

function doSpawn(bin: string, args: readonly string[],
                 opts: {
                     onData: (buf: Buffer, child: ChildProcess) => void,
                     onStart: (child: ChildProcess) => void
                 } = {onData: voidFunction, onStart: voidFunction}) {
    return new Promise<ExecutionResult>((resolve, reject) => {
        const rv: ExecutionResult = {errors: [], code: -1}
        console.log(`akaitools: ${bin} ${args.join(' ')}`)
        const child = spawn(bin, args, {shell: true})
        child.stdout.setEncoding('utf8')
        opts.onStart(child)
        child.stdout.on('data', data => {
            opts.onData(data, child)
        })

        child.on('error', (e) => {
            rv.errors.push(e);
            resolve(rv)
        })
        child.on('close', (code) => {
            if (code !== null) {
                rv.code = code
                resolve(rv)
            } else {
                reject(new Error('Process terminated without an exit code.'))
            }
        })
        child.stderr.on('data', data => {
            process.stderr.write(data)
            rv.errors.push(new Error(data))
        })

        setTimeout(() => reject(new Error(`Timout executing ${bin}.`)), 30 * 1000)
    })
}

async function validateConfig(c: AkaiToolsConfig) {
    let s
    try {
        s = await fs.stat(c.diskFile)
    } catch (e) {
    }

    if (s?.isDirectory()) {
        throw new Error(`Akai disk file is a directory: ${c.diskFile}`)
    }

    s = await fs.stat(c.akaiToolsPath)
    if (!s.isDirectory()) {
        throw new Error(`Akai tools path is not a directory: ${c.akaiToolsPath}`)
    }

    if (!new Set([
        'akai2wav',
        'akailist',
        'akaiconv',
        'akaiformat',
        'akailist',
        'akaimkdir',
        'akairead',
        'akaiwrite',
        'any2akai',
        'akai2wav'
    ]).isSubsetOf(new Set(await fs.readdir(c.akaiToolsPath)))) {
        throw new Error(`Akai tools path does not contain expected executables.`)
    }
}