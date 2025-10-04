import {Result} from "@oletizi/sampler-lib";

export interface AkaiS56ProgramResult extends Result {
    data: AkaiS56kProgram[]
}

/**
 * Writes the data into the buffer; returns the number of bytes written
 * @param buf
 * @param data
 * @param offset
 */
function write(buf: Buffer, data: number[], offset: number): number {
    buf.set(data, offset)
    return data.length
}

/**
 * Write the number to the buffer; returns the number of bytes written
 * @param buf
 * @param n
 * @param offset
 */
function writeByte(buf: Buffer, n: number, offset: number): number {
    buf.writeInt8(n, offset)
    return 1
}

function readByte(buf: Buffer, offset: number): number {
    return buf.readInt8(offset)
}


function string2Bytes(str: string) {
    const rv: number[] = []
    for (let i = 0; i < str.length; i++) {
        rv.push(str.charCodeAt(i))
    }
    return rv
}

function bytes2String(bytes: number[]) {
    let rv = ''
    for (const b of bytes) {
        rv += String.fromCharCode(b)
    }
    return rv
}

/**
 * Validates the buffer from offset matches the expected data array. Returns the number of bytes read
 * @param buf
 * @param data
 * @param offset
 */
function checkOrThrow(buf, data, offset) {
    for (let i = 0; i < data.length; i++, offset++) {
        if (data[i] != buf.readInt8(offset)) {
            throw new Error(`Bad vibes at: i: ${i}, offset: ${offset}. Expected ${data[i]} but found ${buf.readInt8(offset)}`)
        }
    }
    return data.length
}

export function bytes2Number(bytes: number[]): number {
    return Buffer.from(bytes).readInt32LE()
}


class Pad {
    padCount = 0

    padField(): string {
        return 'pad' + this.padCount++
    }
}

export interface Chunk {
    chunkName: number[]
    lengthInBytes: number
    name: string

    write(buf: Buffer, offset: number): number

    parse(buf: Buffer, offset: number): number
}

/**
 * Parses [offset .. offset + 8]  bytes of the buffer:
 *   - sets the chunk name to the ascii values of bytes [offset .. offset + 4]
 *   - sets the chunk length to the int32 value of bytes [offset + 5 .. offset + 8]
 *   - returns the number of bytes read
 * @param buf
 * @param chunk
 * @param offset
 */
export function parseChunkHeader(buf: Buffer, chunk: Chunk, offset: number): number {

    chunk.name = ''
    for (let i = 0; i < 4; i++, offset++) {
        chunk.name += String.fromCharCode(readByte(buf, offset))
    }
    chunk.lengthInBytes = buf.readInt32LE(offset)
    return 8
}

function readFromSpec(buf, obj: any, spec: string[], offset): number {
    const checkpoint = offset
    for (let i = 0; i < spec.length; i++, offset++) {
        try {
            obj[spec[i]] = readByte(buf, offset)
        } catch (err) {
            const chunkNameString = bytes2String(obj.chunkName)
            throw new Error(`Failed to read spec field '${spec[i]}' at index ${i}, offset ${offset} for chunk '${chunkNameString}': ${err.message}`)
        }
    }
    return spec.length
}


function writeFromSpec(buf, chunk, spec, offset): number {
    const chunkNameString = bytes2String(chunk.chunkName)
    const checkpoint = offset
    const zeroPad = chunkNameString === 'zone'

    for (let i = 0; i < chunk.chunkName.length; i++, offset++) {
        writeByte(buf, chunk.chunkName[i], offset)
    }

    // Note: Buffer.writeInt32LE returns the offset + bytes written, not the bytes written
    offset = buf.writeInt32LE(chunk.length, offset)

    for (let i = 0; i < spec.length; i++, offset++) {
        // Zero out padded bytes for zone chunks
        if (zeroPad && spec[i].startsWith('pad')) {
            chunk[spec[i]] = 0
        }
        writeByte(buf, chunk[spec[i]], offset)
    }

    return offset - checkpoint
}

