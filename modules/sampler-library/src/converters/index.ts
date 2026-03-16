/**
 * Converter exports for the sampler library module.
 * @packageDocumentation
 */

// Registry
export {
  ConverterRegistry,
  converterRegistry,
} from './converter-registry.js';

export type { ToneConverter, PatchConverter } from './converter-registry.js';

// S-330 converters
export {
  s330ToneConverter,
  s330PatchConverter,
  createPatchFromKeyGroups as s330CreatePatchFromKeyGroups,
  // Also export without prefix for backward compatibility
  createPatchFromKeyGroups,
  // Wave conversion
  parseWav,
  createWav,
  wavToS330,
  s330ToWav,
  calculateSegmentsNeeded,
  validateWaveDataFits,
  // Set conversion (prefixed)
  deviceStateToSet as s330DeviceStateToSet,
  setToDeviceState as s330SetToDeviceState,
  validateSetAllocations as s330ValidateSetAllocations,
  calculateSetSegmentUsage as s330CalculateSetSegmentUsage,
  // Also export without prefix for backward compatibility (defaults to S-330)
  deviceStateToSet,
  setToDeviceState,
  validateSetAllocations,
  calculateSetSegmentUsage,
} from './s330/index.js';

export type {
  WavData,
  S330WaveData,
  S330WaveSampleRate,
  // Prefixed types
  DeviceStateInput as S330DeviceStateInput,
  DeviceStateToSetResult as S330DeviceStateToSetResult,
  SetToDeviceInput as S330SetToDeviceInput,
  SetToDeviceResult as S330SetToDeviceResult,
  // Unprefixed for backward compatibility
  DeviceStateInput,
  DeviceStateToSetResult,
  SetToDeviceInput,
  SetToDeviceResult,
} from './s330/index.js';

// S-550 converters
export {
  s550ToneConverter,
  s550PatchConverter,
  createPatchFromKeyGroups as s550CreatePatchFromKeyGroups,
  // Wave conversion (uses shared S-series format)
  wavToSeries as wavToS550,
  seriesToWav as s550ToWav,
  calculateSegmentsNeeded as s550CalculateSegmentsNeeded,
  validateWaveDataFits as s550ValidateWaveDataFits,
  // Set conversion
  deviceStateToSet as s550DeviceStateToSet,
  setToDeviceState as s550SetToDeviceState,
  validateSetAllocations as s550ValidateSetAllocations,
  calculateSetSegmentUsage as s550CalculateSetSegmentUsage,
} from './s550/index.js';

export type {
  SSeriesWaveData as S550WaveData,
  SSeriesWaveSampleRate as S550WaveSampleRate,
  DeviceStateInput as S550DeviceStateInput,
  DeviceStateToSetResult as S550DeviceStateToSetResult,
  SetToDeviceInput as S550SetToDeviceInput,
  SetToDeviceResult as S550SetToDeviceResult,
} from './s550/index.js';

// Chopped sample converters
export {
  drumKitBundleToChoppedSample,
  choppedSampleToDrumKitBundle,
  createGenericChoppedSample,
} from './chopped-sample-converter.js';

// Register converters in the global registry
import { converterRegistry } from './converter-registry.js';
import { s330ToneConverter, s330PatchConverter } from './s330/index.js';
import { s550ToneConverter, s550PatchConverter } from './s550/index.js';

converterRegistry.registerToneConverter(s330ToneConverter);
converterRegistry.registerPatchConverter(s330PatchConverter);
converterRegistry.registerToneConverter(s550ToneConverter);
converterRegistry.registerPatchConverter(s550PatchConverter);
