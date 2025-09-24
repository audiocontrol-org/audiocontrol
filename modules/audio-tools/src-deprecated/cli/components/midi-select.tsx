import midi from "midi";
import React from "react";
import {Box, Text, useFocus} from 'ink'
import {Select} from '@inkjs/ui'

export function MidiSelect({defaultValue, midiHandle, label, onChange}: {
    defaultValue: string,
    midiHandle: midi.Input | midi.Output,
    label: string,
    onChange: (string) => void
}) {
    const {isFocused} = useFocus();
    const options = []
    for (let i = 0; i < midiHandle.getPortCount(); i++) {
        options.push({label: midiHandle.getPortName(i), value: midiHandle.getPortName(i)})
    }
    return (<Box gap={2}>
        <Text>{label + (isFocused ? ` (focused)` : ` (blurred)`)}</Text>
        <Select defaultValue={defaultValue} isDisabled={!isFocused} onChange={onChange} options={options}/>
    </Box>)
}