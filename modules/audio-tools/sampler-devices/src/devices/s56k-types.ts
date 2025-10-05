import {Result} from "@oletizi/sampler-lib";

/**
 * Result of parsing S5000/S6000 program file(s).
 *
 * @remarks
 * Extends standard Result interface with array of parsed programs.
 * Multiple programs may be returned when parsing batch files.
 *
 * @public
 */
export interface AkaiS56ProgramResult extends Result {
    /** Array of parsed S5000/S6000 programs */
    data: AkaiS56kProgram[]
}

/**
 * Base chunk interface for S5000/S6000 program data.
 *
 * @remarks
 * All S5000/S6000 program data is organized into chunks with a 4-byte name,
 * length field, and structured content. Each chunk can parse from and write to buffers.
 *
 * @public
 */
export interface Chunk {
    /** 4-byte chunk identifier (ASCII characters) */
    chunkName: number[]
    /** Length of chunk data in bytes (excluding header) */
    lengthInBytes: number
    /** Human-readable chunk name */
    name: string

    /**
     * Write chunk to buffer at specified offset.
     *
     * @param buf - Target buffer
     * @param offset - Byte offset to start writing
     * @returns Number of bytes written
     */
    write(buf: Buffer, offset: number): number

    /**
     * Parse chunk from buffer at specified offset.
     *
     * @param buf - Source buffer
     * @param offset - Byte offset to start reading
     * @returns Number of bytes consumed
     */
    parse(buf: Buffer, offset: number): number
}

/**
 * Header chunk for S5000/S6000 program files.
 *
 * @remarks
 * The header chunk contains file format identification and version information.
 *
 * @public
 */
export interface HeaderChunk extends Chunk {
}

/**
 * Program metadata chunk.
 *
 * @remarks
 * Contains program number and keygroup count. This chunk appears after the header
 * and before parameter chunks.
 *
 * @public
 */
export interface ProgramChunk extends Chunk {
    /** Program number (1-999) */
    programNumber: number
    /** Number of keygroups in this program (0-99) */
    keygroupCount: number
}

/**
 * Output settings for a program.
 *
 * @remarks
 * Defines output parameters including loudness, velocity sensitivity, and modulation routing.
 *
 * @public
 */
export interface Output {
    /** Loudness level (0-100) */
    loudness: number
    /** Amplitude modulation 1 amount (-100 to 100) */
    ampMod1: number
    /** Pan modulation 3 amount (-100 to 100) */
    panMod3: number
    /** Pan modulation 1 amount (-100 to 100) */
    panMod1: number
    /** Amplitude modulation 2 amount (-100 to 100) */
    ampMod2: number
    /** Pan modulation 2 amount (-100 to 100) */
    panMod2: number
    /** Velocity to amplitude sensitivity (-100 to 100) */
    velocitySensitivity: number
}

/**
 * Output chunk combining Output interface with Chunk.
 *
 * @public
 */
export interface OutputChunk extends Output, Chunk {
}

/**
 * Tuning settings for a program.
 *
 * @remarks
 * Includes global tuning, per-note detuning for all 12 chromatic notes,
 * and pitch bend configuration.
 *
 * @public
 */
export interface Tune {
    /** Global semitone tuning (-36 to 36) */
    semiToneTune: number
    /** Global fine tuning in cents (-50 to 50) */
    fineTune: number
    /** Detune for C note in cents */
    detuneC: number
    /** Detune for C# note in cents */
    detuneCSharp: number
    /** Detune for D note in cents */
    detuneD: number
    /** Detune for Eb note in cents */
    detuneEFlat: number
    /** Detune for E note in cents */
    detuneE: number
    /** Detune for F note in cents */
    detuneF: number
    /** Detune for F# note in cents */
    detuneFSharp: number
    /** Detune for G note in cents */
    detuneG: number
    /** Detune for G# note in cents */
    detuneGSharp: number
    /** Detune for A note in cents */
    detuneA: number
    /** Detune for Bb note in cents */
    detuneBFlat: number
    /** Detune for B note in cents */
    detuneB: number
    /** Pitch bend up range in semitones (0-24) */
    pitchBendUp: number
    /** Pitch bend down range in semitones (0-24) */
    pitchBendDown: number
    /** Pitch bend mode (0=normal, 1=smooth) */
    bendMode: number
    /** Aftertouch pitch amount in semitones (-12 to 12) */
    aftertouch: number
}

/**
 * Tune chunk combining Tune interface with Chunk.
 *
 * @public
 */
