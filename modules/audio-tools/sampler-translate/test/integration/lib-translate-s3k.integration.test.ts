import {newAkaitools, newAkaiToolsConfig} from "@oletizi/sampler-devices/s3k";
import path from "pathe";
import {chop, ChopOpts, map, newDefaultTranslateContext} from "@/lib-translate-s3k.js";
import { describe, it, expect } from 'vitest';
import fs from "fs/promises";
import {mapLogicAutoSampler} from "@/lib-translate.js";
import {tmpdir} from "node:os";
import {newServerConfig} from "@oletizi/sampler-lib";

describe(`lib-translate-s3k integration test`, () => {
    it(`maps samples`, async () => {
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
        expect(result.errors.length).toBe(0)
        expect(result.data).toBeDefined()
        const program = result.data
        expect(program?.length).toBeGreaterThanOrEqual(1)
    }, { timeout: 10000 })

    it(`chops samples`, async () => {
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
        expect(result.errors.length).toBe(0)
    }, { timeout: 10000 })
})
