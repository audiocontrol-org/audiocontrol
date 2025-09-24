import {Input, InputEventMap, Output, WebMidi} from "webmidi"
import {newClientOutput, ProcessOutput} from "@/lib/process-output";

export class Midi {
    private output: Output;
    private input: Input;
    private listeners = []
    private out: ProcessOutput;

    constructor() {
        this.out = newClientOutput(false)
    }

    async start(onEnabled = () => {
    }) {
        try {
            await WebMidi.enable({sysex: true})

            if (WebMidi.outputs && WebMidi.outputs.length > 0) {
                this.output = WebMidi.outputs[0]
            }
            if (WebMidi.inputs && WebMidi.inputs.length > 0) {
                this.input = WebMidi.inputs[0]
            }
            await onEnabled()
        } catch (err) {
            console.error(err)
            await WebMidi.disable()
        }
    }

    setOutput(output: Output) {
        this.out.log(` setOutput(): ${output.name}`)
        this.output = output
    }

    setInput(input: Input) {
        if (this.input) {
            // removed listeners from the previous input
            for (const spec of this.listeners) {
                this.input.removeListener(spec.eventName, spec.eventListener)
            }
        }
        if (input) {
            // attach listeners to the current input
            for (const spec of this.listeners) {
                input.addListener(spec.eventName, spec.eventListener)
            }
        }
        this.input = input
    }

    getOutputs() {
        return WebMidi.outputs
    }

    getInputs() {
        return WebMidi.inputs
    }

    getCurrentOutput() {
        return this.output
    }

    getCurrentInput() {
        return this.input
    }

    async stop(onDisabled: () => void = () => {
    }) {
        await WebMidi.disable()
        await onDisabled()
    }

    async getOutput(name: string) {
        let rv: Output | null = null
        await (this.getOutputs()).forEach(output => {
            if (output.name === name) {
                rv = output
            }
        })
        return rv
    }

    isCurrentOutput(name: string) {
        return this.output && this.output.name === name
    }

    isCurrentInput(name: string) {
        return this.input && this.input.name === name
    }

    setOutputByName(name) {
        const selected = this.getOutputs().filter(output => output.name === name)
        if (selected.length == 1) {
            this.setOutput(selected[0])
        }
        return this.output
    }

    // XXX: Refactor to generalize setting output & input by name in a single function
    setInputByName(name) {
        const selected = this.getInputs().filter(input => input.name === name)
        if (selected.length == 1) {
            // this.input = selected[0]
            this.setInput(selected[0])
        }
        return this.input
    }

    addListener(eventName: Symbol | keyof InputEventMap, eventListener: (event) => void) {
        this.out.log(`Adding midi listener: ${eventName} to ${this.input.name}`)
        this.listeners.push({eventName: eventName, eventListener: eventListener})
        return this.input.addListener(eventName, eventListener)
    }

    sendSysex(identifier: number | number[], data: number[]): Midi {
        this.out.log(`Sending sysex to ${this.output.name}`)
        this.output.sendSysex(identifier, data)
        return this
    }

    removeListener(eventName: Symbol | keyof InputEventMap, eventListener: (event) => void) {
        this.input.removeListener(eventName, eventListener)
        this.listeners = this.listeners.filter(value => value.eventName !== eventName && value.eventListener !== eventListener)
    }

    noteOn(channels: number | number[], note: number, velocity: number) {
        this.output.sendNoteOn(note, {channels: channels, rawAttack: velocity})
    }
}
