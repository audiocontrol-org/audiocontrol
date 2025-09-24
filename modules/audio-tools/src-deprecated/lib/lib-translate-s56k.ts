import fs from "fs/promises";
import {createWriteStream, WriteStream} from "fs";
import path, * as Path from "path";
import {mpc} from "@/lib/lib-akai-mpc";
import {AkaiS56ProgramResult, Kloc, newProgramFromBuffer, Zone} from "@/lib/lib-akai-s56k";
import {decent} from '@/lib/lib-decent'
import {newSampleFromBuffer} from "@/model/sample"
import {nullProgress, Progress} from "@/lib/lib-jobs"
import {pad} from "@/lib/lib-core";
import {newServerOutput} from "@/lib/process-output";


const out = newServerOutput()


import Sample = decent.Sample;

function hasher(text: string, max: number) {
    let hash = 0
    for (let i = 0; i < text.length && i <= max; i++) {
        let char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash)
}

export async function decent2Sxk(infile, outdir, outstream = process.stdout, progress: Progress = nullProgress) {
    const rv = {data: [], errors: []} as AkaiS56ProgramResult
    const ddir = path.dirname(infile)
    const programBasename = Path.parse(infile).name
    const dprogram = await decent.newProgramFromBuffer(await fs.readFile(infile))

    let outbuf = Buffer.alloc(1024 * 1000) // XXX: This is a data corruption bug waiting to happen
    let fstream: WriteStream
    let sampleCount = 0
    dprogram.groups.forEach(g => sampleCount += g.samples.length)

    progress.incrementTotal(sampleCount + 1) // one progress increment for each sample to convert

    for (const group of dprogram.groups) {
        const sxkProgram = newProgramFromBuffer(await fs.readFile(path.join('data', 'DEFAULT.AKP')))
        const keyspans: { string: { sample: decent.Sample, basename: string } } = {}
        const hash = hasher(group.name + programBasename + group.name, 12)
        for (let i = 0; i < group.samples.length; i++) {
            const sample = group.samples[i]
            let keyspan
            if (!Number.isNaN(sample.loNote) && !Number.isNaN(sample.hiNote)) {
                keyspan = sample.loNote + '-' + sample.hiNote
            } else {
                keyspan = sample.rootNote
            }
            if (!keyspans[keyspan]) {
                keyspans[keyspan] = []
            }

            const samplePath = path.join(ddir, sample.path)
            let basename = hash + '-' + pad(i + 1, 3);
            const outname = basename + '.WAV'
            const outpath = path.join(outdir, outname);

            keyspans[keyspan].push({sample: sample, basename: basename})

            try {

                let wav = newSampleFromBuffer(await fs.readFile(samplePath))

                // Chop sample and write to disk
                if (!Number.isNaN(sample.start) && !Number.isNaN(sample.end)) {
                    wav = wav.trim(sample.start, sample.end)
                }

                // Set the root note in the smpl metadata of the wav file. S5000 uses it to calculate playback
                if (sample.rootNote) {
                    wav.setRootNote(sample.rootNote)
                }
                wav = wav.to16Bit()
                wav = wav.to441()
                wav.cleanup()


                outstream.write(`TRANSLATE: writing trimmed sample to: ${outpath}\n`)
                fstream = createWriteStream(outpath)
                const bytesWritten = await wav.writeToStream(fstream)
                outstream.write(`TRANSLATE: wrote ${bytesWritten} bytes to ${outpath}\n`)
            } catch (e) {
                rv.errors.push(e)
            } finally {
                progress.incrementCompleted(1)
                if (fstream) {
                    fstream.close((e => {
                        if (e) rv.errors.push(e)
                    }))
                }
            }
            // keygroups.push({
            //     kloc: {
            //         lowNote: sample.loNote,
            //         highNote: sample.hiNote,
            //     },
            //     zone1: {
            //         sampleName: basename
            //     }
            // })
        }
        const keygroups = []
        for (const keyspanName of Object.getOwnPropertyNames(keyspans)) {
            let sampleDescriptors = keyspans[keyspanName]

            const [low, high] = keyspanName.split('-').map(c => Number.parseInt(c))
            const keygroup = {
                kloc: {
                    lowNote: low,
                    highNote: high
                } as Kloc
            }
            // const max = Math.min(4, samples.length)
            sampleDescriptors = sampleDescriptors.sort((a, b) => {
                return a.sample.highVelocity - b.sample.highVelocity
            })
            const size = Math.min(sampleDescriptors.length, 4)

            for (let i = 0; i < size; i++) {
                const sampleDescriptor = sampleDescriptors[i]
                const sampleName = sampleDescriptor.basename
                const sample: Sample = sampleDescriptor.sample
                let highVelocity = 127
                let lowVelocity = 0
                if (i != 0 && !Number.isNaN(sample.hiVel)) {
                    // if this isn't the first (loudest) sample AND its high velocity is set, set high velocity to the
                    // sample high velocity
                    highVelocity = sample.hiVel
                }
                if (i != size - 1) {
                    // if this isn't tte last (quietest) sample AND its low velocity is set, set the low velocity to the
                    // sample low velocity
                    lowVelocity = sample.loVel
                }
                const zone = {} as Zone
                zone.sampleName = sampleName
                // NOTE: Don't we need this zone tuning now that the root note is set in the sample wav file metadata
                // zone.semiToneTune = C3 - sample.rootNote
                zone.highVelocity = highVelocity
                zone.lowVelocity = lowVelocity
                keygroup['zone' + (i + 1)] = zone
            }
            keygroups.push(keygroup)
        }
        const mods = {
            keygroupCount: Object.getOwnPropertyNames(keyspans).length,
            keygroups: keygroups
        }
        sxkProgram.apply(mods)
        const bufferSize = sxkProgram.writeToBuffer(outbuf, 0)
        let outfile = path.join(outdir, programBasename + '.' + group.name + '.AKP');
        outstream.write(`Writing program file: ${outfile}\n`)
        await fs.writeFile(outfile, Buffer.copyBytesFrom(outbuf, 0, bufferSize))
        progress.incrementCompleted(1)
        rv.data.push(newProgramFromBuffer(await fs.readFile(outfile)))
    }
    return rv
}

