import fs from "fs/promises";
import {newSampleFromBuffer} from "@/model/sample"
import * as riffFile from 'riff-file'
import path from "path";
import {expect} from "chai";
import * as wavefile from "wavefile";


describe('Sample', async () => {
    it('Trims a sample via sample interface', async () => {
        let bytesWritten = 0
        const out = Buffer.alloc(1024 * 1000)
        const samplePath = 'test/data/mpc/Oscar/Oscar.WAV'
        const sample = newSampleFromBuffer(await fs.readFile(samplePath))
        bytesWritten = sample.write(out, 0)
        await fs.writeFile('build/untrimmed-sample.WAV', out.subarray(0, bytesWritten))

        const trimmed = sample.trim(0, 44100)
        bytesWritten = trimmed.write(out, 0)
        await fs.writeFile('build/trimmed-sample.WAV', out.subarray(0, bytesWritten))
    })
    it('Parses embedded data', async () => {
        const buf = await fs.readFile(path.join('test', 'data', 'mpc', 'Dub Tao A Kit.WAV'))
        const riff = new riffFile.RIFFFile()
        riff.setSignature(buf)
        const c = riff.findChunk('atem')
        // const decoder = new TextDecoder('utf-8')
        const cData = buf.subarray(c["chunkData"].start, c["chunkData"].end)
        console.log(cData.toString())

        interface MpcSampleData {
            version: number,
            value0: {
                defaultSlice: {
                    Start: number
                    End: number
                },
                numBars: number,
                "Num slices": number,
            }
            value1: {
                version: number,
                note: string,
                scale: string

            }
        }
        const chunk = JSON.parse(cData.toString()) as MpcSampleData
        expect(chunk).to.exist
        expect(chunk.value0).to.exist

        expect(chunk.value1).to.exist
        expect(chunk.value1.version).eq(1)
    })

    it('Looks inside a wav file', async () =>  {
        let buf = await fs.readFile(path.join('test', 'data', 'sx000', 'NEW SAMPLE  1.WAV'));
        const wav = new wavefile.WaveFile()
        wav.fromBuffer(buf)
        const smpl = wav.smpl
        const sample = newSampleFromBuffer(buf)
        const meta = sample.getMetadata()
        expect(meta).to.exist
        expect(meta.manufacturerId).eq(16777287)
        expect(meta.productId).eq(94)
        expect(meta.samplePeriod).eq(20833)
        expect(meta.rootNote).eq(60)
        expect(meta.pitchFraction).eq(0)

        const newRootNote = 75

        sample.setRootNote(newRootNote)

        let outbuf = Buffer.alloc(buf.length)
        sample.write(outbuf, 0)

        const savedSample = newSampleFromBuffer(outbuf)
        expect(savedSample.getMetadata().rootNote).eq(newRootNote)
    })
})