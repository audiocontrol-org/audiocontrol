/**
 * S-330 converter exports.
 * @packageDocumentation
 */

export { s330ToneConverter } from './tone-converter.js';
export { s330PatchConverter, createPatchFromKeyGroups } from './patch-converter.js';
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
  wavToS330,
  s330ToWav,
  calculateSegmentsNeeded,
  validateWaveDataFits,
  type WavData,
  type S330WaveData,
  type S330WaveSampleRate,
} from '@audiocontrol/sampler-devices/s330';
