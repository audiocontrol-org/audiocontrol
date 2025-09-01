/**
 * ## Sysex message structure
 * ```
 * <Start of SysEx> <AKAI ID> <S5000/6000 ID> <User-selectable Device ID> <User-Refs..> ...
 * ```
 *
 * Where the values of the bytes are:
 *```
 * <&F0> <&47> <&5E> <0..&7F> <0..&F7> ... {<240> <71> <94> <0..127> <0..247> ...}
 *```
 *
 * ## Complete control message
 * <&F0> <&47> <&5E> <0..&7F> <0..&7F> <...> <Section> <Item> <Data1> ... <DataN> <checksum> <&F7>
 *
 *  ## Sections
 *  +-----------+-------------------------------+
 *  | Section   | Description                   |
 *  +-----------+-------------------------------+
 *  | 0x00      | Sysex Configuration           |
 *  | 0x02      | System Setup                  |
 *  | 0x04      | MIDI Configuration            |
 *  | 0x06      | Keygroup Zone Manipulation    |
 *  | 0x08      | Keygroup Manipulation         |
 *  | 0x0A      | Program Manipulation          |
 *  | 0x0C      | Multi Manipulation            |
 *  | 0x0E      | Sample Tools                  |
 *  | 0x10      | Disk Tools                    |
 *  | 0x12      | Multi FX Control              |
 *  | 0x14      | Scenelist Manipulation        |
 *  | 0x16      | MIDI Songfile Tools           |
 *  | 0x20      | Front Panel Control           |
 *  | 0x2A      | Alt. Program Manipulation     |
 *  | 0x2C      | Alt. Multi Manipulation       |
 *  | 0x2E      | Alt. Sample Tools             |
 *  | 0x32      | Alt. Multi FX Control         |
 *  +-----------+-------------------------------+
 *
 * ### Section: Keygroup Zone
 *  +-----------+---------------+---------------+---------------------------+
 *  | Item      | Data 1        | Data 2        | Description               |
 *  |           | (Zone number) |               |                           |
 *  +-----------+----------------+--------------+---------------------------+
 *  | 0x21      | 0, 1-4        | N/A           | Get Zone Sample           |
 *  | 0x22      | 0, 1-4        | N/A           | Get Zone Level            |
 *  | ...       | ...           | ...           | ...                       |
 *  +-----------+---------------+---------------+---------------------------+
 */

import {Midi} from "./midi";
import {newClientOutput, ProcessOutput} from "@/process-output";
import {Buffer} from 'buffer/'
import {
    BooleanResult,
    ByteArrayResult,
    MutableNumber,
    MutableString,
    NumberResult,
    Result,
    StringResult
} from "@/lib/lib-core";
import {newControlMessage, ResponseStatus, Section, AkaiS56kSysex, SysexControlMessage, SysexResponse} from "@/midi/akai-s56k-sysex";
import {
    newProgramLfos,
    newProgramMidiTune,
    newProgramOutput,
    newProgramPitchBend, ProgramLfos,
    ProgramMidiTune,
    ProgramOutput, ProgramPitchBend
} from "@/midi/devices/devices";



enum ErrorCode {
    NOT_SUPPORTED = 0,
    INVALID_FORMAT,
    PARAMETER_OUT_OF_RANGE
}

enum SysexItem {
    QUERY = 0x00
}

enum ProgramItem {
    GET_PROGRAM_COUNT = 0x10,
    GET_ID = 0x11,
    GET_INDEX = 0x12,
    GET_NAME = 0x13,
    GET_KEYGROUP_COUNT = 0x14,
    GET_KEYGROUP_CROSSFADE = 0x15,

    // OUTPUT
    GET_LOUDNESS = 0x28,
    GET_VELOCITY_SENSITIVITY = 0x29,
    GET_AMP_MOD_SOURCE = 0x2A, // !!! This message requires data to select between amp mod [...path] 1 or 2
    GET_AMP_MOD_VALUE = 0x2B,  // !!! Ibid.
    GET_PAN_MOD_SOURCE = 0x2C, // DATA1: 1 | 2 | 3
    GET_PAN_MOD_VALUE = 0x2D,  // DATA1: 1 | 2 | 3

    // MIDI/TUNE
    GET_SEMITONE_TUNE = 0x38,
    GET_FINE_TUNE = 0x39,
    GET_TUNE_TEMPLATE = 0x3A,
    GET_USER_TUNE_TEMPLATE = 0x3B,
    GET_KEY = 0x3C,

