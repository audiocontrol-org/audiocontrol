/**
 * Browser-compatible sample chopper exports.
 *
 * Re-exports from @audiocontrol/sample-chopper plus device-specific
 * types and functions from this module.
 *
 * @packageDocumentation
 */

// Re-export all generic types and functions from standalone module
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
} from '@audiocontrol/sample-chopper';

export {
  DEFAULT_DRUM_TYPES,
  DEFAULT_BASE_NOTE,
  // Audio utilities
  msToSamples,
  samplesToMs,
  calculateRms,
  calculatePeak,
  amplitudeToDb,
  dbToAmplitude,
  calculateRmsWindowed,
  findOnsetAboveThreshold,
  findSilenceStart,
  // Individual slicers
  sliceByFixedInterval,
  sliceBySilence,
  trimSilence,
  sliceByTransient,
  refineOnsetPosition,
  sliceByManualRegions,
  createRegionsFromBoundaries,
  createRegionsFromTempo,
  // Main orchestrator
  sliceAudio,
  analyzeForSlicing,
} from '@audiocontrol/sample-chopper';

// Device-specific exports
export type { DrumKitOutputConfig } from './types.js';

export { slicesToDrumKit } from './chopper.js';
