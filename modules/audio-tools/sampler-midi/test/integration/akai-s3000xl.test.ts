import midi from 'midi'
import {expect} from "chai";
import {string2AkaiBytes, akaiByte2String} from "@/s3k"

function listenForMessage(input: midi.Input) {
    return new Promise<midi.MidiMessage>((resolve, reject) => {
        input.on('message', function (deltaTime, message) {
            resolve(message)
        })
        setTimeout(() => reject(), 2 * 1000)
    })
}

function init<T extends midi.Input | midi.Output>(io: T): T {
    for (let i = 0; i < io.getPortCount(); i++) {
        if (io.getPortName(i).startsWith('IAC')) {
            continue
        }
        console.log(`Opening port ${io.getPortName(i)}`)
        io.openPort(i)
        break
    }
    return io
}

let input: midi.Input, output: midi.Output

function midiSetup() {
    output = init(new midi.Output())
    input = init(new midi.Input())
    input.ignoreTypes(false, false, false)
}

function midiTeardown() {
    input?.closePort()
    output?.closePort()
}

describe('akai-s3000xl tests', () => {
    before(midiSetup)
    after(midiTeardown)

    it('Reads and writes akai-formatted strings', () => {
        let v = 'a nice strin' // max 12 chars
        let data = string2AkaiBytes(v)
        let vv = akaiByte2String(data)
        expect(vv).eq(v.toUpperCase())

        v = 'shorty'
        data = string2AkaiBytes(v)
        vv = akaiByte2String(data)
        console.log(`vv: <${vv}>`)
        expect(vv).eq(v.toUpperCase() + '      ')
    })

    it('fetches resident sample names', async () => {
        const device = newDevice(input, output)
        const names: string[] = []
        await device.fetchSampleNames(names)
        expect(names).not.empty
    })

    it('fetches sample header', async () => {
        const device = newDevice(input, output)
        const header = {} as SampleHeader
        const sampleNumber = 8
        await device.fetchSampleHeader(sampleNumber, header)
        console.log(header)
        expect((header as any)['SNUMBER']).eq(sampleNumber)
        expect(header.SHIDENT).eq(3) // Akai magic value
        expect(header.SSRVLD).eq(0x80) // Akai magic value
    })

    it('fetches resident program names', async () => {
        const device = newDevice(input, output)

        const names: string[] = []
        await device.fetchProgramNames(names)
        console.log(`Sample names:`)
        console.log(names)
        expect(names).not.empty

        expect(names).deep.eq(device.getProgramNames([]))
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
        expect(program.getProgramName().trim()).not.eq(newName.toUpperCase())
        program.setProgramName('a new name')
        expect(program.getProgramName().trim()).eq(newName.toUpperCase())

        // await device.writeProgram(header)
        await program.save()

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)

        const p2 = new Program(device, h2)
        expect(p2.getProgramName()).eq(program.getProgramName())
    })

    it(`writes program level via generated class`, async () => {
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)

        const program = new Program(device, header)

        const level = program.getProgramLevel()

        program.setProgramLevel(level - 1)
        expect(program.getProgramLevel()).eq(level - 1)
        await program.save()

        const h2 = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, h2)
        const p2 = new Program(device, h2)

        expect(p2.getProgramLevel()).eq(program.getProgramLevel())
    })

    it(`writes program polyphony`, async () => {
        let polyphony = 2
        const device = newDevice(input, output)
        const programNumber = 0
        const header = {} as ProgramHeader
        await device.fetchProgramHeader(programNumber, header)
        expect(header.POLYPH).not.eq(polyphony)

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

        expect(h2.POLYPH).eq(polyphony)
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
        expect(h2.PLAYLO).eq(lowNote)
    })

    it('fetches keygroup header', async () => {
        const device = newDevice(input, output)
        const programNumber = 3
        const keygroupNumber = 1
        const header = {} as KeygroupHeader
        await device.fetchKeygroupHeader(programNumber, keygroupNumber, header)
        expect((header as any)['PNUMBER']).equal(programNumber)
        expect((header as any)['KNUMBER']).equal(keygroupNumber)
        expect(header.KGIDENT).equal(2) // magic Akai number
        console.log(header)
    })
})

describe('basic sysex tests', () => {
    before(midiSetup)
    after(midiTeardown)


    it('Initializes midi', () => {
        expect(output).to.exist
        expect(input).to.exist
    })

    it(`Sends sysex`, async () => {
        let data
        let listener = listenForMessage(input)
        data = [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7]
        console.log(`Requesting names of resident samples...`)
        output.sendMessage(data as [number, number, number])

        let message = await listener
        console.log(`Received message.`)
        console.log(message)

        // request header for sample 0x09
        listener = listenForMessage(input)
        data = [0xF0, 0x47, 0x00, 0x0a, 0x48, 0x09, 0x00, 0xf7]
        console.log(`Requesting header for sample 0x09...`)
        output.sendMessage(data as [number, number, number])
        message = await listener
        console.log(`Received message:`)
        console.log(message)
    })
})

describe('basic node midi tests', () => {
    it('gets a midi input', () => {
        const input = new midi.Input()
        expect(input).to.exist
        expect(input.getPortCount()).gte(1)
        for (let i = 0; i < input.getPortCount(); i++) {
            console.log(`Input [${i}]: ${input.getPortName(i)}`)
        }
    })

    it('gets a midi output', () => {
        const output = new midi.Output()
        expect(output).to.exist
        expect(output.getPortCount()).gte(1)
        for (let i = 0; i < output.getPortCount(); i++) {
            console.log(`Output [${i}]: ${output.getPortName(i)}`)
        }
    })

    it('sends and receives messages...', async () => {
        const input = new midi.Input()
        const output = new midi.Output()

        input.ignoreTypes(false, false, false)

        const received = new Promise<midi.MidiMessage>((resolve) => {

            input.on('message', (deltaTime, message) => {
                input.closePort()
                output.closePort()
                resolve(message)
            })

        })

        // on MacOS, this will be the IAC bus; other platforms, YMMMV
        input.openPort(0)
        output.openPort(0)

        const data = [176, 22, 1];
        output.sendMessage(data as [number, number, number])

        const m = await received
        for (let i = 0; i < data.length; i++) {
            expect(m[i]).eq(data[i])
        }

    })
})
