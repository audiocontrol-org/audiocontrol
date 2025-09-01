import FormControl from "@mui/material/FormControl";
import {Box, FormLabel, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Typography} from "@mui/material";
import {useState} from "react";
import {FX_TYPES, Jv1080, Jv1080Event} from "@/midi/roland-jv-1080";
import {Knob} from "@/components/knob";
import Divider from "@mui/material/Divider";
import {DoubleThrowSwitch, LabeledBorder, SelectControl} from "@/components/components-core";

export function FxSelect({device, onSubmit, defaultValue}: {
    device: Jv1080,
    onSubmit: (n: number) => void,
    defaultValue: number
}) {
    const [value, setValue] = useState(defaultValue + "")
    device.subscribe(Jv1080Event.FxType, (v) => setValue(v + ""))
    return (
        <FormControl>
            <InputLabel>Fx Select</InputLabel>
            <Select label="Fx Select" value={value} onChange={(e: SelectChangeEvent<string>) => {
                const v = Number.parseInt(e.target.value)
                setValue(e.target.value)
                onSubmit(v)
            }}>
                {FX_TYPES.map((v, i) => (<MenuItem key={'fx-select-' + i} value={i}>{v}</MenuItem>))}
            </Select>
        </FormControl>)
}

export function FxPanel({device}: { device: Jv1080 }) {
    const [fx, setFx] = useState(7)
    return (
        <Box className="flex flex-col gap-10 w-full">
            <FxSelect device={device} defaultValue={fx}
                      onSubmit={(v) => {
                          device.setFx(v)
                          setFx(v)
                      }}/>
            {getFxPanel(device, fx)}
        </Box>)
}


function getFxPanel(device: Jv1080, fxIndex: number) {
    switch (fxIndex) {
        case 0:
            return (<StereoEqPanel device={device}/>)
        case 1:
            return (<OverdriveDistortion device={device}/>)
        case 2:
            return (<OverdriveDistortion device={device}/>)
        case 3:
            return (<Phaser device={device}/>)
        case 4:
            return (<Spectrum device={device}/>)
        case 5:
            return (<Enhancer device={device}/>)
        case 6:
            return (<AutoWah device={device}/>)
        case 7:
            return (<Rotary device={device}/>)
        default:
            return (<div>Unsupported effect: {fxIndex}</div>)
    }
}

export function Rotary({device}: { device: Jv1080 }) {
    return (
        <div className={"flex gap-10"}>
            <ControlSection label="Control">
                <div className="flex gap-2">
                    <ControlKnob
                        dataSource={{ subscribe}}
                        onChange={v => device.setFxParam(1, v)} label="Lo Slow"
                        value={device.getFxParameter(0)} min={0} max={125}/>
                    <ControlKnob onChange={v => device.setFxParam(3, v)} label="Lo Fast" min={0} max={125}/>
                    <ControlKnob onChange={v => device.setFxParam(6, v)} label="Lo Accl" min={0} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(0, v)} label="Hi Slow" min={0} max={125}/>
                    <ControlKnob onChange={v => device.setFxParam(2, v)} label="Hi Fast" min={0} max={125}/>
                    <ControlKnob onChange={v => device.setFxParam(5, v)} label="Hi Accl" min={0} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(7, v)} label="Hi Lvl" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(9, v)} label="Sep" min={0} max={127}/>
                    <DoubleThrowSwitch aLabel="Slow" bLabel="Fast" onChange={v => device.setFxParam(4, v)}/>
                    <ControlKnob onChange={v => device.setFxParam(10, v)} label="Level" min={0} max={127}/>
                </div>
            </ControlSection>
        </div>)
}

