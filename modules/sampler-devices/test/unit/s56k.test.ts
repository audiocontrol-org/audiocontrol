import { describe, it, expect } from 'vitest';
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
        expect(0).toBe(0)
    })
    it('Converts bytes to number...', () => {
        const bytes = [0x6, 0, 0, 0]
        expect(bytes2Number(bytes)).toBe(6)
    })

    it('Parses a chunk header...', () => {
        const buf = Buffer.from([
            0x6f, 0x75, 0x74, 0x20, // 'out '
            0x08, 0x00, 0x00, 0x00   //  8
        ])
        const chunk = newOutputChunk()
        const bytesRead = parseChunkHeader(buf, chunk, 0)
        expect(bytesRead).toBe(8)
        expect(chunk.name).toBe('out ')
        expect(chunk.lengthInBytes).toBe(8)
    })

    it('Parses a program file', async () => {
        const buf = await loadTestFile();
        let offset = 0

        // Parse header
        const header = newHeaderChunk()
        offset += header.parse(buf, offset)
        expect(offset).toBeGreaterThan(0)

        // Parse program chunk
        const program: ProgramChunk = newProgramChunk()
        offset += program.parse(buf, offset)
        expect(program.programNumber).toBe(0)
        expect(program.keygroupCount).toBe(1)

        const output: OutputChunk = newOutputChunk()
        offset += output.parse(buf, offset)
        expect(output.loudness).toBe(80)
        expect(output.ampMod1).toBe(0)
        expect(output.ampMod2).toBe(0)
        expect(output.panMod1).toBe(0)
        expect(output.panMod2).toBe(0)
        expect(output.panMod3).toBe(0)
        expect(output.velocitySensitivity).toBe(0)

        const tune = newTuneChunk()
        offset += tune.parse(buf, offset)
        expect(tune.semiToneTune).toBe(0)
        expect(tune.fineTune).toBe(0)
        expect(tune.detuneA).toBe(0)
        expect(tune.detuneBFlat).toBe(0)
        expect(tune.detuneB).toBe(0)
        expect(tune.detuneC).toBe(0)
        expect(tune.detuneCSharp).toBe(0)
        expect(tune.detuneD).toBe(0)
        expect(tune.detuneEFlat).toBe(0)
        expect(tune.detuneE).toBe(0)
        expect(tune.detuneF).toBe(0)
        expect(tune.detuneFSharp).toBe(0)
        expect(tune.detuneG).toBe(0)
        expect(tune.pitchBendUp).toBe(2)
        expect(tune.pitchBendDown).toBe(2)
        expect(tune.bendMode).toBe(0)
        expect(tune.aftertouch).toBe(0)

        const lfo1 = newLfo1Chunk()
        offset += lfo1.parse(buf, offset)
        expect(lfo1.name).toBe('lfo ')
        expect(lfo1.waveform).toBe(1)
        expect(lfo1.rate).toBe(43)
        expect(lfo1.delay).toBe(0)
        expect(lfo1.depth).toBe(0)
        expect(lfo1.sync).toBe(0)
        expect(lfo1.modwheel).toBe(15)
        expect(lfo1.aftertouch).toBe(0)
        expect(lfo1.rateMod).toBe(0)
        expect(lfo1.delayMod).toBe(0)
        expect(lfo1.depthMod).toBe(0)

        const lfo2 = newLfo2Chunk()
        offset += lfo2.parse(buf, offset)
        expect(lfo2.name).toBe('lfo ')
        expect(lfo2.waveform).toBe(0)
        expect(lfo2.rate).toBe(0)
        expect(lfo2.delay).toBe(0)
        expect(lfo2.depth).toBe(0)
        expect(lfo2.retrigger).toBe(0)
        expect(lfo2.rateMod).toBe(0)
        expect(lfo2.depthMod).toBe(0)

        const mods = newModsChunk()
        offset += mods.parse(buf, offset)
        expect(mods.name).toBe('mods')
        expect(mods.ampMod1Source).toBe(6)
        expect(mods.ampMod2Source).toBe(3)
        expect(mods.panMod1Source).toBe(8)
        expect(mods.panMod2Source).toBe(6)
        expect(mods.panMod3Source).toBe(1)
        expect(mods.lfo1RateModSource).toBe(6)
        expect(mods.lfo1DelayModSource).toBe(6)
        expect(mods.lfo1DepthModSource).toBe(6)
        expect(mods.lfo2RateModSource).toBe(0)
        expect(mods.lfo2DelayModSource).toBe(0)
        expect(mods.lfo2DepthModSource).toBe(0)
        expect(mods.pitchMod1Source).toBe(7)
        expect(mods.pitchMod2Source).toBe(11)
        expect(mods.ampModSource).toBe(5)
        expect(mods.filterModInput1).toBe(5)
        expect(mods.filterModInput2).toBe(8)
        expect(mods.filterModInput3).toBe(9)

        const keygroup = newKeygroupChunk()
        offset += keygroup.parse(buf, offset)
        expect(keygroup.name).toBe('kgrp')
        expect(keygroup.kloc).toBeDefined()

        const kloc = keygroup.kloc
        // expect(kloc.name).toBe('kloc')
        expect(kloc.lowNote).toBe(21)
        expect(kloc.highNote).toBe(127)
        expect(kloc.semiToneTune).toBe(0)
        expect(kloc.fineTune).toBe(0)
        expect(kloc.overrideFx).toBe(0)
        expect(kloc.pitchMod1).toBe(100)
        expect(kloc.pitchMod2).toBe(0)
        expect(kloc.ampMod).toBe(0)
        expect(kloc.zoneXFade).toBe(0)
        expect(kloc.muteGroup).toBe(0)

        expect(keygroup.ampEnvelope).toBeDefined()
        const ampenv = keygroup.ampEnvelope
        // expect(ampenv.name).toBe('env ')
        expect(ampenv.attack).toBe(1)
        expect(ampenv.decay).toBe(50)
        expect(ampenv.sustain).toBe(100)
        expect(ampenv.velocity2Attack).toBe(0)
        expect(ampenv.onVelocity2Release).toBe(0)
        expect(ampenv.offVelocity2Release).toBe(0)

        expect(keygroup.filterEnvelope).toBeDefined()
        const filtenv = keygroup.filterEnvelope
        // expect(filtenv.name).toBe('env ')
        expect(filtenv.attack).toBe(3)
        expect(filtenv.decay).toBe(74)
        expect(filtenv.sustain).toBe(68)
        expect(filtenv.release).toBe(0)
        expect(filtenv.depth).toBe(7)
        expect(filtenv.velocity2Attack).toBe(0)
        expect(filtenv.keyscale).toBe(0)
        expect(filtenv.onVelocity2Release).toBe(0)
        expect(filtenv.offVelocity2Release).toBe(0)

        expect(keygroup.auxEnvelope).toBeDefined()
        const auxenv = keygroup.auxEnvelope
        // expect(auxenv.name).toBe('env ')
        expect(auxenv.rate1).toBe(0)
        expect(auxenv.rate2).toBe(50)
        expect(auxenv.rate3).toBe(50)
        expect(auxenv.rate4).toBe(15)
        expect(auxenv.level1).toBe(100)
        expect(auxenv.level2).toBe(100)
        expect(auxenv.level3).toBe(100)
        expect(auxenv.level4).toBe(0)
        expect(auxenv.velocity2Rate1).toBe(0)
        expect(auxenv.keyboard2Rate2and4).toBe(0)
        expect(auxenv.velocity2Rate4).toBe(0)
        expect(auxenv.offVelocity2Rate4).toBe(0)
        expect(auxenv.velocity2OutLevel).toBe(0)

        expect(keygroup.filter).toBeDefined()
        const filt = keygroup.filter
        // expect(filt.name).toBe('filt')
        expect(filt.mode).toBe(0)
        expect(filt.cutoff).toBe(53)
        expect(filt.resonance).toBe(7)
        expect(filt.keyboardTrack).toBe(6)
        expect(filt.modInput1).toBe(0)
        expect(filt.modInput2).toBe(0)
        expect(filt.modInput3).toBe(0)
        expect(filt.headroom).toBe(0)

        expect(keygroup.zone1).toBeDefined()
        const zone1 = keygroup.zone1
        // expect(zone1.name).toBe('zone')
        expect(zone1.lowVelocity).toBe(0)
        expect(zone1.highVelocity).toBe(127)
        expect(zone1.fineTune).toBe(0)
        expect(zone1.filter).toBe(0)
        expect(zone1.panBalance).toBe(0)
        expect(zone1.playback).toBe(6)
        expect(zone1.output).toBe(0)
        expect(zone1.level).toBe(-20)
        expect(zone1.keyboardTrack).toBe(1)
        expect(zone1.velocity2StartLsb).toBe(0)
        expect(zone1.velocity2StartMsb).toBe(0)

        expect(keygroup.zone2).toBeDefined()
        const zone2 = keygroup.zone2
        // expect(zone2.name).toBe('zone')
        expect(zone2.fineTune).toBe(-10)
        expect(zone2.level).toBe(-20)


        expect(keygroup.zone3).toBeDefined()
        const zone3 = keygroup.zone3
        // expect(zone3.name).toBe('zone')

        expect(keygroup.zone4).toBeDefined()
        const zone4 = keygroup.zone4
        // expect(zone4.name).toBe('zone')
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
        expect(checkHeader.name).toBe(header.name)
        expect(checkHeader.lengthInBytes).toBe(header.lengthInBytes)

        const program = newProgramChunk()
        const checkProgram = newProgramChunk()

        inset += program.parse(buf, inset)
        outset += program.write(out, outset)

        checkpoint += checkProgram.parse(out, checkpoint)

        expect(checkProgram.name).toBe(program.name)
        expect(checkProgram.lengthInBytes).toBe(program.lengthInBytes)
        expect(checkProgram.programNumber).toBe(program.programNumber)
        expect(checkProgram.keygroupCount).toBe(program.keygroupCount)
    })
})

