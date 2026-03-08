/**
 * Zod schema for drum kit bundle configuration (kit.yaml).
 *
 * A drum kit bundle is a directory containing WAV samples and an optional
 * kit.yaml configuration file. Samples can be auto-detected from filenames
 * following the pattern `{TYPE} {##}.wav` (e.g., "KICK 01.wav", "SNARE 02.wav").
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { MidiNoteSchema } from './common-schema.js';

/**
 * Sample file references for a single 4-piece drum kit.
 * Each kit has kick, snare, closed hi-hat, and open hi-hat.
 */
export const DrumKitSamplesSchema = z.object({
  /** Kick drum sample filename */
  kick: z.string().min(1),
  /** Snare drum sample filename */
  snare: z.string().min(1),
  /** Closed hi-hat sample filename */
  hhClosed: z.string().min(1),
  /** Open hi-hat sample filename */
  hhOpen: z.string().min(1),
});

/**
 * A single kit entry with sample references.
 */
export const DrumKitEntryBundleSchema = z.object({
  /** Sample file references */
  samples: DrumKitSamplesSchema,
});

/**
 * Complete drum kit bundle schema for kit.yaml files.
 *
 * If the `kits` array is omitted, the system auto-detects kits from
 * filenames using the pattern `{TYPE} {##}.wav`.
 */
export const DrumKitBundleSchema = z.object({
  /** Format identifier - must be 'drum-kit-bundle' */
  format: z.literal('drum-kit-bundle'),

  /** Schema version - currently only version 1 is supported */
  version: z.literal(1),

  /** Human-readable name for the drum kit bundle */
  name: z.string().min(1).max(64),

  /** Optional description */
  description: z.string().optional(),

  /** Sample rate for all samples: 15000 or 30000 Hz (default: 15000) */
  sampleRate: z.union([z.literal(15000), z.literal(30000)]).default(15000),

  /** Base MIDI note for the first kit (default: C2 = MIDI 36) */
  baseNote: MidiNoteSchema.default('C2'),

  /**
   * Optional explicit kit definitions.
   * If omitted, kits are auto-detected from filenames.
   */
  kits: z.array(DrumKitEntryBundleSchema).optional(),
});

// Type exports
export type DrumKitSamples = z.infer<typeof DrumKitSamplesSchema>;
export type DrumKitEntryBundle = z.infer<typeof DrumKitEntryBundleSchema>;
export type DrumKitBundle = z.infer<typeof DrumKitBundleSchema>;
