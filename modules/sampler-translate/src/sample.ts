import {WriteStream} from "fs";
import * as wavefile from "wavefile"
import fs from "fs/promises";

/**
 * Supported audio formats
 * @public
 */
export enum AudioFormat {
    /** WAV audio format */
    wav = "wav",
}


/**
 * Sample metadata from WAV file's smpl chunk
 * @public
 * @see https://www.recordingblogs.com/wiki/sample-chunk-of-a-wave-file
 */
export interface SampleMetadata {
    /** MIDI Manufacturers Association (MMA) manufacturer code */
    manufacturerId: number
    /** Product ID (manufacturer-specific) */
    productId: number
    /** Sample period in nanoseconds (1/sample rate * 1e9) */
    samplePeriod: number
    /** MIDI root note (0-127) */
    rootNote: number
    /** Fine pitch adjustment (0-2^32, where 2^32 = 1 semitone) */
    pitchFraction: number
    /** SMPTE format code */
    smpteFormat: number
    /** SMPTE offset in hours, minutes, seconds, frames */
    smpteOffset: number
    /** Number of sample loops */
    loopCount: number
    /** Total number of samples */
    sampleLength: number
    /** Number of audio channels */
    channelCount: number
    /** Bit depth (e.g., 16, 24) */
    bitDepth: number
    /** Sample rate in Hz */
    sampleRate: number
}


/**
 * Represents an audio sample with operations for manipulation and conversion
 * @public
 */
export interface Sample {

    /**
     * Get sample metadata from WAV smpl chunk
     * @returns SampleMetadata object with all metadata fields
     */
    getMetadata(): SampleMetadata

    /**
     * Get total number of samples (frames)
     * @returns Number of samples
     */
    getSampleCount(): number

    /**
     * Get number of audio channels
     * @returns Channel count (1 = mono, 2 = stereo)
     */
    getChannelCount(): number

    /**
     * Get sample rate
     * @returns Sample rate in Hz
     */
    getSampleRate(): number

    /**
     * Get bit depth
     * @returns Bit depth (e.g., 16, 24)
     */
    getBitDepth(): number

    /**
     * Set the MIDI root note in sample metadata
     * @param r - MIDI note number (0-127)
     */
    setRootNote(r: number): void

    /**
     * Trim sample to specified range
     * @param start - Start sample index (inclusive)
     * @param end - End sample index (exclusive)
     * @returns New Sample instance with trimmed audio
     */
    trim(start: number, end: number): Sample

    /**
     * Convert sample to 16-bit depth
     * @returns This Sample instance (mutates in place)
     */
    to16Bit(): Sample

    /**
     * Convert sample to 24-bit depth
     * @returns This Sample instance (mutates in place)
     */
    to24Bit(): Sample

    /**
     * Convert sample to 44.1 kHz sample rate
     * @returns This Sample instance (mutates in place)
     */
    to441(): Sample

    /**
     * Convert sample to 48 kHz sample rate
     * @returns This Sample instance (mutates in place)
     */
    to48(): Sample

    /**
     * Write sample data to buffer
     * @param buf - Target buffer
     * @param offset - Offset in buffer to start writing (default: 0)
     * @returns Number of bytes written
     */
    write(buf: Buffer, offset?: number): number

    /**
     * Write sample data to stream
     * @param stream - Writable stream to write to
     * @returns Promise resolving to number of bytes written
     * @throws Error if stream encounters an error
     */
    writeToStream(stream: WriteStream): Promise<number>

    /**
     * Get sample data as Float64 array
     * @returns Float64Array containing interleaved sample data
     */
    getSampleData(): Float64Array;

    /**
     * Get raw binary data
     * @returns Uint8Array containing raw WAV file bytes
     */
    getRawData(): Uint8Array

}

/**
 * Factory for creating Sample instances from files or buffers
 * @public
 */
export interface SampleFactory {
    /**
     * Create Sample from audio file
     * @param filename - Path to audio file
     * @returns Promise resolving to Sample instance
     * @throws Error if file cannot be read or parsed
     */
    newSampleFromFile(filename: string): Promise<Sample>

    /**
     * Create Sample from buffer
     * @param buf - Audio data buffer
     * @param format - Audio format (currently only supports WAV)
     * @returns Sample instance
     * @throws Error if buffer cannot be parsed
     */
    newSampleFromBuffer(buf: Uint8Array, format: AudioFormat): Sample
}

/**
 * Creates a default sample factory that supports WAV format
 * @returns SampleFactory instance
 * @public
 * @example
 * ```typescript
 * const factory = newDefaultSampleFactory();
 * const sample = await factory.newSampleFromFile("piano-C4.wav");
 * console.log(sample.getSampleRate()); // 44100
 * ```
 */
