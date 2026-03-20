/**
 * Browser-compatible exports for @audiocontrol/sampler-library
 *
 * This entry point excludes Node.js-only modules (storage, filesystem)
 * and only exports schemas, converters, and template utilities that
 * work in browser environments.
 *
 * @packageDocumentation
 */

// FSAA global type declarations (side-effect import augments globalThis)
import './fsaa-types.js';

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
  S550ToneExtensionSchema,
  ToneYamlSchema,
  // Patch schemas
  S330KeyModeSchema,
  S330AftertouchAssignSchema,
  S330KeyAssignSchema,
  KeyGroupSchema,
  S330PatchExtensionSchema,
  S550PatchExtensionSchema,
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
  S550ToneExtension,
  PatchYaml,
  KeyGroup,
  S330PatchExtension,
  S550PatchExtension,
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
  // S-330 converters
  s330ToneConverter,
  s330PatchConverter,
  createPatchFromKeyGroups,
  // S-550 converters
  s550ToneConverter,
  s550PatchConverter,
  s550CreatePatchFromKeyGroups,
  // Wave conversion (browser-compatible)
  parseWav,
  createWav,
  wavToS330,
  s330ToWav,
  wavToS550,
  s550ToWav,
  calculateSegmentsNeeded,
  validateWaveDataFits,
  // Set conversion (browser-compatible) - defaults to S-330
  deviceStateToSet,
  setToDeviceState,
  validateSetAllocations,
  calculateSetSegmentUsage,
  // S-550 specific set conversion
  s550DeviceStateToSet,
  s550SetToDeviceState,
  s550ValidateSetAllocations,
  s550CalculateSetSegmentUsage,
} from './converters/index.js';

export type {
  ToneConverter,
  PatchConverter,
  // Wave types
  WavData,
  S330WaveData,
  S330WaveSampleRate,
  S550WaveData,
  S550WaveSampleRate,
  // Set types (defaults to S-330)
  DeviceStateInput,
  DeviceStateToSetResult,
  SetToDeviceInput,
  SetToDeviceResult,
  // S-550 specific types
  S550DeviceStateInput,
  S550DeviceStateToSetResult,
  S550SetToDeviceInput,
  S550SetToDeviceResult,
} from './converters/index.js';

// Promotion converter exports (browser-compatible)
export {
  s330SamplePromotion,
  s550SamplePromotion,
} from './converters/index.js';

export type {
  SamplePromotionConverter,
  S330PromotionDefaults,
  S550PromotionDefaults,
} from './converters/index.js';

// Template exports (these are browser-compatible)
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

// Drum kit bundle exports
export {
  DrumKitSamplesSchema,
  DrumKitEntryBundleSchema,
  SliceDefinitionSchema,
  DrumKitBundleSchema,
} from './schemas/index.js';

export type {
  DrumKitSamples,
  DrumKitEntryBundle,
  SliceDefinition,
  DrumKitBundle,
} from './schemas/index.js';

// Sample schema exports (common area, browser-compatible)
export {
  SampleYamlSchema,
} from './schemas/index.js';

export type {
  SampleYaml,
  SampleInfo,
} from './schemas/index.js';

// Program schema exports (common area, browser-compatible)
export {
  ZoneSchema,
  ProgramYamlSchema,
} from './schemas/index.js';

export type {
  Zone,
  ProgramYaml,
  ProgramInfo,
} from './schemas/index.js';

// Chopped sample schema exports (browser-compatible)
export {
  TriggerMappingSchema,
  PolyphonyModeSchema,
  PlaybackModeSchema,
  PlaybackConfigSchema,
  DrumKitMetadataSchema,
  GenericChoppedSampleSchema,
  DrumKitChoppedSampleSchema,
  ChoppedSampleSchema,
} from './schemas/index.js';

export type {
  TriggerMapping,
  PolyphonyMode,
  PlaybackMode,
  PlaybackConfig,
  DrumKitMetadata,
  GenericChoppedSample,
  DrumKitChoppedSample,
  ChoppedSample,
  ChoppedSampleInfo,
} from './schemas/index.js';

// Chopped sample converter exports (browser-compatible)
export {
  drumKitBundleToChoppedSample,
  choppedSampleToDrumKitBundle,
  createGenericChoppedSample,
} from './converters/index.js';

// Chopped sample migration exports (browser-compatible)
export { migrateChoppedSample } from './converters/index.js';
export type { MigrationResult } from './converters/index.js';

export {
  parseDrumFilename,
  parseDrumKitDirectory,
  loadDrumKitBundle,
  resolveMidiNotes,
  getAllSampleFilenames,
  midiNoteToName,
} from './drum-kits/index.js';

export type {
  DrumSampleType,
  DetectedDrumSample,
  KitSamples,
  KitMidiNotes,
  DetectedKit,
  ResolvedDrumKitBundle,
} from './drum-kits/index.js';

// Sample chopper exports (browser-compatible, no Node.js dependencies)
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
  // Main orchestrator (browser-compatible functions only)
  sliceAudio,
  slicesToDrumKit,
  analyzeForSlicing,
} from './sample-chopper/browser.js';

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
} from './sample-chopper/browser.js';

// Loop detector exports (browser-compatible)
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

// Storage handle abstractions (runtime-agnostic)
export type {
  StorageEntry,
  StorageFile,
  StorageFileMetadata,
  StorageFileWithMetadata,
  StorageWritable,
  StorageFileHandle,
  StorageDirectoryHandle,
} from './storage-handles.js';

// Library connection
export type { LibraryConnection } from './library-connection.js';
export { BrowserLibraryConnection } from './browser-library-connection.js';
export type { BrowserLibraryConnectionOptions } from './browser-library-connection.js';

// Cached storage decorator
export { withCache, StorageCache, CachedStorageDirectoryHandle } from './cached-storage.js';
export type { CachedStorageRoot, CacheMetrics, CacheCategoryMetrics } from './cached-storage.js';

// Library filesystem scanning
export {
  LIBRARY_CATEGORIES,
  getNestedDirectory,
  getNestedDirectoryIfExists,
  copyDirectoryContents,
  moveDirectory,
  isValidMoveTarget,
  scanLibraryDirectory,
  scanTonesDirectory,
  listTonesTree,
  scanDrumKitsDirectory,
  listDrumKitsTree,
  scanPatchesDirectory,
  listPatchesTree,
  scanChoppedSamplesDirectory,
  listChoppedSamplesTree,
  scanCommonSamplesDirectory,
  listCommonSamplesTree,
  listSets,
  listSetTonesTree,
} from './library-fs.js';

export type {
  LibraryCategory,
  LibraryTreeNode,
  LibrarySetInfo,
  ItemDetector,
} from './library-fs.js';

// Common-area CRUD operations
export {
  saveSample,
  loadSample,
  saveChoppedSample,
  loadChoppedSample,
  deleteItem,
  createFolder,
  moveItem,
} from './common-area/samples.js';

export type {
  SampleSavePayload,
  SampleLoadResult,
  ChoppedSampleSavePayload,
  ChoppedSampleLoadResult,
} from './common-area/samples.js';

// Common-area import utilities
export {
  importWavToCommonArea,
  buildSampleYaml,
  deriveSampleName,
  sanitizeForFilename,
  extractWavSampleRate,
} from './common-area/import.js';

export type { ImportOptions } from './common-area/import.js';
