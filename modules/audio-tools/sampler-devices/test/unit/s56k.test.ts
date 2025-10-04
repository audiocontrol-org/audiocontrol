import {assert, expect} from 'chai'
import fs from "fs/promises";
import {
    bytes2Number,
    Keygroup,
    Lfo1,
    Lfo2,
    Mods,
    newHeaderChunk,
    newKeygroupChunk,
    newLfo1Chunk,
    newLfo2Chunk,
    newModsChunk,
    newOutputChunk,
    newProgramChunk,
    newProgramFromBuffer,
    newProgramFromJson,
    newTuneChunk,
    Output,
    OutputChunk,
    parseChunkHeader,
    ProgramChunk,
    Tune,
    Zone
} from "@/devices/s56k.js";
import path from "path";

async function loadTestFile() {
    const testFile = path.join('test', 'data', 'Sx000', 'BASS.AKP')
    return await fs.readFile(testFile);
}

async function ensureBuildDir() {
    const buildDir = path.join('build')
    try {
        await fs.mkdir(buildDir, { recursive: true })
    } catch (err) {
        // ignore if already exists
    }
}

describe('Basics...', async () => {
    it('Does the basics...', () => {
        assert.equal(0, 0)
    })
    it('Converts bytes to number...', () => {
        const bytes = [0x6, 0, 0, 0]
        assert.equal(bytes2Number(bytes), 6)
    })

    it('Parses a chunk header...', () => {
        const buf = Buffer.from([
            0x6f, 0x75, 0x74, 0x20, // 'out '
            0x08, 0x00, 0x00, 0x00   //  8
        ])
        const chunk = newOutputChunk()
        const bytesRead = parseChunkHeader(buf, chunk, 0)
        expect(bytesRead).to.eq(8)
        expect(chunk.name).to.eq('out ')
        expect(chunk.lengthInBytes).to.eq(8)
    })

    it('Parses a program file', async () => {
        const buf = await loadTestFile();
        let offset = 0

        // Parse header
        const header = newHeaderChunk()
        offset += header.parse(buf, offset)
        expect(offset).to.be.greaterThan(0)

        // Parse program chunk
        const program: ProgramChunk = newProgramChunk()
        offset += program.parse(buf, offset)
        expect(program.programNumber).to.equal(0)
        expect(program.keygroupCount).to.equal(1)

        const output: OutputChunk = newOutputChunk()
        offset += output.parse(buf, offset)
        expect(output.loudness).to.equal(80)
        expect(output.ampMod1).to.equal(0)
        expect(output.ampMod2).to.equal(0)
        expect(output.panMod1).to.equal(0)
        expect(output.panMod2).to.equal(0)
        expect(output.panMod3).to.equal(0)
        expect(output.velocitySensitivity).to.equal(0)

        const tune = newTuneChunk()
        offset += tune.parse(buf, offset)
        expect(tune.semiToneTune).to.equal(0)
        expect(tune.fineTune).to.equal(0)
        expect(tune.detuneA).to.equal(0)
        expect(tune.detuneBFlat).to.equal(0)
        expect(tune.detuneB).to.equal(0)
        expect(tune.detuneC).to.equal(0)
        expect(tune.detuneCSharp).to.equal(0)
        expect(tune.detuneD).to.equal(0)
        expect(tune.detuneEFlat).to.equal(0)
        expect(tune.detuneE).to.equal(0)
        expect(tune.detuneF).to.equal(0)
        expect(tune.detuneFSharp).to.equal(0)
        expect(tune.detuneG).to.equal(0)
        expect(tune.pitchBendUp).to.equal(2)
        expect(tune.pitchBendDown).to.equal(2)
        expect(tune.bendMode).to.equal(0)
        expect(tune.aftertouch).to.equal(0)

        const lfo1 = newLfo1Chunk()
        offset += lfo1.parse(buf, offset)
        expect(lfo1.name).to.eq('lfo ')
        expect(lfo1.waveform).to.eq(1)
        expect(lfo1.rate).to.eq(43)
        expect(lfo1.delay).to.eq(0)
        expect(lfo1.depth).to.eq(0)
        expect(lfo1.sync).to.eq(0)
        expect(lfo1.modwheel).to.eq(15)
        expect(lfo1.aftertouch).to.eq(0)
        expect(lfo1.rateMod).to.eq(0)
        expect(lfo1.delayMod).to.eq(0)
        expect(lfo1.depthMod).to.eq(0)

        const lfo2 = newLfo2Chunk()
        offset += lfo2.parse(buf, offset)
        expect(lfo2.name).to.eq('lfo ')
        expect(lfo2.waveform).to.eq(0)
        expect(lfo2.rate).to.eq(0)
        expect(lfo2.delay).to.eq(0)
        expect(lfo2.depth).to.eq(0)
        expect(lfo2.retrigger).to.eq(0)
        expect(lfo2.rateMod).to.eq(0)
        expect(lfo2.depthMod).to.eq(0)

        const mods = newModsChunk()
        offset += mods.parse(buf, offset)
        expect(mods.name).to.eq('mods')
        expect(mods.ampMod1Source).to.eq(6)
        expect(mods.ampMod2Source).to.eq(3)
        expect(mods.panMod1Source).to.eq(8)
        expect(mods.panMod2Source).to.eq(6)
        expect(mods.panMod3Source).to.eq(1)
        expect(mods.lfo1RateModSource).to.eq(6)
        expect(mods.lfo1DelayModSource).to.eq(6)
        expect(mods.lfo1DepthModSource).to.eq(6)
        expect(mods.lfo2RateModSource).to.eq(0)
        expect(mods.lfo2DelayModSource).to.eq(0)
        expect(mods.lfo2DepthModSource).to.eq(0)
        expect(mods.pitchMod1Source).to.eq(7)
        expect(mods.pitchMod2Source).to.eq(11)
        expect(mods.ampModSource).to.eq(5)
        expect(mods.filterModInput1).to.eq(5)
        expect(mods.filterModInput2).to.eq(8)
        expect(mods.filterModInput3).to.eq(9)

        const keygroup = newKeygroupChunk()
        offset += keygroup.parse(buf, offset)
        expect(keygroup.name).to.eq('kgrp')
        expect(keygroup.kloc).to.exist

        const kloc = keygroup.kloc
        // expect(kloc.name).to.eq('kloc')
        expect(kloc.lowNote).to.eq(21)
        expect(kloc.highNote).to.eq(127)
        expect(kloc.semiToneTune).to.eq(0)
        expect(kloc.fineTune).to.eq(0)
        expect(kloc.overrideFx).to.eq(0)
        expect(kloc.pitchMod1).to.eq(100)
        expect(kloc.pitchMod2).to.eq(0)
        expect(kloc.ampMod).to.eq(0)
        expect(kloc.zoneXFade).to.eq(0)
        expect(kloc.muteGroup).to.eq(0)

        expect(keygroup.ampEnvelope).to.exist
        const ampenv = keygroup.ampEnvelope
        // expect(ampenv.name).to.eq('env ')
        expect(ampenv.attack).to.eq(1)
        expect(ampenv.decay).to.eq(50)
        expect(ampenv.sustain).to.eq(100)
        expect(ampenv.velocity2Attack).to.eq(0)
        expect(ampenv.onVelocity2Release).to.eq(0)
        expect(ampenv.offVelocity2Release).to.eq(0)

        expect(keygroup.filterEnvelope).to.exist
        const filtenv = keygroup.filterEnvelope
        // expect(filtenv.name).to.eq('env ')
        expect(filtenv.attack).to.eq(3)
        expect(filtenv.decay).to.eq(74)
        expect(filtenv.sustain).to.eq(68)
        expect(filtenv.release).to.eq(0)
        expect(filtenv.depth).to.eq(7)
        expect(filtenv.velocity2Attack).to.eq(0)
        expect(filtenv.keyscale).to.eq(0)
        expect(filtenv.onVelocity2Release).to.eq(0)
        expect(filtenv.offVelocity2Release).to.eq(0)

        expect(keygroup.auxEnvelope).to.exist
        const auxenv = keygroup.auxEnvelope
        // expect(auxenv.name).to.eq('env ')
        expect(auxenv.rate1).to.eq(0)
        expect(auxenv.rate2).to.eq(50)
        expect(auxenv.rate3).to.eq(50)
        expect(auxenv.rate4).to.eq(15)
        expect(auxenv.level1).to.eq(100)
        expect(auxenv.level2).to.eq(100)
        expect(auxenv.level3).to.eq(100)
        expect(auxenv.level4).to.eq(0)
        expect(auxenv.velocity2Rate1).to.eq(0)
        expect(auxenv.keyboard2Rate2and4).to.eq(0)
        expect(auxenv.velocity2Rate4).to.eq(0)
        expect(auxenv.offVelocity2Rate4).to.eq(0)
        expect(auxenv.velocity2OutLevel).to.eq(0)

        expect(keygroup.filter).to.exist
        const filt = keygroup.filter
        // expect(filt.name).to.eq('filt')
        expect(filt.mode).to.eq(0)
        expect(filt.cutoff).to.eq(53)
        expect(filt.resonance).to.eq(7)
        expect(filt.keyboardTrack).to.eq(6)
        expect(filt.modInput1).to.eq(0)
        expect(filt.modInput2).to.eq(0)
        expect(filt.modInput3).to.eq(0)
        expect(filt.headroom).to.eq(0)

        expect(keygroup.zone1).to.exist
        const zone1 = keygroup.zone1
        // expect(zone1.name).to.eq('zone')
        expect(zone1.lowVelocity).to.eq(0)
        expect(zone1.highVelocity).to.eq(127)
        expect(zone1.fineTune).to.eq(0)
        expect(zone1.filter).to.eq(0)
        expect(zone1.panBalance).to.eq(0)
        expect(zone1.playback).to.eq(6)
        expect(zone1.output).to.eq(0)
        expect(zone1.level).to.eq(-20)
        expect(zone1.keyboardTrack).to.eq(1)
        expect(zone1.velocity2StartLsb).to.eq(0)
        expect(zone1.velocity2StartMsb).to.eq(0)

        expect(keygroup.zone2).to.exist
        const zone2 = keygroup.zone2
        // expect(zone2.name).to.eq('zone')
        expect(zone2.fineTune).to.eq(-10)
        expect(zone2.level).to.eq(-20)


        expect(keygroup.zone3).to.exist
        const zone3 = keygroup.zone3
        // expect(zone3.name).to.eq('zone')

        expect(keygroup.zone4).to.exist
        const zone4 = keygroup.zone4
        // expect(zone4.name).to.eq('zone')
    })

    it('Writes a program file', async () => {
        let inset = 0
        let outset = 0
        let checkpoint = 0
        const buf = await loadTestFile();
        const out = Buffer.alloc(buf.length, 0)

        const header = newHeaderChunk()
        const checkHeader = newHeaderChunk()
        inset += header.parse(buf, inset)
        outset += header.write(out, outset)
        checkpoint += checkHeader.parse(out, checkpoint)
        expect(checkHeader.name).to.eq(header.name)
        expect(checkHeader.lengthInBytes).to.eq(header.lengthInBytes)

        const program = newProgramChunk()
        const checkProgram = newProgramChunk()

        inset += program.parse(buf, inset)
        outset += program.write(out, outset)

        checkpoint += checkProgram.parse(out, checkpoint)

        expect(checkProgram.name).to.eq(program.name)
        expect(checkProgram.lengthInBytes).to.eq(program.lengthInBytes)
        expect(checkProgram.programNumber).to.eq(program.programNumber)
        expect(checkProgram.keygroupCount).to.eq(program.keygroupCount)
    })
})

