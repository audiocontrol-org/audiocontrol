import wavefilePkg from "wavefile";
const { WaveFile } = wavefilePkg;
type WaveFile = InstanceType<typeof WaveFile>;
import { WriteStream } from "fs";

/**
 * Creates a Sample instance from a WAV file buffer.
 *
 * @param buf - Buffer containing WAV file data
 * @returns Sample interface for manipulating the audio data
 *
 * @example
 * ```typescript
 * const wavData = await fs.readFile('sample.wav');
 * const sample = newSampleFromBuffer(new Uint8Array(wavData));
 * console.log(sample.getSampleRate()); // 44100
 * ```
 */
export function newSampleFromBuffer(buf: Uint8Array): Sample {
    return new WavSample(buf)
}

/**
 * Complete metadata for an audio sample.
 *
 * @remarks
 * Based on the WAV file 'smpl' chunk specification.
 * See: https://www.recordingblogs.com/wiki/sample-chunk-of-a-wave-file
 */
export interface SampleMetadata {
    /** MIDI manufacturer ID */
    manufacturerId: number
    /** MIDI product ID */
    productId: number
    /** Sample period in nanoseconds */
    samplePeriod: number
    /** MIDI root note (0-127) */
    rootNote: number
    /** Pitch fraction for fine tuning */
    pitchFraction: number
    /** SMPTE format code */
    smpteFormat: number
    /** SMPTE offset */
    smpteOffset: number
    /** Number of loop points defined */
    loopCount: number
    /** Total number of sample frames */
    sampleLength: number
    /** Number of audio channels (1=mono, 2=stereo) */
    channelCount: number
    /** Bit depth (8, 16, 24, 32) */
    bitDepth: number
    /** Sample rate in Hz (e.g., 44100, 48000) */
    sampleRate: number
}

/**
 * Interface for audio sample manipulation and I/O.
 *
 * @remarks
 * Provides methods for reading metadata, converting formats,
 * trimming samples, and writing audio data.
 */
export interface Sample {
    /**
     * Retrieves complete sample metadata.
     *
     * @returns Sample metadata including format and MIDI information
     */
    getMetadata(): SampleMetadata

    /**
     * Gets the total number of sample frames.
     *
     * @returns Number of samples (per channel)
     */
    getSampleCount(): number

    /**
     * Gets the number of audio channels.
     *
     * @returns Channel count (1=mono, 2=stereo, etc.)
     */
    getChannelCount(): number

    /**
     * Gets the sample rate.
     *
     * @returns Sample rate in Hz
     */
    getSampleRate(): number

    /**
     * Gets the bit depth.
     *
     * @returns Bit depth (8, 16, 24, or 32)
     */
    getBitDepth(): number

    /**
     * Sets the MIDI root note for the sample.
     *
     * @param r - MIDI note number (0-127)
     */
    setRootNote(r: number): void

    /**
     * Trims the sample to a specific range.
     *
     * @param start - Start sample frame index
     * @param end - End sample frame index
     * @returns New trimmed Sample instance
     *
     * @example
     * ```typescript
     * // Trim to first second at 44.1kHz
     * const trimmed = sample.trim(0, 44100);
     * ```
     */
    trim(start: number, end: number): Sample

    /**
     * Converts the sample to 16-bit depth.
     *
     * @returns This Sample instance (for chaining)
     *
     * @remarks
     * Modifies the sample in-place. Use for reducing file size
     * or ensuring compatibility with 16-bit samplers.
     */
    to16Bit(): Sample

    /**
     * Converts the sample to 44.1kHz sample rate.
     *
     * @returns This Sample instance (for chaining)
     *
     * @remarks
     * Modifies the sample in-place. Performs resampling
     * with quality optimized for audio.
     */
    to441(): Sample

    /**
     * Cleans up WAV file metadata.
     *
     * @returns This Sample instance (for chaining)
     *
     * @remarks
     * Ensures the fact chunk is correctly formatted.
     * Call before writing to ensure valid WAV files.
     */
    cleanup(): Sample

    /**
     * Writes sample data to a buffer at a specific offset.
     *
     * @param buf - Target buffer
     * @param offset - Offset in bytes where data should be written
     * @returns Number of bytes written
     */
    write(buf: Buffer, offset: number): number

