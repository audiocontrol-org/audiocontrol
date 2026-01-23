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
