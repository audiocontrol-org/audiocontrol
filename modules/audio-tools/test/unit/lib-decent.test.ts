import {decent} from "@/lib/lib-decent";
import {expect} from "chai";
import fs from "fs/promises";
import path from "path";

describe('Decent Sampler parsing', async ()=> {
    it ('Parses a Decent Sampler preset', async () => {
        let presetFile = 'test/data/decent/Oscar.dspreset';
        const program = await decent.newProgramFromBuffer(await fs.readFile(presetFile))
        expect(program).to.exist
        expect(program.groups).to.exist
        expect(program.groups.length).to.eq(1)

        const group = program.groups[0]
        expect(group.samples.length).to.eq(16)

        const sample = group.samples[0]
        expect(sample.path).to.eq('Samples/Oscar.wav')
        expect(sample.attack).to.eq(0.001)
        expect(sample.attackCurve).to.eq(-25.000)
        expect(sample.decay).to.eq(0.002)
        expect(sample.decayCurve).to.eq(-25.000)
        expect(sample.end).to.eq(133300.000)
        expect(sample.hiNote).to.eq(36)
        expect(sample.hiVel).to.eq(127)
        expect(sample.loNote).to.eq(36)
        expect(sample.loVel).to.eq(0)
        expect(sample.pan).to.eq(0)
        expect(sample.pitchKeyTrack).to.eq(1.000)
        expect(sample.release).to.eq(0.001)
        expect(sample.releaseCurve).to.eq(-25.000)
        expect(sample.rootNote).to.eq(36)
        expect(sample.start).to.eq(0.000)
        expect(sample.sustain).to.eq(1.000)
        expect(sample.volume).to.eq('6.0dB')
    })

    it('Handles multiple groups', async () => {
        const filepath = path.join('test', 'data','decent', 'multizone.dspreset')
        const program = await decent.newProgramFromBuffer(await fs.readFile(filepath))
        expect(program).exist
        expect(program.groups.length).to.eq(2)
    })

})