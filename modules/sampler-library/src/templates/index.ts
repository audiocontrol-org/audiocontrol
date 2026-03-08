/**
 * Template exports for the sampler library module.
 * @packageDocumentation
 */

// Template engine
export {
  parseNoteName,
  resolveKey,
  validateToneReferences,
  TemplateHandlerRegistry,
  templateHandlerRegistry,
} from './template-engine.js';

export type {
  TemplateApplicationResult,
  TemplateHandler,
} from './template-engine.js';

// S-330 handler
export { s330TemplateHandler } from './s330-handler.js';

// Register S-330 handler in the global registry
import { templateHandlerRegistry } from './template-engine.js';
import { s330TemplateHandler } from './s330-handler.js';

templateHandlerRegistry.register(s330TemplateHandler);
