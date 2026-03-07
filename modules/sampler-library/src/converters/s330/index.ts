/**
 * S-330 converter exports.
 * @packageDocumentation
 */

export { s330ToneConverter } from './tone-converter.js';
export { s330PatchConverter, createPatchFromKeyGroups } from './patch-converter.js';
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
} from './wave-converter.js';
