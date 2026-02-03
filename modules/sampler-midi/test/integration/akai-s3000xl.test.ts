import * as easymidi from 'easymidi'
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {string2AkaiBytes, akaiByte2String, SampleHeader, ProgramHeader, KeygroupHeader, ProgramHeader_writePLAYLO} from "@audiocontrol/sampler-devices/s3k"
import {newDevice, Program} from "@/client/client-akai-s3000xl.js"

type MidiMessage = number[];

function listenForMessage(input: easymidi.Input) {
    return new Promise<MidiMessage>((resolve, reject) => {
        input.on('sysex', function (msg) {
            resolve(msg.bytes)
        })
        setTimeout(() => reject(), 2 * 1000)
    })
}

function findPort(ports: string[]): string | undefined {
    for (const port of ports) {
        if (!port.startsWith('IAC')) {
            console.log(`Opening port ${port}`)
            return port
        }
    }
    return undefined
}

let input: easymidi.Input, output: easymidi.Output

function midiSetup() {
    const outputPort = findPort(easymidi.getOutputs())
    const inputPort = findPort(easymidi.getInputs())

    if (!outputPort || !inputPort) {
        throw new Error('No MIDI ports found')
    }

    output = new easymidi.Output(outputPort)
    input = new easymidi.Input(inputPort)
}

function midiTeardown() {
    input?.close()
    output?.close()
}

describe('akai-s3000xl tests', () => {
    beforeAll(midiSetup)
    afterAll(midiTeardown)

    it('Reads and writes akai-formatted strings', () => {
        let v = 'a nice strin' // max 12 chars
        let data = string2AkaiBytes(v)
        let vv = akaiByte2String(data)
        expect(vv).toBe(v.toUpperCase())

        v = 'shorty'
        data = string2AkaiBytes(v)
        vv = akaiByte2String(data)
        console.log(`vv: <${vv}>`)
        expect(vv).toBe(v.toUpperCase() + '      ')
    })

    it('fetches resident sample names', async () => {
        const device = newDevice(input, output)
        const names: string[] = []
        await device.fetchSampleNames(names)
        expect(names.length).toBeGreaterThan(0)
    })

    it('fetches sample header', async () => {
        const device = newDevice(input, output)
        const header = {} as SampleHeader
        const sampleNumber = 8
        await device.fetchSampleHeader(sampleNumber, header)
        console.log(header)
        expect((header as any)['SNUMBER']).toBe(sampleNumber)
        expect(header.SHIDENT).toBe(3) // Akai magic value
        expect(header.SSRVLD).toBe(0x80) // Akai magic value
    })

    it('fetches resident program names', async () => {
        const device = newDevice(input, output)

        const names: string[] = []
        await device.fetchProgramNames(names)
        console.log(`Sample names:`)
        console.log(names)
        expect(names.length).toBeGreaterThan(0)

        expect(names).toEqual(device.getProgramNames([]))
    })

    it('fetches program header', async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)
        console.log(header)
    })

    it('writes program header', async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)
        const program = new Program(device, header)
        console.log(header)
        // await device.writeProgram(header)
        await program.save()
    })

    it(`writes program name`, async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)
        await device.writeProgramName(header, 'new name')
    })

    it(`writes program name via generated class`, async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)

        const program = new Program(device, header)

        program.setProgramName('test program')
        // await device.writeProgram(header)
        await program.save()

        let newName = 'a new name'
        expect(program.getProgramName().trim()).not.toBe(newName.toUpperCase())
        program.setProgramName('a new name')
        expect(program.getProgramName().trim()).toBe(newName.toUpperCase())

        // await device.writeProgram(header)
        await program.save()

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)

        const p2 = new Program(device, h2)
        expect(p2.getProgramName()).toBe(program.getProgramName())
    })

    it(`writes program level via generated class`, async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)

        const program = new Program(device, header)

        const level = program.getProgramLevel()

        program.setProgramLevel(level - 1)
        expect(program.getProgramLevel()).toBe(level - 1)
        await program.save()

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)
        const p2 = new Program(device, h2)

        expect(p2.getProgramLevel()).toBe(program.getProgramLevel())
    })

    it(`writes program polyphony`, async () => {
        let polyphony = 2
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)
        expect(header.POLYPH).not.toBe(polyphony)

        await device.writeProgramPolyphony(header, polyphony)

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)

        for (const field of Object.getOwnPropertyNames(header)) {
            if (!field.endsWith('Label')) {
                console.log(`${field}:`)
                console.log(`  old: ${header[field as keyof ProgramHeader]}`)
                console.log(`  new: ${h2[field as keyof ProgramHeader]}`)
                if (header[field as keyof ProgramHeader] !== h2[field as keyof ProgramHeader]) {
                    console.log(`  DIFFERENT!!!!`)
                }
            }
        }

        expect(h2.POLYPH).toBe(polyphony)
    })

    it(`writes low note`, async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)

        const lowNote = header.PLAYLO + 1
        ProgramHeader_writePLAYLO(header, lowNote)

        // await device.writeProgram(header)
        const program = new Program(device, header)
        await program.save()

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)
        expect(h2.PLAYLO).toBe(lowNote)
    })

    it('fetches keygroup header', async () => {
        const device = newDevice(input, output)
        const programNumber = 3
        const keygroupNumber = 1
        const header = {} as KeygroupHeader
        await device.fetchKeygroupHeader(programNumber, keygroupNumber, header)
        expect((header as any)['PNUMBER']).toBe(programNumber)
        expect((header as any)['KNUMBER']).toBe(keygroupNumber)
        expect(header.KGIDENT).toBe(2) // magic Akai number
        console.log(header)
    })
})

