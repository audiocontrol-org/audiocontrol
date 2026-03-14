/**
 * Roland S-550 Sampler Device Support
 *
 * This module provides TypeScript interfaces, constants, and utilities
 * for communicating with Roland S-550 samplers via MIDI SysEx.
 *
 * Uses the shared roland-s-series base module for common protocol code.
 *
 * @packageDocumentation
 */

// =============================================================================
// Configuration Export
// =============================================================================

export { S550_CONFIG, S550_ADDRESSES } from './s550-config.js';

// =============================================================================
// Shared Type Re-exports (from roland-s-series)
// =============================================================================

export type {
    // MIDI Adapter
    SSeriesMidiAdapter,

    // Envelope and parameter types
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

    // SysEx types
    SSeriesCommand,
    SSeriesBulkDumpType,
    SSeriesErrorCode,
    SSeriesSysExMessage,
    SSeriesResponse,
    SSeriesClientOptions,
    SSeriesWaveDataResponse,
    SSeriesWaveDataInput,
} from './s550-types.js';

// =============================================================================
// S-550 Specific Type Exports
// =============================================================================

export type {
    // System types
    S550SystemParams,

    // Patch types
    S550PatchCommon,
    S550Patch,

    // Tone types
    S550Tone,

    // Wave data types
    S550WaveDataInput,
    S550ImportToneInput,

    // Device state types
    S550DeviceState,
} from './s550-types.js';

// =============================================================================
// Constant Exports
// =============================================================================

export type { PatchParam } from './s550-addresses.js';

export {
    // Device identification
    ROLAND_ID,
    S550_MODEL_ID,
    DEFAULT_DEVICE_ID,

    // Command bytes
    S550_COMMANDS,

    // Base addresses
    ADDR_SYSTEM,
    ADDR_PATCH_BASE,
    ADDR_TONE_BASE,
    ADDR_WAVE_DATA,
    TONE_STRIDE,

    // System parameter offsets
    SYSTEM_OFFSETS,
    SYSTEM_BLOCK_SIZE,

    // Patch parameter offsets
    PATCH_COMMON_OFFSETS,
    PATCH_TOTAL_SIZE,
    TONE_MAP_ENTRIES,
    MAX_PATCHES,
    PATCH_PARAMS,

    // Tone parameter offsets
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    TONE_BLOCK_NIBBLES,
    MAX_TONES,

    // Bulk dump types
    BULK_DUMP_TYPES,

    // Error codes
    ERROR_CODES,

    // Timing constants
    TIMING,

    // Value ranges
    VALUE_RANGES,

    // Address builders
    buildPatchAddress,
    buildPatchParamAddress,
    buildToneAddress,
    buildSystemAddress,
    calculateChecksum,
} from './s550-addresses.js';

// =============================================================================
// Parameter Function Exports
// =============================================================================

export {
    // Value conversion
    parseKeyMode,
    encodeKeyMode,
    parseAftertouchAssign,
    encodeAftertouchAssign,
    parseKeyAssign,
    encodeKeyAssign,
    parseLoopMode,
    encodeLoopMode,
    parseEgPolarity,
    encodeEgPolarity,
    parseLfoMode,
    encodeLfoMode,
    parseLevelCurve,
    parseSampleRate,
    encodeSampleRate,
    parseName,
    encodeName,
    parse21BitAddress,
    encode21BitAddress,
    parse24BitAddress,
    encode24BitAddress,
    parseSignedValue,
    encodeSignedValue,
    parseEnvelope,
    encodeEnvelope,

    // Structure parsing
    parseSystemParams,
    parsePatchCommon,
    parseTone,

    // Structure creation
    createEmptyPatchCommon,

    // Structure encoding
    encodeSystemParams,
    encodePatchCommon,
    encodeTone,

    // Validation
    isValidDeviceId,
    isValidMidiChannel,
    isValidPatchNumber,
    isValidToneNumber,
    isValid7BitValue,
    clamp7Bit,
} from './s550-params.js';

// =============================================================================
// Message Building Exports (from shared roland-s-series)
// =============================================================================

export {
    // Nibblization
    nibblize,
    denibblize,

    // Size encoding
    encodeSize,

    // Message builders
    buildRQDMessage,
    buildWSDMessage,
    buildDATMessage,
    buildDT1Message,
    buildACKMessage,
    buildEODMessage,
    buildRJCMessage,
    buildERRMessage,
} from '../roland-s-series/index.js';

// =============================================================================
// Wave Format Exports (from shared roland-s-series)
// =============================================================================

export type {
    SSeriesWaveSampleRate,
    WavData,
    SSeriesWaveData,
    WavSourceInfo,
    PreparedSSeriesSample,
} from '../roland-s-series/index.js';

export {
    parseWav,
    createWav,
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForSSeries,
    resample,
} from '../roland-s-series/index.js';

// =============================================================================
// Client
// =============================================================================

export type { S550ClientInterface } from './s550-client.js';
export { createS550Client } from './s550-client.js';

// =============================================================================
// Tone Factory
// =============================================================================

export type { CreateToneConfig, CreateSubToneConfig } from './s550-tone-factory.js';
export {
    createTone,
    createSubTone,
    createMonolithicPrimaryTone,
} from './s550-tone-factory.js';