    /**
     * Writes sample data to a stream.
     *
     * @param stream - Writable stream to output WAV data
     * @returns Promise resolving to the number of bytes written
     *
     * @example
     * ```typescript
     * const stream = fs.createWriteStream('output.wav');
     * const bytesWritten = await sample.writeToStream(stream);
     * ```
     */
    writeToStream(stream: WriteStream): Promise<number>

    /**
     * Gets sample data as Float64 array.
     *
     * @returns Float64Array containing interleaved sample data
     *
     * @remarks
     * For stereo files, samples are interleaved: [L, R, L, R, ...]
     */
    getSampleData(): Float64Array;

    /**
     * Gets the raw WAV file data.
     *
     * @returns Uint8Array containing complete WAV file bytes
     */
    getRawData(): Uint8Array
}

/**
 * WaveFile-based implementation of the Sample interface.
 *
 * @internal
 */
class WavSample implements Sample {
    private readonly wav: WaveFile;
    private buf: Uint8Array;

    constructor(buf: Uint8Array) {
        this.buf = buf
        const wav = new WaveFile()
        wav.fromBuffer(buf)
        this.wav = wav
    }

    getMetadata(): SampleMetadata {
        const rv = {} as SampleMetadata
        const smpl = this.wav.smpl as any
        if (smpl) {
            rv.manufacturerId = smpl['dwManufacturer']
            rv.productId = smpl['dwProduct']
            rv.samplePeriod = smpl['dwSamplePeriod']
            rv.rootNote = smpl['dwMIDIUnityNote']
            rv.pitchFraction = smpl['dwMIDIPitchFraction']
            rv.smpteFormat = smpl['dwSMPTEFormat']
            rv.smpteOffset = smpl['dwSMPTEOffset']
            rv.loopCount = smpl['dwNumSampleLoops']
        }
        rv.sampleLength = this.getSampleCount()
        rv.sampleRate = this.getSampleRate()
        rv.channelCount = this.getChannelCount()
        rv.bitDepth = this.getBitDepth()
        return rv
    }

    getChannelCount(): number {
        return (this.wav.fmt as any)["numChannels"]
    }

    getSampleCount(): number {
        // XXX: There's probably a more efficient way to do this
        const channelCount = this.getChannelCount() ? this.getChannelCount() : 1
        return this.wav.getSamples(true).length / channelCount
    }

    getSampleRate(): number {
        return (this.wav.fmt as any).sampleRate
    }

    getBitDepth(): number {
        return parseInt(this.wav.bitDepth)
    }

    setRootNote(r: number): void {
        (this.wav.smpl as any)['dwMIDIUnityNote'] = r
    }

    to16Bit(): Sample {
        this.wav.toBitDepth("16")
        return this
    }

    to441(): Sample {
        this.wav.toSampleRate(44100)
        return this
    }

    trim(start: number, end: number): Sample {
        const channelCount = (this.wav.fmt as any)["numChannels"]
        const trimmedSamples = this.wav.getSamples(true).slice(start * channelCount, end * channelCount)
        const trimmed = new WaveFile()
        trimmed.fromScratch(channelCount, (this.wav.fmt as any).sampleRate, this.wav.bitDepth, trimmedSamples)
        return newSampleFromBuffer(trimmed.toBuffer())
    }

    write(buf: Buffer, offset: number): number {
        const wavData = this.wav.toBuffer()
        const wavBuffer = Buffer.isBuffer(wavData) ? wavData : Buffer.from(wavData)
        return buf.set(wavBuffer, offset), wavBuffer.length
    }

    writeToStream(stream: WriteStream): Promise<number> {
        return new Promise((resolve, reject) => {
            stream.on('error', (e => reject(e)))
            const buf = this.wav.toBuffer()
            stream.write(buf)
            stream.end(() => resolve(buf.length))
        })
    }

    cleanup(): Sample {
        this.wav.fact = {
            chunkId: "fact",
            chunkSize: 4,
            dwSampleLength: (this.wav.data as any).chunkSize / (this.wav.fmt as any)["numChannels"]
        } as any
        return this
    }

    getSampleData(): Float64Array {
        return this.wav.getSamples(true)
    }

    getRawData(): Uint8Array {
        return this.buf
    }
}
