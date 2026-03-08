/**
 * Browser-compatible exports for @audiocontrol/sampler-library
 *
 * This entry point excludes Node.js-only modules (storage, filesystem)
 * and only exports schemas, converters, and template utilities that
 * work in browser environments.
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
  // Wave conversion (browser-compatible)
  parseWav,
  createWav,
  wavToS330,
  s330ToWav,
  calculateSegmentsNeeded,
  validateWaveDataFits,
  // Set conversion (browser-compatible)
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
