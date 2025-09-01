import React, {useState} from "react"
import {Box, Text} from "ink"
import {Device} from "@/midi/akai-s3000xl.js"
import {DataField} from "@/cli/components/data-field.js";
import {Button} from "@/cli/components/button.js";

export function FormatScreen({device, diskFile}: { device: Device, diskFile: string }) {
    const [size, setSize] = useState<number>(1)
    const [count, setCount] = useState<number>(1)
    const [status, setStatus] = useState(<></>)
    function clearStatus() {
        setStatus(<></>)
    }
    return (
        <Box gap={1} flexDirection="column">
            <Text>Format disk: {diskFile}</Text>
            <DataField label="Partition Size" defaultValue={String(size)} onChange={v => {
                setSize(Number.parseInt(v))
                clearStatus()
                return String(size)
            }
            }/>
            <DataField label="Partition Count" defaultValue={String(count)} onChange={v => {
                setCount(Number.parseInt(v))
                clearStatus()
                return String(count)
            }}/>
            {status}
            <Box><Button onClick={() => {device.format(size, count).then(result => {
                if (result.errors.length > 0) {
                    setStatus(<Text>Yikes! {result.errors}</Text>)
                } else {
                    setStatus(<Text>Success!</Text>)
                }
            })}}>Do it!</Button></Box>
        </Box>)
}