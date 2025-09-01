import React from 'react'
import {useStdout} from 'ink'
import {FileChooser} from "@/cli/components/file-chooser.js";
import {CliApp} from "@/cli/cli-app.js";

export function ChopScreen({app, defaultDirectory}:{app: CliApp, defaultDirectory: string}) {
    const {stdout} = useStdout()
    console.log(`Opening file chooser: ${defaultDirectory}`)
    return <FileChooser defaultDirectory={defaultDirectory} maxHeight={stdout.rows - 5} onSubmit={v => {
        app.doChopDetail(v)
    }}/>
}