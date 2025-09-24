import {Midi} from "@/midi/midi";
import {newClientOutput, ProcessOutput} from "@/lib/process-output";

const DEBUG = false

export enum Section {
    SYSEX_CONFIG = 0x00,
    SYSTEM_SETUP = 0x02,
    MIDI_CONFIG = 0x04,
    KEYGROUP_ZONE = 0x06,
    KEYGROUP = 0x08,
    PROGRAM = 0x0A,
    MULTI = 0x0C,
    SAMPLE_TOOLS = 0x0E,
    DISK_TOOLS = 0x10,
    FX = 0x12,
    SCENLIST = 0x14,
    SONGFILE = 0x16,
    FRONT_PANEL = 0x20,
    ALT_PROGRAM = 0x2A,
    ALT_MULTI = 0x2C,
    ALT_SAMPLE = 0x2E,
    ALT_FX = 0x32
}

export interface SysexControlMessage {
    section: Section
    item: number
    data: number[]
}

export function newControlMessage(section: Section, item: number, data: number[]): SysexControlMessage {
    return {
        section: section,
        item: item,
        data: data
    } as SysexControlMessage
}

export interface SysexResponse {
    // 94 (product id)
    // 0  (deviceId)
    // 0  (userRef)
    // 79 ('O':OK) | 68 ('D':DONE) | 82 ('R':REPLY) | 69 ('E': ERROR)
    // 0  (Data 1)
    // 0  (Data 2)
    productId: number
    deviceId: number
    userRef: number
    status: ResponseStatus
    errorCode: number
    message: string
    section: number
    item: number
    data: number[]
}

export enum ResponseStatus {
    OK = 79,
    DONE = 68,
    REPLY = 82,
    ERROR = 69
}

export function getErrorMessage(errorCode: number) {
    switch (errorCode) {
        case 0:
            return "Error: Not supported"
        case 1:
            return "Error: Invalid message format"
        case 2:
            return "Error: Parameter out of range"
        case 3:
            return "Error: Device: Unknown error"
        case 4:
            return "Error: Not found"
        case 5:
            return "Error: Unable to create new element"
        case 6:
            return "Error: Unable to delete item"
        case 129:
            return "Error: Checksum invalid"
        case 257:
            return "Disk error: Selected disk invalid"
        case 258:
            return "Disk error: Error during load"
        case 259:
            return "Disk error: Item not found"
        case 260:
            return "Disk error: Unable to create"
        case 261:
            return "Disk error: Folder not empty"
        case 262:
            return "Disk error: Unable to delete"
        case 263:
            return "Disk error: Unknown error"
        case 264:
            return "Disk error: Error during save"
        case 265:
            return "Disk error: Insufficient space"
        case 266:
            return "Disk error: Media is write protected"
        case 267:
            return "Disk error: Name not unique"
        case 268:
            return "Disk error: Invalid disk handle"
        case 269:
            return "Disk error: Disk is empty"
        case 270:
            return "Disk error: Aborted"
        case 271:
            return "Disk error: Failed on open"
        case 272:
            return "Disk error: Read error"
        case 273:
            return "Disk error: Disk not ready"
        case 274:
            return "Disk error: SCSI error"
        case 385:
            return "Program error: Requested keygroup does not exist"
        default:
            return "Error code unknown"
    }
}

function getStatusMessage(status: number) {
    switch (status) {
        case ResponseStatus.OK:
            return "Ok"
        case ResponseStatus.DONE:
            return "Done"
        case ResponseStatus.REPLY:
            return "Reply"
        case ResponseStatus.ERROR:
            return "Error"
        default:
            return "Unknown"
    }
}

export function newResponse(event) {
    const data = event['dataBytes']
    const rv = {} as SysexResponse
    if (data && data.length >= 6) {
        let cursor = 0
        rv.productId = data[cursor++]
        rv.deviceId = data[cursor++]
        rv.userRef = data[cursor++]
        rv.status = data[cursor++]
        rv.data = []

        if (rv.status == ResponseStatus.REPLY) {
            // Reply messages have a section byte and an item byte before the data byte
            rv.section = data[cursor++]
            rv.item = data[cursor++]
        }
        for (; cursor < data.length; cursor++) {
            rv.data.push(data[cursor])
        }

        if (rv.status === ResponseStatus.ERROR) {
            rv.errorCode = data[4] * 128 + data[5]
            rv.message = getErrorMessage(rv.errorCode)
        } else {
            rv.errorCode = -1
            rv.message = getStatusMessage(rv.status)
        }
        rv.message += ` at ${event.timestamp}`
    } else {
        rv.productId = -1
        rv.deviceId = -1
        rv.userRef = -1
        rv.status = ResponseStatus.ERROR
        rv.errorCode = -1
        rv.message = "Unknown"
        rv.data = []
    }
    return rv as SysexResponse
}

export class AkaiS56kSysex {
    protected midi: Midi
    protected out: ProcessOutput

    constructor(midi: Midi) {
        this.midi = midi
        this.out = newClientOutput(false)
    }

    async sysexRequest(message: SysexControlMessage): Promise<SysexResponse> {
        const midi = this.midi
        const out = this.out
        const akaiID = 0x47
        const s56kId = 0x5E
        const deviceId = 0x00
        const userRef = 0x00
        return new Promise<any>(async (resolve) => {
            let eventCount = 0

            function listener(event) {
                for (const name of Object.getOwnPropertyNames(event)) {
                    out.log(`SYSEX RESPONSE ${eventCount}: ${name} = ${event[name]}`)
                }
                let response = newResponse(event);
                // TODO: Update to handle setter messages that receive a "DONE" reply rather than a "REPLY" message
                // The current implementation doesn't distinguish between the two, but it should.
                switch (response.status) {
                    case ResponseStatus.OK:
                        out.log(`SYSEX RESPONSE: ${eventCount}: OK`)
                        break
                    case ResponseStatus.DONE:
                    case ResponseStatus.REPLY:
                    case ResponseStatus.ERROR:
                        out.log(`SYSEX RESPONSE: ${eventCount} terminal: ${response.status}; Resolving `)
                        midi.removeListener('sysex', listener)
                        resolve(response)
                }
                // if (response.status == ResponseStatus.OK) {
                //     out.log(`SYSEX RESPONSE: ${eventCount}: OK`)
                // } else if (response.status == ResponseStatus.DONE || response.status == ResponseStatus.) {
                //     out.log(`SYSEX RESPONSE: ${eventCount}: ${response.status}; Resolving.`)
                //     midi.removeListener('sysex', listener)
                //     resolve(response)
                // }
                eventCount++
            }

            out.log(`Adding listener for sysex call.`)
            out.log(`  Output: ${(await this.midi.getCurrentOutput()).name}`)
            out.log(`  Input : ${(await this.midi.getCurrentOutput()).name}`)
            this.midi.addListener('sysex', listener)
            let data = [s56kId, deviceId, userRef, message.section, message.item].concat(message.data);
            out.log(`Sending sysex data: ${data}`)
            this.midi.sendSysex(akaiID, data)
            this.out.log(`Done sending sysex.`)
        })
    }
}