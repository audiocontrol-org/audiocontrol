/**
 * Roland S-330 Type Definitions
 *
 * TypeScript interfaces for Roland S-330 sampler data structures.
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * @packageDocumentation
 */

// =============================================================================
// System Types
// =============================================================================

/**
 * S-330 system/global parameters
 */
export interface S330SystemParams {
    masterTune: number;      // 0-127 (64 = A440)
    masterLevel: number;     // 0-127
    midiChannel: number;     // 0-15
    deviceId: number;        // 0-31
    exclusiveEnabled: boolean;
    progChangeEnabled: boolean;
    ctrlChangeEnabled: boolean;
    benderEnabled: boolean;
    modWheelEnabled: boolean;
    aftertouchEnabled: boolean;
    holdPedalEnabled: boolean;
}

// =============================================================================
// Patch Types
// =============================================================================

/**
 * Key/velocity mode for patch
 */
export type S330KeyMode = 'whole' | 'dual' | 'split';

/**
 * S-330 patch common parameters
 */
export interface S330PatchCommon {
    name: string;            // 8 characters max
    benderRange: number;     // 0-12 semitones
    aftertouchSens: number;  // 0-127
    keyMode: S330KeyMode;
    splitPoint: number;      // 0-127 (MIDI note)
    portamentoTime: number;  // 0-127
    portamentoEnabled: boolean;
    outputAssign: number;    // 0-8
    level: number;           // 0-127
}

/**
 * S-330 partial (key zone within a patch)
 */
export interface S330Partial {
    toneNumber: number;      // 0-31
    keyRangeLow: number;     // 0-127
    keyRangeHigh: number;    // 0-127
    velRangeLow: number;     // 1-127
    velRangeHigh: number;    // 1-127
    level: number;           // 0-127
    pan: number;             // 0-127 (64 = center)
    coarseTune: number;      // 0-127 (64 = 0, +/-48 semi)
    fineTune: number;        // 0-127 (64 = 0, +/-50 cents)
    outputAssign: number;    // 0-8
    muted: boolean;
}

/**
 * Complete S-330 patch with common params and partials
 */
export interface S330Patch {
    common: S330PatchCommon;
    partials: S330Partial[];
}

// =============================================================================
// Tone Types
// =============================================================================

/**
 * Loop mode for tone playback
 */
export type S330LoopMode = 'forward' | 'alternating' | 'one-shot';

/**
 * LFO destination routing
 */
export type S330LfoDestination = 'pitch' | 'tvf' | 'tva';

/**
 * Sample rate options
 */
export type S330SampleRate = '15kHz' | '30kHz';

/**
 * TVA (Time Variant Amplifier) envelope parameters
 */
export interface S330TvaEnvelope {
    attack: number;          // 0-127
    decay: number;           // 0-127
    sustain: number;         // 0-127
    release: number;         // 0-127
}

/**
 * TVF (Time Variant Filter) parameters
 */
export interface S330TvfParams {
    cutoff: number;          // 0-127
    resonance: number;       // 0-127
    envDepth: number;        // 0-127
    envelope: S330TvaEnvelope;
}

/**
 * LFO parameters
 */
export interface S330LfoParams {
    rate: number;            // 0-127
    depth: number;           // 0-127
    delay: number;           // 0-127
    destination: S330LfoDestination;
}

/**
 * S-330 tone (sample with synthesis parameters)
 */
export interface S330Tone {
    name: string;            // 8 characters max
    originalKey: number;     // 0-127 (MIDI note)
    sampleRate: S330SampleRate;
    startAddress: number;    // 21-bit wave address
    loopStart: number;       // 21-bit wave address
    loopEnd: number;         // 21-bit wave address
    loopMode: S330LoopMode;
    coarseTune: number;      // 0-127
    fineTune: number;        // 0-127
    level: number;           // 0-127
    tva: S330TvaEnvelope;
    tvf: S330TvfParams;
    lfo: S330LfoParams;
}

// =============================================================================
// SysEx Communication Types
// =============================================================================

/**
 * Roland SysEx command types for S-330
 */
export type S330Command =
    | 'RQ1'  // Data Request
    | 'DT1'  // Data Set
    | 'WSD'  // Want to Send Data
    | 'RQD'  // Request Data
    | 'DAT'  // Data Transfer
    | 'ACK'  // Acknowledge
    | 'EOD'  // End of Data
    | 'ERR'  // Communication Error
    | 'RJC'; // Rejection

/**
 * Bulk dump type identifiers
 */
export type S330BulkDumpType =
    | 'all-patches'
    | 'all-tones'
    | 'single-patch'
    | 'single-tone'
    | 'wave-data'
    | 'all-data';

/**
 * Error codes from ERR response
 */
export type S330ErrorCode =
    | 'checksum'
    | 'unknown-command'
    | 'wrong-format'
    | 'memory-full'
    | 'out-of-range';

/**
 * SysEx message structure
 */
export interface S330SysExMessage {
    deviceId: number;
    command: S330Command;
    address: number[];       // 4 bytes
    data: number[];
    checksum: number;
}

/**
 * Parsed response from S-330
 */
export interface S330Response {
    success: boolean;
    command: S330Command;
    data?: number[];
    errorCode?: S330ErrorCode;
}

// =============================================================================
// Device State Types
// =============================================================================

/**
 * Current state of connected S-330
 */
export interface S330DeviceState {
    connected: boolean;
    deviceId: number;
    patches: S330Patch[];
    tones: S330Tone[];
    systemParams?: S330SystemParams;
}

/**
 * Options for S-330 client initialization
 */
export interface S330ClientOptions {
    deviceId?: number;       // Default: 0
    timeoutMs?: number;      // Default: 500
    retryCount?: number;     // Default: 3
}
