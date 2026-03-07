/**
 * Type exports for the sampler library module.
 * @packageDocumentation
 */

export type {
  // Device types
  DeviceType,
  LoopMode,

  // Base structures
  BaseWaveParams,
  BaseTone,
  BasePatch,
  BaseTemplate,

  // Template types
  TemplateType,
  DrumKitEntry,
  VelocityLayerEntry,
  DrumKitTemplate,
  VelocityLayerTemplate,
  Template,
  TemplateResult,

  // Converter interfaces
  ToneConverter,
  PatchConverter,

  // Storage interfaces
  LibraryItemInfo,
  LibraryStorage,
} from './common.js';
