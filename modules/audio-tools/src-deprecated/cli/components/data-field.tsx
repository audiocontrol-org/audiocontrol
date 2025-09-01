import React, {useState} from "react";
import {Box, Text, useFocus, useFocusManager, useInput} from 'ink'
import {TextInput} from '@inkjs/ui'
import {Button} from "@/cli/components/button.js";
import {CliApp} from "@/cli/cli-app.js";

export function DataDisplay({label, value}: { label: string, value: any }) {
    return (<Box justifyContent="space-between"><Text>{label}</Text><Text>{String(value)}</Text></Box>)
}

export function DataField(
    {defaultValue, label, app, onChange}: {
        defaultValue?: string
        label: string
        editable?: boolean
        app?: CliApp
        onChange?: (v: string) => string
    }) {
    const [value, setValue] = useState<string>(defaultValue)
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const {focusNext} = useFocusManager()
    const {isFocused} = useFocus()

    function toggleEditing(b = !isEditing) {
        app?.setIsEditing(b)
        setIsEditing(b)
    }

    useInput((value, key) => {
        if (key.escape) {
            toggleEditing(false)
        }
    })

    return (
        <Box justifyContent="space-between">
            <Text>{label}</Text>
            {
                isEditing ?
                    <TextInput isDisabled={!isFocused}
                               defaultValue={value}
                               onBlur={() => toggleEditing()}
                               onSubmit={(v) => {
                                   toggleEditing()
                                   const newValue = onChange(v)
                                   setValue(newValue)
                               }}/>
                    : <Button variant="plain"
                              onClick={() => {
                                  toggleEditing()
                                  focusNext()
                              }
                              }>{value}</Button>
            }
        </Box>)
}
