"use client"
import {Knob} from "@/components/knob"
import React, {useState} from "react"
import {Button, Stack} from "@mui/material"

import {DoubleThrowSwitch} from "@/components/components-core"
import {NumberField} from "@base-ui-components/react/number-field"
import styles from "./index.module.css"
import NumberInput from "@/components/number-input";
import FieldDisplay from "@/components/field-display";

export default function Page() {
    const mainColor = "#aaaaaa"
    const [value, setValue] = useState(1)
    const [thingy, setThingy] = useState(0)
    const id = React.useId()
    return (<div className="container pt-10 flex-column gap-4">
        <div className="flex">
            <div className="flex-column border-2">
                <div className="flex gap-4 w-full border-2">
                    <div className="grow">Label</div>
                    <div>Value</div>
                </div>
                <FieldDisplay label="Value" value={value}/>
                <FieldDisplay label="Thingy" value={thingy}/>
            </div>
            <div className="flex-column border-2">
                <div className="flex gap-4 w-full border-2">
                    <div className="grow">Label</div>
                    <div>Value</div>
                </div>
                <FieldDisplay label="Value" value={value}/>
                <FieldDisplay label="Thingy" value={thingy}/>
            </div>
        </div>
        <div className="flex gap-4">
            <NumberInput label="Number Input" value={value} min={1} max={100} onChange={(v) => setValue(v)}/>
            <NumberField.Root id={id} defaultValue={60} className={styles.Field}>
                <NumberField.ScrubArea className={styles.ScrubArea}>
                    <label htmlFor={id} className={styles.Label}>
                        Amount
                    </label>
                    <NumberField.ScrubAreaCursor className={styles.ScrubAreaCursor}>
                        <CursorGrowIcon/>
                    </NumberField.ScrubAreaCursor>
                </NumberField.ScrubArea>

                <NumberField.Group className={styles.Group}>
                    <NumberField.Decrement className={styles.Decrement}>
                        <MinusIcon/>
                    </NumberField.Decrement>
                    <NumberField.Input className={styles.Input}/>
                    <NumberField.Increment className={styles.Increment}>
                        <PlusIcon/>
                    </NumberField.Increment>
                </NumberField.Group>
            </NumberField.Root>
        </div>
        <div className="flex gap-5">
            <Stack className="flex flex-col items-center gap-5">
                <div style={{color: mainColor}}>{value}</div>
                <Button onClick={() => setValue(4)}>Set Value to 4</Button>
                {thingy ? <><Knob defaultValue={64} min={0} max={127}/>
                        <div>Thingy B</div>
                    </>
                    : <><Knob defaultValue={127} min={0} max={127}/>
                        <div>Thingy A</div>
                    </>}
                <DoubleThrowSwitch aLabel="A Label" bLabel="B Label"
                                   onChange={(v) => setThingy(v)}/>
            </Stack>
        </div>
    </div>)
}

function CursorGrowIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg
            width="26"
            height="14"
            viewBox="0 0 24 14"
            fill="black"
            stroke="white"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z"/>
        </svg>
    );
}

function PlusIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentcolor"
            strokeWidth="1.6"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path d="M0 5H5M10 5H5M5 5V0M5 5V10"/>
        </svg>
    );
}

function MinusIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentcolor"
            strokeWidth="1.6"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path d="M0 5H10"/>
        </svg>
    );
}