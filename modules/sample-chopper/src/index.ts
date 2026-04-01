/**
 * @audiocontrol/sample-chopper
 *
 * Device-agnostic audio sample slicing algorithms.
 *
 * @example
 * ```typescript
 * import {
 *   sliceAudio,
 *   analyzeForSlicing,
 *   type SliceConfig,
 * } from '@audiocontrol/sample-chopper';
 *
 * const result = sliceAudio(samples, sampleRate, {
 *   method: 'transient',
 *   threshold: 0.3,
 *   minGapMs: 100,
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
} from './types.js';

export {
  DEFAULT_SLICE_LABELS,
  DEFAULT_DRUM_TYPES, // deprecated alias
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

// Main orchestrator
export {
  sliceAudio,
  analyzeForSlicing,
} from './chopper.js';