function newChunkFromSpec(chunkName: number[], chunkLength: number, spec: string[]) {
    const chunkNameString = bytes2String(chunkName)
    return {
        chunkName: chunkName,
        length: chunkLength,
        parse(buf: Buffer, offset: number): number {
            try {
                checkOrThrow(buf, chunkName, offset)
            } catch (err) {
                throw new Error(`Failed to parse chunk '${chunkNameString}': expected chunk name ${chunkName} but got mismatch at offset ${offset}: ${err.message}`)
            }
            offset += parseChunkHeader(buf, this, offset)
            readFromSpec(buf, this, spec, offset)
            return this.length + 8
        },
        write(buf: Buffer, offset: number): number {
            const bytesReported = this.length + 8
            const bytesWritten = writeFromSpec(buf, this, spec, offset)
            if (bytesReported < bytesWritten) {
                // barf if we've written more bytes than we report
                throw new Error(`Bytes written != bytes reported: ${bytes2String(chunkName)}; written: ${bytesWritten}, reported: ${bytesReported}`)
            }
            return bytesReported
        }
    }
}

export interface HeaderChunk extends Chunk {
}

export function newHeaderChunk(): HeaderChunk {
    const riff = [0x52, 0x49, 0x46, 0x46] // 'RIFF'
    const chunkLength = [0x00, 0x00, 0x00, 0x00] //  Chunk length: 0 (not correct, but that's what Akai does)
    const aprg = [0x41, 0x50, 0x52, 0x47] // 'APRG'
    return {
        chunkName: riff,
        lengthInBytes: bytes2Number(chunkLength),
        name: '',
        parse(buf: Buffer, offset: number): number {
            const checkpoint = offset
            offset += checkOrThrow(buf, riff, offset)
            offset += checkOrThrow(buf, chunkLength, offset)
            offset += checkOrThrow(buf, aprg, offset)
            return offset - checkpoint
        },
        write(buf: Buffer, offset: number): number {
            const checkpoint = offset
            offset += write(buf, riff, offset)
            offset += write(buf, chunkLength, offset)
            offset += write(buf, aprg, offset)
            return offset - checkpoint
        }
    }
}

export interface ProgramChunk extends Chunk {
    programNumber: number
    keygroupCount: number
}


// const programSpec = ["pad1", "programNumber", "keygroupCount", "pad2", "pad3", "pad4"];
const programSpec = ["pad1", "programNumber", "keygroupCount", "pad2", "pad3", "pad4"];

export function newProgramChunk(): ProgramChunk {
    const chunkName = [0x70, 0x72, 0x67, 0x20] // 'prg '
    const chunk = newChunkFromSpec(chunkName, 6, programSpec)
    return chunk as unknown as ProgramChunk
}

export interface Output {
    loudness: number
    ampMod1: number
    panMod3: number
    panMod1: number
    ampMod2: number
    panMod2: number
    velocitySensitivity: number
}

export interface OutputChunk extends Output, Chunk {
}

const outputSpec = ['pad1', 'loudness', 'ampMod1', 'ampMod2', 'panMod1', 'panMod2', 'panMod3', 'velocitySensitivity']

export function newOutputChunk(): OutputChunk {
    const chunkName = [0x6f, 0x75, 0x74, 0x20]   // 'out '
    const chunk = newChunkFromSpec(chunkName, 8, outputSpec)
    return chunk as unknown as OutputChunk
}

export interface Tune {
    semiToneTune: number
    fineTune: number
    detuneC: number
    detuneCSharp: number
    detuneD: number
    detuneEFlat: number
    detuneE: number
    detuneF: number
    detuneFSharp: number
    detuneG: number
    detuneGSharp: number
    detuneA: number
    detuneBFlat: number
    detuneB: number
    pitchBendUp: number
    pitchBendDown: number
    bendMode: number
    aftertouch: number
}

export interface TuneChunk extends Chunk, Tune {
}

export function newTuneChunk(): TuneChunk {
    const chunkName = [0x74, 0x75, 0x6e, 0x65] // 'tune'
    const chunk = newChunkFromSpec(chunkName, 24, [
        'pad1',
        'semiToneTune',
        'fineTune',
        'detuneC',
        'detuneCSharp',
        'detuneD',
        'detuneEFlat',
        'detuneE',
        'detuneF',
        'detuneFSharp',
        'detuneG',
        'detuneGSharp',
        'detuneA',
        'detuneBFlat',
        'detuneB',
        'pitchBendUp',
        'pitchBendDown',
        'bendMode',
        'aftertouch',
        'pad2',
        'pad3',
        'pad4'
    ])

    return chunk as unknown as TuneChunk
}

export interface Lfo1 {
    waveform: number
    rate: number
    delay: number
    depth: number
    sync: number
    modwheel: number
    aftertouch: number
    rateMod: number
    delayMod: number
    depthMod: number
}

