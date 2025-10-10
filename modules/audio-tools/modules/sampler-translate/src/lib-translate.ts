import path from "pathe"
import _ from "lodash"
import {parseFile} from "music-metadata"
import {midiNoteToNumber} from "@/lib-midi.js";
import {newDefaultSampleFactory, Sample} from "@/sample.js";
import {Result} from "@oletizi/sampler-lib";
import fs from "fs/promises";
// import {FfmpegCommand} from "fluent-ffmpeg";
import * as ffmpeg from "fluent-ffmpeg"

/**
 * Result of command execution with errors and status code
 * @public
 */
export interface ExecutionResult {
    /** Array of errors encountered during execution */
    errors: Error[];
    /** Exit code (0 = success, non-zero = failure) */
    code: number;
}

/**
 * Returns a description of the lib-translate module
 * @returns Description string of the library's purpose
 * @public
 */
export function description() {
    return "lib-translate is a collection of functions to translate between sampler formats."
}

/**
 * File I/O operations interface for dependency injection
 * @public
 */
export interface fileio {
    /**
     * Read directory contents
     * @param source - Directory path to read
     * @returns Promise resolving to array of filenames
     */
    readdir(source: string): Promise<string[]>
}

/**
 * Audio translation interface for format conversion
 * @public
 */
export interface AudioTranslate {
    /**
     * Translate audio from source to target format
     * @param source - Source file path
     * @param target - Target file path
     * @returns Promise resolving to execution result with errors
     */
    translate(source: string, target: string): Promise<ExecutionResult>
}

/**
 * Abstract representation of a sampler program
 * @public
 */
export interface AbstractProgram {
    /** Array of keygroups in the program */
    keygroups: AbstractKeygroup[]
}

/**
 * Abstract representation of a keygroup (collection of zones)
 * @public
 */
export interface AbstractKeygroup {
    /** Array of zones in the keygroup */
    zones: AbstractZone[]
}

/**
 * Abstract representation of a zone (sample mapping with velocity and note range)
 * @public
 */
export interface AbstractZone {
    /** Maximum velocity for this zone (0-127) */
    highVelocity: number
    /** Minimum velocity for this zone (0-127) */
    lowVelocity: number
    /** Audio source for this zone */
    audioSource: AudioSource
    /** Lowest MIDI note for this zone (0-127) */
    lowNote: number
    /** Center/root MIDI note for this zone (0-127) */
    centerNote: number
    /** Highest MIDI note for this zone (0-127) */
    highNote: number
}

/**
 * Audio file metadata information
 * @public
 */
export interface AudioMetadata {
    /** Sample rate in Hz (e.g., 44100, 48000) */
    sampleRate?: number
    /** Bit depth (e.g., 16, 24) */
    bitDepth?: number
    /** Number of audio channels (1 = mono, 2 = stereo) */
    channelCount?: number
    /** Total number of samples in the audio file */
    sampleCount?: number
    /** Container format (e.g., "WAV", "AIFF") */
    container?: string
    /** Audio codec (e.g., "PCM") */
    codec?: string
}

/**
 * Represents an audio source with metadata and sample access
 * @public
 */
export interface AudioSource {
    /** Audio file metadata */
    meta: AudioMetadata
    /** Path to the audio file */
    filepath: string

    /**
     * Get the audio sample data
     * @returns Promise resolving to Sample object
     */
    getSample(): Promise<Sample>
}

/**
 * Factory for creating AudioSource instances
 * @public
 */
export interface AudioFactory {
    /**
     * Load audio source from file
     * @param filename - Path to audio file
     * @returns Promise resolving to AudioSource
     * @throws Error if file cannot be loaded or parsed
     */
    loadFromFile(filename: string): Promise<AudioSource>
}


/**
 * Function type for mapping audio sources to keygroups
 * @public
 */
export type MapFunction = (s: AudioSource[]) => AbstractKeygroup[]

/**
 * Context for translation operations with injected dependencies
 * @public
 */
export interface TranslateContext {
    /** File system operations interface */
    fs: fileio
    /** Audio factory for loading audio files */
    audioFactory: AudioFactory
    /** Audio translator for format conversion */
    audioTranslate: AudioTranslate;
}

/**
 * Creates a default audio factory using music-metadata for parsing
 * @returns AudioFactory instance
 * @public
 * @example
 * ```typescript
 * const factory = newDefaultAudioFactory();
 * const audio = await factory.loadFromFile("/path/to/sample.wav");
 * console.log(audio.meta.sampleRate); // 44100
 * ```
 */
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

