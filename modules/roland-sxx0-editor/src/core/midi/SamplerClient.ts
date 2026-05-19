/**
 * Unified Sampler Client Types
 *
 * Device-agnostic client interface and data types for the sampler editor.
 * Both S-330 and S-550 tones/patches are structurally identical — only
 * value ranges differ (e.g., 32 vs 64 tone indices). This module provides
 * type aliases that work with either device.
 *
 * @packageDocumentation
 */

// The shared S-series client interface, parameterized with S-330 types
// (S-550 types are structurally identical — same fields, same shapes).
// Using S-330 types as the concrete parameters since they're already used
// throughout the editor and are type-compatible with S-550.
export type {
    S330ClientInterface as SamplerClientInterface,
    PatchNameInfo,
    ToneNameInfo,
    MultiPartConfig,
    ProgressCallback,
    PatchLoadedCallback,
    ToneLoadedCallback,
} from '@audiocontrol/sampler-devices/s330';

// Re-export S-330 data types as device-agnostic aliases.
// S330Tone and S550Tone are structurally identical interfaces —
// same field names, same TypeScript types. The only differences are
// runtime value ranges (e.g., sourceTone 0-31 vs 0-63), not type-level.
export type {
    S330Tone as SamplerTone,
    S330Patch as SamplerPatch,
    S330PatchCommon as SamplerPatchCommon,
    S330SystemParams as SamplerSystemParams,
} from '@audiocontrol/sampler-devices/s330';

// Re-export shared types used across pages
export type {
    SSeriesMidiAdapter,
    SSeriesKeyMode as SamplerKeyMode,
    SSeriesEnvelope as SamplerEnvelope,
    SSeriesTvaParams as SamplerTvaParams,
    SSeriesTvfParams as SamplerTvfParams,
    SSeriesLfoParams as SamplerLfoParams,
    SSeriesWaveParams as SamplerWaveParams,
    SSeriesWaveDataResponse as SamplerWaveDataResponse,
    SSeriesEgPolarity as SamplerEgPolarity,
    SSeriesLevelCurve as SamplerLevelCurve,
    SSeriesAftertouchAssign as SamplerAftertouchAssign,
    SSeriesKeyAssign as SamplerKeyAssign,
} from '@audiocontrol/sampler-devices/roland-s-series';

// Re-export wave format utilities
export {
    parseWav,
    createWav,
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForSSeries,
    resample,
    sampleRateLabelToHz,
    toneSampleRateHz,
    toneHasWaveData,
} from '@audiocontrol/sampler-devices/roland-s-series';

export type {
    WavData,
    SSeriesWaveData as SamplerWaveData,
    SSeriesWaveSampleRate as SamplerWaveSampleRate,
    PreparedSSeriesSample as PreparedSamplerSample,
} from '@audiocontrol/sampler-devices/roland-s-series';