export interface Lfo1Chunk extends Chunk, Lfo1 {
}

export function newLfo1Chunk(): Lfo1Chunk {
    const chunkName = [0x6c, 0x66, 0x6f, 0x20] // 'lfo '
    const chunk = newChunkFromSpec(chunkName, 14, ['pad1', 'waveform', 'rate', 'delay', 'depth', 'sync', 'pad2', 'modwheel', 'aftertouch',
        'rateMod', 'delayMod', 'depthMod'])
    return chunk as unknown as Lfo1Chunk
}


export interface Lfo2 {
    waveform: number
    rate: number
    delay: number
    depth: number
    retrigger: number
    rateMod: number
    delayMod: number
    depthMod: number
}

export interface Lfo2Chunk extends Chunk, Lfo2 {
}

export function newLfo2Chunk(): Lfo2Chunk {
    const chunkName = [0x6c, 0x66, 0x6f, 0x20] // 'lfo '
    const chunk = newChunkFromSpec(chunkName, 14, [
        'pad1',
        'waveform',
        'rate',
        'delay',
        'depth',
        'pad2',
        'retrigger',
        'pad3',
        'pad4',
        'rateMod',
        'delayMod',
        'depthMod'
    ])
    return chunk as unknown as Lfo2Chunk
}

export interface Mods {
    ampMod1Source: number
    ampMod2Source: number

    panMod1Source: number
    panMod2Source: number
    panMod3Source: number

    lfo1RateModSource: number
    lfo1DelayModSource: number
    lfo1DepthModSource: number

    lfo2RateModSource: number
    lfo2DelayModSource: number
    lfo2DepthModSource: number

    pitchMod1Source: number
    pitchMod2Source: number
    ampModSource: number
    filterModInput1: number
    filterModInput2: number
    filterModInput3: number
}

export interface ModsChunk extends Chunk, Mods {
}

export function newModsChunk(): ModsChunk {
    const chunkName = [0x6d, 0x6f, 0x64, 0x73] // 'lfo '
    const chunk = newChunkFromSpec(chunkName, 38, [
        'pad1',
        'pad2',
        'pad3',
        'pad4',
        'pad5',
        'ampMod1Source',
        'pad6',
        'ampMod2Source',
        'pad7',
        'panMod1Source',
        'pad8',
        'panMod2Source',
        'pad9',
        'panMod3Source',
        'pad10',
        'lfo1RateModSource',
        'pad11',
        'lfo1DelayModSource',
        'pad12',
        'lfo1DepthModSource',
        'pad13',
        'lfo2RateModSource',
        'pad14',
        'lfo2DelayModSource',
        'pad15',
        'lfo2DepthModSource',
        'pad15',
        'pitchMod1Source',
        'pad16',
        'pitchMod2Source',
        'pad17',
        'ampModSource',
        'pad19',
        'filterModInput1',
        'pad19',
        'filterModInput2',
        'pad20',
        'filterModInput3'
    ])
    return chunk as unknown as ModsChunk
}


export interface Keygroup {
    kloc: Kloc
    ampEnvelope: AmpEnvelope
    filterEnvelope: FilterEnvelope
    auxEnvelope: AuxEnvelope
    filter: Filter
    zone1: Zone
    zone2: Zone
    zone3: Zone
    zone4: Zone
}

export interface KeygroupChunk extends Chunk, Keygroup {
}

export interface Kloc {
    lowNote: number
    highNote: number
    semiToneTune: number
    fineTune: number
    overrideFx: number
    fxSendLevel: number
    pitchMod1: number
    pitchMod2: number
    ampMod: number
    zoneXFade: number
    muteGroup: number
}

export interface KlocChunk extends Chunk, Kloc {

}

export interface AmpEnvelope {
    attack: number
    decay: number
    release: number
    sustain: number
    velocity2Attack: number
    keyscale: number
    onVelocity2Release: number
    offVelocity2Release: number
}

export interface AmpEnvelopeChunk extends Chunk, AmpEnvelope {
}

export interface FilterEnvelope {
    attack: number
    decay: number
    release: number
    sustain: number
    depth: number
    velocity2Attack: number
    keyscale: number
    onVelocity2Release: number
    offVelocity2Release: number
}

export interface FilterEnvelopeChunk extends Chunk, FilterEnvelope {
}

