import {WaveFile} from "wavefile";
import {WriteStream} from "fs";
import {types} from "sass";
import Number = types.Number;
import {start} from "repl";
import {Buffer} from "buffer/";
import e from "express";

export function newSampleFromBuffer(buf: Uint8Array): Sample {
    return new WavSample(buf)
}

// https://www.recordingblogs.com/wiki/sample-chunk-of-a-wave-file
//
//   dwManufacturer: 16777287,
//   dwProduct: 94,
//   dwSamplePeriod: 20833,
//   dwMIDIUnityNote: 60,
//   dwMIDIPitchFraction: 0,
//   dwSMPTEFormat: 0,
//   dwSMPTEOffset: 0,
//   dwNumSampleLoops: 0,
//   dwSamplerData: 18,
//   loops: []
export interface SampleMetadata {
    manufacturerId: number
    productId: number
    samplePeriod: number
    rootNote: number
    pitchFraction: number
    smpteFormat: number
    smpteOffset: number
    loopCount: number
    sampleLength: number
    channelCount: number
    bitDepth: number
    sampleRate: number
}


export interface Sample {

    getMetadata(): SampleMetadata

    getSampleCount(): number

    getChannelCount(): number

    getSampleRate(): number

    getBitDepth(): number

    setRootNote(r: number)

    trim(start, end): Sample

    to16Bit(): Sample

    to441(): Sample

    cleanup(): Sample

    write(buf: Buffer, offset: number)

    /**
     * Writes sample data to stream; returns the number of bytes written
     * @param stream
     */
    writeToStream(stream: WriteStream): Promise<number>

    getSampleData(): Float64Array;

    getRawData(): Uint8Array
}

class WavSample implements Sample {
    private readonly wav: WaveFile;
    private buf: Uint8Array;

    constructor(buf: Uint8Array) {
        this.buf = buf
        const wav = new WaveFile()
        wav.fromBuffer(buf)
        this.wav = wav
    }

    //   dwManufacturer: 16777287,
    //   dwProduct: 94,
    //   dwSamplePeriod: 20833,
    //   dwMIDIUnityNote: 60,
    //   dwMIDIPitchFraction: 0,
    //   dwSMPTEFormat: 0,
    //   dwSMPTEOffset: 0,
    //   dwNumSampleLoops: 0,
    //   dwSamplerData: 18,
    getMetadata(): SampleMetadata {
        const rv = {} as SampleMetadata
        const smpl = this.wav.smpl
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
        return this.wav.fmt["numChannels"]
    }

    getSampleCount(): number {
        // XXX: There's probably a more efficient way to do this
        const channelCount = this.getChannelCount() ? this.getChannelCount() : 1
        return this.wav.getSamples(true).length / channelCount
    }

    getSampleRate(): number {
        return this.wav.fmt.sampleRate
    }

    getBitDepth(): number {
        return parseInt(this.wav.bitDepth)
    }

    setRootNote(r: number) {
        this.wav.smpl['dwMIDIUnityNote'] = r
    }

    to16Bit(): Sample {
        this.wav.toBitDepth("16")
        return this
    }

    to441(): Sample {
        this.wav.toSampleRate(44100)
        return this
    }

    trim(start, end): Sample {
        const channelCount = this.wav.fmt["numChannels"]
        const trimmedSamples = this.wav.getSamples(true).slice(start * channelCount, end * channelCount)
        const trimmed = new WaveFile()
        trimmed.fromScratch(channelCount, this.wav.fmt.sampleRate, this.wav.bitDepth, trimmedSamples)
        return newSampleFromBuffer(trimmed.toBuffer())
    }

    write(buf: Buffer, offset: number) {
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

    cleanup(): Sample {
        this.wav.fact = {
            chunkId: "fact",
            chunkSize: 4,
            dwSampleLength: this.wav.data.chunkSize / this.wav.fmt["numChannels"]
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