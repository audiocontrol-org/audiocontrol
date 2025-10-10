import path from "pathe";
import fsp from "fs/promises"
import fs from 'fs'
import _ from 'lodash'
import {newServerConfig, ServerConfig} from '@oletizi/sampler-lib'
import {
    Akaitools,
    KeygroupHeader,
    KeygroupHeader_writeCP1,
    KeygroupHeader_writeCP2,
    KeygroupHeader_writeHINOTE,
    KeygroupHeader_writeHIVEL1,
    KeygroupHeader_writeHIVEL2,
    KeygroupHeader_writeLONOTE,
    KeygroupHeader_writeLOVEL1,
    KeygroupHeader_writeSNAME1,
    KeygroupHeader_writeSNAME2,
    newAkaitools,
    newAkaiToolsConfig,
    parseSampleHeader,
    ProgramHeader_writePRNAME,
    RAW_LEADER,
    readAkaiData,
    SampleHeader,
    SampleHeader_writeSPITCH
} from "@oletizi/sampler-devices/s3k"

import {
    MapFunction,
    mapProgram,
    newDefaultAudioFactory,
    newDefaultAudioTranslate,
    TranslateContext
} from "@/lib-translate.js";
import {ExecutionResult} from "@oletizi/sampler-devices";
import {newDefaultSampleFactory, SampleFactory} from "@/sample.js";
import {tmpdir} from "node:os";


export interface S3kTranslateContext extends TranslateContext {
    akaiTools: Akaitools

    // XXX: this doesn't really belong here
    getS3kDefaultProgramPath(keygroupCount: number): Promise<string>
}

export interface ProgramOpts {
    source: string;
    target: string;
    partition: number;
    prefix: string;
    wipeDisk: boolean;
}

export interface ChopOpts extends ProgramOpts {
    samplesPerBeat: number;
    beatsPerChop: number;
}

export async function newDefaultTranslateContext() {
    const rv: S3kTranslateContext = {
        akaiTools: newAkaitools(await newAkaiToolsConfig()),
        fs: fsp,
        audioFactory: newDefaultAudioFactory(),
        audioTranslate: newDefaultAudioTranslate(),
        getS3kDefaultProgramPath: async function (keygroupCount: number): Promise<string> {
            return (await newServerConfig()).getS3kDefaultProgramPath(keygroupCount)
        }
    }
    return rv
}

export async function map(ctx: S3kTranslateContext, mapFunction: MapFunction, opts: ProgramOpts) {
    const rv = await mapProgram(ctx, mapFunction, opts)
    if (rv.errors.length > 0 || !rv.data) {
        return rv
    }

    const keygroups = rv.data
    const tools = ctx.akaiTools
    const audioTranslate = ctx.audioTranslate
    const audioFactory = ctx.audioFactory
    let count = 0

    if (opts.wipeDisk) {
        tools.akaiFormat(60, 1)
    }

    type KeygroupSpec = {
        sample1: string,
        sample2: string | null,
        lowNote: number,
        centerNote: number,
        highNote: number,
        lowVelocity: number,
        highVelocity: number
    }
    const specs: KeygroupSpec[] = []

    function akaiSampleNames(prefix: string, sampleNumber: number, stereo: boolean, padChar: string) {
        const rv: string[] = []
        const root = _.padEnd(prefix + _.padStart(String(sampleNumber), 2, '0'), 10, padChar).toLowerCase()
        rv.push(stereo ? root + '-l' : _.padEnd(root, 12, padChar));
        rv.push(stereo ? root + '-r' : "");
        return rv
    }

    for (const keygroup of keygroups) {
        for (const zone of keygroup.zones) {
            const sourcePath = zone.audioSource.filepath
            const targetPath = opts.target
            const {meta} = await audioFactory.loadFromFile(sourcePath)
            const stereo = meta.channelCount === 2
            const {name} = path.parse(sourcePath)
            const prefix = _.truncate(opts.prefix, {length: 6, omission: ''})
            const sampleNumber = count++
            const [sample1, sample2] = akaiSampleNames(prefix + String(zone.centerNote), sampleNumber, stereo, '_')
            console.log(`Sample1: ${sample1}; sample2: ${sample2}`);
            const spec: KeygroupSpec = {
                sample1: sample1,
                sample2: sample2,
                lowNote: zone.lowNote,
                centerNote: zone.centerNote,
                highNote: zone.highNote,
                lowVelocity: zone.lowVelocity,
                highVelocity: zone.highVelocity
            }
            specs.push(spec)
            const intermediatePath = path.join(tmpdir(), name + '.wav')
            console.log(`Converting aiff to intermediate: ${intermediatePath}`)
            const tr = await audioTranslate.translate(sourcePath, intermediatePath)
            if (tr.errors.length > 0) {
                rv.errors = tr.errors.concat(tr.errors)
                return rv
            }

            // XXX: this is super gross. There should be one place where the naming patterns are defined.
            // const targetName = prefix.toLowerCase() + _.padStart(String(sampleNumber), 2, '0')
            const targetName = prefix + String(zone.centerNote) + _.padStart(String(sampleNumber), 2, '0')
            console.log(`Converting intermediate: ${intermediatePath} to: ${targetPath}/${targetName}`)
            const r = await tools.wav2Akai(intermediatePath, targetPath, targetName)
            if (r.errors.length > 0) {
                rv.errors = rv.errors.concat(r.errors)
                return rv
            }
        }
    }

    function writeSample(sampleName: string) {
        return tools.akaiWrite(path.join(opts.target, sampleName + '.a3s'), `/${opts.prefix}`, opts.partition)
    }

    const p = await tools.readAkaiProgram(await ctx.getS3kDefaultProgramPath(specs.length))
    const program = p.program
    ProgramHeader_writePRNAME(program, opts.prefix)


    for (let i = 0; i < specs.length; i++) {
        const spec = specs[i]
        const keygroup: KeygroupHeader = p.keygroups[i]

        for (const sampleName of [spec.sample1, spec.sample2]) {
            console.log(`Writing sample ${sampleName}`)
            if (sampleName) {
                // XXX: Wrap up in akaitools
                const sampleFilepath = path.join(opts.target, sampleName + '.a3s');
                const data = await readAkaiData(sampleFilepath)
                const sampleHeader = {} as SampleHeader
                parseSampleHeader(data, 0, sampleHeader)
                sampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)
                // TODO: swith to using the AkaiS3kSample class
                SampleHeader_writeSPITCH(sampleHeader, spec.centerNote)
                tools.writeAkaiSample(sampleFilepath, sampleHeader)
                console.log(`Writing keygroup sample: ${sampleHeader.SHNAME}`)
                if (sampleHeader.SHNAME.endsWith('-R')) {
                    KeygroupHeader_writeSNAME2(keygroup, sampleHeader.SHNAME)
                    KeygroupHeader_writeLOVEL1(keygroup, spec.lowVelocity)
                    KeygroupHeader_writeHIVEL2(keygroup, spec.highVelocity)
                } else {
                    KeygroupHeader_writeSNAME1(keygroup, sampleHeader.SHNAME)
                }
                KeygroupHeader_writeLONOTE(keygroup, spec.lowNote)
                KeygroupHeader_writeHINOTE(keygroup, spec.highNote)
                KeygroupHeader_writeLOVEL1(keygroup, spec.lowVelocity)
                KeygroupHeader_writeHIVEL1(keygroup, spec.highVelocity)

                const result = await writeSample(sampleName)
                rv.errors = rv.errors.concat(result.errors)
            }
        }
        if (rv.errors.length > 0) {
            return rv
        }
    }
    const programPath = path.join(opts.target, opts.prefix + '.a3p');
    await tools.writeAkaiProgram(programPath, p)
    await tools.akaiWrite(programPath, `/${opts.prefix}`, opts.partition)
    return rv
}