export interface AuxEnvelope {
    rate1: number
    rate2: number
    rate3: number
    rate4: number
    level1: number
    level2: number
    level3: number
    level4: number
    velocity2Rate1: number
    keyboard2Rate2and4: number
    velocity2Rate4: number
    offVelocity2Rate4: number
    velocity2OutLevel: number
}

export interface AuxEnvelopeChunk extends Chunk, AuxEnvelope {
}

export interface Filter {
    mode: number
    cutoff: number
    resonance: number
    keyboardTrack: number
    modInput1: number
    modInput2: number
    modInput3: number
    headroom: number
}

export interface FilterChunk extends Chunk, Filter {
}

export interface Zone {
    sampleNameLength: number
    sampleName: string
    lowVelocity: number
    highVelocity: number
    fineTune: number
    semiToneTune: number
    filter: number
    panBalance: number
    playback: number
    output: number
    level: number
    keyboardTrack: number
    velocity2StartLsb: number
    velocity2StartMsb: number
}

export interface ZoneChunk extends Chunk, Zone {
}

export function newKeygroupChunk() {
    const pad = new Pad()
    const keygroupChunkName = [0x6b, 0x67, 0x72, 0x70]
    const klocChunkName = [0x6b, 0x6c, 0x6f, 0x63];
    const klocChunkSpec = [
        pad.padField(),
        pad.padField(),
        pad.padField(),
        pad.padField(),
        'lowNote',
        'highNote',
        'semiToneTune',
        'fineTune',
        'overrideFx',
        'fxSendLevel',
        'pitchMod1',
        'pitchMod2',
        'ampMod',
        'zoneXFade',
        'muteGroup',
        pad.padField()
    ]
    const envChunkName = [0x65, 0x6e, 0x76, 0x20]
    const ampEnvelopeChunkSpec = [
        pad.padField(),
        'attack',
        pad.padField(),
        'decay',
        'release',
        pad.padField(),
        pad.padField(),
        'sustain',
        pad.padField(),
        pad.padField(),
        'velocity2Attack',
        pad.padField(),
        'keyscale',
        pad.padField(),
        'onVelocity2Release',
        pad.padField(),
        'offVelocity2Release',
        pad.padField(),
        // pad.padField()
    ];
    const filterEnvelopeChunkName = [
        pad.padField(),
        'attack',
        pad.padField(),
        'decay',
        'release',
        pad.padField(),
        pad.padField(),
        'sustain',
        pad.padField(),
        'depth',
        'velocity2Attack',
        pad.padField(),
        'keyscale',
        pad.padField(),
        'onVelocity2Release',
        'offVelocity2Release',
        pad.padField(),
        pad.padField()
    ];
    const auxEnvelopeChunkSpec = [
        pad.padField(),
        'rate1',
        'rate2',
        'rate3',
        'rate4',
        'level1',
        'level2',
        'level3',
        'level4',
        pad.padField(),
        'velocity2Rate1',
        pad.padField(),
        'keyboard2Rate2and4',
        pad.padField(),
        'velocity2Rate4',
        'offVelocity2Rate4',
        'velocity2OutLevel',
        pad.padField()
    ];
    const filterChunkName = [0x66, 0x69, 0x6c, 0x74];
    const filterChunkSpec = [
        pad.padField(),
        'mode',
        'cutoff',
        'resonance',
        'keyboardTrack',
        'modInput1',
        'modInput2',
        'modInput3',
        'headroom',
        pad.padField()
    ];
    // 20 character sample name
    const sampleNameSpec = []
    for (let i = 0; i < 20; i++) {
        sampleNameSpec.push('character' + i)
    }
    // 12 unused fields after the sample name
    const zonePadSpec = []
    for (let i = 0; i < 12; i++) {
        zonePadSpec.push(pad.padField())
    }

    const zoneChunkName = [0x7a, 0x6f, 0x6e, 0x65];
    // const zoneChunkSpec = [pad.padField(), 'sampleNameLength'].concat(sampleNameSpec).concat(zonePadSpec).concat([
    const zoneChunkSpec = [pad.padField(), 'sampleNameLength'].concat(sampleNameSpec).concat(zonePadSpec).concat([
        'lowVelocity',
        'highVelocity',
        'fineTune',
        'semiToneTune',
        'filter',
        'panBalance',
        'playback',
        'output',
        'level',
        'keyboardTrack',
        'velocity2StartLsb',
        'velocity2StartMsb'
    ]);

    // XXX: Ugly
    const zones = []
    for (let i = 0; i < 4; i++) {
        zones[i] = newChunkFromSpec(zoneChunkName, 48, zoneChunkSpec)
    }
    // const keygroupLength = 344
    const keygroupLength = 352
    return {
        chunkName: keygroupChunkName,
        name: bytes2String(keygroupChunkName),
        lengthInBytes: keygroupLength,
        kloc: newChunkFromSpec(klocChunkName, 16, klocChunkSpec) as unknown as KlocChunk,
        ampEnvelope: newChunkFromSpec(envChunkName, 18, ampEnvelopeChunkSpec) as unknown as AmpEnvelopeChunk,
        filterEnvelope: newChunkFromSpec(envChunkName, 18, filterEnvelopeChunkName) as unknown as FilterEnvelopeChunk,
        auxEnvelope: newChunkFromSpec(envChunkName, 18, auxEnvelopeChunkSpec) as unknown as AuxEnvelopeChunk,
        filter: newChunkFromSpec(filterChunkName, 10, filterChunkSpec) as unknown as FilterChunk,
        zone1: zones[0],
        zone2: zones[1],
        zone3: zones[2],
        zone4: zones[3],
        parse(buf, offset): number {

            checkOrThrow(buf, keygroupChunkName, offset)
            offset += parseChunkHeader(buf, this, offset)

            offset += this.kloc.parse(buf, offset)
            offset += this.ampEnvelope.parse(buf, offset)

            offset += this.filterEnvelope.parse(buf, offset)
            offset += this.auxEnvelope.parse(buf, offset)
            offset += this.filter.parse(buf, offset)

            offset += this.zone1.parse(buf, offset)
            parseSampleName(this.zone1)

            offset += this.zone2.parse(buf, offset)
            parseSampleName(this.zone2)

            offset += this.zone3.parse(buf, offset)
            parseSampleName(this.zone3)

            offset += this.zone4.parse(buf, offset)
            parseSampleName(this.zone4)

            return keygroupLength
        },
        write(buf: Buffer, offset: number): number {
            // offset += this.headerChunk.write(buf, offset)
            for (let i = 0; i < keygroupChunkName.length; i++) {
                offset += writeByte(buf, keygroupChunkName[i], offset)
            }
            // offset += writeByte(buf, this.chunkSize, offset)
            buf.writeInt32LE(this.length, offset)
            offset += 4

            offset += this.kloc.write(buf, offset)
            offset += this.ampEnvelope.write(buf, offset)
            offset += this.filterEnvelope.write(buf, offset)
            offset += this.auxEnvelope.write(buf, offset)
            offset += this.filter.write(buf, offset)

            writeSampleName(this.zone1)
            offset += this.zone1.write(buf, offset)

            writeSampleName(this.zone2)
            offset += this.zone2.write(buf, offset)

            writeSampleName(this.zone3)
            offset += this.zone3.write(buf, offset)

            writeSampleName(this.zone4)
            offset += this.zone4.write(buf, offset)
            return keygroupLength
        }

    } as KeygroupChunk

}

