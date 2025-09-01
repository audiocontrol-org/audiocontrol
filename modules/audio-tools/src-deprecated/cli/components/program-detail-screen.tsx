import {Program} from "@/midi/devices/s3000xl.js";
import React from "react";
import {Box} from 'ink'
import {DataField} from "@/cli/components/data-field.js";

import {CliApp} from "@/cli/cli-app.js";

export function ProgramDetailScreen({app, program}: { app: CliApp, program: Program }) {

    return (
        <Box justifyContent="flex-start" flexDirection="column" width={32}>
            <DataField app={app}
                       label="Program Name"
                       defaultValue={program.getProgramName().trim()}
                       onChange={(v) => {
                           program.setProgramName(String(v))
                           app.saveProgram(program).then()
                           return program.getProgramName()
                       }}/>
            <DataField app={app}
                       label="Program Number"
                       defaultValue={String(program.getProgramNumber())}
                       onChange={(v) => {
                           program.setProgramNumber(Number.parseInt(String(v)))
                           app.saveProgram(program).then()
                           return program.getProgramNumber()
                       }}
            />
        </Box>)
}

