/**
 * Roland S-330 Type Definitions
 *
 * S-330 specific types built on the shared S-series base.
 * See /docs/s330_sysex.md for complete protocol documentation.
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
// System Types
// =============================================================================

/**
 * S-330 system/global parameters
 */
export interface S330SystemParams extends SSeriesBaseSystemParams {}

// =============================================================================
// Patch Types
// =============================================================================

/**
 * S-330 patch parameters (from hardware manual)
 *
 * Each patch is 512 bytes (1024 nibbles) with the following structure:
 * - 12-character name
 * - Performance parameters (bend, aftertouch, mode, etc.)
 * - Two tone mapping layers (109 keys each, MIDI notes 12-120 / C0-C9)
 * - Output and level settings
 *
 * S-330 specific: toneLayer values 0-31, patch numbers 0-63
 */
export interface S330PatchCommon extends SSeriesBasePatchCommon {}

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
 * S-330 tone (sample with synthesis parameters)
 *
 * Total size: 512 nibbles (256 bytes after de-nibblization)
 *
 * S-330 specific: sourceTone 0-31, wave bank 0-1 (A/B), copySource 0-31
 */
export interface S330Tone extends SSeriesBaseTone {}

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

// =============================================================================
// Wave Data Types (S-330 specific constraints)
// =============================================================================

/**
 * Input for sending wave data to the S-330.
 * S-330 has 2 wave banks (A, B).
 */
export interface S330WaveDataInput {
    /**
     * Raw wave data bytes (7-bit encoded 12-bit samples).
     */
    data: Uint8Array;

    /** Target wave bank (0=A, 1=B) - S-330 only has 2 banks */
    waveBank: 0 | 1;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to write (1-18) */
    segmentLength: number;
}

/**
 * Input for importing a tone with wave data to the S-330.
 */
export interface S330ImportToneInput {
    /** Target tone index (0-31, maps to T11-T42) */
    toneIndex: number;

    /**
     * Wave data bytes (7-bit encoded 12-bit samples).
     */
    waveData: Uint8Array;

    /** Target wave bank (0=A, 1=B) */
    waveBank: 0 | 1;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to allocate */
    segmentLength: number;

    /**
     * Full tone object for library import.
     * When provided, all tone parameters are taken from this object.
     */
    tone?: S330Tone;

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