// XXX: Pretty crappy way to do this
function parseSampleName(zone: ZoneChunk) {
    zone.sampleName = ''
    for (let i = 0; i < zone.sampleNameLength; i++) {
        zone.sampleName += String.fromCharCode(zone[`character${i}`])
    }
}

function writeSampleName(zone: ZoneChunk) {
    zone.sampleNameLength = zone.sampleName.length
    // XXX: This is a hack
    for(const name of Object.getOwnPropertyNames(zone)) {
        if (name.startsWith('character')) {
            zone[name] = 0
        }
    }
    for (let i = 0; i < zone.sampleNameLength; i++) {
        zone[`character${i}`] = zone.sampleName.charCodeAt(i)
    }
}

export interface AkaiS56kProgram {
    getKeygroupCount(): number;

    getProgramNumber(): number;

    getOutput(): Output;

    getTune(): Tune;

    getLfo1(): Lfo1;

    getLfo2(): Lfo2;

    getMods(): Mods;

    getKeygroups(): Keygroup[];

    writeToBuffer(buf: Buffer, offset: number): number

    apply(mods: any): void;
}

export function newProgramFromBuffer(buf: Buffer): AkaiS56kProgram {
    const program = new BasicProgram()
    program.parse(buf)
    return program
}

export function newProgramFromJson(json: string): AkaiS56kProgram {
    const program = new BasicProgram()
    program.copyFromJson(json)
    return program
}

