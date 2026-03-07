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
  ToneConverter,
  PatchConverter,
  LibraryItemInfo,
  LibraryStorage,
} from './types/index.js';

// Schema exports will be added in Phase 2
// export { ToneYamlSchema, PatchYamlSchema, TemplateYamlSchema } from './schemas/index.js';

// Converter exports will be added in Phase 3
// export { ConverterRegistry } from './converters/index.js';

// Storage exports will be added in Phase 4
// export { FileStorage, getLibraryRoot } from './storage/index.js';

// Template exports will be added in Phase 5
// export { TemplateEngine } from './templates/index.js';
