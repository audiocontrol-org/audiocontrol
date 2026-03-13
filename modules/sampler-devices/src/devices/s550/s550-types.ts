/**
 * Roland S-550 Type Definitions
 *
 * S-550 specific types built on the shared S-series base.
 *
 * @packageDocumentation
 */

import type {
    SSeriesEnvelope,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEgPolarity,
    SSeriesLfoMode,
    SSeriesLevelCurve,
    SSeriesTvaParams,
    SSeriesTvfParams,
    SSeriesLfoParams,
    SSeriesWaveParams,
    SSeriesMidiAdapter,
    SSeriesCommand,
    SSeriesBulkDumpType,
    SSeriesErrorCode,
    SSeriesSysExMessage,
    SSeriesResponse,
    SSeriesClientOptions,
    SSeriesWaveDataResponse,
    SSeriesWaveDataInput,
} from '../roland-s-series/index.js';

// =============================================================================
// Re-export shared types for convenience
// =============================================================================

export type {
    SSeriesEnvelope,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEgPolarity,
    SSeriesLfoMode,
    SSeriesLevelCurve,
    SSeriesTvaParams,
    SSeriesTvfParams,
    SSeriesLfoParams,
    SSeriesWaveParams,
    SSeriesMidiAdapter,
    SSeriesCommand,
    SSeriesBulkDumpType,
    SSeriesErrorCode,
    SSeriesSysExMessage,
    SSeriesResponse,
    SSeriesClientOptions,
    SSeriesWaveDataResponse,
    SSeriesWaveDataInput,
};

// =============================================================================
// System Types
// =============================================================================

/**
 * S-550 system/global parameters
 */
export interface S550SystemParams {
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
 * S-550 patch parameters
 *
 * Each patch is 512 bytes (1024 nibbles) with the following structure:
 * - 12-character name
 * - Performance parameters (bend, aftertouch, mode, etc.)
 * - Two tone mapping layers (109 keys each, MIDI notes 12-120 / C0-C9)
 * - Output and level settings
 *
 * Key difference from S-330: toneLayer values can be 0-63 (vs 0-31)
 */
export interface S550PatchCommon {
    name: string;                           // 12 characters max
    benderRange: number;                    // 0-12 semitones
    aftertouchSens: number;                 // 0-127
    keyMode: SSeriesKeyMode;
    velocityThreshold: number;              // 0-127 - V-Sw threshold
    toneLayer1: number[];                   // 109 entries, -1 to 63 (S-550 has 64 tones)
    /**
     * 109 entries, 0-63
     *
     * CRITICAL: toneLayer2 is ONLY meaningful when keyMode uses velocity
     * switching ('v-sw', 'x-fade', 'v-mix') AND the corresponding toneLayer1
     * entry is >= 0.
     */
    toneLayer2: number[];
    copySource: number;                     // 0-7
    octaveShift: number;                    // -2 to +2
    level: number;                          // 0-127
    detune: number;                         // -64 to +63 - Unison detune
    velocityMixRatio: number;               // 0-127 - V-Mix ratio
    aftertouchAssign: SSeriesAftertouchAssign;
    keyAssign: SSeriesKeyAssign;
    outputAssign: number;                   // 0-8 (0-7=Out 1-8, 8=TONE)
}

/**
 * Complete S-550 patch
 */
export interface S550Patch {
    common: S550PatchCommon;
}

// =============================================================================
// Tone Types
// =============================================================================

/**
 * S-550 tone (sample with synthesis parameters)
 *
 * Total size: 512 nibbles (256 bytes after de-nibblization)
 *
 * Key differences from S-330:
 * - wave.bank can be 0-3 (A, B, C, D) vs 0-1 (A, B)
 * - sourceTone can be 0-63 (vs 0-31)
 */
export interface S550Tone {
    // === Basic Info ===
    /** Tone name (8 characters max) */
    name: string;
    /** Output assignment (0-7) */
    outputAssign: number;
    /** Source tone number (0-63 for S-550) */
    sourceTone: number;
    /** Original/Sub tone flag (0=ORG, 1=SUB) */
    origSubTone: number;
    /** Sampling frequency */
    sampleRate: SSeriesSampleRate;
    /** Original key number (MIDI note 11-108) */
    originalKey: number;

    // === Wave Parameters ===
    /** Wave params (bank 0-3 for S-550: A, B, C, D) */
    wave: SSeriesWaveParams;
    /** Loop mode */
    loopMode: SSeriesLoopMode;

    // === LFO Parameters ===
    lfo: SSeriesLfoParams;
    /** TVA LFO depth (separate from LFO params) */
    tvaLfoDepth: number;

    // === Pitch Parameters ===
    /** Transpose in semitones (-64 to +63, 0=no change) */
    transpose: number;
    /** Fine tune (-64 to +63) */
    fineTune: number;

    // === TVF Parameters ===
    tvf: SSeriesTvfParams;

    // === TVA Parameters ===
    tva: SSeriesTvaParams;

    // === Switches ===
    /** Pitch bender on/off */
    benderEnabled: boolean;
    /** Aftertouch on/off */
    aftertouchEnabled: boolean;
    /** Pitch follow for loop */
    pitchFollow: boolean;

    // === Recording Parameters ===
    /** Recording threshold (0-127) */
    recThreshold: number;
    /** Recording pre-trigger (0-3: 0ms, 10ms, 50ms, 100ms) */
    recPreTrigger: number;
    /** Loop tune (-64 to +63) */
    loopTune: number;
    /** Envelope zoom for display (0-5) */
    envZoom: number;
    /** Copy source tone (0-63 for S-550) */
    copySource: number;
}

// =============================================================================
// Device State Types
// =============================================================================

/**
 * Current state of connected S-550
 */
export interface S550DeviceState {
    connected: boolean;
    deviceId: number;
    patches: S550Patch[];
    tones: S550Tone[];
    systemParams?: S550SystemParams;
}

// =============================================================================
// Wave Data Types (S-550 specific constraints)
// =============================================================================

/**
 * Input for sending wave data to the S-550.
 * S-550 has 4 wave banks (A, B, C, D).
 */
export interface S550WaveDataInput {
    /**
     * Raw wave data bytes (7-bit encoded 12-bit samples).
     */
    data: Uint8Array;

    /** Target wave bank (0=A, 1=B, 2=C, 3=D) */
    waveBank: 0 | 1 | 2 | 3;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to write (1-18) */
    segmentLength: number;
}

/**
 * Input for importing a tone with wave data to the S-550.
 */
export interface S550ImportToneInput {
    /** Target tone index (0-63) */
    toneIndex: number;

    /**
     * Wave data bytes (7-bit encoded 12-bit samples).
     */
    waveData: Uint8Array;

    /** Target wave bank (0=A, 1=B, 2=C, 3=D) */
    waveBank: 0 | 1 | 2 | 3;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to allocate */
    segmentLength: number;

    /**
     * Full tone object for library import.
     * When provided, all tone parameters are taken from this object.
     */
    tone?: S550Tone;

    // --- Parameters for new sample import (ignored if `tone` is provided) ---

    /** Tone name (max 8 characters) - required if tone not provided */
    name?: string;

    /** Sample rate - required if tone not provided */
    sampleRate?: SSeriesSampleRate;

    /** Loop mode - required if tone not provided */
    loopMode?: SSeriesLoopMode;

    /** Loop point in samples (relative to segment start) */
    loopPoint?: number;

    /** Original key (MIDI note number, default 60 = C4) */
    originalKey?: number;
}
