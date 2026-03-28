/**
 * S-330 MIDI Client for Web Browser
 *
 * This module re-exports the unified S330Client from @audiocontrol/sampler-devices
 * and provides Web MIDI adapter compatibility types.
 *
 * The actual client implementation is now in @audiocontrol/sampler-devices/s330
 * and works in both Node.js and browser environments via dependency injection.
 *
 * @packageDocumentation
 */

// Re-export everything from the unified client
export type {
    S330ClientInterface,
    PatchNameInfo,
    ToneNameInfo,
    MultiPartConfig,
    S330DataType,
    ProgressCallback,
    PatchLoadedCallback,
    ToneLoadedCallback,
} from '@audiocontrol/sampler-devices/s330';

export {
    createS330Client,
    S330_DATA_TYPES,
    S330_FUNCTION_ADDRESSES,
} from '@audiocontrol/sampler-devices/s330';

// Re-export S-330 specific types
export type {
    S330SystemParams,
    S330Patch,
    S330Tone,
    S330PatchCommon,
} from '@audiocontrol/sampler-devices/s330';

// Re-export shared SSeries types with backward-compatible aliases
export type {
    SSeriesMidiAdapter as S330MidiAdapter,
    SSeriesResponse as S330Response,
    SSeriesCommand as S330Command,
    SSeriesClientOptions as S330ClientOptions,
    SSeriesKeyMode as S330KeyMode,
    SSeriesEnvelope as S330Envelope,
    SSeriesTvaParams as S330TvaParams,
    SSeriesTvfParams as S330TvfParams,
    SSeriesLfoParams as S330LfoParams,
    SSeriesWaveParams as S330WaveParams,
    SSeriesWaveDataResponse as S330WaveDataResponse,
    SSeriesEgPolarity as S330EgPolarity,
    SSeriesLevelCurve as S330LevelCurve,
} from '@audiocontrol/sampler-devices/s330';

// Re-export constants for convenience
export {
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S330_COMMANDS,
    TIMING,
    calculateChecksum,
} from '@audiocontrol/sampler-devices/s330';

// Re-export front panel types and functions
export type {
    FrontPanelController,
    FrontPanelButton,
    NavigationButton,
    FunctionButton,
    NavigationMode,
    FrontPanelControllerOptions,
} from '@audiocontrol/sampler-devices/s330';

export {
    createFrontPanelController,
} from '@audiocontrol/sampler-devices/s330';

// Re-export parameter listener types and functions
export type {
    ParameterChangeEvent,
    ParameterChangeType,
    ParseResult,
} from '@audiocontrol/sampler-devices/s330';

export {
    parseDT1Message,
    isDT1Message,
    isUIStateAddress,
} from '@audiocontrol/sampler-devices/s330';

// Re-export wave format types and functions
export type {
    PreparedS330Sample,
    S330WaveSampleRate,
    WavData,
    S330WaveData,
} from '@audiocontrol/sampler-devices/s330';

export {
    parseWav,
    createWav,
    wavToS330,
    s330ToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    prepareWavForS330,
    resample,
} from '@audiocontrol/sampler-devices/s330';

// Local type alias for backward compatibility
// S330MidiIO matches S330MidiAdapter from sampler-devices
export type { S330MidiIO } from './types';
