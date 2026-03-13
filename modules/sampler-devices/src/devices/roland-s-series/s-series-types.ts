/**
 * Roland S-Series Shared Type Definitions
 *
 * Common interfaces shared between S-330 and S-550 samplers.
 * Both devices use the same SysEx protocol (model ID 0x1E).
 *
 * @packageDocumentation
 */

// =============================================================================
// MIDI Adapter Interface
// =============================================================================

/**
 * MIDI transport adapter interface for S-series communication
 *
 * This interface abstracts MIDI I/O to enable clients to work
 * in both Node.js (via easymidi) and browser (via Web MIDI API) environments.
 */
export interface SSeriesMidiAdapter {
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
// Envelope Types
// =============================================================================

/**
 * 8-point envelope used by both TVA and TVF
 * The S-series samplers use complex multi-point envelopes, not simple ADSR
 */
export interface SSeriesEnvelope {
    /** 8 level values (0-127) */
    levels: [number, number, number, number, number, number, number, number];
    /** 8 rate values (1-127) */
    rates: [number, number, number, number, number, number, number, number];
    /** Sustain point (0-7), envelope holds at this point until note release */
    sustainPoint: number;
    /** End point (1-8), envelope ends at this point */
    endPoint: number;
}

// =============================================================================
// Enum Types
// =============================================================================

/**
 * Key mode for patch
 * - normal: Single tone layer across keyboard
 * - v-sw: Velocity switch (layer 1 below threshold, layer 2 above)
 * - x-fade: Crossfade between layers based on velocity
 * - v-mix: Mix both layers, ratio controlled by velocity
 * - unison: Both layers play together with detune
 */
export type SSeriesKeyMode = 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison';

/**
 * Aftertouch assignment destination
 */
export type SSeriesAftertouchAssign = 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter';

/**
 * Key assignment mode
 */
export type SSeriesKeyAssign = 'rotary' | 'fix';

/**
 * Loop mode for tone playback
 * From protocol: 0=Fwd, 1=Alt, 2=1Shot, 3=Reverse
 */
export type SSeriesLoopMode = 'forward' | 'alternating' | 'one-shot' | 'reverse';

/**
 * Sample rate options
 * From protocol: 0=30kHz, 1=15kHz
 */
export type SSeriesSampleRate = '15kHz' | '30kHz';

/**
 * EG (Envelope Generator) polarity
 */
export type SSeriesEgPolarity = 'normal' | 'reverse';

/**
 * LFO mode
 */
export type SSeriesLfoMode = 'normal' | 'one-shot';

/**
 * Level curve type (0-5)
 */
export type SSeriesLevelCurve = 0 | 1 | 2 | 3 | 4 | 5;

// =============================================================================
// Parameter Interfaces
// =============================================================================

/**
 * TVA (Time Variant Amplifier) parameters
 */
export interface SSeriesTvaParams {
    /** LFO modulation depth for amplitude (0-127) */
    lfoDepth: number;
    /** Keyboard rate follow (0-127) - higher keys = faster envelope */
    keyRate: number;
    /** Output level (0-127) */
    level: number;
    /** Velocity rate follow (0-127) - velocity affects envelope speed */
    velRate: number;
    /** Level curve type (0-5) */
    levelCurve: SSeriesLevelCurve;
    /** 8-point envelope */
    envelope: SSeriesEnvelope;
}

/**
 * TVF (Time Variant Filter) parameters
 */
export interface SSeriesTvfParams {
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
    egPolarity: SSeriesEgPolarity;
    /** Level curve (0-5) */
    levelCurve: SSeriesLevelCurve;
    /** Key rate follow (0-127) */
    keyRateFollow: number;
    /** Velocity rate follow (0-127) */
    velRateFollow: number;
    /** Filter on/off switch */
    enabled: boolean;
    /** 8-point envelope */
    envelope: SSeriesEnvelope;
}

/**
 * LFO parameters
 */
export interface SSeriesLfoParams {
    /** LFO rate/speed (0-127) */
    rate: number;
    /** Key sync on/off */
    sync: boolean;
    /** LFO delay time (0-127) */
    delay: number;
    /** LFO mode */
    mode: SSeriesLfoMode;
    /** LFO polarity (sine vs peak hold) */
    polarity: boolean;
    /** LFO offset (0-127) */
    offset: number;
}

/**
 * Wave/Sample parameters
 */
export interface SSeriesWaveParams {
    /** Wave bank (S-330: 0=A, 1=B; S-550: 0=A, 1=B, 2=C, 3=D) */
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

// =============================================================================
// SysEx Communication Types
// =============================================================================

/**
 * Roland SysEx command types for S-series
 */
export type SSeriesCommand =
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
export type SSeriesBulkDumpType =
    | 'all-patches'
    | 'all-tones'
    | 'single-patch'
    | 'single-tone'
    | 'wave-data'
    | 'all-data';

/**
 * Error codes from ERR response
 */
export type SSeriesErrorCode =
    | 'checksum'
    | 'unknown-command'
    | 'wrong-format'
    | 'memory-full'
    | 'out-of-range';

/**
 * SysEx message structure
 */
export interface SSeriesSysExMessage {
    deviceId: number;
    command: SSeriesCommand;
    address: number[];       // 4 bytes
    data: number[];
    checksum: number;
}

/**
 * Parsed response from device
 */
export interface SSeriesResponse {
    success: boolean;
    command: SSeriesCommand;
    data?: number[];
    errorCode?: SSeriesErrorCode;
}

// =============================================================================
// Address Constants Interface
// =============================================================================

/**
 * Device-specific address constants
 */
export interface SSeriesAddresses {
    /** System parameters base address */
    system: readonly number[];

    /** Patch parameters base address */
    patchBase: readonly number[];

    /** Tone parameters base address */
    toneBase: readonly number[];

    /** Wave data base address */
    waveData: readonly number[];
}

// =============================================================================
// Client Options
// =============================================================================

/**
 * Options for S-series client initialization
 */
export interface SSeriesClientOptions {
    deviceId?: number;       // Default: 0
    timeoutMs?: number;      // Default: 500
    retryCount?: number;     // Default: 3
    /**
     * Delay in milliseconds before flushing buffered writes.
     * Multiple writes to the same address within this window are collapsed.
     * Set to 0 to disable buffering (immediate writes).
     * Default: 150ms
     */
    writeFlushDelayMs?: number;
}

// =============================================================================
// Wave Data Types
// =============================================================================

/**
 * S-series sample rate in Hz
 */
export type SSeriesWaveSampleRate = 15000 | 30000;

/**
 * Wave data response from device
 */
export interface SSeriesWaveDataResponse {
    /**
     * Raw wave data bytes (packed 12-bit samples).
     */
    data: Uint8Array;

    /** Sample rate in Hz (15000 or 30000) */
    sampleRate: 15000 | 30000;

    /** Sample start point (24-bit address in wave memory) */
    startPoint: number;

    /** Sample end point (24-bit address in wave memory) */
    endPoint: number;

    /** Loop point (24-bit address in wave memory) */
    loopPoint: number;

    /** Loop mode */
    loopMode: SSeriesLoopMode;
}

/**
 * Input for sending wave data to the device.
 */
export interface SSeriesWaveDataInput {
    /**
     * Raw wave data bytes (7-bit encoded 12-bit samples).
     */
    data: Uint8Array;

    /** Target wave bank */
    waveBank: number;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to write (1-18) */
    segmentLength: number;
}