export interface TuneChunk extends Chunk, Tune {
}

/**
 * LFO1 settings.
 *
 * @remarks
 * LFO1 is typically used for vibrato and other cyclic modulations.
 *
 * @public
 */
export interface Lfo1 {
    /** Waveform type (0-8: sine, triangle, square, etc.) */
    waveform: number
    /** LFO rate/speed (0-100) */
    rate: number
    /** Initial delay before LFO starts (0-100) */
    delay: number
    /** LFO modulation depth (0-100) */
    depth: number
    /** MIDI sync enable (0=off, 1=on) */
    sync: number
    /** Modwheel to depth amount (0-100) */
    modwheel: number
    /** Aftertouch to depth amount (0-100) */
    aftertouch: number
    /** Rate modulation amount (-100 to 100) */
    rateMod: number
    /** Delay modulation amount (-100 to 100) */
    delayMod: number
    /** Depth modulation amount (-100 to 100) */
    depthMod: number
}

/**
 * LFO1 chunk combining Lfo1 interface with Chunk.
 *
 * @public
 */
export interface Lfo1Chunk extends Chunk, Lfo1 {
}

/**
 * LFO2 settings.
 *
 * @remarks
 * LFO2 provides additional modulation routing, typically for filter or amplitude.
 *
 * @public
 */
export interface Lfo2 {
    /** Waveform type (0-8: sine, triangle, square, etc.) */
    waveform: number
    /** LFO rate/speed (0-100) */
    rate: number
    /** Initial delay before LFO starts (0-100) */
    delay: number
    /** LFO modulation depth (0-100) */
    depth: number
    /** Retrigger on new note (0=off, 1=on) */
    retrigger: number
    /** Rate modulation amount (-100 to 100) */
    rateMod: number
    /** Delay modulation amount (-100 to 100) */
    delayMod: number
    /** Depth modulation amount (-100 to 100) */
    depthMod: number
}

/**
 * LFO2 chunk combining Lfo2 interface with Chunk.
 *
 * @public
 */
export interface Lfo2Chunk extends Chunk, Lfo2 {
}

/**
 * Modulation routing sources.
 *
 * @remarks
 * Defines which modulation sources are routed to various parameters.
 * Source values typically map to: 0=none, 1=modwheel, 2=aftertouch, 3=velocity, etc.
 *
 * @public
 */
export interface Mods {
    /** Amplitude modulation 1 source (0-14) */
    ampMod1Source: number
    /** Amplitude modulation 2 source (0-14) */
    ampMod2Source: number

    /** Pan modulation 1 source (0-14) */
    panMod1Source: number
    /** Pan modulation 2 source (0-14) */
    panMod2Source: number
    /** Pan modulation 3 source (0-14) */
    panMod3Source: number

    /** LFO1 rate modulation source (0-14) */
    lfo1RateModSource: number
    /** LFO1 delay modulation source (0-14) */
    lfo1DelayModSource: number
    /** LFO1 depth modulation source (0-14) */
    lfo1DepthModSource: number

    /** LFO2 rate modulation source (0-14) */
    lfo2RateModSource: number
    /** LFO2 delay modulation source (0-14) */
    lfo2DelayModSource: number
    /** LFO2 depth modulation source (0-14) */
    lfo2DepthModSource: number

    /** Pitch modulation 1 source (0-14) */
    pitchMod1Source: number
    /** Pitch modulation 2 source (0-14) */
    pitchMod2Source: number
    /** Amplitude modulation source (0-14) */
    ampModSource: number
    /** Filter modulation input 1 source (0-14) */
    filterModInput1: number
    /** Filter modulation input 2 source (0-14) */
    filterModInput2: number
    /** Filter modulation input 3 source (0-14) */
    filterModInput3: number
}

/**
 * Mods chunk combining Mods interface with Chunk.
 *
 * @public
 */
export interface ModsChunk extends Chunk, Mods {
}

/**
 * Keygroup location and global settings.
 *
 * @remarks
 * Defines the keyboard range and global parameters for a keygroup.
 *
 * @public
 */
