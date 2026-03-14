/**
 * Roland S-Series Shared Module
 *
 * Shared base code for Roland S-330 and S-550 samplers.
 * Both devices use the same SysEx protocol (model ID 0x1E).
 *
 * @packageDocumentation
 */

// =============================================================================
// Configuration
// =============================================================================

export type { SSeriesDeviceConfig } from './s-series-config.js';
export { validateDeviceConfig } from './s-series-config.js';

// =============================================================================
// Types
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
    SSeriesAddresses,
    SSeriesClientOptions,

    // Wave data types
    SSeriesWaveSampleRate,
    SSeriesWaveDataResponse,
    SSeriesWaveDataInput,
} from './s-series-types.js';

// =============================================================================
// Constants
// =============================================================================

export {
    ROLAND_ID,
    S_SERIES_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S_SERIES_COMMANDS,
    ERROR_CODES,
    TIMING,
    VALUE_RANGES,
    BULK_DUMP_TYPES,
} from './s-series-constants.js';

// =============================================================================
// Message Builders
// =============================================================================

export {
    nibblize,
    denibblize,
    calculateChecksum,
    encodeSize,
    buildRQDMessage,
    buildWSDMessage,
    buildDATMessage,
    buildDT1Message,
    buildACKMessage,
    buildEODMessage,
    buildRJCMessage,
    buildERRMessage,
} from './s-series-messages.js';

// =============================================================================
// Parameter Utilities
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

    // Name encoding
    parseName,
    encodeName,

    // Address encoding
    parse21BitAddress,
    encode21BitAddress,
    parse24BitAddress,
    encode24BitAddress,

    // Signed value encoding
    parseSignedValue,
    encodeSignedValue,

    // Envelope encoding
    parseEnvelope,
    encodeEnvelope,

    // Validation
    isValidDeviceId,
    isValidMidiChannel,
    isValid7BitValue,
    clamp7Bit,
} from './s-series-params.js';

// =============================================================================
// Wave Format
// =============================================================================

export type {
    WavData,
    SSeriesWaveData,
    WavSourceInfo,
    PreparedSSeriesSample,
} from './s-series-wave-format.js';

export {
    parseWav,
    createWav,
    resample,
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForSSeries,
    clampWaveParams,
} from './s-series-wave-format.js';

// =============================================================================
// Shared Client
// =============================================================================

export type {
    ProgressCallback,
    PatchLoadedCallback,
    ToneLoadedCallback,
    MultiPartConfig,
    PatchNameInfo,
    ToneNameInfo,
    SSeriesWaveDataInput as SSeriesClientWaveDataInput,
    SSeriesImportToneInput,
    SSeriesParserFunctions,
    SSeriesClientInterface,
    SSeriesAddressBuilders,
} from './s-series-client.js';

export { createSSeriesClient } from './s-series-client.js';
