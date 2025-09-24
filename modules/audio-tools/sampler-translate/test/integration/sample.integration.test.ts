import {AudioFormat, newDefaultSampleSource, SampleSource} from "@/sample.js";
import {expect} from "chai";
import * as wavefile from "wavefile"
import {tmpdir} from "node:os";
import {createWriteStream} from "fs";
import fs from "fs/promises";
import path from "pathe";

describe('wavefile', () => {
    it(`Can read a wavefile`, async () => {
        const w = new wavefile.default.WaveFile()
        expect(w).not.eq(null)
    })
})

describe('sample', () => {
    const ss = newDefaultSampleSource()
    it('Parses a wave file', async () => {
        const ss = newDefaultSampleSource()
        // const s = newSampleFromBuffer(await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())
        expect(s).not.eq(null)
        expect(s.getSampleRate()).eq(44100)
        expect(s.getBitDepth()).eq(16)
        expect(s.getChannelCount()).eq(2)
        expect(s.getSampleCount()).eq(655726)
        expect(s.getMetadata()).to.be.an('object')
        const meta = s.getMetadata()
        expect(meta.bitDepth).eq(16)
        expect(meta.sampleRate).eq(44100)
        expect(meta.channelCount).eq(2)
        expect(meta.loopCount).eq(1)
        expect(meta.manufacturerId).eq(16777287)
        expect(meta.pitchFraction).eq(0)
        expect(meta.productId).eq(94)
        expect(meta.rootNote).eq(60)
        expect(meta.sampleLength).eq(655726)
        expect(meta.samplePeriod).eq(22675)
        expect(meta.smpteFormat).eq(25)
        expect(meta.smpteOffset).eq(0)
    })
    it(`Manipulates wave file`, async function () {
        this.timeout(10000)
        // const s = newSampleFromBuffer(await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())

        const currentRootNote = s.getMetadata().rootNote
        expect(currentRootNote).eq(60)

        s.setRootNote(currentRootNote + 1)
        expect(s.getMetadata().rootNote).eq(currentRootNote + 1)

        const s2 = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'decent', 'Samples', 'Oscar.wav'))//"test/data/decent/Samples/Oscar.wav")
        expect(s2.getBitDepth()).eq(24)
        expect(s2.getSampleRate()).eq(44100)

        s2.to16Bit()
        expect(s2.getBitDepth()).eq(16)

        s2.to24Bit()
        expect(s2.getBitDepth()).eq(24)

        s2.to48()
        expect(s2.getSampleRate()).eq(48000)

        s2.to441()
        expect(s2.getSampleRate()).eq(44100)

    })
    describe("newSampleSource", () => {
        let source: SampleSource;

        beforeEach(() => {
            source = newDefaultSampleSource();
        });

        it("Should create a valid SampleSource instance", () => {
            expect(source).to.have.property("newSampleFromBuffer").that.is.a("function");
            expect(source).to.have.property("newSampleFromUrl").that.is.a("function");
        });

        it("Should parse a WAV file buffer into a Sample (newSampleFromBuffer)", async () => {
            const testFile = "test/data/mpc/Dub Tao A Kit.WAV";
            const buffer = await fs.readFile(testFile);

            const sample = source.newSampleFromBuffer(buffer, AudioFormat.WAV);
            expect(sample).exist
            expect(sample.getSampleRate()).to.equal(44100);
            expect(sample.getChannelCount()).to.equal(2);
        });

        it("Should throw an error for unsupported audio formats in newSampleFromBuffer", () => {
            const buffer = new Uint8Array([0, 1, 2, 3]);
            expect(() => source.newSampleFromBuffer(buffer, "MP3" as AudioFormat)).to.throw("Unsupported format: MP3");
        });

        it("Should parse a WAV file from a URL (newSampleFromUrl)", async () => {
            const testFile = 'file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize()

            const sample = await source.newSampleFromUrl(testFile);
            expect(sample).exist
            expect(sample.getSampleRate()).to.equal(44100);
            expect(sample.getChannelCount()).to.equal(2);
        });

        it("Should handle errors in newSampleFromUrl for invalid paths", async () => {
            const invalidPath = "test/data/invalid.WAV";
            try {
                await source.newSampleFromUrl(invalidPath);
                expect.fail("Expected error for invalid file path");
            } catch (error: any) {
                // XXX: There must be a better way to check for errors.
                expect(error.message).to.include("Invalid URL");
            }
        });
    });
    it(`Trims a wave file`, async () => {
        const s = await ss.newSampleFromUrl('file://' + path.join(process.cwd(), 'test', 'data', 'mpc', 'Dub Tao A Kit.WAV').normalize())//await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV'))
        const initialSampleCount = s.getSampleCount()
        expect(initialSampleCount).eq(655726)
        expect(s.getSampleData().length).eq(initialSampleCount * 2)

        const trimmed = s.trim(0, 10)
        expect(trimmed.getSampleCount()).eq(10)
        expect(trimmed.getSampleData().length).eq(10 * 2)
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
        expect(re.getSampleCount()).eq(s.getSampleCount())
        expect(re.getSampleData().length).eq(s.getSampleData().length)
    })

    it(`Returns raw data`, async () => {
        const inbuf = await fs.readFile('test/data/mpc/Dub Tao A Kit.WAV');
        const s = ss.newSampleFromBuffer(inbuf, AudioFormat.WAV)
        const buf = s.getRawData()
        expect(buf).eq(inbuf)
    })
})