export function AutoWah({device}) {
    return (
        <div className={"flex gap-10"}>
            <ControlSection label="Control">
                <div className="flex gap-2">
                    <DoubleThrowSwitch aLabel="LPF" bLabel="BPF" onChange={v => device.setFxParam(0, v)}/>
                    <ControlKnob onChange={v => device.setFxParam(3, v)} label="Sens" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(4, v)} label="Manual" min={0} max={127}
                                 defaultValue={64}/>
                    <ControlKnob onChange={v => device.setFxParam(5, v)} label="Peak" min={0} max={127}
                                 defaultValue={100}/>
                    <ControlKnob onChange={v => device.setFxParam(1, v)} label="Rate" min={0} max={125}/>
                    <ControlKnob onChange={v => device.setFxParam(2, v)} label="Depth" min={0} max={127}
                                 defaultValue={64}/>
                    <ControlKnob onChange={v => device.setFxParam(6, v)} label="Level" min={0} max={127}
                                 defaultValue={64}/>
                </div>
            </ControlSection>
        </div>)
}

export function Enhancer({device}) {
    return (
        <div className="flex gap-10">
            <ControlSection label="Controls">
                <div className="flex gap-2">
                    <ControlKnob onChange={v => device.setFxParam(0, v)} label="Sens" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(1, v)} label="Mix" min={0} max={127}
                                 defaultValue={64}/>
                    <ControlKnob onChange={v => device.setFxParam(2, v + 15)} label="Lo Gain" min={-15} max={15}
                                 defaultValue={0}/>
                    <ControlKnob onChange={v => device.setFxParam(3, v + 15)} label="Hi Gain" min={-15} max={15}
                                 defaultValue={0}/>
                    <ControlKnob onChange={v => device.setFxParam(4, v)} label="Level" min={0} max={127}
                                 defaultValue={127}/>
                </div>
            </ControlSection>
        </div>)
}

export function Spectrum({device}) {
    return (
        <div className="flex gap-10">
            <ControlSection label="Bands">
                <div className="flex gap-2">
                    <ControlKnob onChange={v => device.setFxParam(0, v + 15)} label="Band 1" min={-15} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(1, v + 15)} label="Band 2" min={-15} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(2, v + 15)} label="Band 3" min={-15} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(3, v + 15)} label="Band 4" min={-15} max={15}/>
                </div>
            </ControlSection>
        </div>)
}

export function Phaser({device}) {
    return (
        <div className="flex gap-10">
            <ControlSection label="Color">
                <div className="flex gap-2">
                    <ControlKnob onChange={v => device.setFxParam(0, v)} label="Manual" min={0} max={127} step={1}/>
                    <ControlKnob onChange={v => device.setFxParam(1, v)} label="Rate" min={0} max={127} step={1}/>
                    <ControlKnob onChange={v => device.setFxParam(2, v)} label="Depth" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(3, v)} label="Res" min={0} max={127}/>
                </div>
            </ControlSection>
            <ControlSection label="Mixer">
                <div className="flex gap-2">
                    <ControlKnob onChange={v => device.setFxParam(4, v)} label="Mix" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(5, v)} label="Pan" min={0} max={127}/>
                    <ControlKnob onChange={v => device.setFxParam(6, v)} label="Level" min={0} max={127}/>
                </div>
            </ControlSection>
        </div>)

}

export function OverdriveDistortion({device}) {
    return (
        <div className="flex gap-10">
            <ControlSection label="Color">
                <div className="flex gap-2">
                    <ControlKnob onChange={v => device.setFxParam(0, v)} label="Drive" min={0} max={127}/>
                    {/*<ControlKnob onChange={v => device.setFxParam(1, v)} label="Level" min={0} max={127}/>*/}
                    <ControlKnob onChange={v => device.setFxParam(3, v + 15)} label="Lo Gain"
                                 min={-15} max={15}/>
                    <ControlKnob onChange={v => device.setFxParam(4, v + 15)} label="Hi Gain" min={-15} max={15}/>
                </div>
            </ControlSection>
            <ControlSection label="Amp">
                <div className="flex justify-center content-center items-center gap-2">
                    <SelectControl label="Type" onSubmit={v => device.setFxParam(5, v)}
                                   defaultValue={0}
                                   items={['SMALL', 'BUILT-IN', '2-STACK', '3-STACK']}/>
                    <ControlKnob onChange={v => device.setFxParam(6, v + 63)} label="Pan" min={-63} max={64}/>
                </div>
            </ControlSection>
        </div>)
}

