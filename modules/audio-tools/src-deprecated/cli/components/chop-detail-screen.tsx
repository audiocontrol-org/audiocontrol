import {Sample, newSampleFromBuffer} from "@/model/sample.js";
import React, {useEffect, useState} from "react";
import {Box, Text} from "ink"
import {DataDisplay, DataField} from "@/cli/components/data-field.js";
import {CliApp} from "@/cli/cli-app.js";
import {Button} from "@mui/material";
import fs from "fs/promises";

export function ChopDetailScreen({app, samplepath}: { app: CliApp, samplepath: string }) {
    const [bpm, setBpm] = useState(app.getDefaults().bpm)
    const [beatsPerChop, setBeatsPerChop] = useState(app.getDefaults().beatsPerChop)
    const [sample, setSample] = useState<Sample>(null)
    let defaults = app.getDefaults()

    useEffect(() => {
        fs.readFile(samplepath).then(buf => setSample(newSampleFromBuffer(buf)))
    }, [sample])

    function getSamplesPerBeat() {
        return Math.round(sample?.getSampleRate() / (bpm / 60))
    }

    function getTotalChops() {
        return Math.round(sample?.getSampleCount() / (getSamplesPerBeat() * beatsPerChop))
    }

    return (
        <Box justifyContent="flex-start" flexDirection="column" width={32}>
            <Text>Chop Detail</Text>
            <DataDisplay label="Sample Rate" value={sample?.getSampleRate()}/>
            <DataDisplay label="Sample Length" value={sample?.getSampleCount()}/>
            <DataField app={app}
                       label="BPM"
                       defaultValue={String(bpm)}
                       onChange={(v) => {
                           const parsed = parseInt(String(v).trim())
                           setBpm(parsed)
                           defaults.bpm = bpm
                           app.saveDefaults(defaults).then(d => defaults = d)
                           return v
                       }}/>
            <DataField app={app}
                       label="Beats per Chop"
                       defaultValue={String(beatsPerChop)}
                       onChange={(v) => {
                           setBeatsPerChop(parseInt(String(v).trim()))
                           defaults.beatsPerChop = beatsPerChop
                           app.saveDefaults(defaults).then(d => defaults = d)
                           return v
                       }}/>
            <DataDisplay label="Samples per Beat" value={String(getSamplesPerBeat())}/>
            <DataDisplay label="Total Chops" value={String(getTotalChops())}/>
            {/*<Button onClick={app.chopSample(sample, getSamplesPerBeat() * beatsPerChop, getTotalChops())}>Do It</Button>*/}
        </Box>)
}