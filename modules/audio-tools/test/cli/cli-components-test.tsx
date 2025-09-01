import React from "react"
import {Box, Text, render, useApp, useInput, useStdout} from "ink"
import {Slider} from "@/cli/components/slider"
import {Button} from "@/cli/components/button"

render(<Main/>)

function Main() {
    const {exit} = useApp()
    const {stdout} = useStdout()
    useInput((input, key) => {
        switch (input.toUpperCase()) {
            case 'Q':
                exit()
                break
        }
    })
    return (
        <Box flexDirection="column">
            <Box borderStyle="single" padding='1' height={stdout.rows - 4}>
                <Slider defaultValue={50} min={0} max={100}/>
            </Box>
            <Box><Button onClick={exit}><Text>q: Quit</Text></Button></Box>
        </Box>)

}