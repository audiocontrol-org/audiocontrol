/**
 * Components specific to the Akai S5000/S6000 sampler series
 */
import React, {useState} from "react";
import {
    ProgramInfoResult,
} from "@/midi/device";
import {SimpleSelect, Selectable, Option, ControlPanel, MutableSlider} from "./components-common";
import {Alert} from '@/components/chakra/alert'
import {Flex, Stack, Tabs} from '@chakra-ui/react'

import {MutableNumber, Result} from "@/lib/lib-core";
import {
    ProgramLfosInfo,
    ProgramLfosInfoResult,
    ProgramMidiTuneInfoResult,
    ProgramOutputInfoResult,
    ProgramPitchBendInfoResult
} from "@/midi/devices/devices";


interface ProgramData {
    info: Promise<ProgramInfoResult>
    output: Promise<ProgramOutputInfoResult>
    midiTune: Promise<ProgramMidiTuneInfoResult>
    pitchBend: Promise<ProgramPitchBendInfoResult>
    lfos: Promise<ProgramLfosInfoResult>
}

export interface MidiDeviceData {
    midiOutputs: Selectable
    midiInputs: Selectable
}

export interface AppData {
    midiDeviceData: Promise<MidiDeviceData>
    program: ProgramData
}


export function ProgramView({data}: { data: ProgramData }) {
    return (
        <Tabs.Root defaultValue={'lfos'}>
            <Tabs.List>
                <Tabs.Trigger value={'info'}>Program Info</Tabs.Trigger>
                <Tabs.Trigger value={'output'}>Output</Tabs.Trigger>
                <Tabs.Trigger value={'midi-tune'}>MIDI/Tune</Tabs.Trigger>
                <Tabs.Trigger value={'pitch-bend'}>Pitch Bend</Tabs.Trigger>
                <Tabs.Trigger value={'lfos'}>LFOs</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value={'info'}>Tab content for Program Info.</Tabs.Content>
            <Tabs.Content value={'output'}>
                <SectionView data={data.output}>
                    <ProgramOutputView data={data.output}/>
                </SectionView>
            </Tabs.Content>
            <Tabs.Content value={'midi-tune'}>
                <SectionView data={data.midiTune}>
                    <ProgramMidiTuneView data={data.midiTune}/>
                </SectionView>
            </Tabs.Content>
            <Tabs.Content value={'pitch-bend'}>
                <SectionView data={data.midiTune}>
                    <ProgramPitchBendView data={data.pitchBend}/>
                </SectionView>
            </Tabs.Content>
            <Tabs.Content value={'lfos'}>
                <SectionView data={data.lfos}>
                    <ProgramLfosView data={data.lfos}/>
                </SectionView>
            </Tabs.Content>
        </Tabs.Root>
    )
}

function SectionView({data, children}: { data: Promise<Result> }) {
    const [result, setResolved] = useState(null)
    // noinspection TypeScriptValidateTypes
    data.then(result => setResolved(result))

    if (!result) {
        return (<div>Waiting...</div>)
    }
    const errors = result.errors.length > 0
        ? (<Alert status="error" title="Errors">
            <ul>{result.errors.map(e => (<li key={e.message}>{e.message}</li>))}</ul>
        </Alert>)
        : (<div></div>)
    return (<Stack>{children}{errors}</Stack>)
}