export function newDefaultSampleFactory(): SampleFactory {
    function wavFactory(buf: Uint8Array) {
        const wav = new wavefile.default.WaveFile()
        wav.fromBuffer(buf)
        return wav
    }

    function fromBuffer(buf: Uint8Array, format: AudioFormat): Sample {
        return new WavSample(wavFactory, buf)
    }

    async function fromFile(filename: string): Promise<Sample> {
        return fromBuffer(await fs.readFile(filename), AudioFormat.wav)
    }

    return {
        newSampleFromBuffer: fromBuffer,
        newSampleFromFile: fromFile
    }
}

/**
 * WAV file sample implementation using wavefile library
 * @internal
 */
export class WavSample implements Sample {
    private readonly wav: wavefile.WaveFile
    private readonly buf: Uint8Array;
    private readonly factory: (buf: Uint8Array) => wavefile.WaveFile;

    /**
     * Create WavSample instance
     * @param factory - Factory function to create WaveFile from buffer
     * @param buf - WAV file data buffer
     * @internal
     */
    constructor(factory: (buf: Uint8Array) => wavefile.WaveFile, buf: Uint8Array) {
        this.wav = factory(buf)
        this.buf = buf
        this.factory = factory
    }

    getMetadata(): SampleMetadata {
        const rv = {} as SampleMetadata
        const smpl = this.wav.smpl
        if (smpl) {
            // @ts-ignore
            rv.manufacturerId = smpl['dwManufacturer']
            // @ts-ignore
            rv.productId = smpl['dwProduct']
            // @ts-ignore
            rv.samplePeriod = smpl['dwSamplePeriod']
            // @ts-ignore
            rv.rootNote = smpl['dwMIDIUnityNote']
            // @ts-ignore
            rv.pitchFraction = smpl['dwMIDIPitchFraction']
            // @ts-ignore
            rv.smpteFormat = smpl['dwSMPTEFormat']
            // @ts-ignore
            rv.smpteOffset = smpl['dwSMPTEOffset']
            // @ts-ignore
            rv.loopCount = smpl['dwNumSampleLoops']
        }
        rv.sampleLength = this.getSampleCount()
        rv.sampleRate = this.getSampleRate()
        rv.channelCount = this.getChannelCount()
        rv.bitDepth = this.getBitDepth()
        return rv
    }

    getChannelCount(): number {
        // @ts-ignore
        return this.wav.fmt["numChannels"]
    }

    getSampleCount(): number {
        // XXX: There's probably a more efficient way to do this
        const channelCount = this.getChannelCount() ? this.getChannelCount() : 1
        return this.wav.getSamples(true).length / channelCount
    }

    getSampleRate(): number {
        // @ts-ignore
        return this.wav.fmt.sampleRate
    }

    getBitDepth(): number {
        return parseInt(this.wav.bitDepth)
    }

    setRootNote(r: number) {
        // @ts-ignore
        this.wav.smpl['dwMIDIUnityNote'] = r
    }

    to16Bit(): Sample {
        this.wav.toBitDepth("16")
        return this
    }

    to24Bit(): Sample {
        this.wav.toBitDepth("24")
        return this
    }

    to441(): Sample {
        this.wav.toSampleRate(44100)
        this.cleanup()
        return this
    }

    to48(): Sample {
        this.wav.toSampleRate(48000)
        this.cleanup()
        return this
    }

    trim(start: number, end: number): Sample {
        // @ts-ignore
        const channelCount = this.wav.fmt["numChannels"]
        const trimmedSamples = this.wav.getSamples(true).slice(start * channelCount, end * channelCount)
        const trimmed = new wavefile.default.WaveFile()
        // @ts-ignore
        trimmed.fromScratch(channelCount, this.wav.fmt.sampleRate, this.wav.bitDepth, trimmedSamples)
        return new WavSample(this.factory, trimmed.toBuffer())
    }

    write(buf: Buffer, offset: number = 0) {
        const wavBuffer = Buffer.from(this.wav.toBuffer())
        wavBuffer.copy(buf, offset, 0, wavBuffer.length)
        return wavBuffer.length
    }

    writeToStream(stream: WriteStream): Promise<number> {
        return new Promise((resolve, reject) => {
            stream.on('error', (e => reject(e)))
            const buf = this.wav.toBuffer()
            stream.write(buf)
            stream.end(() => resolve(buf.length))
        })
    }

    /**
     * Clean up WAV file metadata after sample rate conversion
     * @internal
     */
    private cleanup(): Sample {
        // @ts-ignore
        const sampleLength = this.wav.data.chunkSize / this.wav.fmt["numChannels"];
        this.wav.fact = {
            chunkId: "fact",
            chunkSize: 4,
            dwSampleLength: sampleLength
        }
        return this
    }

    getSampleData(): Float64Array {
        return this.wav.getSamples(true)
    }

    getRawData(): Uint8Array {
        return this.buf
    }
}
