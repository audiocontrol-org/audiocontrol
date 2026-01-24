/**
 * S-330 MIDI Client for Web Browser
 *
 * This module re-exports the unified S330Client from @oletizi/sampler-devices
 * and provides Web MIDI adapter compatibility types.
 *
 * The actual client implementation is now in @oletizi/sampler-devices/s330
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
} from '@oletizi/sampler-devices/s330';

export {
    createS330Client,
    S330_DATA_TYPES,
    S330_FUNCTION_ADDRESSES,
} from '@oletizi/sampler-devices/s330';

// Re-export types for convenience
export type {
    S330MidiAdapter,
    S330SystemParams,
    S330Patch,
    S330Tone,
    S330PatchCommon,
    S330Response,
    S330Command,
    S330ClientOptions,
    S330KeyMode,
    S330Envelope,
    S330TvaParams,
    S330TvfParams,
    S330LfoParams,
    S330WaveParams,
} from '@oletizi/sampler-devices/s330';

// Re-export constants for convenience
export {
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S330_COMMANDS,
    TIMING,
    calculateChecksum,
} from '@oletizi/sampler-devices/s330';

// Local type alias for backward compatibility
// S330MidiIO matches S330MidiAdapter from sampler-devices
export type { S330MidiIO } from './types';
