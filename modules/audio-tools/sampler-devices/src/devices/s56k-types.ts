import {Result} from "@oletizi/sampler-lib";

export interface AkaiS56ProgramResult extends Result {
    data: AkaiS56kProgram[]
}

export interface Chunk {
    chunkName: number[]
    lengthInBytes: number
    name: string

    write(buf: Buffer, offset: number): number

    parse(buf: Buffer, offset: number): number
}

export interface HeaderChunk extends Chunk {
}

export interface ProgramChunk extends Chunk {
    programNumber: number
    keygroupCount: number
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
