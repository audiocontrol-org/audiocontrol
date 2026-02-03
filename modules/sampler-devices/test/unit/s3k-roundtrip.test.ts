import path from "pathe"
import { describe, it, expect } from 'vitest';
import {newAkaitools, newAkaiToolsConfig, RAW_LEADER, readAkaiData} from "@/index.js";
import {tmpdir} from "node:os"
import {parseSampleHeader, SampleHeader, SampleHeader_writeSPITCH} from "@/s3k.js";

describe(`Akai S3K Format Round-Trip`, () => {
    it.skip('Round trip read, write, read Akai format sample', async () => {
        const filepath = path.join('test', 'data', 's3000xl', 'chops', 'brk.10', 'brk.10.00_-l.a3s')
        const data = await readAkaiData(filepath)
        const sampleHeader = {} as SampleHeader
        parseSampleHeader(data, 0, sampleHeader)
        sampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)
        expect(sampleHeader.SPITCH).toBe(60)
        SampleHeader_writeSPITCH(sampleHeader, 12)

        const outfile = path.join(tmpdir(), 'out.a3s')
        const tools = newAkaitools(await newAkaiToolsConfig())
        await tools.writeAkaiSample(outfile, sampleHeader)

        // read the modified sample back in and make sure it's sane
        const lazarusData = await readAkaiData(outfile)
        const lazarusSampleHeader = {} as SampleHeader
        parseSampleHeader(lazarusData, 0, lazarusSampleHeader)
        lazarusSampleHeader.raw = new Array(RAW_LEADER).fill(0).concat(data)

        expect(lazarusSampleHeader.SPITCH).toBe(12)

    })
})