class BasicProgram implements AkaiS56kProgram {
    private readonly program: ProgramChunk
    private readonly header: HeaderChunk
    private readonly output: OutputChunk
    private readonly tune: TuneChunk
    private readonly lfo1: Lfo1Chunk
    private readonly lfo2: Lfo2Chunk
    private readonly mods: ModsChunk
    private readonly keygroups: KeygroupChunk[] = []
    private originalBuffer!: Buffer;
    private firstKeygroupOffset!: number;

    constructor() {
        this.header = newHeaderChunk()
        this.program = newProgramChunk()
        this.output = newOutputChunk()
        this.tune = newTuneChunk()
        this.lfo1 = newLfo1Chunk()
        this.lfo2 = newLfo2Chunk()
        this.mods = newModsChunk()
    }

    apply(mods: any) {
        // XXX: Recursion is probably ok here, since the graphs aren't deep or recursive; but, it's a stack error
        // waiting to happen
        function recursiveApply(source: any, dest: any) {
            for (const field of Object.getOwnPropertyNames(dest)) {
                if (source.hasOwnProperty(field) && dest.hasOwnProperty(field) && typeof source[field] === typeof dest[field]) {
                    if (typeof source[field] === 'object') {
                        recursiveApply(source[field], dest[field])
                    } else {
                        dest[field] = source[field]
                    }
                }
            }
        }

        // XXX: This is also gross; there should be a more well-though-out way to CRUD keygroups
        if (mods.keygroupCount != this.getKeygroupCount()) {
            // the number of keygroups has changed. Make them the same
            if (mods.keygroupCount < this.getKeygroupCount()) {
                this.keygroups.length = mods.keygroupCount
            } else {
                for (let i = 0; i < mods.keygroupCount; i++) {
                    if (i >= this.keygroups.length) {
                        // add a new keygroup
                        const keygroup = newKeygroupChunk()

                        this.keygroups.push(keygroup)
                        keygroup.parse(this.originalBuffer, this.firstKeygroupOffset)
                    }
                    const modKeygroup: Keygroup =  mods.keygroups[i]
                    const myKeygroup = this.keygroups[i]
                    for (let i = 0; i< 4; i++) {
                        const zoneName = 'zone' + (i + 1)
                        const modZone: Zone = modKeygroup[zoneName]
                        if (modZone) {
                            const myZone: Zone = myKeygroup[zoneName]
                            myZone.sampleName = modZone.sampleName
                            myZone.sampleNameLength = myZone.sampleName.length
                            myZone.semiToneTune = modZone.semiToneTune
                            myZone.lowVelocity = modZone.lowVelocity
                            myZone.highVelocity = modZone.highVelocity
                        }
                    }
                }
            }
        }
        recursiveApply(mods, this)
        recursiveApply(mods, this.program)

    }

    parse(buf: Buffer, offset: number = 0) {
        this.originalBuffer = buf
        offset += this.header.parse(buf, offset)
        offset += this.program.parse(buf, offset)
        offset += this.output.parse(buf, offset)
        offset += this.tune.parse(buf, offset)
        offset += this.lfo1.parse(buf, offset)
        offset += this.lfo2.parse(buf, offset)
        offset += this.mods.parse(buf, offset)
        this.firstKeygroupOffset = offset
        for (let i = 0; i < this.getKeygroupCount(); i++) {
            const keygroup = newKeygroupChunk()
            this.keygroups.push(keygroup)
            try {
                offset += keygroup.parse(buf, offset)
            } catch (err) {
                throw new Error(`Failed to parse keygroup ${i + 1} of ${this.getKeygroupCount()} at offset ${offset}: ${err.message}`)
            }
        }
    }

    writeToBuffer(buf: Buffer, offset: number = 0) {
        offset += this.header.write(buf, offset)
        offset += this.program.write(buf, offset)
        offset += this.output.write(buf, offset)
        offset += this.tune.write(buf, offset)
        offset += this.lfo1.write(buf, offset)
        offset += this.lfo2.write(buf, offset)
        offset += this.mods.write(buf, offset)
        for (let i = 0; i < this.keygroups.length; i++) {
            const keygroup = this.keygroups[i]
            offset += keygroup.write(buf, offset)
        }
        return offset
    }