export interface Kloc {
    /** Lowest MIDI note for this keygroup (0-127) */
    lowNote: number
    /** Highest MIDI note for this keygroup (0-127) */
    highNote: number
    /** Keygroup semitone tuning (-36 to 36) */
    semiToneTune: number
    /** Keygroup fine tuning in cents (-50 to 50) */
    fineTune: number
    /** Override global FX settings (0=off, 1=on) */
    overrideFx: number
    /** FX send level (0-100) */
    fxSendLevel: number
    /** Pitch modulation 1 amount (-100 to 100) */
    pitchMod1: number
    /** Pitch modulation 2 amount (-100 to 100) */
    pitchMod2: number
    /** Amplitude modulation amount (-100 to 100) */
    ampMod: number
    /** Zone crossfade amount (0-100) */
    zoneXFade: number
    /** Mute group assignment (0=none, 1-99=group) */
    muteGroup: number
}

/**
 * Kloc chunk combining Kloc interface with Chunk.
 *
 * @public
 */
export interface KlocChunk extends Chunk, Kloc {
}

/**
 * Amplitude envelope settings.
 *
 * @remarks
 * Defines the volume envelope for a keygroup.
 *
 * @public
 */
export interface AmpEnvelope {
    /** Attack time (0-100) */
    attack: number
    /** Decay time (0-100) */
    decay: number
    /** Release time (0-100) */
    release: number
    /** Sustain level (0-100) */
    sustain: number
    /** Velocity to attack time modulation (-100 to 100) */
    velocity2Attack: number
    /** Keyboard tracking of envelope times (0-100) */
    keyscale: number
    /** Note-on velocity to release time (-100 to 100) */
    onVelocity2Release: number
    /** Note-off velocity to release time (-100 to 100) */
    offVelocity2Release: number
}

/**
 * Amp envelope chunk combining AmpEnvelope interface with Chunk.
 *
 * @public
 */
export interface AmpEnvelopeChunk extends Chunk, AmpEnvelope {
}

/**
 * Filter envelope settings.
 *
 * @remarks
 * Defines the filter envelope for a keygroup.
 *
 * @public
 */
export interface FilterEnvelope {
    /** Attack time (0-100) */
    attack: number
    /** Decay time (0-100) */
    decay: number
    /** Release time (0-100) */
    release: number
    /** Sustain level (0-100) */
    sustain: number
    /** Envelope modulation depth to filter (-100 to 100) */
    depth: number
    /** Velocity to attack time modulation (-100 to 100) */
    velocity2Attack: number
    /** Keyboard tracking of envelope times (0-100) */
    keyscale: number
    /** Note-on velocity to release time (-100 to 100) */
    onVelocity2Release: number
    /** Note-off velocity to release time (-100 to 100) */
    offVelocity2Release: number
}

/**
 * Filter envelope chunk combining FilterEnvelope interface with Chunk.
 *
 * @public
 */
export interface FilterEnvelopeChunk extends Chunk, FilterEnvelope {
}

/**
 * Auxiliary envelope settings.
 *
 * @remarks
 * Flexible 4-stage envelope for custom modulation routing.
 *
 * @public
 */
export interface AuxEnvelope {
    /** Rate for stage 1 (0-100) */
    rate1: number
    /** Rate for stage 2 (0-100) */
    rate2: number
    /** Rate for stage 3 (0-100) */
    rate3: number
    /** Rate for stage 4 (0-100) */
    rate4: number
    /** Level for stage 1 (0-100) */
    level1: number
    /** Level for stage 2 (0-100) */
    level2: number
    /** Level for stage 3 (0-100) */
    level3: number
    /** Level for stage 4 (0-100) */
    level4: number
    /** Velocity to rate 1 modulation (-100 to 100) */
    velocity2Rate1: number
    /** Keyboard to rates 2 and 4 modulation (-100 to 100) */
    keyboard2Rate2and4: number
    /** Velocity to rate 4 modulation (-100 to 100) */
    velocity2Rate4: number
    /** Note-off velocity to rate 4 modulation (-100 to 100) */
    offVelocity2Rate4: number
    /** Velocity to output level modulation (-100 to 100) */
    velocity2OutLevel: number
}

/**
 * Auxiliary envelope chunk combining AuxEnvelope interface with Chunk.
 *
 * @public
 */
export interface AuxEnvelopeChunk extends Chunk, AuxEnvelope {
}

/**
 * Filter settings for a keygroup.
 *
 * @remarks
 * S5000/S6000 provides multiple filter modes and extensive modulation routing.
 *
 * @public
 */
