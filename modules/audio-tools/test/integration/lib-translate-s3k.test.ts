import {chop, map, ChopOpts} from "@/lib/lib-translate-s3k";
import path from "path";
import {akaiFormat, newAkaiToolsConfig} from "@/akaitools/akaitools";
import {expect} from "chai";
import fs from "fs/promises";
// import {AbstractProgram} from "@oletizi/translate"

describe('Integration tests for lib-translate-s3k', async () => {

    it(`Maps samples`, async function () {
        const c = await newAkaiToolsConfig()
        const source = path.join('test', 'data', 'auto', 'J8.01')
        const result = await map(c, {source: source, target: ""})
        expect(result.errors.length).eq(0)
        expect(result.data).exist
        const program = result.data
        expect(program.keygroups).exist


    })

    it(`Chops samples`, async function () {
        this.timeout(5000)
        const c = await newAkaiToolsConfig()
        const root = path.join('build', 'chop')
        try {
            await fs.rmdir(root)
        } catch (e) {
        }

        await fs.mkdir(root, {recursive: true})

        c.diskFile = path.join(root, `akai-${new Date().getTime()}.img`)
        await akaiFormat(c, 10)

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
        // const result = await chop(c, sourcepath, targetpath, prefix, samplesPerBeat, beatsPerChop)
        const result = await chop(c, opts)
        result.errors.forEach(e => console.error(e))
        expect(result.errors.length).eq(0)
    })
})