/**
 * Zod schema for common-area sample YAML files.
 *
 * A sample is a device-agnostic representation of a single audio file
 * with intrinsic properties (sample rate, loop points, root key).
 * Stored as a directory bundle in `library/common/samples/{name}/`:
 *   - sample.yaml (metadata)
 *   - sample.wav (audio data)
 *
 * No device field, no device-specific extensions. Device constraints
 * (e.g., 12-char name limit, originalKey) are applied at promotion time.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { LoopModeSchema, MidiNoteSchema, DeviceTypeSchema } from './common-schema.js';

/**
 * Common-area sample YAML schema.
 *
 * Inspired by SFZ sample-level concepts: a WAV file plus intrinsic
 * audio properties. The `rootKey` field maps to SFZ `pitch_keycenter`.
 */
export const SampleYamlSchema = z.object({
  /** Format identifier */
  format: z.literal('sample'),
  /** Schema version */
  version: z.literal(1),
  /** Sample name (device limits applied at promotion, not storage) */
  name: z.string().min(1).max(128),
  /** WAV filename (always 'sample.wav' for directory bundles) */
  file: z.string().default('sample.wav'),
  /** Sample rate in Hz */
  sampleRate: z.number().int().positive(),
  /** Loop playback mode (absent = one-shot) */
  loopMode: LoopModeSchema.optional(),
  /** Loop start point in samples */
  loopStart: z.number().int().min(0).optional(),
  /** Loop end point in samples */
  loopEnd: z.number().int().min(0).optional(),
  /** Original pitch of the sample (SFZ pitch_keycenter) */
  rootKey: MidiNoteSchema.optional(),
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
}).refine(
  (data) => {
    if (data.loopStart !== undefined && data.loopEnd !== undefined) {
      return data.loopEnd >= data.loopStart;
    }
    return true;
  },
  { message: 'loopEnd must be >= loopStart when both are specified' }
);

/**
 * Inferred type from the schema.
 */
export type SampleYaml = z.infer<typeof SampleYamlSchema>;

/**
 * Summary info returned when listing samples.
 */
export interface SampleInfo {
  name: string;
  description?: string;
  tags?: string[];
  rootKey?: string | number;
  sourceDevice?: string;
  createdAt?: string;
  modifiedAt?: string;
}
