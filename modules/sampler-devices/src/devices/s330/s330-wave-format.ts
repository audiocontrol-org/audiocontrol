/**
 * S-330 wave data format encoding/decoding.
 *
 * Re-exports shared S-series wave format utilities with S-330 naming.
 *
 * @packageDocumentation
 */

import type { SSeriesWaveSampleRate } from '../roland-s-series/index.js';

import {
    type WavData,
    type SSeriesWaveData,
    type WavSourceInfo,
    type PreparedSSeriesSample,
    parseWav,
    createWav,
    resample,
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForSSeries,
} from '../roland-s-series/index.js';

// =============================================================================
// Type Re-exports with S-330 naming
// =============================================================================

/** S-330 sample rate options */
export type S330WaveSampleRate = SSeriesWaveSampleRate;

/** Re-export WavData for compatibility */
export type { WavData };

/** S-330 wave data ready for transmission */
export type S330WaveData = SSeriesWaveData;

/** Source WAV metadata */
export type { WavSourceInfo };

/** Prepared S-330 sample data */
export type PreparedS330Sample = PreparedSSeriesSample;

// =============================================================================
// Function Re-exports
// =============================================================================

export { parseWav, createWav, resample, calculateSegmentsNeeded, validateWaveDataFits };

/**
 * Convert WAV data to S-330 wave format.
 */
export function wavToS330(wav: WavData, targetSampleRate: S330WaveSampleRate): S330WaveData {
    return wavToSeries(wav, targetSampleRate);
}

/**
 * Convert S-330 wave data to 16-bit PCM samples.
 */
export function s330ToWav(s330Data: Uint8Array, sampleRate: S330WaveSampleRate): Int16Array {
    return seriesToWav(s330Data, sampleRate);
}

/**
 * Convert raw WAV file bytes to S-330 format.
 *
 * This is the CANONICAL function for WAV -> S-330 conversion.
 */
export function prepareWavForS330(
    wavBytes: ArrayBuffer,
    targetSampleRate: S330WaveSampleRate,
    options?: { enableDiagnostics?: boolean }
): PreparedS330Sample {
    return prepareWavForSSeries(wavBytes, targetSampleRate, options);
}
