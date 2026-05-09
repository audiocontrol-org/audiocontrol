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
// Base Structure Types (shared between S-330 and S-550)
// =============================================================================

/**
 * Base system/global parameters shared by all S-series devices
 */
export interface SSeriesBaseSystemParams {
    masterTune: number;
    masterLevel: number;
    midiChannel: number;
    deviceId: number;
    exclusiveEnabled: boolean;
    progChangeEnabled: boolean;
    ctrlChangeEnabled: boolean;
    benderEnabled: boolean;
    modWheelEnabled: boolean;
    aftertouchEnabled: boolean;
    holdPedalEnabled: boolean;
}

/**
 * Base patch common parameters shared by all S-series devices
 */
export interface SSeriesBasePatchCommon {
    name: string;
    benderRange: number;
    aftertouchSens: number;
    keyMode: SSeriesKeyMode;
    velocityThreshold: number;
    toneLayer1: number[];
    /**
     * CRITICAL: toneLayer2 is ONLY meaningful when keyMode uses velocity
     * switching ('v-sw', 'x-fade', 'v-mix') AND the corresponding toneLayer1
     * entry is >= 0.
     */
    toneLayer2: number[];
    copySource: number;
    octaveShift: number;
    level: number;
    detune: number;
    velocityMixRatio: number;
    aftertouchAssign: SSeriesAftertouchAssign;
    keyAssign: SSeriesKeyAssign;
    outputAssign: number;
}

/**
 * Base tone parameters shared by all S-series devices
 */
export interface SSeriesBaseTone {
    name: string;
    outputAssign: number;
    sourceTone: number;
    origSubTone: number;
    sampleRate: SSeriesSampleRate;
    originalKey: number;
    wave: SSeriesWaveParams;
    loopMode: SSeriesLoopMode;
    lfo: SSeriesLfoParams;
    tvaLfoDepth: number;
    transpose: number;
    fineTune: number;
    tvf: SSeriesTvfParams;
    tva: SSeriesTvaParams;
    benderEnabled: boolean;
    aftertouchEnabled: boolean;
    pitchFollow: boolean;
    recThreshold: number;
    recPreTrigger: number;
    loopTune: number;
    envZoom: number;
    copySource: number;
}

/**
 * Resolve an `SSeriesSampleRate` label to its sample-rate in Hz. Single edit
 * site for the `'30kHz' | '15kHz'` → `30000 | 15000` mapping; a future third
 * sample rate (e.g. a smaller device's `'7.5kHz'`) lands here. Returns the
 * literal union `SSeriesWaveSampleRate` so downstream APIs that demand the
 * literal type (e.g. `calculateWavSegmentsNeeded`, `wavToSeries`) accept it
 * without a cast.
 *
 * Note: runtime helpers in an otherwise types-only file are co-located with
 * `SSeriesSampleRate` so the contract — "this is how the label maps to Hz" —
 * is unmistakable from the type.
 */
export function sampleRateLabelToHz(rate: SSeriesSampleRate): SSeriesWaveSampleRate {
    return rate === '30kHz' ? 30000 : 15000;
}

/**
 * Convenience wrapper: read the sample rate off a tone. Equivalent to
 * `sampleRateLabelToHz(tone.sampleRate)`; lives next to `SSeriesBaseTone` so
 * call sites that already hold a tone object don't have to thread the label.
 */
export function toneSampleRateHz(tone: Pick<SSeriesBaseTone, 'sampleRate'>): SSeriesWaveSampleRate {
    return sampleRateLabelToHz(tone.sampleRate);
}

/**
 * Device-specific limits that vary between S-series models.
 * Used to parameterize shared parse/encode functions.
 */
export interface SSeriesDeviceLimits {
    sourcetoneMask: number;
    waveBankMask: number;
    copySourceMask: number;
    maxPatchNumber: number;
    maxToneNumber: number;
}

// =============================================================================
// Offset Map Types (for shared parse/encode functions)
// =============================================================================

/**
 * Shape of a patch parameter entry in the address map
 */
export interface SSeriesPatchParamEntry {
    readonly byteOffset: number;
    readonly size: number;
}

type PatchParamKey =
    | 'name' | 'benderRange' | 'aftertouchSens' | 'keyMode' | 'velocityThreshold'
    | 'toneLayer1' | 'toneLayer2' | 'copySource' | 'octaveShift' | 'level'
    | 'detune' | 'velocityMixRatio' | 'aftertouchAssign' | 'keyAssign' | 'outputAssign';

/**
 * Shape of the PATCH_PARAMS constant from device address files
 */
export type SSeriesPatchParamMap = Readonly<Record<PatchParamKey, SSeriesPatchParamEntry>>;

type ToneOffsetKey =
    | 'NAME' | 'OUTPUT_ASSIGN' | 'SOURCE_TONE' | 'ORIG_SUB_TONE'
    | 'SAMPLING_FREQ' | 'ORIG_KEY_NUMBER' | 'WAVE_BANK' | 'WAVE_SEGMENT_TOP'
    | 'WAVE_SEGMENT_LENGTH' | 'START_POINT' | 'END_POINT' | 'LOOP_POINT'
    | 'LOOP_LENGTH' | 'LOOP_MODE' | 'TVA_LFO_DEPTH' | 'LFO_RATE' | 'LFO_SYNC'
    | 'LFO_DELAY' | 'LFO_MODE' | 'LFO_POLARITY' | 'LFO_OFFSET'
    | 'TVA_ENV_SUSTAIN_POINT' | 'TVA_ENV_END_POINT' | 'TVA_ENV_LEVEL_1'
    | 'TVA_KEY_RATE' | 'TVA_LEVEL' | 'TVA_VEL_RATE' | 'TVA_LEVEL_CURVE'
    | 'TVF_CUTOFF' | 'TVF_RESONANCE' | 'TVF_KEY_FOLLOW' | 'TVF_LFO_DEPTH'
    | 'TVF_EG_DEPTH' | 'TVF_EG_POLARITY' | 'TVF_LEVEL_CURVE'
    | 'TVF_KEY_RATE_FOLLOW' | 'TVF_VEL_RATE_FOLLOW' | 'TVF_SWITCH'
    | 'TVF_ENV_SUSTAIN_POINT' | 'TVF_ENV_END_POINT' | 'TVF_ENV_LEVEL_1'
    | 'TRANSPOSE' | 'FINE_TUNE' | 'BENDER_SWITCH' | 'AFTERTOUCH_SWITCH'
    | 'PITCH_FOLLOW' | 'REC_THRESHOLD' | 'REC_PRE_TRIGGER' | 'LOOP_TUNE'
    | 'ENV_ZOOM' | 'COPY_SOURCE';

/**
 * Shape of the TONE_OFFSETS constant from device address files
 */
export type SSeriesToneOffsetMap = Readonly<Record<ToneOffsetKey, number>>;

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

    /**
     * Build a 4-byte SysEx address for wave data given a wave bank and segment index.
     *
     * The S-330 and S-550 use different wave address formulas despite sharing the same
     * SysEx model ID (0x1E). The S-330 uses a linear stride (24576 address units per
     * segment) while the S-550 uses a structured formula (byte2 = segmentIndex * 8).
     *
     * When not provided, the standalone S-330 client defaults to the S-330 stride-based
     * formula. Callers using the S-550 must supply the S-550 address builder.
     */
    buildWaveAddress?: (waveBank: number, segmentIndex: number) => number[];
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