export async function mpc2Sxk(infile, outdir, outstream = process.stdout, progress: Progress = nullProgress) {
    progress.setCompleted(0)
    const mpcbuf = await fs.readFile(infile)
    const mpcdir = path.dirname(infile)
    const mpcProgram = mpc.newProgramFromBuffer(mpcbuf)

    const sxkbuf = await fs.readFile('data/DEFAULT.AKP')
    const sxkProgram = newProgramFromBuffer(sxkbuf)
    const snapshot = new Date().getMilliseconds()

    const mods = {
        keygroupCount: mpcProgram.layers.length,
        keygroups: []
    }
    const inbuf = Buffer.alloc(1024 * 10000)
    const outbuf = Buffer.alloc(inbuf.length)
    let sliceCounter = 1
    let midiNote = 60
    let detune = 0

    progress.incrementTotal(mpcProgram.layers.length + 1)

    // for (const layer of mpcProgram.layers) {
    for (let i = 0; i < mpcProgram.layers.length; i++) {
        const layer = mpcProgram.layers[i]
        // chop & copy sample
        const samplePath = path.join(mpcdir, layer.sampleName + '.WAV')
        const basename = layer.sampleName.substring(0, 8)
        const sliceName = `${basename}-${sliceCounter++}-${snapshot}`

        try {
            let buf = await fs.readFile(samplePath);
            let sliceStart = 0
            let sliceEnd = 0

            let sliceData;
            try {
                sliceData = mpc.newSampleSliceDataFromBuffer(buf)
            } catch (e) {
                out.error(e)
            }

            // Check the sample for embedded slice data
            out.log(`CHECKING SAMPLE FOR EMBEDDED SLICE DATA...`)
            if (sliceData && sliceData.slices.length >= i) {
                const slice = sliceData.slices[i]

                sliceStart = slice.start
                sliceEnd = slice.end
            } else {
                sliceStart = layer.sliceStart
                sliceEnd = layer.sliceEnd
            }

            const sample = newSampleFromBuffer(buf)
            let trimmed = sample.trim(sliceStart, sliceEnd)
            trimmed = trimmed.to16Bit()

            const bytesWritten = trimmed.write(outbuf, 0)
            let outpath = path.join(outdir, sliceName + '.WAV');
            outstream.write(`TRANSLATE: writing trimmed sample to: ${outpath}\n`)
            await fs.writeFile(outpath, Buffer.copyBytesFrom(outbuf, 0, bytesWritten))
        } catch (err) {
            // no joy
            out.error(err)
        } finally {
            progress.incrementCompleted(1)
        }

        mods.keygroups.push({
            kloc: {
                lowNote: midiNote,
                highNote: midiNote++,
                semiToneTune: detune--
            },
            zone1: {
                sampleName: sliceName
            }
        })
    }

    sxkProgram.apply(mods)
    const bufferSize = sxkProgram.writeToBuffer(outbuf, 0)
    let outfile = path.join(outdir, mpcProgram.programName + '.AKP');
    outstream.write(`Writing program file: ${outfile}\n`)
    await fs.writeFile(outfile, Buffer.copyBytesFrom(outbuf, 0, bufferSize))
    progress.incrementCompleted(1)

}