export interface Filter {
    /** Filter mode (0=LP, 1=HP, 2=BP, etc.) */
    mode: number
    /** Filter cutoff frequency (0-100) */
    cutoff: number
    /** Filter resonance amount (0-100) */
    resonance: number
    /** Keyboard tracking of cutoff (-100 to 100) */
    keyboardTrack: number
    /** Modulation input 1 amount (-100 to 100) */
    modInput1: number
    /** Modulation input 2 amount (-100 to 100) */
    modInput2: number
    /** Modulation input 3 amount (-100 to 100) */
    modInput3: number
    /** Filter headroom setting (0-100) */
    headroom: number
}

/**
 * Filter chunk combining Filter interface with Chunk.
 *
 * @public
 */
export interface FilterChunk extends Chunk, Filter {
}

/**
 * Sample zone settings.
 *
 * @remarks
 * Each keygroup can have up to 4 zones for velocity switching or crossfading.
 * Zones define which sample plays and its playback parameters.
 *
 * @public
 */
export interface Zone {
    /** Length of sample name string */
    sampleNameLength: number
    /** Sample name (max 12 characters) */
    sampleName: string
    /** Lowest velocity for this zone (0-127) */
    lowVelocity: number
    /** Highest velocity for this zone (0-127) */
    highVelocity: number
    /** Zone fine tuning in cents (-50 to 50) */
    fineTune: number
    /** Zone semitone tuning (-36 to 36) */
    semiToneTune: number
    /** Filter override (0=use keygroup filter, 1=zone filter) */
    filter: number
    /** Pan/balance position (-50 to 50, 0=center) */
    panBalance: number
    /** Playback mode (0=normal, 1=reverse, 2=loop, etc.) */
    playback: number
    /** Output routing (0-7) */
    output: number
    /** Zone level/volume (0-100) */
    level: number
    /** Keyboard tracking of pitch (0-100) */
    keyboardTrack: number
    /** Velocity to sample start LSB (0-255) */
    velocity2StartLsb: number
    /** Velocity to sample start MSB (0-255) */
    velocity2StartMsb: number
}

/**
 * Zone chunk combining Zone interface with Chunk.
 *
 * @public
 */
export interface ZoneChunk extends Chunk, Zone {
}

/**
 * Complete keygroup definition.
 *
 * @remarks
 * A keygroup combines all parameters for a keyboard range: location, envelopes,
 * filter, and up to 4 sample zones.
 *
 * @public
 */
export interface Keygroup {
    /** Keygroup location and global settings */
    kloc: Kloc
    /** Amplitude envelope */
    ampEnvelope: AmpEnvelope
    /** Filter envelope */
    filterEnvelope: FilterEnvelope
    /** Auxiliary envelope */
    auxEnvelope: AuxEnvelope
    /** Filter settings */
    filter: Filter
    /** Sample zone 1 */
    zone1: Zone
    /** Sample zone 2 */
    zone2: Zone
    /** Sample zone 3 */
    zone3: Zone
    /** Sample zone 4 */
    zone4: Zone
}

/**
 * Keygroup chunk combining Keygroup interface with Chunk.
 *
 * @public
 */
export interface KeygroupChunk extends Chunk, Keygroup {
}

/**
 * Complete S5000/S6000 program.
 *
 * @remarks
 * Main interface for working with S5000/S6000 programs. Provides methods to access
 * all program data and apply modifications.
 *
 * @public
 */
export interface AkaiS56kProgram {
    /**
     * Get number of keygroups in this program.
     *
     * @returns Keygroup count (0-99)
     */
    getKeygroupCount(): number;

    /**
     * Get program number.
     *
     * @returns Program number (1-999)
     */
    getProgramNumber(): number;

    /**
     * Get output settings.
     *
     * @returns Output configuration
     */
    getOutput(): Output;

    /**
     * Get tuning settings.
     *
     * @returns Tune configuration
     */
    getTune(): Tune;

    /**
     * Get LFO1 settings.
     *
     * @returns LFO1 configuration
     */
    getLfo1(): Lfo1;

    /**
     * Get LFO2 settings.
     *
     * @returns LFO2 configuration
     */
    getLfo2(): Lfo2;

    /**
     * Get modulation routing.
     *
     * @returns Mods configuration
     */
    getMods(): Mods;

    /**
     * Get all keygroups.
     *
     * @returns Array of keygroups
     */
    getKeygroups(): Keygroup[];

    /**
     * Write program to buffer.
     *
     * @param buf - Target buffer
     * @param offset - Byte offset to start writing
     * @returns Number of bytes written
     */
    writeToBuffer(buf: Buffer, offset: number): number

    /**
     * Apply modifications to program.
     *
     * @param mods - Modification object (structure TBD)
     */
    apply(mods: any): void;
}
