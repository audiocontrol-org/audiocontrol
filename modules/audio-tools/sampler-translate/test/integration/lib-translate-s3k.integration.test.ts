import {newAkaitools, newAkaiToolsConfig} from "@oletizi/sampler-devices/s3k";
import path from "pathe";
import {chop, ChopOpts, map, newDefaultTranslateContext} from "@/lib-translate-s3k.js";
import {expect} from "chai";
import fs from "fs/promises";
import {mapLogicAutoSampler} from "@/lib-translate.js";
import {tmpdir} from "node:os";
import {newServerConfig} from "@oletizi/sampler-lib";

describe(`lib-translate-s3k integration test`, () => {
    it(`maps samples`, async function () {
        this.timeout(10 * 1000)
        const prefix = 'MOOGC'
        const cfg = await newServerConfig()
        const source = path.join(cfg.sourceRoot, 'auto', prefix)
        const target = path.join(tmpdir(), `map-${new Date().getTime()}`)
        await fs.mkdir(target)
        const result = await map(
            await newDefaultTranslateContext(),
            mapLogicAutoSampler,
            {source: source, target: target, prefix: prefix, partition: 0, wipeDisk: true})

        console.log(result.errors)
        expect(result.errors.length).eq(0)
        expect(result.data).exist
        const program = result.data
        expect(program?.length).gte(1)
    })

    it(`chops samples`, async function () {
        const c = await newAkaiToolsConfig()
        const root = path.join('build', 'chop')
        try {
            await fs.rmdir(root)
        } catch (e) {
        }

        await fs.mkdir(root, {recursive: true})
        c.diskFile = path.join(root, `akai-${new Date().getTime()}.img`)
        const sourcepath = path.join('test', 'data', 's3000xl', 'chops', 'loop96.wav')
        const targetpath = path.join('build', 'chop')
        const prefix = 'loop96'
        const samplesPerBeat = 27563
        const beatsPerChop = 4
        const opts: ChopOpts = {
            partition: 0,
            source: sourcepath,
            target: targetpath,
            prefix: prefix,
            samplesPerBeat: samplesPerBeat,
            beatsPerChop: beatsPerChop,
            wipeDisk: true
        }
        const result = await chop(await newServerConfig(), newAkaitools(c), opts)
        result.errors.forEach(e => console.error(e))
        expect(result.errors.length).eq(0)
    })
})

