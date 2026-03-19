/**
 * Zod schema for common-area sample YAML files.
 *
 * A common sample is a device-agnostic tone stored in `library/common/tones/`.
 * It has no `device` field and no device-specific extension block.
 * Device constraints (e.g., 12-char name limit) are applied at promotion time.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseWaveParamsSchema, DeviceTypeSchema } from './common-schema.js';

/**
 * Common sample YAML schema.
 *
 * Follows the same standalone-schema pattern as `ChoppedSampleSchema`:
 * own `format` discriminator, no `device` field, relaxed name length.
 */
export const CommonSampleYamlSchema = z.object({
  /** Format identifier */
  format: z.literal('common-sample'),
  /** Schema version */
  version: z.literal(1),
  /** Sample name (device limits applied at promotion, not storage) */
  name: z.string().min(1).max(128),
  /** Wave parameters (file, sampleRate, loopMode, loopPoint) */
  wave: BaseWaveParamsSchema,
  /** Freeform tags for organization */
  tags: z.array(z.string()).optional(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Breadcrumb set when a device tone is demoted to the common area */
  sourceDevice: DeviceTypeSchema.optional(),
  /** ISO 8601 creation timestamp */
  createdAt: z.string().optional(),
  /** ISO 8601 last modification timestamp */
  modifiedAt: z.string().optional(),
});

/**
 * Inferred type from the schema.
 */
export type CommonSampleYaml = z.infer<typeof CommonSampleYamlSchema>;

/**
 * Summary info returned when listing common samples.
 */
export interface CommonSampleInfo {
  name: string;
  description?: string;
  tags?: string[];
  sourceDevice?: string;
  createdAt?: string;
  modifiedAt?: string;
}
