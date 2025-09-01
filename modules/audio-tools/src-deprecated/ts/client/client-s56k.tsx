import {createRoot, Root} from "react-dom/client";
import {MidiDeviceSelect, MidiDeviceSpec, ProgramInfoView, ProgramOutputView} from "@/components/components-experimental";
import {Midi} from "@/midi/midi"
import {ClientConfig, newClientConfig} from "@/lib/config-client";
import {newClientCommon} from "@/lib/client-common";
import {MidiInstrument, newMidiInstrument} from "@/midi/instrument";
import {newS56kDevice, ProgramInfoResult, S56kDevice} from "@/midi/device";
import React from 'react'

const clientCommon = newClientCommon((msg) => console.log(msg), (msg) => console.error(msg))
const out = clientCommon.getOutput()
const midi = new Midi()
const midiOutputSelectRoot = createRoot(document.getElementById('midi-output-select'))
const midiInputSelectRoot = createRoot(document.getElementById('midi-input-select'))
const programInfoRoot = createRoot(document.getElementById('program-info'))
const programOutputRoot = createRoot(document.getElementById('program-output'))

class ClientS56k {
    private cfg: ClientConfig = newClientConfig()
    private device: S56kDevice

    async init() {
        let result = await clientCommon.fetchConfig()
        let instrument: MidiInstrument
        if (result.errors.length > 0) {
            clientCommon.status(result.errors)
            out.error(result.errors)
        } else {
            this.cfg = result.data
        }

        await midi.start(async () => {
            if (this.cfg.midiOutput && this.cfg.midiOutput !== '') {
                for (const out of  midi.getOutputs()) {
                    if (out.name === this.cfg.midiOutput) {
                        midi.setOutput(out)
                    }
                }
            }
            if (this.cfg.midiInput && this.cfg.midiInput !== '') {
                for (const input of  midi.getInputs()) {
                    if (input.name === this.cfg.midiInput) {
                        midi.setInput(input)
                    }
                }
            }
            this.device = newS56kDevice(midi, out)
            this.device.init()
            instrument = newMidiInstrument(midi, 1)
            await updateMidiDeviceSelect(
                midiOutputSelectRoot,
                async () => (await midi.getOutputs()).map((output) => output.name),
                async (name) => midi.isCurrentOutput(name),
                async (name) => {
                    await midi.setOutputByName(name)
                    this.cfg.midiOutput = name
                    await saveConfig(this.cfg)
                },
                'Midi Out: '
            )
            await updateMidiDeviceSelect(
                midiInputSelectRoot,
                async () => midi.getInputs().map((input) => input.name),
                async (name) => midi.isCurrentInput(name),
                async (name) => {
                    await midi.setInputByName(name)
                    this.cfg.midiInput = name
                    await saveConfig(this.cfg)
                },
                'Midi In: '
            )
        })

        const playButton = document.getElementById('play-button')
        playButton.onclick = () => {
            instrument.noteOn(60, 127)
        }

        const sysexButton = document.getElementById('sysex-button')
        sysexButton.onclick = async () => {
            const response = await this.device.ping()
            clientCommon.status(response.message)
        }
        const programCountButton = document.getElementById('program-count-button')
        programCountButton.onclick = async () => {
            const response = await this.device.getProgramCount()
            clientCommon.status(response.errors.length > 0 ? `Error: ${response.errors[0].message}` : `Program count: ${response.data}`)
        }


        let program = this.device.getCurrentProgram();
        const r: ProgramInfoResult = await program.getInfo();
        if (r.errors.length > 0) {
            programInfoRoot.render(<div>Yikes! Errors: {r.errors.map(e => e.message).join('; ')}</div>)
        } else {
            programInfoRoot.render(ProgramInfoView(r.data))
        }

        // const rOutput = await program.getOutput().getInfo()
        let programOutput = program.getOutput();
        programOutputRoot.render(await ProgramOutputView(programOutput))
    }

}

async function saveConfig(cfg) {
    try {
        const result = await clientCommon.saveConfig(cfg)
        if (result.errors.length > 0) {
            out.log(`Error saving config: ${result.errors}`)
        } else {
            out.log(`Done saving config.`)
        }
    } catch (err) {
        out.log(`Barfed trying to save config: ${err.message}`)
        clientCommon.status(err.message)
    }
}

async function updateMidiDeviceSelect(root: Root, getNames: Function, isCurrent: Function, selected: Function, label: string = 'Midi Out: ') {
    out.log(`Updating midi device select...`)
    const specs = []
    for (const name of (await getNames())) {
        out.log(`Creating spec for device: ${name}`)
        specs.push({
            name: name,
            isActive: await isCurrent(name),
            action: async () => {
                clientCommon.status(`You chose ${name}`)
                await selected(name)
                out.log(`Updating midi device select..`)
                await updateMidiDeviceSelect(root, getNames, isCurrent, selected, label)
                out.log(`Done updating midi device select.`)
            }
        } as MidiDeviceSpec)
    }
    out.log(`Specs: ${JSON.stringify(specs)}`)
    root.render(MidiDeviceSelect(specs, label))
}

const c56k = new ClientS56k()
c56k.init()
    .then(() => clientCommon.status(`Initialized.`))
    .catch(err => {
        clientCommon.status(`error: ${err.message}`)
        out.error(err)
    })

