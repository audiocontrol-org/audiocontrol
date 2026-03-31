/**
 * Zod schema for patch YAML files.
 *
 * Patches define how tones are mapped to the keyboard.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { DeviceTypeSchema, KeyRangeSchema, VelocityRangeSchema } from './common-schema.js';

/**
 * S-330 key mode options.
 */
export const S330KeyModeSchema = z.enum(['normal', 'v-sw', 'x-fade', 'v-mix', 'unison']);

/**
 * S-330 aftertouch assignment.
 */
export const S330AftertouchAssignSchema = z.enum([
  'modulation',
  'volume',
  'bend+',
  'bend-',
  'filter',
]);

/**
 * S-330 key assignment mode.
 */
export const S330KeyAssignSchema = z.enum(['rotary', 'fix']);

/**
 * Key group entry for patch definitions.
 * Maps a key range to a tone reference.
 */
export const KeyGroupSchema = z.object({
  /** Display name for this key group */
  name: z.string().min(1).optional(),
  /** Reference to library tone by name */
  tone: z.string().min(1),
  /** Key range [low, high] as MIDI note numbers */
  keyRange: KeyRangeSchema,
  /** Velocity range [min, max] (defaults to [1, 127]) */
  velocityRange: VelocityRangeSchema.optional(),
  /** Level adjustment (0-127) */
  level: z.number().int().min(0).max(127).optional(),
  /** Pan position (-64 to +63, or 'center') */
  pan: z.union([
    z.literal('center'),
    z.number().int().min(-64).max(63),
  ]).optional(),
});

function createSeriesPatchExtensionSchema(maxTone: number) {
  return z.object({
    benderRange: z.number().int().min(0).max(12).optional(),
    aftertouchSens: z.number().int().min(0).max(127).optional(),
    keyMode: S330KeyModeSchema.optional(),
    velocityThreshold: z.number().int().min(0).max(127).optional(),
    octaveShift: z.number().int().min(-2).max(2).optional(),
    detune: z.number().int().min(-64).max(63).optional(),
    velocityMixRatio: z.number().int().min(0).max(127).optional(),
    aftertouchAssign: S330AftertouchAssignSchema.optional(),
    keyAssign: S330KeyAssignSchema.optional(),
    outputAssign: z.number().int().min(0).max(8).optional(),
    toneLayer1: z.array(z.number().int().min(-1).max(maxTone)).length(109).optional(),
    toneLayer2: z.array(z.number().int().min(-1).max(maxTone)).length(109).optional(),
  });
}

/**
 * S-330 specific patch extension fields.
 */
export const S330PatchExtensionSchema = createSeriesPatchExtensionSchema(31);

/**
 * S-550 specific patch extension fields.
 * Same structure as S-330 but with extended tone ranges:
 * - toneLayer1/2 can reference tones 0-63 (instead of 0-31)
 */
export const S550PatchExtensionSchema = createSeriesPatchExtensionSchema(63);

/**
 * Complete patch YAML schema.
 */
export const PatchYamlSchema = z.object({
  /** Format identifier */
  format: z.literal('sampler-patch'),
  /** Device type */
  device: DeviceTypeSchema,
  /** Schema version */
  version: z.number().int().positive(),
  /** Patch name */
  name: z.string().min(1).max(12),
  /** Level (0-127) */
  level: z.number().int().min(0).max(127).optional(),
  /** Key groups (simplified representation) */
  keyGroups: z.array(KeyGroupSchema).optional(),
  /** S-330 specific parameters */
  s330: S330PatchExtensionSchema.optional(),
  /** S-550 specific parameters */
  s550: S550PatchExtensionSchema.optional(),
  // Future device extensions:
  // jv1080: JV1080PatchExtensionSchema.optional(),
  // d110: D110PatchExtensionSchema.optional(),
}).refine(
  (data) => {
    // Ensure device-specific extension is present when needed
    if (data.device === 's330' && !data.s330 && !data.keyGroups) {
      return false;
    }
    if (data.device === 's550' && !data.s550 && !data.keyGroups) {
      return false;
    }
    return true;
  },
  {
    message: 'Patch must have either keyGroups or device-specific extension',
  }
);

/**
 * Inferred type from the schema.
 */
export type PatchYaml = z.infer<typeof PatchYamlSchema>;

/**
 * Key group type.
 */
export type KeyGroup = z.infer<typeof KeyGroupSchema>;

/**
 * S-330 patch extension type.
 */
export type S330PatchExtension = z.infer<typeof S330PatchExtensionSchema>;

/**
 * S-550 patch extension type.
 */
export type S550PatchExtension = z.infer<typeof S550PatchExtensionSchema>;
