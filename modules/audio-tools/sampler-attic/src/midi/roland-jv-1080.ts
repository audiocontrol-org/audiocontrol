import {Midi} from "@/midi/midi";

/**
 * | Byte       | Description       |
 * + ---------- + ----------------- +
 * | 0xFO (240) | Start Sysex       |
 * | 0x41 ( 65) | Manufacturer ID   |
 * | DEV    | Device ID         |
 * | MDL    | Model ID          | 0x6A: JV-1080
 * | CMD    | Command ID        |
 * | [Body] | Main data         |
 * | 0xF7   | End Sysex         |
 */

/**
 * Example message from device
 * 0xF0 (240): Start Sysex
 * 0x41 ( 65): Manufacturer ID
 * 0x10 ( 16): Device ID
 * 0x6A (106): Model ID
 * 0x12 ( 18): Command ID
 *   0       : Data
 *   0       : Data
 *   0       : Data
 * 0x0C ( 12): Data
 *   0       : Data
 * 0x74 (116): Data
 * 0xF7 (247): End Sysex
 *
 */

/**
 * const generatedMessage = generate({
 *   manufacturerId: 0x41,
 *   deviceId: 0x10,
 *   modelId: 0x00,
 *   command: 0x12,
 *   data: [0x34]
 * });
 */

const ROLAND_MANUFACTURER_ID = 0x41
const JV_1080_MODEL_ID = 0x6A
const CMD_RQ1 = 0x11
const CMD_DT1 = 0x12

// System parameters
const BASE_SYSTEM = [0, 0, 0, 0]
const OFFSET_PANEL_MODE = [0, 0, 0, 0]
const OFFSET_PERFORMANCE_NUMBER = [0, 0, 0, 1]
const OFFSET_PATCH_GROUP = [0, 0, 0, 2]
const OFFSET_PATCH_GROUP_ID = [0, 0, 0, 3]
const OFFSET_PATCH_NUMBER = [0, 0, 0, 4]
const OFFSET_EFX_SWITCH = [0, 0, 0, 8]
const OFFSET_CHORUS_FX_SWITCH = [0, 0, 0, 9]
const OFFSET_REVERB_FX_SWITCH = [0, 0, 0, 10]
const OFFSET_PATCH_REMAIN = [0, 0, 0, 11]
const OFFSET_CLOCK = [0, 0, 0, 12]

// Temp performance parameters
// const BASE_TEMP_PERFORMANCE = [1, 0, 0, 0]
// const BASE_TEMP_PERFORMANCE_PATCH_01 = [2, 0, 0, 0]
// const BASE_TEMP_PERFORMANCE_PATCH_02 = [2, 1, 0, 0]
// const BASE_TEMP_PERFORMANCE_PATCH_03 = [2, 2, 0, 0]

// Temp patch parameters
const BASE_TEMP_PATCH = [3, 0, 0, 0]
const OFFSET_PATCH_NAME = [0, 0, 0, 0]
const OFFSET_FX_TYPE = [0, 0, 0, 0x0C]
const OFFSET_FX_PARAM = [0, 0, 0, 0x0D]


export const FX_TYPES = [
    'STEREO-EQ',
    'OVERDRIVE',
    'DISTORTION',
    'PHASER',
    'SPECTRUM',
    'ENHANCER',
    'AUTO-WAH',
    'ROTARY',
    'COMPRESSOR',
    'LIMITER',
    'HEXA-CHORUS',
    'TREMOLO-CHORUS',
    'SPACE-D',
    'STEREO-CHORUS',
    'STEREO-FLANGER',
    'STEP-FLANGER',
    'STEREO-DELAY',
    'MODULATION-DELAY',
    'TRIPLE-TAP-DELAY',
    'QUADRUPLE-TAP-DELAY',
    'TIME-CONTROL-DELAY',
    'VOICE-PITCH-SHIFTER',
    'FBK-PITCH-SHIFTER',
    'REVERB',
    'GATE-REVERB',
    'OVERDRIVE->CHORUS',
    'OVERDRIVE->FLANGER',
    'OVERDRIVE->DELAY',
    'DISTORTION->CHORUS',
    'DISTORTION->FLANGER',
    'DISTORTION->DELAY',
    'ENHANCER->CHORUS',
    'ENHANCER->FLANGER',
    'ENHANCER->DELAY',
    'CHORUS->DELAY',
    'FLANGER->DELAY',
    'CHORUS->FLANGER',
    'CHORUS/DELAY',
    'FLANGER/DELAY',
    'CHORUS/FLANGER',
]

function toHex(a: number[]) {
    return `(${a.length}) [` + a.map(i => '0x' + i.toString(16)).join(', ') + ']'
}

interface RolandSysexEvent {
    id: number[]
    cmd: number
    param: number[]
    value: number
    checksum: number
}

class RolandSysexEventHandler {
    private listeners = {}

    private static p2n(param: number[]) {
        return param.reduce((acc, v) => acc + v)
    }

    handleEvent(e: RolandSysexEvent, value: number) {
        const n = RolandSysexEventHandler.p2n(e.param)
        console.log(`Handling event for param ${toHex(e.param)}: ${n}`)
        const listener = this.listeners[n]
        if (listener) {
            listener(value)
        }
    }

    setListener(param: number[], listener: (value: number) => void) {
        console.log(`Setting listener for ${toHex(param)}: ${RolandSysexEventHandler.p2n(param)}`)
        this.listeners[RolandSysexEventHandler.p2n(param)] = listener
    }
}

export enum Jv1080Event {
    FxType,
    FxParam01,
}


export class Jv1080 {
    private readonly midi: Midi;
    private readonly deviceId: number
    private readonly eh: RolandSysexEventHandler = new RolandSysexEventHandler()
    private listeners = {}
    private fxParams: number[] = new Array<number>(12)

