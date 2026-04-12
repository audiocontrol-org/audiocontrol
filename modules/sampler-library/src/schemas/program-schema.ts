/**
 * Zod schema for common-area program YAML files.
 *
 * A program is a device-agnostic instrument definition: a collection
 * of zones that map samples to key ranges, velocity layers, and
 * performance parameters. Analogous to SFZ `<group>` with `<region>` zones.
 *
 * Stored as a directory bundle (`program.yaml` + sample WAVs) in
 * `library/common/samples/`.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import {
  MidiNoteSchema,
  KeyRangeSchema,
  VelocityRangeSchema,
} from './common-schema.js';
import { PolyphonyModeSchema, PlaybackModeSchema } from './chopped-sample-schema.js';

/**
 * Provenance information linking a program back to its source sample.
 */
export const SourceInfoSchema = z.object({
  /** Name of the source sample this program was created from */
  sampleName: z.string().min(1),
  /** Directory name of the source sample in the library (for lookup) */
  sampleDirectory: z.string().min(1).optional(),
});

/**
 * A zone maps one sample to a region of the keyboard/velocity space.
 * Analogous to SFZ `<region>`.
 */
export const ZoneSchema = z.object({
  /** Sample name or path reference (filename within the program bundle) */
  sample: z.string().min(1),
  /** Key range [low, high] MIDI notes — when this zone is triggered */
  keyRange: KeyRangeSchema.optional(),
  /** Velocity range [low, high] — velocity layer boundaries */
  velocityRange: VelocityRangeSchema.optional(),
  /** Override the sample's rootKey for this zone (SFZ pitch_keycenter) */
  rootKey: MidiNoteSchema.optional(),
  /** Transpose in semitones */
  transpose: z.number().int().min(-64).max(63).optional(),
  /** Fine tuning in cents */
  fineTune: z.number().int().min(-64).max(63).optional(),
  /** Mute group: 0 = none, same non-zero group chokes (SFZ group/off_by) */
  muteGroup: z.number().int().min(0).optional(),
  /** Human-readable label (e.g., "kick", "snare", "hi-hat open") */
  label: z.string().optional(),
});

/**
 * Common-area program YAML schema.
 *
 * A program collects zones into an instrument. Shared playback settings
 * (polyphony, playback mode) apply to all zones — analogous to SFZ
 * `<group>`-level opcodes.
 */
export const ProgramYamlSchema = z.object({
  /** Format identifier */
  format: z.literal('program'),
  /** Schema version */
  version: z.literal(1),
  /** Program name */
  name: z.string().min(1).max(128),
  /** Zones mapping samples to performance parameters */
  zones: z.array(ZoneSchema).min(1),
  /** Voice allocation mode (mono/poly) */
  polyphony: PolyphonyModeSchema.optional(),
  /** How zones respond to note-on/off (one-shot/gate) */
  playbackMode: PlaybackModeSchema.optional(),
  /** Provenance: which source sample this program was created from */
  sourceInfo: SourceInfoSchema.optional(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Freeform tags for organization */
  tags: z.array(z.string()).optional(),
  /** ISO 8601 creation timestamp */
  createdAt: z.string().optional(),
  /** ISO 8601 last modification timestamp */
  modifiedAt: z.string().optional(),
});

/**
 * Inferred types from schemas.
 */
export type SourceInfo = z.infer<typeof SourceInfoSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type ProgramYaml = z.infer<typeof ProgramYamlSchema>;

/**
 * Summary info returned when listing programs.
 */
export interface ProgramInfo {
  name: string;
  zoneCount: number;
  description?: string;
  tags?: string[];
  createdAt?: string;
  modifiedAt?: string;
}
