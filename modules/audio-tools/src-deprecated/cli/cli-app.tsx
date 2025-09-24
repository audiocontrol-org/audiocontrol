import React from "react"
import {Box, Text} from "ink"
import midi from "midi"
import {ProcessOutput} from "@/lib/process-output.js";
import {Program, Sample} from "@/midi/devices/s3000xl.js";
import {ProgramScreen} from "@/cli/components/program-screen.js";
import {ProgramDetailScreen} from "@/cli/components/program-detail-screen.js";
import {SampleScreen} from "@/cli/components/sample-screen.js";
import {SampleDetailScreen} from "@/cli/components/sample-detail-screen.js";
import {ChopDetailScreen} from "@/cli/components/chop-detail-screen.js";
import {Device} from "@/midi/akai-s3000xl.js";
import {StartScreen} from "@/cli/components/start-screen.js";
import {ClientConfig} from "@/lib/config-client.js";
import {saveClientConfig, ServerConfig} from "@/lib/config-server.js";
import {FormatScreen} from "@/cli/components/format-screen.js";
import {ExecutionResult} from "@/akaitools/akaitools.js";
import {ChopScreen} from "@/cli/components/chop-screen.js";


function openMidiPort(midiHandle: midi.Input | midi.Output, name: string) {
    for (let i = 0; i < midiHandle.getPortCount(); i++) {
        const portName = midiHandle.getPortName(i)
        if (portName === name) {
            midiHandle.closePort()
            midiHandle.openPort(i)
            return true
        }
    }
    return false
}


export function updateMidiInput(config: ClientConfig, midiInput: midi.Input, v: string) {
    if (openMidiPort(midiInput, v)) {
        config.midiInput = v
        saveClientConfig(config).then()
    }
}

export function updateMidiOutput(config: ClientConfig, midiOutput: midi.Output, v: string) {
    if (openMidiPort(midiOutput, v)) {
        config.midiOutput = v
        saveClientConfig(config).then()
    }
}


export interface CliApp {

    out: ProcessOutput

    doConfig()

    doFormat(): void

    getDefaults(): Defaults

    saveDefaults(d: Defaults): Promise<Defaults>

    addListener(event: string, callback: Function): void

    setScreen(screen): void

    setIsEditing(b: boolean): void

    getIsEditing(): boolean

    doProgram(): void

    doProgramDetail(programNumber: number): void;

    saveProgram(program: Program): Promise<void>;

    doSample(): void

    doSampleDetail(sampleName): void

    doChop(): void;

    doChopDetail(samplepath): void;

    saveSample(sample: Sample): Promise<void>;

    chopSample(samplePath: string, chopLength: number, totalChops: number): Promise<ExecutionResult>
}

export interface Defaults {
    beatsPerChop: number
    bpm: number
}


class BasicApp implements CliApp {
    private readonly listeners: Function[] = []
    private readonly defaults: Defaults = {beatsPerChop: 1, bpm: 90}
    private readonly device: Device;
    private readonly config: ClientConfig;
    private readonly serverConfig: ServerConfig;

    private isEditing: boolean;

    readonly out: ProcessOutput

    constructor(config: ClientConfig, serverConfig: ServerConfig, device: Device, out: ProcessOutput) {
        this.config = config
        this.serverConfig = serverConfig
        this.device = device
        this.out = out
    }

    chopSample(samplePath: string, chopLength: number, totalChops: number): Promise<ExecutionResult> {
        return Promise.resolve({code: 0, errors: []})
    }

    setIsEditing(b: boolean): void {
        this.isEditing = b
    }

    getIsEditing() {
        return this.isEditing
    }

    getDefaults(): Defaults {
        return this.defaults
    }

    async saveDefaults(d: Defaults): Promise<Defaults> {
        return this.defaults
    }

    setScreen(element) {
        this.listeners.forEach(callback => callback(element))
    }

    addListener(event: string, callback: Function) {
        this.listeners.push(callback)
    }

    async saveProgram(p: Program) {
        const out = this.out
        try {
            await p.save()
            out.log(`Program saved.`)
        } catch (e) {
            out.log(`Error saving program: ${e}`)
        }
    }

    async saveSample(s: Sample) {
        const out = this.out
        try {
            await s.save()
            out.log(`Sample saved.`)
        } catch (e) {
            out.log(`Error saving sample: ${s}`)
        }
    }

    doProgram() {
        const device = this.device
        const app = this
        this.setScreen(<ProgramScreen nextScreen={(v) => {
            app.doProgramDetail(v)
        }} names={device.getProgramNames([])}/>)
    }

    doProgramDetail(programNumber: number): void {
        const app = this
        this.device.getProgram(programNumber).then(program => this.setScreen(<ProgramDetailScreen app={app}
                                                                                                  program={program}/>))
    }

    doSample() {
        const app = this
        const device = this.device
        this.setScreen(<SampleScreen nextScreen={(v) => {
            app.doSampleDetail(v)
        }} names={device.getSampleNames([])}/>)
    }

    doSampleDetail(sampleName): void {
        const app = this
        this.device.getSample(sampleName).then(sample => this.setScreen(<SampleDetailScreen app={app}
                                                                                            sample={sample}/>))
    }

    doChop() {
        this.setScreen(<ChopScreen app={this} defaultDirectory={this.serverConfig.sourceRoot}/>)
    }

    doChopDetail(samplepath): void {
        this.setScreen(<ChopDetailScreen app={this} samplepath={samplepath}/>)
    }

    doConfig() {
    }

    doFormat() {
    }
}


export function newFileApp(config: ClientConfig, serverConfig: ServerConfig, device: Device, out: ProcessOutput, diskFilePath: string) {
    const rv = new BasicApp(config, serverConfig, device, out)
    rv.doConfig = () => {
        rv.setScreen(<Box gap={3}><Text>Hi. Let's do some config!</Text><Text>Disk file
            path: {diskFilePath}</Text></Box>)
    }

    rv.doFormat = async () => {
        rv.setScreen(<FormatScreen device={device} diskFile={diskFilePath}/>)
    }

    // rv.chopSample = async (samplePath, chopLength, totalChops) => {
    //
    // }

    return rv
}

export function newMidiApp(config: ClientConfig, serverConfig: ServerConfig, device: Device, out: ProcessOutput, midiInput: midi.Input, midiOutput: midi.Output) {
    const rv = new BasicApp(config, serverConfig, device, out)
    rv.doConfig = () => {
        rv.setScreen(<StartScreen defaultMidiInput={config.midiInput}
                                  defaultMidiOutput={config.midiOutput}
                                  midiInput={midiInput}
                                  midiOutput={midiOutput}
                                  updateMidiInput={(v) => updateMidiInput(config, midiInput, v)}
                                  updateMidiOutput={(v) => updateMidiOutput(config, midiOutput, v)}
        />)
    }
    return rv
}
