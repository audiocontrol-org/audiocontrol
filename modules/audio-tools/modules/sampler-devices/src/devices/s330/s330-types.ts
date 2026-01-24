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
 * Key mode for patch
 * - normal: Single tone layer across keyboard
 * - v-sw: Velocity switch (layer 1 below threshold, layer 2 above)
 * - x-fade: Crossfade between layers based on velocity
 * - v-mix: Mix both layers, ratio controlled by velocity
 * - unison: Both layers play together with detune
 */
export type S330KeyMode = 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison';

/**
 * Aftertouch assignment destination
 */
export type S330AftertouchAssign = 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter';

/**
 * Key assignment mode
 */
export type S330KeyAssign = 'rotary' | 'fix';

/**
 * S-330 patch parameters (from hardware manual)
 *
 * Each patch is 512 bytes (1024 nibbles) with the following structure:
 * - 12-character name
 * - Performance parameters (bend, aftertouch, mode, etc.)
 * - Two tone mapping layers (109 keys each, MIDI notes 21-127)
 * - Output and level settings
 */
export interface S330PatchCommon {
    name: string;                      // 12 characters max (00 00H-00 17H)
    benderRange: number;               // 0-12 semitones (00 18H)
    aftertouchSens: number;            // 0-127 (00 1CH)
    keyMode: S330KeyMode;              // 00 1EH (0-4)
    velocityThreshold: number;         // 0-127 (00 20H) - V-Sw threshold
    toneLayer1: number[];              // 109 entries, -1 to 31 (00 22H-01 7BH)
    toneLayer2: number[];              // 109 entries, 0-31 (01 7CH-03 55H)
    copySource: number;                // 0-7 (03 56H)
    octaveShift: number;               // -2 to +2 (03 58H)
    level: number;                     // 0-127 (03 5AH)
    detune: number;                    // -64 to +63 (03 5EH) - Unison detune
    velocityMixRatio: number;          // 0-127 (03 60H) - V-Mix ratio
    aftertouchAssign: S330AftertouchAssign; // 03 62H (0-4)
    keyAssign: S330KeyAssign;          // 03 64H (0-1)
    outputAssign: number;              // 0-8 (03 66H) - 0-7=Out 1-8, 8=TONE
}

/**
 * Complete S-330 patch
 *
 * Note: The S-330 uses a tone mapping approach instead of partials.
 * Each patch has two layers of 109 tone assignments (one per MIDI note from C1 to G9).
 */
export interface S330Patch {
    common: S330PatchCommon;
}

// =============================================================================
// Tone Types
// =============================================================================

/**
 * Loop mode for tone playback
 * From protocol: 0=Fwd, 1=Alt, 2=1Shot, 3=Reverse
 */
export type S330LoopMode = 'forward' | 'alternating' | 'one-shot' | 'reverse';

/**
 * Sample rate options
 * From protocol: 0=30kHz, 1=15kHz
 */
export type S330SampleRate = '15kHz' | '30kHz';

/**
 * EG (Envelope Generator) polarity
 */
export type S330EgPolarity = 'normal' | 'reverse';

/**
 * LFO mode
 */
export type S330LfoMode = 'normal' | 'one-shot';

/**
 * Level curve type (0-5)
 */
export type S330LevelCurve = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 8-point envelope used by both TVA and TVF
 * The S-330 uses complex multi-point envelopes, not simple ADSR
 */
export interface S330Envelope {
    /** 8 level values (0-127) */
    levels: [number, number, number, number, number, number, number, number];
    /** 8 rate values (1-127) */
    rates: [number, number, number, number, number, number, number, number];
    /** Sustain point (0-7), envelope holds at this point until note release */
    sustainPoint: number;
    /** End point (1-8), envelope ends at this point */
    endPoint: number;
}

/**
 * TVA (Time Variant Amplifier) parameters
 */
export interface S330TvaParams {
    /** LFO modulation depth for amplitude (0-127) */
    lfoDepth: number;
    /** Keyboard rate follow (0-127) - higher keys = faster envelope */
    keyRate: number;
    /** Output level (0-127) */
    level: number;
    /** Velocity rate follow (0-127) - velocity affects envelope speed */
    velRate: number;
    /** Level curve type (0-5) */
    levelCurve: S330LevelCurve;
    /** 8-point envelope */
    envelope: S330Envelope;
}

/**
 * TVF (Time Variant Filter) parameters
 */
