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
    SSeriesBaseSystemParams,
    SSeriesBasePatchCommon,
    SSeriesBaseTone,
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
// Block Types
// =============================================================================

/**
 * S-550 block identifier.
 *
 * The S-550 is organized as two independent blocks, each similar to an S-330.
 * Block 1 contains tones 0-31 with wave banks A/B.
 * Block 2 contains tones 32-63 with wave banks C/D.
 */
export type S550Block = 1 | 2;

/**
 * Block-relative wave bank index.
 *
 * Within each block, wave banks are referenced as 0 or 1:
 * - Block 1: 0 = Bank A, 1 = Bank B
 * - Block 2: 0 = Bank C, 1 = Bank D
 */
export type S550BlockRelativeWaveBank = 0 | 1;

/**
 * Absolute wave bank identifier (as stored in device memory).
 */
export type S550AbsoluteWaveBank = 0 | 1 | 2 | 3;

/**
 * Information about an S-550 block.
 */
export interface S550BlockInfo {
    /** Block number (1 or 2) */
    block: S550Block;

    /** First tone index in this block (absolute) */
    firstToneIndex: number;

    /** Last tone index in this block (absolute) */
    lastToneIndex: number;

    /** Wave banks available in this block (absolute indices) */
    waveBanks: readonly [S550AbsoluteWaveBank, S550AbsoluteWaveBank];

    /** Disk label for this block */
    diskLabel?: string;
}

// =============================================================================
// System Types
// =============================================================================

/**
 * S-550 system/global parameters
 */
export interface S550SystemParams extends SSeriesBaseSystemParams {}

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
 * S-550 specific: toneLayer values 0-63, patch numbers 0-31
 */
export interface S550PatchCommon extends SSeriesBasePatchCommon {}

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
 * S-550 specific: sourceTone 0-63, wave bank 0-3 (A/B/C/D), copySource 0-63
 */
export interface S550Tone extends SSeriesBaseTone {}

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
