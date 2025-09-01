// import {translate} from '@/lib/lib-translate-s56k'
import {Keygroup, newProgramFromBuffer} from "@/lib/lib-akai-s56k"
import fs from "fs/promises"
import {expect} from "chai"
import path from "path"
import {decent2Sxk, mpc2Sxk} from "../../src-deprecated/lib/lib-translate-s56k";

describe(`Translate`, async () => {
    let cleanup = false
    it('Converts MPC drum program to Akai Sx000 program.', async function () {
        this.timeout(10000)
        const infile = 'test/data/mpc/Oscar/Oscar.xpm'
        const outdir = 'build'
        await mpc2Sxk(infile, outdir)
        const buf = await fs.readFile('build/Oscar.AKP')
        const program = newProgramFromBuffer(buf)
        let midiNote = 60
        let detune = 0
        expect(program.getKeygroupCount()).to.eq(16)
        for (const keygroup of program.getKeygroups()) {
            expect(keygroup.zone1.sampleName).to.exist
            expect(keygroup.kloc.lowNote).to.eq(midiNote)
            expect(keygroup.kloc.highNote).to.eq(midiNote)
            expect(keygroup.kloc.semiToneTune).to.eq(detune)
            const cleanupPath = `build/${keygroup.zone1.sampleName}.WAV`
            console.log(`low note: ${keygroup.kloc.lowNote}`)
            console.log(`hi note : ${keygroup.kloc.highNote}`)
            console.log(`detune  : ${keygroup.kloc.semiToneTune}`)
            console.log(`Cleanup: ${cleanupPath}`)
            if (cleanup) {
                await fs.rm(cleanupPath)
            }
            midiNote++
            detune--
        }
    })
    it('Checks itself', async () => {
        const buf = await fs.readFile('test/data/Sx000/Oscar/Oscar-unmuted.AKP')
        const program = newProgramFromBuffer(buf)
    })
    it('Converts decent sampler program to Akai Sx000 program', async function () {
        this.timeout(10000)
        const infile = path.join('test', 'data', 'decent', 'Oscar.dspreset')
        const outdir = path.join('build')
        const outfile = path.join(outdir, 'Oscar.AKP')
        // const program = decent.newProgramFromBuffer(await fs.readFile(infile))
        await decent2Sxk(infile, outdir)

        const program = newProgramFromBuffer(await fs.readFile(outfile))
        expect(program).to.exist
    })

    it('Handles decent sampler programs with velocity zones', async () => {
        const infile = path.join('test', 'data', 'decent', 'multizone.dspreset')
        const outdir = 'build'
        const outfile = path.join(outdir, 'multizone.AKP')
        let result = await decent2Sxk(infile, outdir);
        expect(result.errors.length).eq(90) // one error for each missing sample file
        expect(result.data.length).eq(2)
        const program = result.data[0]
        expect(program).to.exist
        const keygroups = program.getKeygroups()
        expect(keygroups.length).eq(9)
        const keygroup: Keygroup = keygroups[0]
        expect(keygroup).to.exist

        const zone1 = keygroup.zone1
        expect(zone1).to.exist
        expect(zone1.highVelocity).to.eq(127)
        console.log(`zone1 sample name: ${zone1.sampleName}`)
        console.log(`zone1 low velocity: ${zone1.lowVelocity}`)
        console.log(`zone1 high velocity: ${zone1.highVelocity}`)

        const zone2 = keygroup.zone2
        console.log(`zone sample name: <${zone2.sampleName}>`)
        const zone4 = keygroup.zone4
        expect(zone4).to.exist
        expect(zone4.lowVelocity).to.eq(0)
    })
})