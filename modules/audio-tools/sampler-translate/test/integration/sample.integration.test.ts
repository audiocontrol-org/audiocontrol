import {AudioFormat, newDefaultSampleSource, SampleSource} from "@/sample.js";
import { describe, it, expect, beforeEach } from 'vitest';
import * as wavefile from "wavefile"
import {tmpdir} from "node:os";
import {createWriteStream} from "fs";
import fs from "fs/promises";
import path from "pathe";

describe('wavefile', () => {
    it(`Can read a wavefile`, async () => {
        const w = new wavefile.default.WaveFile()
        expect(w).not.toBe(null)
    })
})

describe('sample', () => {
    const ss = newDefaultSampleSource()
    it('Parses a wave file', async () => {
        const ss = newDefaultSampleSource()
        // const s = newSampleFromBuffer(await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())
        expect(s).not.toBe(null)
        expect(s.getSampleRate()).toBe(44100)
        expect(s.getBitDepth()).toBe(16)
        expect(s.getChannelCount()).toBe(2)
        expect(s.getSampleCount()).toBe(655726)
        expect(s.getMetadata()).toBeTypeOf('object')
        const meta = s.getMetadata()
        expect(meta.bitDepth).toBe(16)
        expect(meta.sampleRate).toBe(44100)
        expect(meta.channelCount).toBe(2)
        expect(meta.loopCount).toBe(1)
        expect(meta.manufacturerId).toBe(16777287)
        expect(meta.pitchFraction).toBe(0)
        expect(meta.productId).toBe(94)
        expect(meta.rootNote).toBe(60)
        expect(meta.sampleLength).toBe(655726)
        expect(meta.samplePeriod).toBe(22675)
        expect(meta.smpteFormat).toBe(25)
        expect(meta.smpteOffset).toBe(0)
    })
    it(`Manipulates wave file`, async () => {
        // const s = newSampleFromBuffer(await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())

        const currentRootNote = s.getMetadata().rootNote
        expect(currentRootNote).toBe(60)

        s.setRootNote(currentRootNote + 1)
        expect(s.getMetadata().rootNote).toBe(currentRootNote + 1)

        const s2 = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'decent', 'Samples', 'Oscar.wav'))//"test/data/decent/Samples/Oscar.wav")
        expect(s2.getBitDepth()).toBe(24)
        expect(s2.getSampleRate()).toBe(44100)

        s2.to16Bit()
        expect(s2.getBitDepth()).toBe(16)

        s2.to24Bit()
        expect(s2.getBitDepth()).toBe(24)

        s2.to48()
        expect(s2.getSampleRate()).toBe(48000)

        s2.to441()
        expect(s2.getSampleRate()).toBe(44100)

    }, { timeout: 10000 })
    describe("newSampleSource", () => {
        let source: SampleSource;

        beforeEach(() => {
            source = newDefaultSampleSource();
        });

        it("Should create a valid SampleSource instance", () => {
            expect(source).toHaveProperty("newSampleFromBuffer");
            expect(source.newSampleFromBuffer).toBeTypeOf("function");
            expect(source).toHaveProperty("newSampleFromUrl");
            expect(source.newSampleFromUrl).toBeTypeOf("function");
        });

        it("Should parse a WAV file buffer into a Sample (newSampleFromBuffer)", async () => {
            const testFile = "test/data/mpc/Dub Tao A Kit.WAV";
            const buffer = await fs.readFile(testFile);

            const sample = source.newSampleFromBuffer(buffer, AudioFormat.WAV);
            expect(sample).toBeDefined()
            expect(sample.getSampleRate()).toBe(44100);
            expect(sample.getChannelCount()).toBe(2);
        });

        it("Should throw an error for unsupported audio formats in newSampleFromBuffer", () => {
            const buffer = new Uint8Array([0, 1, 2, 3]);
            expect(() => source.newSampleFromBuffer(buffer, "MP3" as AudioFormat)).toThrow("Unsupported format: MP3");
        });

        it("Should parse a WAV file from a URL (newSampleFromUrl)", async () => {
            const testFile = 'file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize()

            const sample = await source.newSampleFromUrl(testFile);
            expect(sample).toBeDefined()
            expect(sample.getSampleRate()).toBe(44100);
            expect(sample.getChannelCount()).toBe(2);
        });

        it("Should handle errors in newSampleFromUrl for invalid paths", async () => {
            const invalidPath = "test/data/invalid.WAV";
            await expect(async () => {
                await source.newSampleFromUrl(invalidPath);
            }).rejects.toThrow("Invalid URL");
        });
    });
    it(`Trims a wave file`, async () => {
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())//await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const initialSampleCount = s.getSampleCount()
        expect(initialSampleCount).toBe(655726)
        expect(s.getSampleData().length).toBe(initialSampleCount * 2)

        const trimmed = s.trim(0, 10)
        expect(trimmed.getSampleCount()).toBe(10)
        expect(trimmed.getSampleData().length).toBe(10 * 2)
    })

    it(`Writes a wave file`, async () => {
        const tmp = tmpdir()
        const outfile = path.join(tmp, 'test.wav')

        const inbuf = await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV');
        const s = ss.newSampleFromBuffer(inbuf, AudioFormat.WAV)
        const buf = Buffer.of(s.getSampleData().length)

        s.write(buf)
        expect(inbuf.equals(buf))

        const outstream = createWriteStream(outfile)
        await s.writeToStream(outstream)

        const re = ss.newSampleFromBuffer(await fs.readFile(outfile), AudioFormat.WAV)
        expect(re.getSampleCount()).toBe(s.getSampleCount())
        expect(re.getSampleData().length).toBe(s.getSampleData().length)
    })

    it(`Returns raw data`, async () => {
        const inbuf = await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV');
        const s = ss.newSampleFromBuffer(inbuf, AudioFormat.WAV)
        const buf = s.getRawData()
        expect(buf).toBe(inbuf)
    })
})
