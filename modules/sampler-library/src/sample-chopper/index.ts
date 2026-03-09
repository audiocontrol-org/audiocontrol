/**
 * Sample chopper module for slicing contiguous audio into drum kits.
 *
 * @example
 * ```typescript
 * import {
 *   sliceAudio,
 *   chopSampleToDrumKit,
 *   type SliceConfig
 * } from '@audiocontrol/sampler-library/sample-chopper';
 *
 * // Slice using transient detection
 * const result = sliceAudio(samples, sampleRate, {
 *   method: 'transient',
 *   threshold: 0.3,
 *   minGapMs: 100
 * });
 * ```
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

// Main orchestrator (browser-compatible)
export {
  sliceAudio,
  slicesToDrumKit,
  analyzeForSlicing,
} from './chopper.js';

// Node.js-only functions (requires filesystem)
export { chopSampleToDrumKit } from './chopper-node.js';