function ProgramOutputView({data}: { data: Promise<ProgramOutputInfoResult> }) {
    const [result, setResolved] = useState(null)
    data.then((r) => {
        // noinspection TypeScriptValidateTypes
        setResolved(r)
    })
    if (!result) return (<></>)
    const info = result.data
    return (
        <Flex gap={4} wrap={'wrap'}>
            <ControlPanel title={'Loudness'} flexGrow={1}>
                <MutableSlider data={info.loudness} label={'Loudness'}/>
            </ControlPanel>
            <ControlPanel title={'Velocity Sensitivity'}>
                <MutableSlider data={info.velocitySensitivity} label={'Sensitivity'}/>
                <p>Fix me :-(</p>
                <p>I can't save my data.</p>
            </ControlPanel>
            <ControlPanel title={'Amp Mod 1'}>
                <ModSourceSelect modSource={info.ampMod1Source} label={'Source'}/>
                <MutableSlider data={info.ampMod1Value} label={'Value'}/>
            </ControlPanel>
            <ControlPanel title={'Amp Mod 2'}>
                <ModSourceSelect modSource={info.ampMod2Source} label={'Source'}/>
                <MutableSlider data={info.ampMod2Value} label={'Value'}/>
            </ControlPanel>
            <ControlPanel title={'Pan Mod 1'}>
                <ModSourceSelect modSource={info.panMod1Source} label={'Source'}/>
                <MutableSlider data={info.panMod1Value} label={'Value'}/>
            </ControlPanel>
            <ControlPanel title={'Pan Mod 2'}>
                <ModSourceSelect modSource={info.panMod2Source} label={'Source'}/>
                <MutableSlider data={info.panMod2Value} label={'Value'}/>
            </ControlPanel>
            <ControlPanel title={'Pan Mod 3'}>
                <p>Fix me :-(</p>
                <p> My data is borken.</p>
                {/*<ModSourceSelect modSource={data.panMod3Source} label={'Source'}/>*/}
                {/*<MutableSlider data={data.panMod3Value} label={'Value'}/>*/}
            </ControlPanel>
        </Flex>
    )
}

function ProgramMidiTuneView({data}: { data: Promise<ProgramMidiTuneInfoResult> }) {
    const [result, setResult] = useState(null)
    // noinspection TypeScriptValidateTypes
    data.then(r => setResult(r))
    if (!result) return (<></>)
    const info = result.data
    return (
        <Flex gap={4}>
            <ControlPanel title={'Tune'}>
                <MutableSlider data={info.semitoneTune} label={'Semitone'}/>
                <MutableSlider data={info.fineTune} label={"Fine"}/>
            </ControlPanel>
            <ControlPanel title={'Tune Template'}>
                <MutableSlider data={info.tuneTemplate} label={'Template'}/>
                <div>ADD USER TEMPLATE HERE.</div>
            </ControlPanel>
            <ControlPanel title={'Key'}>
                <MutableSlider data={info.key} label={'Value'}/>
            </ControlPanel>
        </Flex>
    )
}

function ProgramPitchBendView({data}: { data: Promise<ProgramPitchBendInfoResult> }) {
    const [result, setResult] = useState(null)
    // noinspection TypeScriptValidateTypes
    data.then(r => setResult(r))
    if (!result) return (<></>)
    const info = result.data
    return (
        <Flex gap={4}>
            <ControlPanel title={'Pitch Bend'}>
                <MutableSlider data={info.pitchBendUp} label={'Up'}/>
                <MutableSlider data={info.pitchBendDown} label={'Down'}/>
                <MutableSlider data={info.bendMode} label={'Mode'}/>
            </ControlPanel>
            <ControlPanel title={'Aftertouch/Legato'}>
                <MutableSlider data={info.aftertouchValue} label={'Aftertouch Value'}/>
                <MutableSlider data={info.legatoEnable} label={'Legato Enable'}/>
            </ControlPanel>
            <ControlPanel title={'Portamento'}>
                <MutableSlider data={info.portamentoEnable} label={'Enable'}/>
                <MutableSlider data={info.portamentoMode} label={'Mode'}/>
                <MutableSlider data={info.portamentoTime} label={'Time'}/>
            </ControlPanel>
        </Flex>
    )
}

function ProgramLfosView({data}:{data:Promise<ProgramLfosInfoResult>}) {
    const [result, setResult] = useState(null)
    // noinspection TypeScriptValidateTypes
    data.then(r => setResult(r))
    if (!result) return (<></>)
    const info:ProgramLfosInfo = result.data
    return (<Flex gap={4}>
        <ControlPanel title={'LFO 1'}>
            <MutableSlider data={info.lfo1Rate} label={'Rate'}/>
            <MutableSlider data={info.lfo1Delay} label={'Delay'}/>
            <MutableSlider data={info.lfo1Depth} label={'Depth'}/>
            <MutableSlider data={info.lfo1Waveform} label={'Waveform'}/>
            <MutableSlider data={info.lfo1Sync} label={'Sync'}/>
            <MutableSlider data={info.lfo1RateModSource} label={'Rate Mod Source'}/>
            <ModSourceSelect modSource={info.lfo1RateModSource} label={'Rate Mod Source'}/>
        </ControlPanel>
        <ControlPanel title={'LFO 2'}>
            <MutableSlider data={info.lfo2Rate} label={'Rate'}/>
            <MutableSlider data={info.lfo2Delay} label={'Delay'}/>
            <MutableSlider data={info.lfo2Depth} label={'Depth'}/>
            <MutableSlider data={info.lfo2Waveform} label={'Waveform'}/>
            <MutableSlider data={info.lfo2Retrigger} label={'Retrigger'}/>
        </ControlPanel>
    </Flex>)
}

// function ProgramInfoView({info}: { info: ProgramInfo }) {
//     return (
//         <div className={'flex columns-2'}>
//             <SlInput
//                 name="program-name"
//                 value={info.name.value}
//                 onSlChange={(event) => info.name.mutator((event.target as any).value)}/>
//             <div>Id:</div>
//             <div><SlFormatNumber value={info.id}/></div>
//             <div>Index:</div>
//             <div><SlFormatNumber value={info.index}/></div>
//             <div>Keygroup Count:</div>
//             <div><SlFormatNumber value={info.keygroupCount}/></div>
//         </div>
//     )
// }


function ModSourceSelect({modSource, label}: { modSource: MutableNumber, label: string }) {
    const items = {
        0: 'No Source',
        1: 'Modwheel',
        2: 'Pitch Bend',
        3: 'Aftertouch',
        4: 'External',
        5: 'Velocity',
        6: 'Keyboard',
        7: 'LFO 1',
        8: 'LFO 2',
        9: 'Amp Envelope',
        10: 'Filter Envelope',
        11: 'Aux Envelope',
        12: '+Modwheel',
        13: '+Pitch Bend',
        14: '+External'
    }
    return (
        <SimpleSelect
            options={Object.getOwnPropertyNames(items).map(key => {
                return {value: key, label: items[key], selected: key === "" + modSource.value} as Option
            })}
            mutator={modSource.mutator}
            label={label}
        />
    )
}