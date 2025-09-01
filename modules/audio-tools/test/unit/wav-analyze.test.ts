import * as wavefile from "wavefile";
import fs from "fs/promises";
import path from "path";

describe('Wav file analysis tests', async () => {
    it(`Looks at wave files`, async () => {
        const wavOk = new wavefile.WaveFile()
        const wavBroken = new wavefile.WaveFile()
        wavOk.fromBuffer(await fs.readFile(path.join('test', 'data', 'Sx000', 'WV', 'WV.WAV')))
        wavBroken.fromBuffer(await fs.readFile(path.join('test', 'data', 'Sx000', 'broken', '1799099196-1.WAV')))
        // console.log(`OK:\n${JSON.stringify(wavOk, null, 2)}`)
        console.log("== OK ==========")
        console.log(wavInfo(wavOk))
        console.log("== BROKEN ======")
        console.log(wavInfo(wavBroken))

        wavBroken.fact = {
            chunkId: "fact",
            chunkSize: 4,
            dwSampleLength: wavBroken.data.chunkSize / wavBroken.fmt.numChannels
        }
        await fs.writeFile(path.join('build', 'fixed.WAV'), wavBroken.toBuffer())
    })
})

function wavInfo(wav: wavefile.WaveFile) {
    let rv = ''
    rv += `container: ${wav.container}\n`
    rv += `chunkSize: ${wav.chunkSize}\n`
    rv += `format   : ${wav.format}\n`
    rv += `bit depth: ${wav.bitDepth}\n`
    rv += `fmt      : ${JSON.stringify(wav.fmt)}\n`
    rv += `fact     : ${JSON.stringify(wav.fact)}\n`
    rv += `cue      : ${JSON.stringify(wav.cue)}\n`
    rv += `smpl     : ${JSON.stringify(wav.smpl)}\n`
    rv += `bext     : ${JSON.stringify(wav.bext)}\n`
    rv += `iXML     : ${JSON.stringify(wav.iXML)}\n`
    rv += `ds64     : ${JSON.stringify(wav.ds64)}\n`
    rv += `data     : chunk size: ${wav.data.chunkSize}\n`
    return rv
}