    // PITCH BEND
    GET_PITCH_BEND_UP = 0x48,
    GET_PITCH_BEND_DOWN = 0x49,
    GET_PITCH_BEND_MODE = 0x4A,
    GET_AFTERTOUCH_VALUE = 0x4B,
    GET_LEGATO_ENABLE = 0x4C,
    GET_PORTAMENTO_ENABLE = 0x4D,
    GET_PORTAMENTO_MODE = 0x4E,
    GET_PORTAMENTO_TIME = 0x4F,

    // LFO (DATA1 [1: LFO 1 | 2: LFO 2])
    GET_LFO_RATE = 0x60,        // DATA1: 1 | 2
    GET_LFO_DELAY = 0x61,       // DATA1: 1 | 2
    GET_LFO_DEPTH = 0x62,       // DATA1: 1 | 2

}

function newResult(res: SysexResponse): Result {
    const rv = {
        errors: [],
        data: []
    } as Result
    if (res.status == ResponseStatus.REPLY && res.data) {
        rv.data = res.data
    } else if (res.status == ResponseStatus.ERROR) {
        rv.errors.push(new Error(`Error: ${res.errorCode}: ${res.message}`))
    }

    return rv
}

function newByteArrayResult(res: SysexResponse, bytes: number): ByteArrayResult {
    const rv = {
        errors: [],
        data: []
    } as ByteArrayResult
    if (res.status == ResponseStatus.REPLY && res.data && res.data.length >= bytes) {
        rv.data = rv.data.concat(res.data.slice(0, bytes))
    } else {
        rv.errors.push(new Error(`Malformed REPLY message for ByteArrayResult: ${res.status}: ${res.message}`))
    }
    return rv
}

function newNumberResult(res: SysexResponse, bytes: number, signed: boolean = false): NumberResult {
    const rv = {
        errors: []
    } as NumberResult
    if (signed && bytes < 2) {
        throw new Error("Error parsing SysexResponse for NumberResult. At least two bytes required for signed value.")
    }
    if (res.status == ResponseStatus.REPLY && res.data && res.data.length >= bytes) {
        let abs = 0
        // signed numbers use the first data byte for signed, where 0 is positive, 1 is negative
        const offset = signed ? 1 : 0
        const length = signed ? bytes - 1 : bytes
        abs = Buffer.from(res.data).readIntBE(offset, length)
        rv.data = signed ? abs * (res.data[0] ? -1 : 1) : abs
    } else {
        rv.errors.push(new Error(`Malformed REPLY message for NumberResult: ${res.status}: ${res.message}`))
    }
    return rv
}

function newStringResult(res: SysexResponse): StringResult {
    const rv = {
        errors: [],
        data: '',
    } as StringResult
    if (res.status == ResponseStatus.REPLY && res.data && res.data.length > 0) {
        for (const c of res.data.filter(c => c != 0)) {
            rv.data += String.fromCharCode(c)
        }
    } else {
        rv.errors.push(new Error(`Malformed REPLY message for StringResult: ${res.status}: ${res.message}`))
    }
    return rv
}

function newBooleanResult(res: SysexResponse): BooleanResult {
    const result = newNumberResult(res, 1)
    return {
        errors: result.errors,
        data: !!result.data
    }
}


export interface ProgramInfo {
    name: MutableString
    id: number
    index: number
    keygroupCount: number
}

export interface ProgramInfoResult extends Result {
    data: ProgramInfo
}

export function newS56kDevice(midi, out: ProcessOutput) {
    return new S56kSysex(midi, out)
}


export interface S56kProgram {
    getName(): Promise<StringResult>

    getId(): Promise<NumberResult>

    getIndex(): Promise<NumberResult>

    getKeygroupCount(): Promise<NumberResult>

    getInfo(): Promise<ProgramInfoResult>

    getOutput(): ProgramOutput

    getMidiTune(): ProgramMidiTune

    getPitchBend(): ProgramPitchBend

    getLfos(): ProgramLfos
}

export interface S56kDevice {
    init()

    ping(): Promise<SysexResponse>

    getProgramCount(): Promise<NumberResult>

    getCurrentProgram(): S56kProgram

}

class S56kProgramSysex implements S56kProgram {
    private readonly sysex: AkaiS56kSysex;
    private readonly out: ProcessOutput;

    constructor(sysex: AkaiS56kSysex, out: ProcessOutput) {
        this.sysex = sysex
        this.out = out
    }

