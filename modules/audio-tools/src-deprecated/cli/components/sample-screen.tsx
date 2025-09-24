import React from "react";
import {Box} from "ink"
import {Select} from "@inkjs/ui"

export function SampleScreen({nextScreen, names}: { nextScreen: (string) => void, names: string[] }) {
    const options = names.map((sampleName) => {
        return {label: sampleName, value: sampleName}
    })
    return (
        <Box>
            <Select options={options} onChange={v => nextScreen(v)}/>
        </Box>
    )
}