describe('BinaryProgram', async () => {
    it('Parses a program file...', async () => {
        let offset = 0
        const buf = await loadTestFile();
        const program = newProgramFromBuffer(buf)//new Program()

        expect(program.getProgramNumber()).toBe(0)
        expect(program.getKeygroupCount()).toBe(1)

        const output: Output = program.getOutput()
        expect(output.loudness).toBe(80)

        const tune: Tune = program.getTune()
        expect(tune.pitchBendUp).toBe(2)
        expect(tune.pitchBendDown).toBe(2)

        const lfo1: Lfo1 = program.getLfo1()
        expect(lfo1.rate).toBe(43)

        const lfo2: Lfo2 = program.getLfo2()
        expect(lfo2.rate).toBe(0)

        const mods: Mods = program.getMods()
        expect(mods.panMod1Source).toBe(8)

        const keygroups: Keygroup[] = program.getKeygroups()
        expect(keygroups.length).toBe(program.getKeygroupCount())
        const kgrp = keygroups[0]
        expect(kgrp.kloc).toBeDefined()


        expect(kgrp.ampEnvelope).toBeDefined()
        expect(kgrp.filterEnvelope).toBeDefined()
        expect(kgrp.auxEnvelope).toBeDefined()
        expect(kgrp.filter).toBeDefined()
        expect(kgrp.zone1).toBeDefined()
        expect(kgrp.zone1.sampleName).toBe('WV 2')
        expect(kgrp.zone2).toBeDefined()
        expect(kgrp.zone3).toBeDefined()
        expect(kgrp.zone4).toBeDefined()

        const kloc = kgrp.kloc
        expect(kloc.ampMod).toBe(0)
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

        // expect(out).toBe(buf)

        expect(program.getProgramNumber()).toBe(checkProgram.getProgramNumber())
        expect(program.getKeygroupCount()).toBe(checkProgram.getKeygroupCount())
        const keygroups = program.getKeygroups()
        const checkKeygroups = checkProgram.getKeygroups()
        expect(keygroups.length).toBe(program.getKeygroupCount())

        const keygroup = keygroups[0]
        const checkKeygroup = checkKeygroups[0]

        const kloc = keygroup.kloc
        const checkKloc = checkKeygroup.kloc
        expect(kloc.ampMod).toBe(checkKloc.ampMod)

        const ampEnvelope = keygroup.ampEnvelope
        const checkAmpEnvelope = checkKeygroup.ampEnvelope
        expect(ampEnvelope.attack).toBe(checkAmpEnvelope.attack)
        expect(ampEnvelope.sustain).toBe(checkAmpEnvelope.sustain)

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
        expect(program.getProgramNumber()).toBe(0)
        expect(program.getKeygroupCount()).toBe(1)
        expect(program.getOutput()).toBeDefined()
        const output = program.getOutput()
        expect(output.loudness).toBe(85)
        expect(output.ampMod1).toBe(0)
        expect(output.ampMod2).toBe(0)
        expect(output.panMod1).toBe(0)
        expect(output.panMod2).toBe(0)
        expect(output.panMod3).toBe(0)
        expect(output.velocitySensitivity).toBe(25)
        const tune = program.getTune()
        expect(tune.semiToneTune).toBe(0)
        expect(tune.detuneC).toBe(0)
        expect(tune.detuneCSharp).toBe(0)
        expect(tune.detuneD).toBe(0)
        expect(tune.detuneEFlat).toBe(0)
        expect(tune.detuneE).toBe(0)
        expect(tune.detuneF).toBe(0)
        expect(tune.detuneFSharp).toBe(0)
        expect(tune.detuneG).toBe(0)
        expect(tune.detuneGSharp).toBe(0)
        expect(tune.detuneA).toBe(0)
        expect(tune.detuneBFlat).toBe(0)
        expect(tune.detuneB).toBe(0)

        const lfo1 = program.getLfo1()
        expect(lfo1.waveform).toBe(1)
        expect(lfo1.rate).toBe(43)
        expect(lfo1.delay).toBe(0)
        expect(lfo1.depth).toBe(0)
        expect(lfo1.sync).toBe(0)
        expect(lfo1.modwheel).toBe(15)
        expect(lfo1.aftertouch).toBe(0)
        expect(lfo1.rateMod).toBe(0)
        expect(lfo1.delayMod).toBe(0)
        expect(lfo1.depthMod).toBe(0)

        const lfo2 = program.getLfo2()
        expect(lfo2.waveform).toBe(0)
        expect(lfo2.rate).toBe(0)
        expect(lfo2.delay).toBe(0)
        expect(lfo2.depth).toBe(0)
        expect(lfo2.retrigger).toBe(0)
        expect(lfo2.rateMod).toBe(0)
        expect(lfo2.delayMod).toBe(0)
        expect(lfo2.depthMod).toBe(0)

        const mods = program.getMods()
        expect(mods.ampMod1Source).toBe(6)
        expect(mods.ampMod2Source).toBe(3)
        expect(mods.panMod1Source).toBe(8)
        expect(mods.panMod2Source).toBe(6)
        expect(mods.panMod3Source).toBe(1)
        expect(mods.lfo1RateModSource).toBe(6)
        expect(mods.lfo1DelayModSource).toBe(6)
        expect(mods.lfo1DepthModSource).toBe(6)
        expect(mods.lfo2RateModSource).toBe(0)
        expect(mods.lfo2DepthModSource).toBe(0)
        expect(mods.lfo2DepthModSource).toBe(0)
        expect(mods.pitchMod1Source).toBe(7)
        expect(mods.pitchMod2Source).toBe(11)
        expect(mods.ampModSource).toBe(5)
        expect(mods.filterModInput1).toBe(5)
        expect(mods.filterModInput2).toBe(8)
        expect(mods.filterModInput3).toBe(9)

        const keygroup = program.getKeygroups()[0]
        const kloc = keygroup.kloc
        expect(kloc.lowNote).toBe(21)
        expect(kloc.highNote).toBe(127)
        expect(kloc.semiToneTune).toBe(0)
        expect(kloc.fineTune).toBe(0)
        expect(kloc.overrideFx).toBe(0)
        expect(kloc.fxSendLevel).toBe(0)
        expect(kloc.pitchMod1).toBe(0)
        expect(kloc.pitchMod2).toBe(0)
        expect(kloc.ampMod).toBe(0)
        expect(kloc.zoneXFade).toBe(0)
        expect(kloc.muteGroup).toBe(0)

        const ampEnvelope = keygroup.ampEnvelope
        expect(ampEnvelope.attack).toBe(0)
        expect(ampEnvelope.decay).toBe(50)
        expect(ampEnvelope.sustain).toBe(100)
        expect(ampEnvelope.release).toBe(15)
        expect(ampEnvelope.velocity2Attack).toBe(0)
        expect(ampEnvelope.keyscale).toBe(0)
        expect(ampEnvelope.onVelocity2Release).toBe(0)
        expect(ampEnvelope.offVelocity2Release).toBe(0)


        const filterEnvelope = keygroup.filterEnvelope
        expect(filterEnvelope.attack).toBe(0)
        expect(filterEnvelope.decay).toBe(50)
        expect(filterEnvelope.sustain).toBe(100)
        expect(filterEnvelope.release).toBe(15)
        expect(filterEnvelope.depth).toBe(0)
        expect(filterEnvelope.velocity2Attack).toBe(0)
        expect(filterEnvelope.keyscale).toBe(0)
        expect(filterEnvelope.onVelocity2Release).toBe(0)
        expect(filterEnvelope.offVelocity2Release).toBe(0)

        const auxEnvelope = keygroup.auxEnvelope
        expect(auxEnvelope.rate1).toBe(0)
        expect(auxEnvelope.rate2).toBe(50)
        expect(auxEnvelope.rate3).toBe(50)
        expect(auxEnvelope.rate4).toBe(15)
        expect(auxEnvelope.level1).toBe(100)
        expect(auxEnvelope.level2).toBe(100)
        expect(auxEnvelope.level3).toBe(100)
        expect(auxEnvelope.level4).toBe(0)

        const filter = keygroup.filter
        expect(filter.mode).toBe(0)
        expect(filter.cutoff).toBe(100)
        expect(filter.resonance).toBe(0)
        expect(filter.keyboardTrack).toBe(0)
        expect(filter.modInput1).toBe(0)
        expect(filter.modInput2).toBe(0)
        expect(filter.modInput3).toBe(0)
        expect(filter.headroom).toBe(0)
        expect(keygroup.zone1.sampleName).toBe('smp1')
        expect(keygroup.zone1.sampleNameLength).toBe(4)
        for (const zone of [keygroup.zone1, keygroup.zone2, keygroup.zone3, keygroup.zone4]) {
            expect(zone.lowVelocity).toBe(21)
            expect(zone.highVelocity).toBe(127)
            expect(zone.fineTune).toBe(0)
            expect(zone.semiToneTune).toBe(0)
            expect(zone.filter).toBe(0)
            expect(zone.panBalance).toBe(0)
            expect(zone.playback).toBe(4)
            expect(zone.output).toBe(0)
            expect(zone.level).toBe(0)
            expect(zone.keyboardTrack).toBe(1)
            expect(zone.velocity2StartLsb).toBe(0)
            expect(zone.velocity2StartMsb).toBe(0)
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

        expect(checkProgram.getKeygroupCount()).toBe(1)
        expect(checkProgram.getOutput().loudness).toBe(95)
        const kg = checkProgram.getKeygroups()[0]
        expect(kg.filter.cutoff).toBe(3)
        expect(kg.filter.resonance).toBe(5)


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
        expect(program.getOutput().loudness).toBe(85)
        expect(program.getKeygroups()).toBeDefined()
        expect(program.getKeygroups().length).toBe(1)
        expect(program.getKeygroups()[0].zone1.sampleName).toBe(originalName)
        program.apply(mods)
        expect(program.getOutput().loudness).toBe(mods.output.loudness)
        expect(program.getKeygroups().length).toBe(2)
        expect(program.getKeygroupCount()).toBe(2)
        expect(program.getKeygroups()[0].zone1.sampleName).toBe(newName)

        await ensureBuildDir()
        const outFile = path.join('build', 'MOD4.AKP')
        const output = Buffer.alloc(1024 * 2)
        const bufferSize = program.writeToBuffer(output, 0)
        await fs.writeFile(outFile, Buffer.copyBytesFrom(output, 0, bufferSize))

        const originalSample = await fs.readFile(path.join('test', 'data', 'Sx000', `${originalName}.wav`))
        await fs.writeFile(path.join('build', `${newName}.WAV`), originalSample)

        const mod4Buffer = await fs.readFile(outFile)
        const mod4Program = newProgramFromBuffer(mod4Buffer)
        expect(mod4Program.getKeygroups()).toBeDefined()
        expect(mod4Program.getKeygroups().length).toBe(2)
        expect(mod4Program.getKeygroupCount()).toBe(2)
        expect(mod4Program.getKeygroups()[0].zone1.sampleName).toBe(newName)
    })

})
