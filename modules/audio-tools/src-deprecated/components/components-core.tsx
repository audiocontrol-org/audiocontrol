import {Box, InputLabel, MenuItem, Select, SelectChangeEvent, Switch, TextField} from "@mui/material";
import React, {useState} from "react";
import FormControl from "@mui/material/FormControl";

export function DoubleThrowSwitch({color = "#777", aLabel, bLabel, onChange = () => void 0}: {
    color?: string, aLabel: string, bLabel: string, onChange?: (v: number) => void
}) {
    return (
        <div className="flex justify-center content-center items-center" style={{color: color}}>
            <div>{aLabel}</div>
            <Switch onChange={(e) => {
                onChange(e.target.checked ? 1 : 0)
            }}/>
            <div>{bLabel}</div>
        </div>)
}

export function LabeledBorder({
                                  border = 2,
                                  borderRadius = 1,
                                  label = "",
                                  textColor = "#999",
                                  color = "#ddd",
                                  children
                              }) {
    return (
        <Box
            border={border}
            borderColor={color}
            borderRadius={borderRadius}
            p={2}
            position="relative"
        >
            <Box
                position="absolute"
                top={-14}
                left={10}
                bgcolor="white"
                px={1}
            >
                <span style={{color: textColor}}>{label}</span>
            </Box>
            {children}
        </Box>
    )
}
export default function IntField({
                             onSubmit,
                             label = "",
                             defaultValue = 0,
                             min = Number.MIN_SAFE_INTEGER,
                             max = Number.MAX_SAFE_INTEGER
                         }: {
    onSubmit: (n: number) => void,
    label: string,
    defaultValue: number,
    min: number,
    max: number
}) {
    const [value, setValue] = useState<string>(defaultValue.toString())
    const [submitted, setSubmitted] = useState<string>(value)

    function rectify(v: string) {
        const n = Number.parseInt(v)
        return ((!isNaN(n)) && n <= max && n >= min) ? n.toString() : submitted
    }

    return (<form onSubmit={(e) => {
        e.preventDefault()
        const r = rectify(e.target[0].value)
        setValue(r)
        onSubmit(Number.parseInt(r))
        setSubmitted(r)
    }}><TextField label={label} value={value} onChange={(e) => setValue(e.target.value)}/></form>)

}

export function FixedLengthTextField({label, defaultValue, length = 100, onSubmit}: {
    label: string,
    defaultValue: string,
    length: number,
    onSubmit: (name: string) => void
}) {
    const [value, setValue] = useState<string>(defaultValue)

    function rectify(v: string, length) {
        const chars = new Array(length)
        for (let i = 0; i < length; i++) {
            chars[i] = i < v.length ? v.charAt(i) : ' '
        }
        return chars.join('')
    }

    return (<form onSubmit={(e) => {
        e.preventDefault()
        const r = rectify(e.target[0].value, length)
        setValue(r)
        onSubmit(r)
    }}><TextField label={label} value={value} onChange={e => setValue(e.target.value)}/></form>)
}

export function SelectControl({label, onSubmit, defaultValue, items}: {
    label: string,
    onSubmit: (v: number) => void,
    defaultValue: number,
    items: string[]
}) {
    const [value, setValue] = useState(defaultValue + "")
    return (
        <FormControl>
            <InputLabel>{label}</InputLabel>
            <Select label={label} value={value} onChange={(e: SelectChangeEvent<string>) => {
                const v = Number.parseInt(e.target.value)
                setValue(e.target.value)
                onSubmit(v)
            }}>
                {items.map((v, i) => (<MenuItem key={label + i} value={i}>{v}</MenuItem>))}
            </Select>
        </FormControl>)
}