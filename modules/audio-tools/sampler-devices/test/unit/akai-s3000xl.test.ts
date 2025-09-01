import midi from "midi"
import path from "pathe"
import {newServerOutput} from "@oletizi/sampler-lib";
import {expect} from "chai";
import {newDevice} from "@/client/client-akai-s3000xl.js";
import {newAkaitools, newAkaiToolsConfig, RAW_LEADER, readAkaiData} from "@/client/akaitools.js";
import {tmpdir} from "node:os"
import {parseSampleHeader, SampleHeader, SampleHeader_writeSPITCH} from "@/devices/s3000xl.js";

describe(`Basic Akai S3000xl tests`, () => {
    it('Compiles', () => {
        const device = newDevice(new midi.Input(), new midi.Output(), newServerOutput())
        expect(device).exist
    })

    it('Round trip read, write, read Akai format sample', async () => {
        const filepath = path.join('test', 'data', 's3000xl', 'chops', 'brk.10', 'brk.10.00_-l.a3s')
        const data = await readAkaiData(filepath)
        const sampleHeader = {} as SampleHeader
        parseSampleHeader(data, 0, sampleHeader)
        sampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)
        expect(sampleHeader.SPITCH).eq(60)
        SampleHeader_writeSPITCH(sampleHeader, 12)

        const outfile = path.join(tmpdir(), 'out.a3s')
        const tools = newAkaitools(await newAkaiToolsConfig())
        await tools.writeAkaiSample(outfile, sampleHeader)

        // read the modified sample back in and make sure it's sane
        const lazarusData = await readAkaiData(outfile)
        const lazarusSampleHeader = {} as SampleHeader
        parseSampleHeader(lazarusData, 0, lazarusSampleHeader)
        lazarusSampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)

        expect(lazarusSampleHeader.SPITCH).eq(12)

    })
})