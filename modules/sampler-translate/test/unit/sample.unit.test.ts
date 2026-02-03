import { describe, it, expect, vi } from 'vitest'
import * as wavefile from 'wavefile'
import {WavSample} from "@/sample.js";

describe('sample', () => {

    it(`Creates a sample from buffer`, () => {
        const wav = new wavefile.default.WaveFile()
        const fromBufferStub = vi.spyOn(wav, 'fromBuffer').mockImplementation(() => {})
        const toBitDepthStub = vi.spyOn(wav, 'toBitDepth').mockImplementation(() => {})
        const toSampleRateStub = vi.spyOn(wav, 'toSampleRate').mockImplementation(() => {})
        const buffer: Uint8Array = new Uint8Array([1, 2, 3])
        const factory = vi.fn((buf: Uint8Array) => {
            wav.fromBuffer(buf)
            return wav
        })
        const sample = new WavSample(factory, buffer)

        expect(fromBufferStub).toHaveBeenCalledWith(buffer)

        expect(toBitDepthStub).not.toHaveBeenCalledWith("16")
        sample.to16Bit()
        expect(toBitDepthStub).toHaveBeenCalledWith("16")

        expect(toBitDepthStub).not.toHaveBeenCalledWith("24")
        sample.to24Bit()
        expect(toBitDepthStub).toHaveBeenCalledWith("24")

        expect(toSampleRateStub).not.toHaveBeenCalledWith(44100)
        sample.to441()
        expect(toSampleRateStub).toHaveBeenCalledWith(44100)

        expect(toSampleRateStub).not.toHaveBeenCalledWith(48000)
        sample.to48()
        expect(toSampleRateStub).toHaveBeenCalledWith(48000)

    })
})
