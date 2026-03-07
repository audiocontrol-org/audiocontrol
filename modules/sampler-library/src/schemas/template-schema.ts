/**
 * Zod schema for template YAML files.
 *
 * Templates define high-level instrument structures (drum kits, velocity layers)
 * that can be applied to generate patches and tone mappings.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import {
  DeviceTypeSchema,
  MidiNoteSchema,
  VelocityRangeSchema,
  KeyRangeSchema,
} from './common-schema.js';

/**
 * Template type discriminator.
 */
export const TemplateTypeSchema = z.enum(['drum-kit', 'velocity-layer']);

/**
 * Drum kit entry - maps a key to a tone.
 */
export const DrumKitEntrySchema = z.object({
  /** Display name for this drum element */
  name: z.string().min(1),
  /** MIDI note (name like "C2" or number like 36) */
  key: MidiNoteSchema,
  /** Reference to library tone by name */
  tone: z.string().min(1),
  /** Mute group for exclusive playback (e.g., hi-hat choke) */
  muteGroup: z.number().int().min(1).max(16).optional(),
  /** Level adjustment (0-127) */
  level: z.number().int().min(0).max(127).optional(),
  /** Pan position (-64 to +63, or 'center') */
  pan: z.union([
    z.literal('center'),
    z.number().int().min(-64).max(63),
  ]).optional(),
});

/**
 * Velocity layer entry - maps a velocity range to a tone.
 */
export const VelocityLayerEntrySchema = z.object({
  /** Velocity range [min, max] inclusive */
  range: VelocityRangeSchema,
  /** Reference to library tone by name */
  tone: z.string().min(1),
});

/**
 * Base template fields common to all template types.
 */
const BaseTemplateSchema = z.object({
  /** Format identifier */
  format: z.literal('sampler-template'),
  /** Device type */
  device: DeviceTypeSchema,
  /** Schema version */
  version: z.number().int().positive(),
  /** Template name */
  name: z.string().min(1),
  /** Human-readable description */
  description: z.string().optional(),
});

/**
 * Drum kit template schema.
 */
export const DrumKitTemplateSchema = BaseTemplateSchema.extend({
  /** Template type */
  type: z.literal('drum-kit'),
  /** Kit entries mapping keys to tones */
  kit: z.array(DrumKitEntrySchema).min(1),
});

/**
 * Velocity layer template base schema (without refinement for discriminated union).
 */
const VelocityLayerTemplateBaseSchema = BaseTemplateSchema.extend({
  /** Template type */
  type: z.literal('velocity-layer'),
  /** Key range for the multi-layer patch */
  keyRange: KeyRangeSchema,
  /** Velocity layers from soft to loud */
  velocityLayers: z.array(VelocityLayerEntrySchema).min(1),
});

/**
 * Velocity layer template schema with validation.
 */
export const VelocityLayerTemplateSchema = VelocityLayerTemplateBaseSchema.refine(
  (data) => {
    // Ensure velocity layers cover the full range without gaps
    const sorted = [...data.velocityLayers].sort((a, b) => a.range[0] - b.range[0]);

    // Check first layer starts at 1
    if (sorted[0] && sorted[0].range[0] !== 1) {
      return false;
    }

    // Check last layer ends at 127
    const lastLayer = sorted[sorted.length - 1];
    if (lastLayer && lastLayer.range[1] !== 127) {
      return false;
    }

    // Check for gaps between layers
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev && curr && curr.range[0] !== prev.range[1] + 1) {
        return false;
      }
    }

    return true;
  },
  {
    message: 'Velocity layers must cover the full range 1-127 without gaps',
  }
);

/**
 * Combined template schema using discriminated union.
 * Note: Uses the base schema without refinement for discrimination.
 */
export const TemplateYamlSchema = z.discriminatedUnion('type', [
  DrumKitTemplateSchema,
  VelocityLayerTemplateBaseSchema,
]);

/**
 * Inferred types from schemas.
 */
export type DrumKitEntry = z.infer<typeof DrumKitEntrySchema>;
export type VelocityLayerEntry = z.infer<typeof VelocityLayerEntrySchema>;
export type DrumKitTemplateYaml = z.infer<typeof DrumKitTemplateSchema>;
export type VelocityLayerTemplateYaml = z.infer<typeof VelocityLayerTemplateSchema>;
export type TemplateYaml = z.infer<typeof TemplateYamlSchema>;