export function PeakEq({device, paramIndexOffset = 0, spacing = 2}) {
    return (
        <Stack spacing={spacing}>
            <ControlKnob label="Gain" min={-15} max={15}
                         onChange={v => device.setFxParam(6 + paramIndexOffset * 3, v + 15)}/>
            <ControlKnob label="Q" min={0} max={4}
                         marks={[
                             {label: '0.5', value: 0},
                             {label: '1.0', value: 1},
                             {label: '2.0', value: 2},
                             {label: '4.0', value: 3},
                             {label: '9.0', value: 4}
                         ]}
                         onChange={v => device.setFxParam(5 + paramIndexOffset * 3, v)}/>
            <ControlKnob label="Freq" min={0} max={16}
                         marks={[
                             {label: 200, value: 0},
                             {label: 250, value: 1},
                             {label: 315, value: 2},
                             {label: 400, value: 3},
                             {label: 500, value: 4},
                             {label: 630, value: 5},
                             {label: 800, value: 6},
                             {label: 1000, value: 7},
                             {label: 1250, value: 8},
                             {label: 1600, value: 9},
                             {label: 2000, value: 10},
                             {label: 2500, value: 11},
                             {label: 3150, value: 12},
                             {label: 4000, value: 13},
                             {label: 5000, value: 14},
                             {label: 6300, value: 15},
                             {label: 8000, value: 16}
                         ]}
                         onChange={v => device.setFxParam(4 + paramIndexOffset * 3, v)}/>
        </Stack>)
}

export function StereoEqPanel({device, color = "#777"}: { device: Jv1080, color?: string }) {
    const stackSpacing = 2
    return (
        <div className="flex gap-10">
            <ControlSection label="Hi & Lo Shelf">
                <Stack spacing={stackSpacing}>

                    {/*FX Param 3*/}
                    <ControlKnob color={color} label="Hi Gain" min={-15} max={15}
                                 onChange={v => device.setFxParam(3, v + 15)}/>
                    {/* FX Param 2*/}
                    <DoubleThrowSwitch aLabel="4KHz" bLabel="8KHz"
                                       onChange={(v) => device.setFxParam(2, v)}/>
                    <Divider/>
                    <ControlKnob label="Lo Gain" min={-15} max={15} step={1}
                                 onChange={v => device.setFxParam(1, v + 15)}/>
                    <DoubleThrowSwitch aLabel="200Hz" bLabel="400Hz"
                                       onChange={(v) => device.setFxParam(0, v)}/>
                </Stack>
            </ControlSection>
            <ControlSection label="Mid Peak">
                <div className="flex gap-5">
                    <PeakEq device={device} paramIndexOffset={0} spacing={stackSpacing}/>
                    <PeakEq device={device} paramIndexOffset={1} spacing={stackSpacing}/>
                </div>
            </ControlSection>

        </div>)
}

export function ControlSection({label = "", children}) {
    return (<LabeledBorder label={label}>{children}</LabeledBorder>)
}

function ControlKnob({
                         dataSource,
                         onChange,
                         label,
                         min,
                         max,
                         defaultValue = 0,
                         step = 1,
                         marks = [],
                         color = "#777777"
                     }: {
    dataSource: {
        subscribe: (onStoreChange: () => void) => () => void,
        getSnapshot: () => number,
        getServerSnapshot: () => number
    }
    onChange: (v: number) => void,
    label: string,
    value: number
    min: number,
    max: number,
    defaultValue?: number,
    step?: number,
    marks?: { label: string | number, value: number }[],
    color?: string
}) {
    const [value, setValue] = useState(defaultValue)
    const mark = marks.filter(i => i.value === value)
    return (
        <FormControl>
            <div className="flex flex-col items-center">
                <FormLabel>{label}</FormLabel>
                <Knob
                    backgroundColor={color}
                    onChange={(v) => {
                        onChange(v)
                        setValue(v)
                    }}
                    min={min}
                    max={max}
                    defaultValue={defaultValue}
                    step={step}></Knob>
                <Typography sx={{color: color}}>{mark.length > 0 ? mark[0].label : value}</Typography>
            </div>
        </FormControl>)
}