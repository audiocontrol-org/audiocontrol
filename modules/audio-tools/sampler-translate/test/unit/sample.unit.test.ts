import {stub} from 'sinon'
import {expect} from "chai"
import * as wavefile from 'wavefile'
import {WavSample} from "@/sample.js";

describe('sample', () => {

    it(`Creates a sample from buffer`, () => {
        const wav = new wavefile.default.WaveFile()
        const fromBufferStub = stub(wav, 'fromBuffer')
        const toBitDepthStub = stub(wav, 'toBitDepth')
        const toSampleRateStub = stub(wav, 'toSampleRate')
        const buffer: Uint8Array = new Uint8Array([1, 2, 3])
        const factory = stub().returns(wav)
        const sample = new WavSample(factory, buffer)

        expect(fromBufferStub.calledWith(buffer))

        expect(toBitDepthStub.calledWith("16")).eq(false)
        sample.to16Bit()
        expect(toBitDepthStub.calledWith("16")).eq(true)

        expect(toBitDepthStub.calledWith("24")).eq(false)
        sample.to24Bit()
        expect(toBitDepthStub.calledWith("24")).eq(true)

        expect(toSampleRateStub.calledWith(44100)).eq(false)
        sample.to441()
        expect(toSampleRateStub.calledWith(44100)).eq(true)

        expect(toSampleRateStub.calledWith(48000)).eq(false)
        sample.to48()
        expect(toSampleRateStub.calledWith(48000)).eq(true)

    })
})