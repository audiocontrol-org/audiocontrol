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
} from './schemas/index.js';

// Converter exports
export {
  ConverterRegistry,
  converterRegistry,
  s330ToneConverter,
  s330PatchConverter,
  createPatchFromKeyGroups,
} from './converters/index.js';

export type { ToneConverter, PatchConverter } from './converters/index.js';

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
