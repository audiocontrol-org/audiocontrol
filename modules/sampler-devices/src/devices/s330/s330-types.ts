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
 *
 * `waveBank` is typed as `number` rather than a literal union so that this
 * shape doubles as the editor-side input type for S-series devices that share
 * `SamplerClientInterface` (the editor erases the device distinction at the
 * type level — see `core/midi/SamplerClient.ts`). The S-330 client validates
 * `waveBank ∈ {0, 1}` at runtime in `s330-client.ts`; the S-550 client
 * validates against its own bank range (A/B/C/D = 0..3). Both reject
 * out-of-range values loudly — the wider type is honest about the contract,
 * not a relaxation.
 */
export interface S330WaveDataInput {
    /**
     * Raw wave data bytes (7-bit encoded 12-bit samples).
     */
    data: Uint8Array;

    /**
     * Target wave bank. S-330 accepts 0 (A) or 1 (B); S-550 (which shares this
     * input type via `SamplerClientInterface`) accepts 0..3 (A/B/C/D). Out-of-
     * range values throw at the device-client boundary.
     */
    waveBank: number;

    /** Target segment index (0-17) */
    segmentTop: number;

    /** Number of segments to write (1-18) */
    segmentLength: number;
}

/**
 * Input for importing a tone with wave data.
 *
 * Used as the editor-side input type for both S-330 and S-550 via
 * `SamplerClientInterface` (the editor erases the device distinction at the
 * type level). `waveBank` is `number`; each device client validates the bank
 * against its own range at runtime. See `S330WaveDataInput` for details.
 */
export interface S330ImportToneInput {
    /** Target tone index (0-31, maps to T11-T42) */
    toneIndex: number;

    /**
     * Wave data bytes (7-bit encoded 12-bit samples).
     */
    waveData: Uint8Array;

    /**
     * Target wave bank. S-330 accepts 0 (A) or 1 (B); S-550 accepts 0..3
     * (A/B/C/D). Out-of-range values throw at the device-client boundary.
     */
    waveBank: number;

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
