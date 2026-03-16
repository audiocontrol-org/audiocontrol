/**
 * Zod schema for chopped sample library format (manifest.yaml).
 *
 * A chopped sample is a device-agnostic representation of sliced audio
 * with optional trigger mappings and playback configuration.
 *
 * Supports variant discrimination:
 * - 'generic': Basic chopped sample with no additional metadata
 * - 'drum-kit': Adds drum kit specific metadata (baseNote, transpose, etc.)
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { MidiNoteSchema } from './common-schema.js';
import { SliceDefinitionSchema } from './drum-kit-bundle-schema.js';

/**
 * Trigger mapping: associates a trigger identifier with a slice index.
 */
export const TriggerMappingSchema = z.object({
  /** Trigger identifier (e.g., "key:a", "midi:36") */
  triggerId: z.string().min(1),
  /** Index into the slices array */
  sliceIndex: z.number().int().min(0),
});

/**
 * Polyphony mode for playback.
 */
export const PolyphonyModeSchema = z.enum(['mono', 'poly']);

/**
 * Playback mode for slices.
 */
export const PlaybackModeSchema = z.enum(['one-shot', 'gate']);

/**
 * Playback configuration for chopped samples.
 */
export const PlaybackConfigSchema = z.object({
  /** Voice allocation mode */
  polyphony: PolyphonyModeSchema,
  /** How slices respond to note-on/off */
  playbackMode: PlaybackModeSchema,
  /** Mute group per slice. 0 = no mute group. Same non-zero group chokes. */
  muteGroups: z.array(z.number().int().min(0)),
});

/**
 * Drum kit variant metadata.
 */
export const DrumKitMetadataSchema = z.object({
  /** Base MIDI note for the first slice */
  baseNote: MidiNoteSchema,
  /** Transpose in semitones (-64 to +63) */
  transpose: z.number().int().min(-64).max(63).default(0).optional(),
  /** Velocity-to-level sensitivity (0-5) */
  velocitySensitivity: z.number().int().min(0).max(5).default(2).optional(),
});

/**
 * Base fields shared by all chopped sample variants.
 */
const ChoppedSampleBaseFields = {
  /** Format identifier */
  format: z.literal('chopped-sample'),
  /** Schema version */
  version: z.literal(1),
  /** Human-readable name */
  name: z.string().min(1).max(128),
  /** Optional description */
  description: z.string().optional(),
  /** Source WAV filename */
  source: z.string().min(1),
  /** Actual audio sample rate (unconstrained) */
  sampleRate: z.number().int().positive(),
  /** Slice definitions referencing regions of the source WAV */
  slices: z.array(SliceDefinitionSchema).min(1),
  /** Optional trigger mappings */
  triggers: z.array(TriggerMappingSchema).optional(),
  /** Optional playback configuration */
  playback: PlaybackConfigSchema.optional(),
  /** ISO 8601 creation timestamp */
  createdAt: z.string().optional(),
  /** ISO 8601 last modification timestamp */
  modifiedAt: z.string().optional(),
};

/**
 * Generic chopped sample — no variant-specific metadata.
 */
export const GenericChoppedSampleSchema = z.object({
  ...ChoppedSampleBaseFields,
  variant: z.literal('generic'),
});

/**
 * Drum kit chopped sample — adds drum kit metadata.
 */
export const DrumKitChoppedSampleSchema = z.object({
  ...ChoppedSampleBaseFields,
  variant: z.literal('drum-kit'),
  /** Drum kit specific parameters */
  drumKit: DrumKitMetadataSchema,
});

/**
 * Discriminated union of all chopped sample variants.
 */
export const ChoppedSampleSchema = z.discriminatedUnion('variant', [
  GenericChoppedSampleSchema,
  DrumKitChoppedSampleSchema,
]);

// Type exports
export type TriggerMapping = z.infer<typeof TriggerMappingSchema>;
export type PolyphonyMode = z.infer<typeof PolyphonyModeSchema>;
export type PlaybackMode = z.infer<typeof PlaybackModeSchema>;
export type PlaybackConfig = z.infer<typeof PlaybackConfigSchema>;
export type DrumKitMetadata = z.infer<typeof DrumKitMetadataSchema>;
export type GenericChoppedSample = z.infer<typeof GenericChoppedSampleSchema>;
export type DrumKitChoppedSample = z.infer<typeof DrumKitChoppedSampleSchema>;
export type ChoppedSample = z.infer<typeof ChoppedSampleSchema>;

/**
 * Summary info returned when listing chopped samples.
 */
export interface ChoppedSampleInfo {
  name: string;
  variant: ChoppedSample['variant'];
  sliceCount: number;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
}
