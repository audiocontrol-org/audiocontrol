import React from "react";
import {Box, Text, useFocus, useInput} from 'ink'

export function Button(props) {
    const {isFocused} = useFocus()
    useInput((input, key) => {
        if (props.onClick && isFocused && key.return) {
            props.onClick()
        }
    })
    let border: string | undefined = 'single'
    let padding = 1

    if (props.variant && props.variant === 'plain') {
        border = undefined
        padding = 0
    }
    return (<Box borderStyle={border} paddingLeft={padding}
                 paddingRight={padding}><Text inverse={isFocused}>{props.children}</Text></Box>)
}