    async getInfo() {
        const rv = {
            errors: [],
            data: null
        } as ProgramInfoResult
        const programId = await this.getId()
        const programIndex = await this.getIndex()
        const keygroupCount = await this.getKeygroupCount()
        const programName = await this.getName()
        rv.errors = rv.errors
            .concat(programId.errors)
            .concat(programIndex.errors)
            .concat(keygroupCount.errors)
            .concat(programName.errors)
        rv.data = {
            id: programId.data,
            index: programIndex.data,
            keygroupCount: keygroupCount.data,
            name: {
                value: programName.data, mutator: (value: string) => {
                    this.out.log(`TODO: Write program name: ${value}`);
                    return []
                }
            },
        } as ProgramInfo
        return rv
    }

    async getName(): Promise<StringResult> {
        return newStringResult(await this.sysex.sysexRequest(newControlMessage(Section.PROGRAM, ProgramItem.GET_NAME, [])))
    }

    async getId() {
        const res = await this.sysex.sysexRequest(newControlMessage(Section.PROGRAM, ProgramItem.GET_ID, []))
        return newNumberResult(res, 2)
    }

    async getIndex(): Promise<NumberResult> {
        return newNumberResult(
            await this.sysex.sysexRequest(newControlMessage(Section.PROGRAM, ProgramItem.GET_INDEX, [])),
            2
        )
    }

    async getKeygroupCount(): Promise<NumberResult> {
        return newNumberResult(
            await this.sysex.sysexRequest(newControlMessage(Section.PROGRAM, ProgramItem.GET_KEYGROUP_COUNT, [])),
            1
        )
    }

    // OUTPUT
    getOutput(): ProgramOutput {
        return newProgramOutput(this.sysex, this.out)
    }

    // MIDI/Tune
    getMidiTune(): ProgramMidiTune {
        return newProgramMidiTune(this.sysex, this.out)
    }

    getPitchBend(): ProgramPitchBend {
        return newProgramPitchBend(this.sysex, this.out)
    }

    getLfos(): ProgramLfos {
        return newProgramLfos(this.sysex, this.out)
    }
}

/**
 * XXX: Move this to gen-devices.ts
 * Dynamically generates a device object that implements sysex getter/setter methods based on the given spec
 *
 * @param spec -- a spec object describing the getters and setters the device object should have
 * @param sysex -- a Sysex client that knows how to send and receive Akai S56k system exclusive messages
 * @param out -- a wrapper around stdout/stderr and/or console.log/console.err, depending on execution context (nodejs or browser)
 */
