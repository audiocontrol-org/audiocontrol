/**
 * S-550 converter exports.
 * @packageDocumentation
 */

export { s550ToneConverter } from './tone-converter.js';
export { s550PatchConverter, createPatchFromKeyGroups } from './patch-converter.js';
export {
    deviceStateToSet,
    setToDeviceState,
    validateSetAllocations,
    calculateSetSegmentUsage,
} from './set-converter.js';

export type {
    DeviceStateInput,
    DeviceStateToSetResult,
    SetToDeviceInput,
    SetToDeviceResult,
} from './set-converter.js';

// Re-export wave format functions from sampler-devices
// (the canonical location for device-specific wire formats)
export {
    parseWav,
    createWav,
    wavToSeries,
    seriesToWav,
    calculateSegmentsNeeded,
    validateWaveDataFits,
    type WavData,
    type SSeriesWaveData,
    type SSeriesWaveSampleRate,
} from '@audiocontrol/sampler-devices/s550';
