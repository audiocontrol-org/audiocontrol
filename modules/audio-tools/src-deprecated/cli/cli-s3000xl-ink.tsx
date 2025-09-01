import React, {useState} from 'react';
import {Box, render, useApp, useInput, useStdout} from 'ink';

import midi from "midi";
import {newDevice} from "@/midi/akai-s3000xl.js";
import {loadClientConfig, newServerConfig} from "@/lib/config-server.js";
import {newStreamOutput} from "@/lib/process-output.js";
import fs from "fs";
import {Program} from "@/midi/devices/s3000xl.js";
import {Button} from "@/cli/components/button.js";
import {ProgramDetailScreen} from "@/cli/components/program-detail-screen.js";
import {CliApp, newMidiApp, updateMidiInput, updateMidiOutput} from "@/cli/cli-app.js";

const serverConfig = await newServerConfig()
const logstream = fs.createWriteStream(serverConfig.logfile)
const out = newStreamOutput(logstream, logstream, true, 'cli-s3000xl-midi')
const config = await loadClientConfig()

const midiInput = new midi.Input()
midiInput.ignoreTypes(false, false, false)
const midiOutput = new midi.Output()


out.log(`startup`)
await updateMidiInput(config, midiInput, config.midiInput)
await updateMidiOutput(config, midiOutput, config.midiOutput)
const device = newDevice(midiInput, midiOutput, out)

const app: CliApp = newMidiApp(config, device, out, midiInput, midiOutput);

out.log(`Initializing device...`)
await device.init()
out.log(`Done initializing device.`)
let currentProgram = device.getCurrentProgram()
out.log(`Current program: ${currentProgram.getProgramName()}`)
out.log(`Rendering app...`)


export function Main({app, program}: { app: CliApp, program: Program }) {
    const {exit} = useApp();
    const [screen, setScreen] = useState(<ProgramDetailScreen app={app} program={program}/>)
    const {stdout} = useStdout()

    app.addListener('screen', (s) => {
        setScreen(s)
    })

    function quit() {
        shutdown(exit)
    }




    useInput((input: string) => {
        if (!app.getIsEditing()) {
            switch (input.toUpperCase()) {
                case 'C':
                    app.doChop()
                    break
                case ';':
                    app.doConfig()
                    break
                case 'P':
                    app.doProgram()
                    break
                case 'S':
                    app.doSample()
                    break
                case 'Q':
                    quit()
                    break
            }
        }
    })
    return (
        <>
            <Box borderStyle='single' padding='1' height={stdout.rows - 4}>{screen}</Box>
            <Box>
                <Button onClick={app.doChop}>C: Chop</Button>
                <Button onClick={app.doProgram}>P: Program</Button>
                <Button onClick={app.doSample}>S: Sample</Button>
                <Button onClick={app.doConfig}>;: Config</Button>
                <Button onClick={quit}>Q: Quit</Button>
            </Box>
        </>
    )
}





function shutdown(cb = () => {
}) {
    [midiInput, midiOutput].forEach(i => i.closePort())
    cb()
}


try {
    render(<Main
        app={app}
        program={currentProgram}/>)
} catch (e) {
    out.log(`Error rendering Main: ${e}`)
    shutdown()
}



