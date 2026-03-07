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
  createPatchFromKeyGroups,
} from './s330/index.js';

// Register S-330 converters in the global registry
import { converterRegistry } from './converter-registry.js';
import { s330ToneConverter, s330PatchConverter } from './s330/index.js';

converterRegistry.registerToneConverter(s330ToneConverter);
converterRegistry.registerPatchConverter(s330PatchConverter);
