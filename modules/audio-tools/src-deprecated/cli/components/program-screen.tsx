import React from "react";
import {Box} from 'ink'
import {Select} from '@inkjs/ui'

export function ProgramScreen({nextScreen, names}: { nextScreen: (string) => void, names: string[] }) {
    const options = names.map((programName) => {
        return {label: programName, value: programName}
    })
    return (
        <Box>
            <Select options={options} onChange={(v) => {
                nextScreen(v)
            }}/>
        </Box>
    )
}

