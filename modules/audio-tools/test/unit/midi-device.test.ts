import {describe, it} from 'mocha'
import {expect} from "chai";
import {newServerOutput} from "@/lib/process-output";
import {Midi} from "@/midi/midi";
import {Message} from "webmidi";

const out = newServerOutput()
const activeDevices = {
    "MT4 Port 1": {
        input: "MT4 Port 1",
        output: "MT4 Port 1"
    },

}

const loopbackDevice = {
    input: "IAC Driver Bus 1",
    output: "IAC Driver Bus 1"
}

describe('Device', async () => {
    const midi = new Midi()
    let isActive = false

    before(async () => {
        out.log('Starting midi...')
        await midi.start(() => {
            out.log(`MIDI started.`)
            for (const name of Object.getOwnPropertyNames(activeDevices)) {
                const pair = activeDevices[name]
                if (midi.getOutput(name)) {
                    out.log(`Setting midi inputs and outputs...`)
                    midi.setInputByName(pair.input)
                    midi.setOutputByName(pair.output)
                    isActive = true
                }
            }
        })
    })
    after(async () => {
        out.log('Disabling MIDI...')
        await midi.stop(() => out.log(`MIDI disabled.`))
    })

    it('Initializes', async () => {
        expect((await midi.getOutputs()).length).gte(1);

        const inputs = await midi.getInputs()
        const outputs = await midi.getOutputs();
        out.log(`+ MIDI inputs ---------------------------+`)
        inputs.forEach((input) => out.log(`+ -- input : ${input.name}`))
        out.log(`+ MIDI outputs --------------------------+`)
        outputs.forEach((output) => out.log(`+ -- output: ${output.name}`))
    })

    it('Reads and writes on the loopback midi device', async () => {
        await midi.setOutputByName(loopbackDevice.output)
        await midi.setInputByName(loopbackDevice.input)

        const p = new Promise((resolve) => {
            out.log(`Adding MIDI listener...`)
            const listener = midi.addListener('noteon', (event) => {
                out.log(`Midi message!!!`)
                resolve(event)
            })
            out.log(`Done adding MIDI listener: ${listener}`)
        })


        midi.noteOn(1, 60, 100)
        const event = await p
        expect(event).to.exist
        const message: Message = event.message
        expect(message).to.exist
        expect(message.type).to.eq('noteon')
    })
})