export function newDeviceObject(spec, sysex: AkaiS56kSysex, out: ProcessOutput) {
    const sectionCode = spec.sectionCode
    const obj = {}

    for (const item of spec.items) {
        let i = 0
        const methodName = item[i++] as string
        const dataTypeSpec = item[i++] as string
        const getterItemCode = item[i++] as number
        const getterRequestData = item[i++] as number[]
        const responseType = item[i++] as string
        const responseSize = item[i++] as number
        obj[`get${methodName}`] = async (methodName) => {
            const res = await sysex.sysexRequest(newControlMessage(sectionCode, getterItemCode, getterRequestData))
            switch (responseType) {
                case "uint8":
                    return newNumberResult(res, responseSize)
                case "int8":
                    return newNumberResult(res, responseSize, true)
                default:
                    return newByteArrayResult(res, responseSize)
            }
        }

        const setterItemCode = item[i++]
        const setterDataSpec = item[i++]
        const setterRequestData = []

        for (let i = 0; i < setterDataSpec.length; i++) {
            const d = setterDataSpec[i]
            if (typeof d === 'string') {
                // d describes the datum
                switch (d) {
                    case "uint8":
                        // Write a function into the current request data array that knows how to retrieve the value from
                        // the arguments of the method.
                        setterRequestData[i] = (value) => {
                            // write the argument in the current data slot (erasing this function, which we don't need anymore)
                            setterRequestData[i] = value
                        }
                        break
                    case "int8sign":
                        // this data byte is the sign byte signed int8. Write a function into the current request data array
                        // that knows how to retrieve the number passed in as an argument and replace itself and the next
                        // data byte with the two-byte version of the argument data
                        setterRequestData[i] = (value) => {
                            const int8 = value
                            // write the sign byte into the current data slot (erasing this function, which we don't need anymore)
                            setterRequestData[i] = (int8 >= 0) ? 0 : 1
                            // write the absolute value into the next data slot
                            setterRequestData[i + 1] = Math.abs(int8)
                        }
                        break
                    case "int8abs":
                        // This data byte is the absolute value of the signed int8
                        // Nothing to do here. The previous handler should have filled this in.
                        break
                    case "string":
                        //
                        // TODO: Need to stuff strings into the request data array.
                        // this means the request data can be variable length and my 1:1 spec:data array indexing scheme
                        // may not work, unless:
                        //
                        //   a) there is only one variable length parameter per request; and
                        //   b) the variable length parameter is at the end of the data array.
                        //
                        // I strongly suspect this is true.
                        //
                        break
                    default:
                        break
                }
            } else {
                // d is the literal datum
                setterRequestData.push(d)
            }
        }
        obj[`set${methodName}`] = async (value) => {
            // iterate over the setterRequestData to execute argument reading functions (which replace themselves with the
            // argument data
            for (let i = 0; i < setterRequestData.length; i++) {
                const d = setterRequestData[i]
                if (typeof d === 'function') {
                    // this *is* an argument-handling function. Call it with the arguments array
                    // d(arguments)
                    d(value)
                }
                // else: all other request data was inserted from the spec
            }
            return newResult(await sysex.sysexRequest(newControlMessage(sectionCode, setterItemCode, setterRequestData)))
        }
    }
    // Create get<...>Info() method
    obj[`getInfo`] = async () => {
        const info = {}
        let errors = []
        for (const item of spec.items) {
            const methodNameRoot = item[0]
            const getter = 'get' + methodNameRoot
            const setter = 'set' + methodNameRoot
            const dataTypeSpec = item[1]
            const propertyName = String(methodNameRoot).charAt(0).toLowerCase() + String(methodNameRoot).slice(1)
            const result = await obj[getter]()
            const propertyValue = {
                value: result.data,
                mutator: obj[setter]
            }
            if (dataTypeSpec.startsWith('number')) {
                const [type, min, max, step] = dataTypeSpec.split('|')
                propertyValue['type'] = type
                propertyValue['min'] = min
                propertyValue['max'] = max
                propertyValue['step'] = step
            }

            info[propertyName] = propertyValue
            errors = errors.concat(result.errors)
        }
        return {errors: errors, data: info}
    }

    return obj
}

class S56kSysex implements S56kDevice {
    private readonly monitor: boolean;
    private readonly sysex: AkaiS56kSysex;
    private readonly midi: any;
    private readonly out: ProcessOutput;
    private readonly program: S56kProgramSysex;

    constructor(midi, out: ProcessOutput = newClientOutput(), monitor: boolean = false) {
        this.sysex = new AkaiS56kSysex(midi)
        this.program = new S56kProgramSysex(this.sysex, out)
        this.midi = midi
        this.out = out
        this.monitor = monitor
    }

    init() {
        if (this.monitor) {
            const out = this.out
            let sequence = 0
            this.midi.addListener('sysex', (event) => {
                const count = sequence++
                for (const name of Object.getOwnPropertyNames(event)) {
                    out.log(`MONITOR: ${count}: ${name} = ${event[name]}`)
                }
            })
        }
    }

    async getProgramCount() {
        const res = await this.sysex.sysexRequest(newControlMessage(Section.PROGRAM, ProgramItem.GET_PROGRAM_COUNT, []))
        return newNumberResult(res, 2)
    }

    async ping(): Promise<SysexResponse> {
        return this.sysex.sysexRequest({
            section: Section.SYSEX_CONFIG,
            item: SysexItem.QUERY,
            data: []
        } as SysexControlMessage)
    }

    getCurrentProgram(): S56kProgram {
        return this.program
    }
}


export interface S5000 {
    init()
}

export function newVirtualS5000(midi: Midi, out: ProcessOutput): S5000 {
    return new VirtualS5000(midi, out)
}

class VirtualS5000 implements S5000 {
    private readonly midi: Midi;
    private readonly out: ProcessOutput;

    constructor(midi: Midi, out: ProcessOutput) {
        this.midi = midi
        this.out = out
    }

    init() {
        const out = this.out

        function log(msg) {
            out.log('vs5k sysex: ' + msg)
        }

        this.midi.addListener('sysex', async (event) => {
            log(`Sysex!!!`)
            Object.getOwnPropertyNames(event).sort().forEach((name) => log(`${name}: ${event[name]}`))
        })
    }
}

