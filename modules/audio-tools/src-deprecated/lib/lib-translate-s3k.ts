import {
    akaiFormat,
    akaiWrite,
    ExecutionResult, RAW_LEADER, readAkaiData,
    readAkaiProgram,
    wav2Akai, writeAkaiProgram
} from "@/akaitools/akaitools";
import fs from "fs/promises"
import {createWriteStream} from 'fs'
import {newSampleFromBuffer} from "@/model/sample";
import path from "path";
import {pad, Result} from "@/lib/lib-core";
import {newServerConfig} from "@/lib/config-server";
import {
    KeygroupHeader_writeCP1, KeygroupHeader_writeCP2,
    KeygroupHeader_writeHINOTE,
    KeygroupHeader_writeHIVEL2, KeygroupHeader_writeLONOTE,
    KeygroupHeader_writeSNAME1, KeygroupHeader_writeSNAME2,
    parseSampleHeader,
    ProgramHeader_writePRNAME,
    SampleHeader
} from "@/midi/devices/s3000xl";
import {AkaiToolsConfig} from "@/model/akai";
import {mapProgram, mapLogicAutoSampler, AbstractProgram} from "@oletizi/translate";

export interface AbstractProgramResult extends Result {
    data: AbstractProgram
}

export async function map(c: AkaiToolsConfig, opts: {
    source: string,
    target: string
}): Promise<AbstractProgramResult> {
    const program = mapProgram(mapLogicAutoSampler, opts)
    return {data: program, errors: []}
}

export interface ChopOpts {
    source: string;
    target: string;
    partition: number;
    prefix: string;
    samplesPerBeat: number;
    beatsPerChop: number;
    wipeDisk: boolean;
}

export async function chop(c: AkaiToolsConfig, opts: ChopOpts) {
    const cfg = await newServerConfig()
    const rv: ExecutionResult = {code: -1, errors: []}
    if (opts.samplesPerBeat <= 0 || opts.beatsPerChop <= 0) {
        throw new Error(`Bad params: samplesPerBeat: ${opts.samplesPerBeat}, beatsPerChop: ${opts.beatsPerChop}`)
    }
    if (!(await fs.stat(opts.source)).isFile()) {
        throw new Error(`Source is not a regular file: ${opts.source}`)
    }
    try {
        const stats = await fs.stat(opts.target)
        if (!stats.isDirectory()) {
            throw new Error(`Target is not a directory: ${opts.target}`)
        }
    } catch (e) {
        await fs.mkdir(opts.target)
    }

    const sample = newSampleFromBuffer(await fs.readFile(opts.source))
    if (sample.getMetadata().sampleRate > 44100) {
        sample.to441()
    }
    if (sample.getMetadata().bitDepth > 16) {
        sample.to16Bit()
    }
    const sampleCount = sample.getSampleCount()
    const chopLength = opts.samplesPerBeat * opts.beatsPerChop
    let count = 0
    for (let i = 0; i < sampleCount; i += chopLength) {
        const chop = sample.trim(i, i + chopLength)
        let targetName = opts.prefix + '.' + pad(count, 2)
        const outfile = path.join(opts.target, targetName) + '.wav'
        await chop.writeToStream(createWriteStream(outfile))
        const result = await wav2Akai(c, outfile, opts.target, targetName)
        if (result.errors.length) {
            rv.errors = rv.errors.concat(result.errors)
        }
        count++
    }
    if (rv.errors.length === 0) {
        if (opts.wipeDisk) {
            await akaiFormat(c, 10, 1)
        }
        const keygroupSpec: { sample1: string, sample2: string | null }[] = []
        for (const f of await fs.readdir(opts.target)) {
            if (f.endsWith('a3s')) {
                const result = await akaiWrite(c, path.join(opts.target, f), `/${opts.prefix}`, opts.partition)
                if (result.errors.length !== 0) {
                    rv.errors = rv.errors.concat(rv.errors, result.errors)
                    return rv
                }
                // const buf = await fs.readFile(path.join(target, f))
                const data = await readAkaiData(path.join(opts.target, f))
                const sampleHeader = {} as SampleHeader
                parseSampleHeader(data, 0, sampleHeader)
                sampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)

                console.log(`Checking sample name for stereo; ${sampleHeader.SHNAME}`)

                if (sampleHeader.SHNAME.endsWith('-R')) {
                    keygroupSpec[keygroupSpec.length - 1].sample2 = sampleHeader.SHNAME
                } else {
                    keygroupSpec.push({sample1: sampleHeader.SHNAME, sample2: null})
                }
                if (result.errors.length > 0) {
                    rv.errors = rv.errors.concat(result.errors)
                    return rv
                }

            }
        }
        const p = await readAkaiProgram(cfg.getS3kDefaultProgramPath(keygroupSpec.length))
        if (p.keygroups.length != keygroupSpec.length) {
            rv.errors.push(new Error(`Keygroup count does not match. Program keygroups: ${p.keygroups.length}; expected keygroups: ${keygroupSpec.length}`))
            return rv
        } else {
            ProgramHeader_writePRNAME(p.program, opts.prefix)

            for (let i = 0; i < p.keygroups.length; i++) {
                const kg = p.keygroups[i]
                const spec = keygroupSpec[i]
                KeygroupHeader_writeLONOTE(kg, 60 + i)
                KeygroupHeader_writeHINOTE(kg, 60 + i)

                KeygroupHeader_writeSNAME1(kg, spec.sample1)
                KeygroupHeader_writeCP1(kg, 1)
                if (spec.sample2) {
                    KeygroupHeader_writeSNAME2(kg, spec.sample2)
                    KeygroupHeader_writeHIVEL2(kg, 127)
                    KeygroupHeader_writeCP2(kg, 1)
                }
            }
            const programPath = path.join(opts.target, opts.prefix + '.a3p');
            await writeAkaiProgram(programPath, p)
            await akaiWrite(c, programPath, `/${opts.prefix}`, opts.partition)
        }
    }
    if (rv.errors.length === 0) {
        rv.code = 0
    }
    return rv
}