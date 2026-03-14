/**
 * @audiocontrol/sampler-library
 *
 * Device-agnostic library system for sampler tone/patch storage.
 * Stores data as human-readable YAML files alongside WAV audio.
 *
 * @example
 * ```typescript
 * import { ToneYamlSchema, type BaseTone } from '@audiocontrol/sampler-library';
 *
 * // Validate a tone YAML file
 * const result = ToneYamlSchema.safeParse(yamlData);
 * if (result.success) {
 *   console.log('Valid tone:', result.data.name);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Type exports
export type {
  DeviceType,
  LoopMode,
  BaseWaveParams,
  BaseTone,
  BasePatch,
  BaseTemplate,
  TemplateType,
  DrumKitEntry,
  VelocityLayerEntry,
  DrumKitTemplate,
  VelocityLayerTemplate,
  Template,
  TemplateResult,
  LibraryItemInfo,
  LibraryStorage,
} from './types/index.js';

// Schema exports
export {
  // Common schemas
  DeviceTypeSchema,
  LoopModeSchema,
  BaseWaveParamsSchema,
  S330EnvelopeSchema,
  AdsrEnvelopeSchema,
  MidiNoteNameSchema,
  MidiNoteSchema,
  VelocityRangeSchema,
  KeyRangeSchema,
  // Tone schemas
  S330LfoParamsSchema,
  S330TvfParamsSchema,
  S330TvaParamsSchema,
  S330ToneExtensionSchema,
  ToneYamlSchema,
  // Patch schemas
  S330KeyModeSchema,
  S330AftertouchAssignSchema,
  S330KeyAssignSchema,
  KeyGroupSchema,
  S330PatchExtensionSchema,
  PatchYamlSchema,
  // Template schemas
  TemplateTypeSchema,
  DrumKitEntrySchema,
  VelocityLayerEntrySchema,
  DrumKitTemplateSchema,
  VelocityLayerTemplateSchema,
  TemplateYamlSchema,
  // Set schemas
  WaveSegmentAllocationSchema,
  SetToneEntrySchema,
  SetPatchEntrySchema,
  SetSystemParamsSchema,
  SetYamlSchema,
} from './schemas/index.js';

export type {
  DeviceTypeZ,
  LoopModeZ,
  BaseWaveParamsZ,
  S330EnvelopeZ,
  AdsrEnvelopeZ,
  ToneYaml,
  S330ToneExtension,
  PatchYaml,
  KeyGroup,
  S330PatchExtension,
  DrumKitEntry as DrumKitEntryZ,
  VelocityLayerEntry as VelocityLayerEntryZ,
  DrumKitTemplateYaml,
  VelocityLayerTemplateYaml,
  TemplateYaml,
  // Set types
  WaveSegmentAllocation,
  SetToneEntry,
  SetPatchEntry,
  SetSystemParams,
  SetYaml,
  SetInfo,
  SetData,
} from './schemas/index.js';

// Converter exports
export {
  ConverterRegistry,
  converterRegistry,
  s330ToneConverter,
  s330PatchConverter,
  createPatchFromKeyGroups,
  // Wave conversion
  parseWav,
  createWav,
  wavToS330,
  s330ToWav,
  calculateSegmentsNeeded,
  validateWaveDataFits,
  // Set conversion
  deviceStateToSet,
  setToDeviceState,
  validateSetAllocations,
  calculateSetSegmentUsage,
} from './converters/index.js';

export type {
  ToneConverter,
  PatchConverter,
  WavData,
  S330WaveData,
  S330WaveSampleRate,
  DeviceStateInput,
  DeviceStateToSetResult,
  SetToDeviceInput,
  SetToDeviceResult,
} from './converters/index.js';

// Storage exports
export {
  getLibraryRoot,
  getDeviceLibraryPath,
  getTonesDirectory,
  getPatchesDirectory,
  getTemplatesDirectory,
  getTonePath,
  getToneWavePath,
  getPatchPath,
  getTemplatePath,
  sanitizeFilename,
  getBaseName,
  FileStorage,
  fileStorage,
  // Set paths
  getSetsDirectory,
  getSetDirectory,
  getSetManifestPath,
  getSetTonesDirectory,
  getSetPatchesDirectory,
  getSetTonePath,
  getSetToneWavePath,
  getSetPatchPath,
  getToneFilename,
  getPatchFilename,
  parseToneFilename,
  parsePatchFilename,
  // Set storage
  SetStorage,
  setStorage,
} from './storage/index.js';

// Template exports
export {
  parseNoteName,
  resolveKey,
  validateToneReferences,
  TemplateHandlerRegistry,
  templateHandlerRegistry,
  s330TemplateHandler,
} from './templates/index.js';

export type {
  TemplateApplicationResult,
  TemplateHandler,
} from './templates/index.js';

// Sample chopper exports
export {
  // Constants
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
  slicesToDrumKit,
  chopSampleToDrumKit,
  analyzeForSlicing,
} from './sample-chopper/index.js';

export type {
  SliceMethod,
  TransientConfig as ChopperTransientConfig,
  SilenceConfig,
  FixedConfig,
  ManualConfig,
  ManualRegion,
  SliceConfig,
  Slice,
  SliceResult,
  DrumKitOutputConfig,
} from './sample-chopper/index.js';

// Loop detector exports
export {
  // Constants
  DEFAULT_SEARCH_CONFIG,
  DEFAULT_SPLICE_CONFIG,
  DEFAULT_TRANSIENT_CONFIG,
  HARDWARE_CONSTRAINTS,
  // Zero crossing detection
  snapToWordBoundary,
  detectZeroCrossings,
  filterByPolarity,
  matchBySlope,
  findMatchingCrossings,
  calculateSlopeScore,
  generateCandidatePairs,
  // Transient exclusion
  findSustainStart,
  analyzeAttack,
  // NCC scoring
  calculateNCC,
  calculateZeroMeanNCC,
  batchCalculateNCC,
  calculateOptimalWindowSize,
  normalizeNCCScore,
  // Spectral scoring
  createHannWindow,
  computeLogMagnitudeSpectrum,
  calculateSpectralDistance,
  scoreSpectralSimilarity,
  normalizeSpectralDistance,
  batchCalculateSpectralSimilarity,
  calculateOptimalFFTSize,
  // Candidate scoring
  scoreCandidate,
  calculateCompositeScore,
  scoreCandidates,
  rankCandidates,
  filterByThresholds,
  deduplicateCandidates,
  // Loop point search
  searchLoopPoints,
  quickSearchLoopPoints,
  validateCandidate,
  search as searchLoop,
  // Splice smoothing
  applyCrossfade,
  createSmoothedCopy,
  calculateOptimalCrossfadeLength,
  analyzeDiscontinuity,
} from './loop-detector/index.js';

export type {
  // Loop detector types
  ZeroCrossingPolarity,
  ZeroCrossing,
  LoopCandidate,
  SearchConfig,
  ScoreWeights,
  SpliceConfig,
  TransientConfig,
  ProgressCallback,
  SearchRequest,
  SearchProgress,
  SearchComplete,
  SearchError,
  SearchResponse,
  SearchOptions,
  AttackAnalysis,
  DiscontinuityAnalysis,
} from './loop-detector/index.js';
