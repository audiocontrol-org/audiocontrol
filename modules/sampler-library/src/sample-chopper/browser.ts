/**
 * Browser-compatible sample chopper exports.
 *
 * This entry point excludes Node.js-only functions (chopSampleToDrumKit)
 * that require filesystem access.
 *
 * @packageDocumentation
 */

// Type exports
export type {
  SliceMethod,
  TransientConfig,
  SilenceConfig,
  FixedConfig,
  ManualConfig,
  ManualRegion,
  SliceConfig,
  Slice,
  SliceResult,
  DrumKitOutputConfig,
} from './types.js';

export {
  DEFAULT_DRUM_TYPES,
  DEFAULT_BASE_NOTE,
} from './types.js';

// Audio utilities
export {
  msToSamples,
  samplesToMs,
  calculateRms,
  calculatePeak,
  amplitudeToDb,
  dbToAmplitude,
  calculateRmsWindowed,
  findOnsetAboveThreshold,
  findSilenceStart,
} from './audio-utils.js';

// Individual slicers
export { sliceByFixedInterval } from './fixed-slicer.js';
export { sliceBySilence, trimSilence } from './silence-detector.js';
export { sliceByTransient, refineOnsetPosition } from './transient-detector.js';
export {
  sliceByManualRegions,
  createRegionsFromBoundaries,
  createRegionsFromTempo,
} from './manual-slicer.js';

// Main orchestrator (browser-compatible functions only)
export {
  sliceAudio,
  slicesToDrumKit,
  analyzeForSlicing,
} from './chopper.js';
