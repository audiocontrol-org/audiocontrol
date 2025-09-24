import React from "react";
import {Box} from 'ink'
import {MidiSelect} from '@/cli/components/midi-select.js'

export function StartScreen({
                                defaultMidiInput,
                                defaultMidiOutput,
                                midiInput,
                                midiOutput,
                                updateMidiInput,
                                updateMidiOutput
                            }) {
    return (
        <Box flexDirection="column" gap={1} width="100%">
            <Box width="100%" justifyContent="space-around">
                <MidiSelect label="MIDI Input" defaultValue={defaultMidiInput} midiHandle={midiInput}
                            onChange={(v) => updateMidiInput(v)}/>
                <MidiSelect label="MIDI Output" defaultValue={defaultMidiOutput} midiHandle={midiOutput}
                            onChange={(v) => updateMidiOutput(v)}/>
            </Box>
        </Box>)
}