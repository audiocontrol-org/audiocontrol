import React, {useEffect, useState} from "react"
import {Box, Text, useFocus, useFocusManager, useStdin} from "ink"
import {Select} from '@inkjs/ui'
import fs from "fs/promises";
import path from "path";

export function FileChooser({defaultDirectory, onSubmit, maxHeight}: {
    defaultDirectory: string,
    onSubmit: (v: string) => void,
    maxHeight: number
}) {
    const [dir, setDir] = useState<string>(defaultDirectory)
    const [files, setFiles] = useState<any>([])
    const {focus} = useFocusManager()
    const {isFocused} = useFocus()
    const {stdin} = useStdin()
    const selectId = 'select-id'
    useEffect(() => {
        fs.readdir(dir).then(async list => {
            let id = 0
            const f = [{
                label: '../',
                value: path.join('D' + dir, '..')

            }]
            for (const filename of list) {
                if (filename.startsWith('.DS_Store')) {
                    continue
                }
                id++
                const file = path.join(dir, filename)
                const s = await fs.stat(file)
                f.push({
                    label: filename + (s.isDirectory() ? "/" : ""),
                    value: `${s.isDirectory() ? 'D' : 'F'}${file}`
                })
            }

            setFiles(f)
            focus(selectId)
        })
    }, [dir])
    return (
        <Box flexDirection="column" width="100%">
            <Text>{dir}:</Text>
            <Text> </Text>
            <Select visibleOptionCount={maxHeight - 3} id={selectId} options={files} isDisabled={!isFocused}
                    onChange={v => {
                        console.log(`Changed: ${v}`)

                        let s = v.substring(1);
                        if (v.startsWith('D')) {
                            console.log(`change dir: ${s}`)
                            setDir(s)
                        } else {
                            console.log(`Select file: ${s}`)
                            onSubmit(s)
                        }
                    }}/>
            <Text>-----</Text>
        </Box>
    )
}