describe('BinaryProgram', async () => {
    it('Parses a program file...', async () => {
        let offset = 0
        const buf = await loadTestFile();
        const program = newProgramFromBuffer(buf)//new Program()

        expect(program.getProgramNumber()).to.eq(0)
        expect(program.getKeygroupCount()).to.eq(1)

        const output: Output = program.getOutput()
        expect(output.loudness).to.eq(80)

        const tune: Tune = program.getTune()
        expect(tune.pitchBendUp).to.eq(2)
        expect(tune.pitchBendDown).to.eq(2)

        const lfo1: Lfo1 = program.getLfo1()
        expect(lfo1.rate).to.eq(43)

        const lfo2: Lfo2 = program.getLfo2()
        expect(lfo2.rate).to.eq(0)

        const mods: Mods = program.getMods()
        expect(mods.panMod1Source).to.equal(8)

        const keygroups: Keygroup[] = program.getKeygroups()
        expect(keygroups.length).to.eq(program.getKeygroupCount())
        const kgrp = keygroups[0]
        expect(kgrp.kloc).to.exist


        expect(kgrp.ampEnvelope).to.exist
        expect(kgrp.filterEnvelope).to.exist
        expect(kgrp.auxEnvelope).to.exist
        expect(kgrp.filter).to.exist
        expect(kgrp.zone1).to.exist
        expect(kgrp.zone1.sampleName).to.eq('WV 2')
        expect(kgrp.zone2).to.exist
        expect(kgrp.zone3).to.exist
        expect(kgrp.zone4).to.exist

        const kloc = kgrp.kloc
        expect(kloc.ampMod).to.eq(0)
    })
    it('Writes a Program to a byte buffer', async () => {
        const buf = await loadTestFile();
        const out = Buffer.alloc(buf.length)
        const program = newProgramFromBuffer(buf)
        program.writeToBuffer(out, 0)

        const checkProgram = newProgramFromBuffer(out)
        const modProgram = newProgramFromBuffer(out)

        await ensureBuildDir()
        await fs.writeFile(path.join('build', 'TEST.AKP'), buf)
        await fs.writeFile(path.join('build', 'CHECK.AKP'), out)

        // expect(out).to.eq(buf)

        expect(program.getProgramNumber()).to.eq(checkProgram.getProgramNumber())
        expect(program.getKeygroupCount()).to.eq(checkProgram.getKeygroupCount())
        const keygroups = program.getKeygroups()
        const checkKeygroups = checkProgram.getKeygroups()
        expect(keygroups.length).to.equal(program.getKeygroupCount())

        const keygroup = keygroups[0]
        const checkKeygroup = checkKeygroups[0]

        const kloc = keygroup.kloc
        const checkKloc = checkKeygroup.kloc
        expect(kloc.ampMod).eq(checkKloc.ampMod)

        const ampEnvelope = keygroup.ampEnvelope
        const checkAmpEnvelope = checkKeygroup.ampEnvelope
        expect(ampEnvelope.attack).to.eq(checkAmpEnvelope.attack)
        expect(ampEnvelope.sustain).to.eq(checkAmpEnvelope.sustain)

        // modify the test program to see if modified program will load in sampler
        modProgram.getOutput().loudness = 70
        const mod = Buffer.alloc(out.length)
        modProgram.writeToBuffer(mod,0)
        await ensureBuildDir()
        await fs.writeFile(path.join('build', 'MOD.AKP'), mod)
    })
})

