import {TextField} from "@mui/material";
import React, {useState} from "react";

export default function NumberInput({label, defaultValue, min, max, onChange, className = ''}:
                                        { label: string, min: number, max: number, onChange: (number) => void }) {
    const id = React.useId()
    const [value, setValue] = useState<number>(defaultValue)
    return (
        <TextField
            className={className}
            id={id}
            type="number"
            label={label}
            value={value}
            onChange={e => {
                if (e.target.value === '') {
                    e.target.value = String(min)
                }
                const v = parseInt(e.target.value)
                if (isNaN(v) || v < min || v > max) {
                    e.target.value = String(value)
                } else {
                    setValue(v)
                    onChange(v)
                }
            }}
        />)
}