    constructor(midi: Midi, deviceId: number) {
        this.midi = midi
        this.deviceId = deviceId
    }

    init() {
        this.midi.addListener('sysex', (e) => this.receiveSysex(e))
        this.eh.setListener(param(BASE_TEMP_PATCH, OFFSET_FX_TYPE), v => {
            console.log(`Set FX type: ${FX_TYPES[v]}`)
            this.listeners[Jv1080Event.FxType]?.forEach(fn => fn(v))
        })
        this.eh.setListener(param(BASE_TEMP_PATCH, OFFSET_FX_PARAM), v => {
            console.log(`Set FX Param 01: ${v}`)
            this.fxParams[0] = v
            this.listeners[Jv1080Event.FxParam01]?.forEach(fn => fn(v))
        })
    }

    getFxParameter(parameterIndex: number): number {
        return this.fxParams[parameterIndex]
    }

    subscribe(type: Jv1080Event, fn: (v: number) => void) {
        let set = this.listeners[type]
        if (!set) {
            set = new Set()
            this.listeners[type] = set
        }
        //set.push(fn)
        set.add(fn)
        return (() => {
            set.delete(fn)
        })
    }

    private receiveSysex(e) {
        const data = e.data
        const expectedId = this.getIdentifier()

        if (data.length < 11) return
        // diff the message against the expected identifier bytes. If the diff is zero, this is the device we care about.
        // Otherwise, bail out.
        const diff = expectedId.reduce((accum, val, i) => accum + val - data[i + 1], 0)
        if (diff) return
        const cmdId: number = data[4]

        const param = data.slice(5, 9);

        const value = data[9];

        const parsed = {
            id: data.slice(1, 4),
            cmd: cmdId,
            param: param,
            value: value,
            checksum: data[10]
        }
        this.eh.handleEvent(parsed, value)
    }

    private checksum(msg: number[]) {
        return (128 - msg.reduce((acc, val) => (acc + val) % 128)) % 128
    }

    private getIdentifier() {
        return [ROLAND_MANUFACTURER_ID, this.deviceId, JV_1080_MODEL_ID];
    }

    private set(msg: number[]) {
        this.sysex(CMD_DT1, msg)
    }

    // private get(msg: number[]) {
    //     this.sysex(CMD_RQ1, msg)
    // }

    private sysex(cmd: number, msg) {
        this.midi.sendSysex(this.getIdentifier(), [cmd].concat(msg).concat(this.checksum(msg)))
    }

    testSysex() {
        this.set([0x01, 0x00, 0x00, 0x28, 0x06])
    }

    panelModePerformance() {
        this.set(param(BASE_SYSTEM, OFFSET_PANEL_MODE).concat([0x00]))
    }

    panelModePatch() {
        this.set(param(BASE_SYSTEM, OFFSET_PANEL_MODE).concat([0x01]))
    }

    panelModeGm() {
        this.set(param(BASE_SYSTEM, OFFSET_PANEL_MODE).concat([0x02]))
    }

    setPerformanceNumber(n: number) {
        this.set(param(BASE_SYSTEM, OFFSET_PERFORMANCE_NUMBER).concat([n]))
    }

    patchGroupUser() {
        // this.set(param(BASE_SYSTEM, OFFSET_PATCH_GROUP).concat([0]))
        this.patchGroup(0)
    }

    patchGroupPcm() {
        // this.set(param(BASE_SYSTEM, OFFSET_PATCH_GROUP).concat[[1]])
        this.patchGroup(1)
    }

    private patchGroup(n: number) {
        this.set(param(BASE_SYSTEM, OFFSET_PATCH_GROUP).concat([n]))
    }

    setPatchGroupId(n: number) {
        this.set(param(BASE_SYSTEM, OFFSET_PATCH_GROUP_ID).concat([n]))
    }

    setPatchNumber(n: number) {
        this.set(param(BASE_SYSTEM, OFFSET_PATCH_NUMBER).concat([n]))
    }

    setInsertFx(on: boolean) {
        this.set(param(BASE_SYSTEM, OFFSET_EFX_SWITCH).concat([on ? 1 : 0]))
    }

    setChorusFx(on: boolean) {
        this.set(param(BASE_SYSTEM, OFFSET_CHORUS_FX_SWITCH).concat([on ? 1 : 0]))
    }

    setReverbFx(on: boolean) {
        this.set(param(BASE_SYSTEM, OFFSET_REVERB_FX_SWITCH).concat([on ? 1 : 0]))
    }

    setPatchRemain(on: boolean) {
        this.set(param(BASE_SYSTEM, OFFSET_PATCH_REMAIN).concat([on ? 1 : 0]))
    }

    setClockInternal() {
        this.set(param(BASE_SYSTEM, OFFSET_CLOCK).concat([0]))
    }

    setClockMidi() {
        this.set(param(BASE_SYSTEM, OFFSET_CLOCK).concat([1]))
    }

    setPatchName(name: string) {
        const offset = Array.from(OFFSET_PATCH_NAME)
        for (let i = 0; i < 12; i++, offset[3]++) {
            this.set(param(BASE_TEMP_PATCH, offset).concat([name.charCodeAt(i)]))
        }
    }

    setFx(v: number) {
        this.set(param(BASE_TEMP_PATCH, OFFSET_FX_TYPE).concat([v]))
    }

    setFxParam(index: number, value: number) {
        const offset = Array.from(OFFSET_FX_PARAM)
        offset[3] += index
        this.set(param(BASE_TEMP_PATCH, offset).concat([value]))
    }
}


function param(base: number[], offset: number[]) {
    return base.map((n, i) => n + offset[i])
}

