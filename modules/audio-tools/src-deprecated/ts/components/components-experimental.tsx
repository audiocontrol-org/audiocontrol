import React from "react";
import {ProgramInfo, ProgramOutput} from "../midi/device";
let sequence = 0

export interface MidiDeviceSpec {
    name: string
    isActive: boolean
    action: () => void
}

function uid() {
    return sequence++ + '-' + Math.random().toString(16).slice(2)
}

export async function ProgramOutputView(data: ProgramOutput) {
    const props = []
    props.push({
        label: "Loudness",
        min: 0,
        max: 100,
        value: async () => (await data.getLoudness()).data,

    })

    const items = props.map(prop => {
        return (
            <li className={'list-group-item'} key={prop.label}>
                <div className={'row'}>
                    <div className={'col'}>{prop.label}</div>
                    <div className={'col'}>
                        <sl-range value={prop.value} min={prop.min} max={prop.max} onSlInput={event => console.log(`I've changed: ${event} !!!!`)}></sl-range>
                    </div>
                </div>
            </li>)
    })
    return (
        <div className={'card h-100'}>
            <div className={'card-header fw-bold'}>Program Output</div>
            <ul className={'list-group list-group-flush overflow-scroll h-100'}>
                {items}
            </ul>
        </div>
    )
}

export function ProgramInfoView(data: ProgramInfo) {
    const items = []
    for (const name of Object.getOwnPropertyNames(data).sort()) {
        items.push(<li className={'list-group-item'} key={name}>
            <div className={'row'}>
                <div className={'col'}><span className={'fw-bold'}>{name}</span></div>
                <div className={'col'}>{data[name]}</div>
            </div>
        </li>)
    }
    return (
        <div className={'card'}>
            <div className={'card-header fw-bold'}>Program Info</div>
            <ul className={'list-group list-group-flush'}>
                {items}
            </ul>
        </div>)
}

export function MidiDeviceSelect(specs: MidiDeviceSpec[], label: string) {
    let current = ''
    const target = `midi-device-view-${uid()}`
    const items = specs.map((spec) => {
        const classes = ['dropdown-item']
        if (spec.isActive) {
            classes.push('active')
            current = spec.name
        }

        return (<li key={spec.name + '-' + target}>
            <a className={classes.join(' ')}
               href={'#'}
               onClick={spec.action}
               data-bs-toggle="dropdown"
               data-bs-target={target}>{spec.name}</a></li>)
    })
    return (<div>
        <button className="btn btn-primary dropdown-toggle" type="button"
                data-bs-toggle="dropdown"
                data-bs-target={'#' + target}><span className={'fw-bold'}>{label}</span>{current}</button>
        <ul id={target} className={'dropdown-menu'}>{items}</ul>
    </div>)
}