describe('JSON Program', async () => {
    it('reads the default json', async () => {
        const json = await fs.readFile(path.join('test', 'data', 'default-program.json'))
        const program = newProgramFromJson(json.toString())
        expect(program.getProgramNumber()).to.eq(0)
        expect(program.getKeygroupCount()).to.eq(1)
        expect(program.getOutput()).to.exist
        const output = program.getOutput()
        expect(output.loudness).to.eq(85)
        expect(output.ampMod1).to.eq(0)
        expect(output.ampMod2).to.eq(0)
        expect(output.panMod1).to.eq(0)
        expect(output.panMod2).to.eq(0)
        expect(output.panMod3).to.eq(0)
        expect(output.velocitySensitivity).to.eq(25)
        const tune = program.getTune()
        expect(tune.semiToneTune).to.eq(0)
        expect(tune.detuneC).to.eq(0)
        expect(tune.detuneCSharp).to.eq(0)
        expect(tune.detuneD).to.eq(0)
        expect(tune.detuneEFlat).to.eq(0)
        expect(tune.detuneE).to.eq(0)
        expect(tune.detuneF).to.eq(0)
        expect(tune.detuneFSharp).to.eq(0)
        expect(tune.detuneG).to.eq(0)
        expect(tune.detuneGSharp).to.eq(0)
        expect(tune.detuneA).to.eq(0)
        expect(tune.detuneBFlat).to.eq(0)
        expect(tune.detuneB).to.eq(0)

        const lfo1 = program.getLfo1()
        expect(lfo1.waveform).to.eq(1)
        expect(lfo1.rate).to.eq(43)
        expect(lfo1.delay).to.eq(0)
        expect(lfo1.depth).to.eq(0)
        expect(lfo1.sync).to.eq(0)
        expect(lfo1.modwheel).to.eq(15)
        expect(lfo1.aftertouch).to.eq(0)
        expect(lfo1.rateMod).to.eq(0)
        expect(lfo1.delayMod).to.eq(0)
        expect(lfo1.depthMod).to.eq(0)

        const lfo2 = program.getLfo2()
        expect(lfo2.waveform).to.eq(0)
        expect(lfo2.rate).to.eq(0)
        expect(lfo2.delay).to.eq(0)
        expect(lfo2.depth).to.eq(0)
        expect(lfo2.retrigger).to.eq(0)
        expect(lfo2.rateMod).to.eq(0)
        expect(lfo2.delayMod).to.eq(0)
        expect(lfo2.depthMod).to.eq(0)

        const mods = program.getMods()
        expect(mods.ampMod1Source).to.eq(6)
        expect(mods.ampMod2Source).to.eq(3)
        expect(mods.panMod1Source).to.eq(8)
        expect(mods.panMod2Source).to.eq(6)
        expect(mods.panMod3Source).to.eq(1)
        expect(mods.lfo1RateModSource).to.eq(6)
        expect(mods.lfo1DelayModSource).to.eq(6)
        expect(mods.lfo1DepthModSource).to.eq(6)
        expect(mods.lfo2RateModSource).to.eq(0)
        expect(mods.lfo2DepthModSource).to.eq(0)
        expect(mods.lfo2DepthModSource).to.eq(0)
        expect(mods.pitchMod1Source).to.eq(7)
        expect(mods.pitchMod2Source).to.eq(11)
        expect(mods.ampModSource).to.eq(5)
        expect(mods.filterModInput1).to.eq(5)
        expect(mods.filterModInput2).to.eq(8)
        expect(mods.filterModInput3).to.eq(9)

        const keygroup = program.getKeygroups()[0]
        const kloc = keygroup.kloc
        expect(kloc.lowNote).to.eq(21)
        expect(kloc.highNote).to.eq(127)
        expect(kloc.semiToneTune).to.eq(0)
        expect(kloc.fineTune).to.eq(0)
        expect(kloc.overrideFx).to.eq(0)
        expect(kloc.fxSendLevel).to.eq(0)
        expect(kloc.pitchMod1).to.eq(0)
        expect(kloc.pitchMod2).to.eq(0)
        expect(kloc.ampMod).to.eq(0)
        expect(kloc.zoneXFade).to.eq(0)
        expect(kloc.muteGroup).to.eq(0)

        const ampEnvelope = keygroup.ampEnvelope
        expect(ampEnvelope.attack).to.eq(0)
        expect(ampEnvelope.decay).to.eq(50)
        expect(ampEnvelope.sustain).to.eq(100)
        expect(ampEnvelope.release).to.eq(15)
        expect(ampEnvelope.velocity2Attack).to.eq(0)
        expect(ampEnvelope.keyscale).to.eq(0)
        expect(ampEnvelope.onVelocity2Release).to.eq(0)
        expect(ampEnvelope.offVelocity2Release).to.eq(0)


        const filterEnvelope = keygroup.filterEnvelope
        expect(filterEnvelope.attack).to.eq(0)
        expect(filterEnvelope.decay).to.eq(50)
        expect(filterEnvelope.sustain).to.eq(100)
        expect(filterEnvelope.release).to.eq(15)
        expect(filterEnvelope.depth).to.eq(0)
        expect(filterEnvelope.velocity2Attack).to.eq(0)
        expect(filterEnvelope.keyscale).to.eq(0)
        expect(filterEnvelope.onVelocity2Release).to.eq(0)
        expect(filterEnvelope.offVelocity2Release).to.eq(0)

        const auxEnvelope = keygroup.auxEnvelope
        expect(auxEnvelope.rate1).to.eq(0)
        expect(auxEnvelope.rate2).to.eq(50)
        expect(auxEnvelope.rate3).to.eq(50)
        expect(auxEnvelope.rate4).to.eq(15)
        expect(auxEnvelope.level1).to.eq(100)
        expect(auxEnvelope.level2).to.eq(100)
        expect(auxEnvelope.level3).to.eq(100)
        expect(auxEnvelope.level4).to.eq(0)

        const filter = keygroup.filter
        expect(filter.mode).to.eq(0)
        expect(filter.cutoff).to.eq(100)
        expect(filter.resonance).to.eq(0)
        expect(filter.keyboardTrack).to.eq(0)
        expect(filter.modInput1).to.eq(0)
        expect(filter.modInput2).to.eq(0)
        expect(filter.modInput3).to.eq(0)
        expect(filter.headroom).to.eq(0)
        expect(keygroup.zone1.sampleName).to.eq('smp1')
        expect(keygroup.zone1.sampleNameLength).to.eq(4)
        for (const zone: Zone of [keygroup.zone1, keygroup.zone2, keygroup.zone3, keygroup.zone4]) {
            expect(zone.lowVelocity).to.eq(21)
            expect(zone.highVelocity).to.eq(127)
            expect(zone.fineTune).to.eq(0)
            expect(zone.semiToneTune).to.eq(0)
            expect(zone.filter).to.eq(0)
            expect(zone.panBalance).to.eq(0)
            expect(zone.playback).to.eq(4)
            expect(zone.output).to.eq(0)
            expect(zone.level).to.eq(0)
            expect(zone.keyboardTrack).to.eq(1)
            expect(zone.velocity2StartLsb).to.eq(0)
            expect(zone.velocity2StartMsb).to.eq(0)
        }
    })


    it('Reads a json file and writes a valid binary file', async () => {
        const json = (await fs.readFile(path.join('test', 'data', 'default-program.json'))).toString()
        const program = newProgramFromJson(json)
        const output = program.getOutput()
        output.loudness = 95
        const keygroup = program.getKeygroups()[0]
        keygroup.filter.cutoff = 3
        keygroup.filter.resonance = 5
        const buf = Buffer.alloc(1024 * 2)
        const written = program.writeToBuffer(buf, 0)
        await ensureBuildDir()
        await fs.writeFile(path.join('build', 'default-program.akp'),  Buffer.copyBytesFrom(buf, 0, written))
        const inbuf = await fs.readFile(path.join('build', 'default-program.akp'))
        const checkProgram = newProgramFromBuffer(inbuf)

        expect(checkProgram.getKeygroupCount()).to.eq(1)
        expect(checkProgram.getOutput().loudness).to.eq(95)
        const kg = checkProgram.getKeygroups()[0]
        expect(kg.filter.cutoff).to.eq(3)
        expect(kg.filter.resonance).to.eq(5)


    })

    it('Reads a default binary file, applies changes from json, and writes a valid binary file', async () => {
        let originalName = 'Kick 1';
        const newName = "New Name"
        const mods = {
            keygroupCount: 2,
            output: {
                loudness: 75
            },
            keygroups: [
                {
                    zone1: {
                        sampleName: newName
                    }
                },
                {
                    zone1: {
                        sampleName: newName
                    }
                }
            ]
        }
        const input = await fs.readFile(path.join('test', 'data', 'DEFAULT.AKP'))
        const program = newProgramFromBuffer(input)
        expect(program.getOutput().loudness).to.eq(85)
        expect(program.getKeygroups()).to.exist
        expect(program.getKeygroups().length).to.eq(1)
        expect(program.getKeygroups()[0].zone1.sampleName).to.eq(originalName)
        program.apply(mods)
        expect(program.getOutput().loudness).to.eq(mods.output.loudness)
        expect(program.getKeygroups().length).to.eq(2)
        expect(program.getKeygroupCount()).to.eq(2)
        expect(program.getKeygroups()[0].zone1.sampleName).to.eq(newName)

        await ensureBuildDir()
        const outFile = path.join('build', 'MOD4.AKP')
        const output = Buffer.alloc(1024 * 2)
        const bufferSize = program.writeToBuffer(output, 0)
        await fs.writeFile(outFile, Buffer.copyBytesFrom(output, 0, bufferSize))

        const originalSample = await fs.readFile(path.join('test', 'data', 'Sx000', `${originalName}.wav`))
        await fs.writeFile(path.join('build', `${newName}.WAV`), originalSample)

        const mod4Buffer = await fs.readFile(outFile)
        const mod4Program = newProgramFromBuffer(mod4Buffer)
        expect(mod4Program.getKeygroups()).to.exist
        expect(mod4Program.getKeygroups().length).to.eq(2)
        expect(mod4Program.getKeygroupCount()).to.eq(2)
        expect(mod4Program.getKeygroups()[0].zone1.sampleName).to.eq(newName)
    })

})