// XXX: Rename
// XXX: This is super messy and should be refactored.
export async function chop(cfg: ServerConfig, tools: Akaitools, opts: ChopOpts, sampleFactory: SampleFactory = newDefaultSampleFactory()) {
    const rv: ExecutionResult = {code: -1, errors: []}
    if (opts.samplesPerBeat <= 0 || opts.beatsPerChop <= 0) {
        rv.errors.push(new Error(`Bad params: samplesPerBeat: ${opts.samplesPerBeat}, beatsPerChop: ${opts.beatsPerChop}`))
        return rv
    }
    if (!(await fsp.stat(opts.source)).isFile()) {
        rv.errors.push(new Error(`Source is not a regular file: ${opts.source}`))
        return rv
    }
    try {
        const stats = await fsp.stat(opts.target)
        if (!stats.isDirectory()) {
            rv.errors.push(new Error(`Target is not a directory: ${opts.target}`))
            return rv
        }
    } catch (e) {
        await fsp.mkdir(opts.target)
    }

    const sample = await sampleFactory.newSampleFromFile(opts.source)

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
        let targetName = opts.prefix + '.' + _.pad(String(count), 2, ' ')
        const outfile = path.join(opts.target, targetName) + '.wav'
        await chop.writeToStream(fs.createWriteStream(outfile))
        const result = await tools.wav2Akai(outfile, opts.target, targetName)
        if (result.errors.length) {
            rv.errors = rv.errors.concat(result.errors)
        }
        count++
    }
    if (rv.errors.length === 0) {
        if (opts.wipeDisk) {
            await tools.akaiFormat(10, 1)
        }
        const keygroupSpec: { sample1: string, sample2: string | null }[] = []
        for (const f of await fsp.readdir(opts.target)) {
            if (f.endsWith('a3s')) {
                const result = await tools.akaiWrite(path.join(opts.target, f), `/${opts.prefix}`, opts.partition)
                if (result.errors.length !== 0) {
                    rv.errors = rv.errors.concat(rv.errors, result.errors)
                    break
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
                    break
                }

            }
        }
        if (rv.errors.length > 0) {
            return rv
        }
        const p = await tools.readAkaiProgram(cfg.getS3kDefaultProgramPath(keygroupSpec.length))
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
            await tools.writeAkaiProgram(programPath, p)
            await tools.akaiWrite(programPath, `/${opts.prefix}`, opts.partition)
        }
    }
    if (rv.errors.length === 0) {
        rv.code = 0
    }
    return rv
}