export interface S330TvfParams {
    /** Filter cutoff frequency (0-127) */
    cutoff: number;
    /** Filter resonance (0-127) */
    resonance: number;
    /** Keyboard follow for filter (0-127) */
    keyFollow: number;
    /** LFO modulation depth for filter (0-127) */
    lfoDepth: number;
    /** Envelope depth / EG Depth (0-127) */
    egDepth: number;
    /** Envelope polarity */
    egPolarity: S330EgPolarity;
    /** Level curve (0-5) */
    levelCurve: S330LevelCurve;
    /** Key rate follow (0-127) */
    keyRateFollow: number;
    /** Velocity rate follow (0-127) */
    velRateFollow: number;
    /** Filter on/off switch */
    enabled: boolean;
    /** 8-point envelope */
    envelope: S330Envelope;
}

/**
 * LFO parameters
 */
export interface S330LfoParams {
    /** LFO rate/speed (0-127) */
    rate: number;
    /** Key sync on/off */
    sync: boolean;
    /** LFO delay time (0-127) */
    delay: number;
    /** LFO mode */
    mode: S330LfoMode;
    /** LFO polarity (sine vs peak hold) */
    polarity: boolean;
    /** LFO offset (0-127) */
    offset: number;
}

/**
 * Wave/Sample parameters
 */
export interface S330WaveParams {
    /** Wave bank (0=A, 1=B) */
    bank: number;
    /** Wave segment start position (0-17) */
    segmentTop: number;
    /** Wave segment length (0-18) */
    segmentLength: number;
    /** Sample start point (24-bit address) */
    startPoint: number;
    /** Sample end point (24-bit address) */
    endPoint: number;
    /** Loop point (24-bit address) */
    loopPoint: number;
    /** Loop length for display (24-bit) */
    loopLength: number;
}

/**
 * S-330 tone (sample with synthesis parameters)
 *
 * Total size: 512 nibbles (256 bytes after de-nibblization)
 *
 * This matches the actual S-330 MIDI protocol, not a simplified model.
 */
export interface S330Tone {
    // === Basic Info (00 00H - 00 1FH) ===
    /** Tone name (8 characters max) */
    name: string;
    /** Output assignment (0-7) */
    outputAssign: number;
    /** Source tone number (0-31) */
    sourceTone: number;
    /** Original/Sub tone flag (0=ORG, 1=SUB) */
    origSubTone: number;
    /** Sampling frequency (0=30kHz, 1=15kHz) */
    sampleRate: S330SampleRate;
    /** Original key number (MIDI note 11-108) */
    originalKey: number;

    // === Wave Parameters (00 1AH - 00 33H) ===
    wave: S330WaveParams;
    /** Loop mode (0=Fwd, 1=Alt, 2=1Shot, 3=Reverse) */
    loopMode: S330LoopMode;

    // === LFO Parameters (00 34H - 00 47H) ===
    lfo: S330LfoParams;
    /** TVA LFO depth (separate from LFO params) */
    tvaLfoDepth: number;

    // === Pitch Parameters (00 48H - 00 4BH) ===
    /** Transpose (0-127, 64=center) */
    transpose: number;
    /** Fine tune (-64 to +63) */
    fineTune: number;

    // === TVF Parameters (00 4CH - 00 63H) ===
    tvf: S330TvfParams;

    // === TVA Parameters (00 64H - 01 33H) ===
    tva: S330TvaParams;

    // === Switches ===
    /** Pitch bender on/off */
    benderEnabled: boolean;
    /** Aftertouch on/off */
    aftertouchEnabled: boolean;
    /** Pitch follow for loop */
    pitchFollow: boolean;

    // === Recording Parameters (for display, not usually edited via MIDI) ===
    /** Recording threshold (0-127) */
    recThreshold: number;
    /** Recording pre-trigger (0-3: 0ms, 10ms, 50ms, 100ms) */
    recPreTrigger: number;
    /** Loop tune (-64 to +63) */
    loopTune: number;
    /** Envelope zoom for display (0-5) */
    envZoom: number;
    /** Copy source tone (0-31) */
    copySource: number;
}

// =============================================================================
// MIDI Adapter Interface
// =============================================================================

/**
 * MIDI transport adapter interface for S-330 communication
 *
 * This interface abstracts MIDI I/O to enable the S330Client to work
 * in both Node.js (via easymidi) and browser (via Web MIDI API) environments.
 *
 * Implementations:
 * - Node.js: EasymidiAdapter in sampler-midi package
 * - Browser: WebMidiAdapter in s330-editor package
 */
export interface S330MidiAdapter {
    /**
     * Send a SysEx message to the device
     * @param data - Complete SysEx message including F0 start and F7 end bytes
     */
    send(data: number[]): void;

    /**
     * Register a callback for incoming SysEx messages
     * @param callback - Function to call when SysEx message is received
     */
    onSysEx(callback: (data: number[]) => void): void;

    /**
     * Remove a previously registered SysEx callback
     * @param callback - The callback function to remove
     */
    removeSysExListener(callback: (data: number[]) => void): void;
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
