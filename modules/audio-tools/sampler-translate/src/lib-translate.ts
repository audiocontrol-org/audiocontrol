import path from "pathe"
import _ from "lodash"
import {parseFile} from "music-metadata"
import {midiNoteToNumber} from "@/lib-midi.js";
import {newDefaultSampleFactory, Sample} from "@/sample.js";
import {Result} from "@oletizi/sampler-lib";
import fs from "fs/promises";
import {ExecutionResult} from "@oletizi/sampler-devices";
// import {FfmpegCommand} from "fluent-ffmpeg";
import * as ffmpeg from "fluent-ffmpeg"

export function description() {
    return "lib-translate is a collection of functions to translate between sampler formats."
}

export interface fileio {
    readdir(source: string): Promise<string[]>
}

export interface AudioTranslate {
    translate(source: string, target: string): Promise<ExecutionResult>
}

export interface AbstractProgram {
    keygroups: AbstractKeygroup[]
}

export interface AbstractKeygroup {
    zones: AbstractZone[]
}

export interface AbstractZone {
    highVelocity: number
    lowVelocity: number
    audioSource: AudioSource
    lowNote: number
    centerNote: number
    highNote: number
}

export interface AudioMetadata {
    sampleRate?: number
    bitDepth?: number
    channelCount?: number
    sampleCount?: number
    container?: string
    codec?: string
}

export interface AudioSource {
    meta: AudioMetadata
    filepath: string

    getSample(): Promise<Sample>
}

export interface AudioFactory {
    loadFromFile(filename: string): Promise<AudioSource>
}


export type MapFunction = (s: AudioSource[]) => AbstractKeygroup[]

export interface TranslateContext {
    fs: fileio
    audioFactory: AudioFactory
    audioTranslate: AudioTranslate;
}

export function newDefaultAudioFactory(): AudioFactory {
    return {
        loadFromFile: async (filepath: string) => {
            const m = await parseFile(filepath)
            return {
                meta: {
                    sampleRate: m.format.sampleRate,
                    bitDepth: m.format.bitsPerSample,
                    channelCount: m.format.numberOfChannels,
                    sampleCount: m.format.numberOfSamples,
                    container: m.format.container,
                    codec: m.format.codec,
                },
                filepath: filepath,
                getSample(): Promise<Sample> {
                    return newDefaultSampleFactory().newSampleFromFile(filepath)
                }
            }
        }
    }
}

export function newDefaultTranslateContext(): TranslateContext {
    return {audioFactory: newDefaultAudioFactory(), fs: fs, audioTranslate: newDefaultAudioTranslate()}
}

export const mapLogicAutoSampler: MapFunction = (sources: AudioSource[]) => {
    const rv: AbstractKeygroup[] = []

    const note2Samples = new Map<number, AudioSource[]>()
    for (const s of sources) {
        const match = s.filepath.match(/-([A-G][#b]*[0-9])-/)
        if (match && match[1]) {
            const noteName = match[1]
            let noteNumber = midiNoteToNumber(noteName) + 12
            console.log(`noteName: ${noteName}; noteNumber: ${noteNumber}`);
            if (noteNumber != null) {
                if (note2Samples.get(noteNumber)) {
                    note2Samples.get(noteNumber)?.push(s)
                } else {
                    note2Samples.set(noteNumber, [s])
                }
            }
        }
    }
    let start = 0
    Array.from(note2Samples.keys()).sort((a, b) => {
        return a - b
    }).forEach(i => {
        const zones: AbstractZone[] = []
        _(note2Samples.get(i)).each(s => {
            // TODO: interrogate filename for velocity range
            zones.push({
                audioSource: s,
                highNote: i,
                centerNote: i,
                lowNote: start,
                lowVelocity: 0,
                highVelocity: 127
            })
        })
        rv.push({
            zones: zones
        })
        start = i + 1
    })

    return rv
}

export interface MapProgramResult extends Result {
    data: AbstractKeygroup[] | undefined
}

export async function mapProgram(ctx: TranslateContext, mapFunction: MapFunction, opts: {
    source: string,
    target: string
}): Promise<MapProgramResult> {
    const rv: MapProgramResult = {
        data: undefined,
        errors: [],
    }
    if (!ctx) {
        rv.errors.push(new Error(`Context is empty`))
    }
    if (ctx && !ctx.audioFactory) {
        console.log(`Audio factory: ${ctx.audioFactory}`)
        rv.errors.push(new Error(`AudioFactory is empty.`))
    }
    if (ctx && !ctx.fs) {
        rv.errors.push(new Error(`Translate context fs empty.`))
    }
    if (!mapFunction) {
        rv.errors.push(new Error(`Map function empty.`))
    }
    if (!opts) {
        rv.errors.push(new Error(`Options empty.`))
    }
    if (opts && !opts.source) {
        rv.errors.push(new Error(`Source is empty`))
    }
    if (opts && !opts.target) {
        rv.errors.push(new Error(`Target is empty`))
    }
    if (rv.errors.length > 0) {
        return rv
    }
    const sources: AudioSource[] = []
    const audioFactory = ctx.audioFactory
    const fs = ctx.fs
    for (const item of await fs.readdir(opts.source)) {
        const filepath = path.join(opts.source, item);
        try {
            const audio = await audioFactory.loadFromFile(filepath)
            const m = audio.meta
            sources.push({
                meta: m, filepath: filepath
            } as AudioSource)
        } catch (e) {
            // XXX: probably check to see what's wrong
        }
    }

    rv.data = mapFunction(sources)
    return rv
}

export function newDefaultAudioTranslate(): AudioTranslate {
    return new FfmpegTranslate()
}

class FfmpegTranslate implements AudioTranslate {

    translate(source: string, target: string): Promise<ExecutionResult> {
        return new Promise((resolve) => {
            const cmd = ffmpeg.default(source)
                .output(target)
                .on('end', () => {
                    resolve({code: 0, errors: []})
                })
                .on('error', (e, stdout, stderr) => {
                    console.log(stdout)
                    console.error(stderr)
                    resolve({code: -1, errors: [e]})
                })
            cmd.run()
        })
    }

}