    copyFromJson(json: string) {
        const obj = JSON.parse(json)
        this.program.programNumber = obj.programNumber
        this.program.keygroupCount = obj.keygroupCount
        this.output.loudness = obj.output.loudness
        this.output.ampMod1 = obj.output.ampMod1
        this.output.ampMod2 = obj.output.ampMod2
        this.output.panMod1 = obj.output.panMod1
        this.output.panMod2 = obj.output.panMod2
        this.output.panMod3 = obj.output.panMod3
        this.output.velocitySensitivity = obj.output.velocitySensitivity
        this.tune.semiToneTune = obj.tune.semiToneTune
        this.tune.fineTune = obj.tune.fineTune
        this.tune.detuneC = obj.tune.detuneC
        this.tune.detuneCSharp = obj.tune.detuneCSharp
        this.tune.detuneD = obj.tune.detuneD
        this.tune.detuneEFlat = obj.tune.detuneEFlat
        this.tune.detuneE = obj.tune.detuneE
        this.tune.detuneF = obj.tune.detuneF
        this.tune.detuneFSharp = obj.tune.detuneFSharp
        this.tune.detuneG = obj.tune.detuneG
        this.tune.detuneGSharp = obj.tune.detuneGSharp
        this.tune.detuneA = obj.tune.detuneA
        this.tune.detuneBFlat = obj.tune.detuneBFlat
        this.tune.detuneB = obj.tune.detuneB

        this.lfo1.waveform = obj.lfo1.waveform
        this.lfo1.rate = obj.lfo1.rate
        this.lfo1.delay = obj.lfo1.delay
        this.lfo1.depth = obj.lfo1.depth
        this.lfo1.sync = obj.lfo1.sync
        this.lfo1.modwheel = obj.lfo1.modwheel
        this.lfo1.aftertouch = obj.lfo1.aftertouch
        this.lfo1.rateMod = obj.lfo1.rateMod
        this.lfo1.delayMod = obj.lfo1.delayMod
        this.lfo1.depthMod = obj.lfo1.depthMod

        this.lfo2.waveform = obj.lfo2.waveform
        this.lfo2.rate = obj.lfo2.rate
        this.lfo2.delay = obj.lfo2.delay
        this.lfo2.depth = obj.lfo2.depth
        this.lfo2.retrigger = obj.lfo2.retrigger
        this.lfo2.rateMod = obj.lfo2.rateMod
        this.lfo2.delayMod = obj.lfo2.delayMod
        this.lfo2.depthMod = obj.lfo2.depthMod

        this.mods.ampMod1Source = obj.mods.ampMod1Source
        this.mods.ampMod2Source = obj.mods.ampMod2Source
        this.mods.panMod1Source = obj.mods.panMod1Source
        this.mods.panMod2Source = obj.mods.panMod2Source
        this.mods.panMod3Source = obj.mods.panMod3Source
        this.mods.lfo1RateModSource = obj.mods.lfo1RateModSource
        this.mods.lfo1DelayModSource = obj.mods.lfo1DelayModSource
        this.mods.lfo1DepthModSource = obj.mods.lfo1DepthModSource
        this.mods.lfo2RateModSource = obj.mods.lfo2RateModSource
        this.mods.lfo2DelayModSource = obj.mods.lfo2DelayModSource
        this.mods.lfo2DepthModSource = obj.mods.lfo2DepthModSource
        this.mods.pitchMod1Source = obj.mods.pitchMod1Source
        this.mods.pitchMod2Source = obj.mods.pitchMod2Source
        this.mods.ampModSource = obj.mods.ampModSource
        this.mods.filterModInput1 = obj.mods.filterModInput1
        this.mods.filterModInput2 = obj.mods.filterModInput2
        this.mods.filterModInput3 = obj.mods.filterModInput3

        this.keygroups.length = 0
        for (let i = 0; i < obj.keygroups.length; i++) {
            const keygroup = newKeygroupChunk()
            this.keygroups.push(keygroup)

            const srcKloc = obj.keygroups[i].kloc
            const destKloc = keygroup.kloc

            destKloc.lowNote = srcKloc.lowNote
            destKloc.highNote = srcKloc.highNote
            destKloc.semiToneTune = srcKloc.semiToneTune
            destKloc.fineTune = srcKloc.fineTune
            destKloc.overrideFx = srcKloc.overrideFx
            destKloc.fxSendLevel = srcKloc.fxSendLevel
            destKloc.pitchMod1 = srcKloc.pitchMod1
            destKloc.pitchMod2 = srcKloc.pitchMod2
            destKloc.ampMod = srcKloc.ampMod
            destKloc.zoneXFade = srcKloc.zoneXFade
            destKloc.muteGroup = srcKloc.muteGroup

            const srcAmpEnv = obj.keygroups[i].ampEnvelope
            const destAmpEnv = keygroup.ampEnvelope
            destAmpEnv.attack = srcAmpEnv.attack
            destAmpEnv.decay = srcAmpEnv.decay
            destAmpEnv.sustain = srcAmpEnv.sustain
            destAmpEnv.release = srcAmpEnv.release
            destAmpEnv.velocity2Attack = srcAmpEnv.velocity2Attack
            destAmpEnv.keyscale = srcAmpEnv.keyscale
            destAmpEnv.onVelocity2Release = srcAmpEnv.onVelocity2Release
            destAmpEnv.offVelocity2Release = srcAmpEnv.offVelocity2Release

            const srcFiltEnv = obj.keygroups[i].filterEnvelope
            const destFiltEnv = keygroup.filterEnvelope
            destFiltEnv.attack = srcFiltEnv.attack
            destFiltEnv.decay = srcFiltEnv.decay
            destFiltEnv.sustain = srcFiltEnv.sustain
            destFiltEnv.release = srcFiltEnv.release
            destFiltEnv.depth = srcFiltEnv.depth
            destFiltEnv.velocity2Attack = srcFiltEnv.velocity2Attack
            destFiltEnv.keyscale = srcFiltEnv.keyscale
            destFiltEnv.onVelocity2Release = srcFiltEnv.onVelocity2Release
            destFiltEnv.offVelocity2Release = srcFiltEnv.offVelocity2Release

            const srcAuxEnv = obj.keygroups[i].auxEnvelope
            const destAuxEnv = keygroup.auxEnvelope
            destAuxEnv.rate1 = srcAuxEnv.rate1
            destAuxEnv.rate2 = srcAuxEnv.rate2
            destAuxEnv.rate3 = srcAuxEnv.rate3
            destAuxEnv.rate4 = srcAuxEnv.rate4
            destAuxEnv.level1 = srcAuxEnv.level1
            destAuxEnv.level2 = srcAuxEnv.level2
            destAuxEnv.level3 = srcAuxEnv.level3
            destAuxEnv.level4 = srcAuxEnv.level4

            const srcFilt = obj.keygroups[i].filter
            const destFilt = keygroup.filter
            destFilt.mode = srcFilt.mode
            destFilt.cutoff = srcFilt.cutoff
            destFilt.resonance = srcFilt.resonance
            destFilt.keyboardTrack = srcFilt.keyboardTrack
            destFilt.modInput1 = srcFilt.modInput1
            destFilt.modInput2 = srcFilt.modInput2
            destFilt.modInput3 = srcFilt.modInput3
            destFilt.headroom = srcFilt.headroom

            for (let j = 1; j <= 4; j++) {
                let zoneName = `zone${j}`;
                const srcZone = obj.keygroups[i][zoneName]
                const destZone = keygroup[zoneName]
                destZone.sampleName = srcZone.sampleName
                destZone.sampleNameLength = destZone.sampleName.length
                destZone.lowVelocity = srcZone.lowVelocity
                destZone.highVelocity = srcZone.highVelocity
                destZone.fineTune = srcZone.fineTune
                destZone.semiToneTune = srcZone.semiToneTune
                destZone.filter = srcZone.filter
                destZone.panBalance = srcZone.panBalance
                destZone.playback = srcZone.playback
                destZone.output = srcZone.output
                destZone.level = srcZone.level
                destZone.keyboardTrack = srcZone.keyboardTrack
                destZone.velocity2StartLsb = srcZone.velocity2StartLsb
                destZone.velocity2StartMsb = srcZone.velocity2StartMsb
            }
        }
    }

    getKeygroupCount() {
        return this.program.keygroupCount
    }

    getProgramNumber() {
        return this.program.programNumber
    }

    getOutput(): Output {
        return this.output
    }

    getTune(): Tune {
        return this.tune
    }

    getLfo1(): Lfo1 {
        return this.lfo1
    }

    getLfo2(): Lfo2 {
        return this.lfo2
    }

    getMods(): Mods {
        return this.mods;
    }

    getKeygroups(): Keygroup[] {
        return Array.from(this.keygroups)
    }
}

