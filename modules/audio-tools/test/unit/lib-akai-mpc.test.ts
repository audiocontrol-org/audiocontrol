import fs from "fs/promises";

import {mpc} from "@/lib/lib-akai-mpc";
import {expect} from "chai";
import Layer = mpc.Layer;
import path from "path";

describe('MPC', async () => {
    it('Parses an MPC program', async () => {
        const buf = await fs.readFile('test/data/mpc/Oscar/Oscar.xpm')
        const program = mpc.newProgramFromBuffer(buf)
        expect(program).to.exist
        expect(program.programName).to.eq('Oscar')
        expect(program.layers).to.exist
        expect(program.layers.length).to.eq(16)
        const layer: Layer = program.layers[0]
        expect(layer.number).to.eq(1)
        expect(layer.sampleName).to.eq('Oscar')
        expect(layer.sliceStart).to.eq(0)
        expect(layer.sliceEnd).to.eq(133300)
    })

    it('Parses slice data from sample', async () => {
        const buf = await fs.readFile(path.join('test', 'data', 'mpc', 'Dub Tao A Kit.WAV'))
        const data = mpc.newSampleSliceDataFromBuffer(buf)
        expect(data).to.exist
        expect(data.slices).to.exist
        expect(data.slices.length).eq(16)

        const slice = data.slices[1]
        expect(slice).to.exist
        expect(slice.start).eq(30840)
        expect(slice.end).eq(61521)
    })

    // it('Gracefully handles samples without slice data', async () =>{
    //     const buf = await fs.readFile(path.join('test', 'data', 'mpc', 'Oscar', 'Oscar.WAV'))
    //     const data = mpc.newSampleSliceDataFromBuffer(buf)
    //     expect(data).to.exist
    // })
})