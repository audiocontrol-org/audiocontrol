/**
 * Schema exports for the sampler library module.
 * @packageDocumentation
 */

// Common schemas
export {
  DeviceTypeSchema,
  LoopModeSchema,
  BaseWaveParamsSchema,
  S330EnvelopeSchema,
  AdsrEnvelopeSchema,
  MidiNoteNameSchema,
  MidiNoteSchema,
  VelocityRangeSchema,
  KeyRangeSchema,
} from './common-schema.js';

export type {
  DeviceTypeZ,
  LoopModeZ,
  BaseWaveParamsZ,
  S330EnvelopeZ,
  AdsrEnvelopeZ,
} from './common-schema.js';

// Tone schemas
export {
  S330LfoParamsSchema,
  S330TvfParamsSchema,
  S330TvaParamsSchema,
  S330ToneExtensionSchema,
  ToneYamlSchema,
} from './tone-schema.js';

export type { ToneYaml, S330ToneExtension } from './tone-schema.js';

// Patch schemas
export {
  S330KeyModeSchema,
  S330AftertouchAssignSchema,
  S330KeyAssignSchema,
  KeyGroupSchema,
  S330PatchExtensionSchema,
  PatchYamlSchema,
} from './patch-schema.js';

export type { PatchYaml, KeyGroup, S330PatchExtension } from './patch-schema.js';

// Template schemas
export {
  TemplateTypeSchema,
  DrumKitEntrySchema,
  VelocityLayerEntrySchema,
  DrumKitTemplateSchema,
  VelocityLayerTemplateSchema,
  TemplateYamlSchema,
} from './template-schema.js';

export type {
  DrumKitEntry,
  VelocityLayerEntry,
  DrumKitTemplateYaml,
  VelocityLayerTemplateYaml,
  TemplateYaml,
} from './template-schema.js';