/**
 * Creates a default translate context with standard dependencies
 * @returns TranslateContext with default implementations
 * @public
 * @example
 * ```typescript
 * const context = newDefaultTranslateContext();
 * const result = await mapProgram(context, mapLogicAutoSampler, {
 *   source: "/path/to/samples",
 *   target: "/path/to/output"
 * });
 * ```
 */
export function newDefaultTranslateContext(): TranslateContext {
    return {audioFactory: newDefaultAudioFactory(), fs: fs, audioTranslate: newDefaultAudioTranslate()}
}

/**
 * Maps audio samples to keygroups based on Logic Auto Sampler naming convention.
 *
 * Parses filenames for MIDI note names in the format "-[Note]-" (e.g., "-C4-", "-F#3-")
 * and creates velocity-layered keygroups.
 *
 * @param sources - Array of audio sources to map
 * @returns Array of abstract keygroups with zones
 * @public
 *
 * @example
 * ```typescript
 * // Given files: "Piano-C4-v1.wav", "Piano-C4-v2.wav", "Piano-D4-v1.wav"
 * const sources = await loadAudioSources(directory);
 * const keygroups = mapLogicAutoSampler(sources);
 * // Creates 2 keygroups: one for C4, one for D4
 * ```
 *
 * @remarks
 * - Expects filename pattern containing "-[NoteName]-" (e.g., "-C4-", "-F#3-", "-Bb2-")
 * - Groups samples by MIDI note number
 * - Each keygroup spans from previous note + 1 to current note
 * - All zones default to full velocity range (0-127)
 * - Files without valid note names are ignored
 */
export const mapLogicAutoSampler: MapFunction = (sources: AudioSource[]) => {
    const rv: AbstractKeygroup[] = []

    const note2Samples = new Map<number, AudioSource[]>()
    for (const s of sources) {
        const match = s.filepath.match(/-([A-G][#b]*[0-9])-/)
        if (match && match[1]) {
            const noteName = match[1]
            let noteNumber = midiNoteToNumber(noteName)
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

/**
 * Result of mapping program operation
 * @public
 */
export interface MapProgramResult extends Result {
    /** Resulting keygroups, or undefined if errors occurred */
    data: AbstractKeygroup[] | undefined
}

/**
 * Maps a directory of audio files to abstract keygroups using a mapping function.
 *
 * Scans the source directory for audio files, loads their metadata, and applies
 * the provided mapping function to create an abstract program structure.
 *
 * @param ctx - Translation context with file system and audio factory
 * @param mapFunction - Function to map audio sources to keygroups
 * @param opts - Configuration options
 * @param opts.source - Source directory containing audio files
 * @param opts.target - Target directory for output (used by caller)
 * @returns Promise resolving to MapProgramResult with keygroups or errors
 * @public
 *
 * @example
 * ```typescript
 * const ctx = newDefaultTranslateContext();
 * const result = await mapProgram(ctx, mapLogicAutoSampler, {
 *   source: "/samples/piano",
 *   target: "/output/piano"
 * });
 *
 * if (result.errors.length === 0) {
 *   console.log(`Mapped ${result.data.length} keygroups`);
 * }
 * ```
 *
 * @throws Does not throw - errors are collected in result.errors array
 *
 * @remarks
 * - Validates all required parameters before processing
 * - Silently skips files that cannot be parsed as audio
 * - Errors are accumulated in the result.errors array
 * - Returns early if validation fails
 */
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

/**
 * Creates a default audio translator using FFmpeg
 * @returns AudioTranslate instance
 * @public
 * @example
 * ```typescript
 * const translator = newDefaultAudioTranslate();
 * const result = await translator.translate("input.aiff", "output.wav");
 * if (result.code === 0) {
 *   console.log("Translation successful");
 * }
 * ```
 */
export function newDefaultAudioTranslate(): AudioTranslate {
    return new FfmpegTranslate()
}

/**
 * FFmpeg-based audio translator implementation
 * @internal
 */
class FfmpegTranslate implements AudioTranslate {

    /**
     * Translates audio file from source to target format using FFmpeg
     * @param source - Source file path
     * @param target - Target file path
     * @returns Promise resolving to ExecutionResult
     */
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