describe('basic sysex tests', () => {
    beforeAll(midiSetup)
    afterAll(midiTeardown)


    it('Initializes midi', () => {
        expect(output).toBeDefined()
        expect(input).toBeDefined()
    })

    it(`Sends sysex`, async () => {
        let data
        let listener = listenForMessage(input)
        data = [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7]
        console.log(`Requesting names of resident samples...`)
        output.send('sysex', {bytes: data})

        let message = await listener
        console.log(`Received message.`)
        console.log(message)

        // request header for sample 0x09
        listener = listenForMessage(input)
        data = [0xF0, 0x47, 0x00, 0x0a, 0x48, 0x09, 0x00, 0xf7]
        console.log(`Requesting header for sample 0x09...`)
        output.send('sysex', {bytes: data})
        message = await listener
        console.log(`Received message:`)
        console.log(message)
    })
})

describe('basic easymidi tests', () => {
    it('gets midi inputs', () => {
        const inputs = easymidi.getInputs()
        expect(inputs).toBeDefined()
        expect(inputs.length).toBeGreaterThanOrEqual(1)
        for (let i = 0; i < inputs.length; i++) {
            console.log(`Input [${i}]: ${inputs[i]}`)
        }
    })

    it('gets midi outputs', () => {
        const outputs = easymidi.getOutputs()
        expect(outputs).toBeDefined()
        expect(outputs.length).toBeGreaterThanOrEqual(1)
        for (let i = 0; i < outputs.length; i++) {
            console.log(`Output [${i}]: ${outputs[i]}`)
        }
    })

    it('sends and receives messages...', async () => {
        // on MacOS, this will be the IAC bus; other platforms, YMMV
        const inputPorts = easymidi.getInputs()
        const outputPorts = easymidi.getOutputs()

        expect(inputPorts.length).toBeGreaterThanOrEqual(1)
        expect(outputPorts.length).toBeGreaterThanOrEqual(1)

        const input = new easymidi.Input(inputPorts[0])
        const output = new easymidi.Output(outputPorts[0])

        const received = new Promise<{controller: number, value: number, channel: number}>((resolve) => {
            input.on('cc', (msg) => {
                input.close()
                output.close()
                resolve(msg)
            })
        })

        // Send CC message: channel 0, controller 22, value 1
        output.send('cc', {controller: 22, value: 1, channel: 0})

        const m = await received
        expect(m.controller).toBe(22)
        expect(m.value).toBe(1)
        expect(m.channel).toBe(0)
    })
})
