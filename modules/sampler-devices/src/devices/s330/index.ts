/**
 * Roland S-330 Sampler Device Support
 *
 * This module provides TypeScript interfaces, constants, and utilities
 * for communicating with Roland S-330 samplers via MIDI SysEx.
 *
 * Uses the shared roland-s-series base module for common protocol code.
 *
 * @packageDocumentation
 */

// =============================================================================
// Configuration Export
// =============================================================================

export { S330_CONFIG, S330_ADDRESSES } from './s330-config.js';

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
} from './s330-types.js';

// =============================================================================
// S-330 Specific Type Exports
// =============================================================================

export type {
    // System types
    S330SystemParams,

    // Patch types
    S330PatchCommon,
    S330Patch,

    // Tone types
    S330Tone,

    // Wave data types
    S330WaveDataInput,
    S330ImportToneInput,

    // Device state types
    S330DeviceState,
} from './s330-types.js';

// =============================================================================
// Constant Exports
// =============================================================================

export type { PatchParam } from './s330-addresses.js';

export {
    // Device identification
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,

    // Command bytes
    S330_COMMANDS,

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
} from './s330-addresses.js';

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
} from './s330-params.js';

// =============================================================================
// Message Building Exports
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

    // Helper functions
    buildPatchAddressRQD,
} from './s330-messages.js';

// =============================================================================
// Client Exports
// =============================================================================

export type {
    // Client interface and data types
    S330ClientInterface,
    PatchNameInfo,
    ToneNameInfo,
    MultiPartConfig,
    S330DataType,
    // Callback types for progressive loading
    ProgressCallback,
    PatchLoadedCallback,
    ToneLoadedCallback,
} from './s330-client.js';

export {
    // Client factory function
    createS330Client,

    // Data type constants
    S330_DATA_TYPES,
    S330_FUNCTION_ADDRESSES,
} from './s330-client.js';

// =============================================================================
// Parameter Listener Exports
// =============================================================================

export type {
    ParameterChangeType,
    ParameterChangeEvent,
    ParseResult,
} from './s330-parameter-listener.js';

export {
    parseDT1Message,
    isDT1Message,
    isUIStateAddress,
} from './s330-parameter-listener.js';

// =============================================================================
// Front Panel Exports
// =============================================================================

export type {
    NavigationButton,
    FunctionButton,
    FrontPanelButton,
    FrontPanelControllerOptions,
    FrontPanelController,
    NavigationMode,
} from './s330-front-panel.js';

export {
    FRONT_PANEL_ADDRESS,
    ARROW_CODES_CAT01,
    ARROW_CODES_CAT09,
    VALUE_CODES,
    NAVIGATION_DELAY_MS,
    FUNCTION_CODES,
    isNavigationButton,
    isArrowButton,
    isValueButton,
    buildFrontPanelMessage,
    createFrontPanelController,
} from './s330-front-panel.js';

// =============================================================================
// Wave Format Exports
// =============================================================================

export type {
    S330WaveSampleRate,
    WavData,
    S330WaveData,
    WavSourceInfo,
    PreparedS330Sample,
} from './s330-wave-format.js';

export {
    parseWav,
    createWav,
    wavToS330,
    s330ToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForS330,
    resample,
} from './s330-wave-format.js';

// =============================================================================
// Drum Kit Import Service Exports
// =============================================================================

export type {
    DrumSampleInput,
    DrumKitImportConfig,
    ImportedSample,
    DrumKitImportResult,
    ImportProgressCallback,
    // Monolithic drum kit types
    MonolithicSlice,
    MonolithicDrumKitConfig,
    MonolithicDrumKitResult,
} from './drum-kit-import-service.js';

export {
    importDrumKit,
    verifyDrumKitImport,
    createDrumTone,
    createDrumKitPatch,
    // Monolithic drum kit import
    importMonolithicDrumKit,
} from './drum-kit-import-service.js';

// =============================================================================
// Tone Layer Utilities Exports
// =============================================================================

export type { ToneZone } from './s330-tone-layer.js';

export {
    // Constants
    TONE_LAYER_MIN_MIDI_NOTE,
    TONE_LAYER_MAX_MIDI_NOTE,
    TONE_LAYER_SIZE,
    TONE_LAYER_OFF,

    // Index conversion
    midiNoteToLayerIndex,
    layerIndexToMidiNote,

    // Factory functions
    createEmptyToneLayer,

    // Manipulation functions
    getToneAtMidiNote,
    setToneAtMidiNote,
    setToneForMidiRange,
    isValidToneLayerMidiNote,

    // Zone functions
    toneLayerToZones,
    zonesToToneLayer,
} from './s330-tone-layer.js';

// =============================================================================
// Tone Factory Exports
// =============================================================================

export type {
    CreateToneConfig,
    CreateSubToneConfig,
} from './s330-tone-factory.js';

export {
    createTone,
    createSubTone,
    createMonolithicPrimaryTone,
} from './s330-tone-factory.js';
