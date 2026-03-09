/**
 * Zod schema for drum kit bundle configuration (kit.yaml).
 *
 * A drum kit bundle is a directory containing WAV samples and an optional
 * kit.yaml configuration file.
 *
 * Version 1 (legacy): Individual WAV files with filenames like "KICK 01.wav"
 * Version 2 (deferred chopping): Single source.wav + slice definitions in YAML
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
 * Slice definition for deferred chopping (version 2).
 * Defines a region of the source WAV file.
 */
export const SliceDefinitionSchema = z.object({
  /** Human-readable label for this slice (e.g., "kick", "snare") */
  label: z.string().min(1),
  /** Start position in samples (0-indexed) */
  startSample: z.number().int().min(0),
  /** End position in samples (exclusive) */
  endSample: z.number().int().min(0),
});

/**
 * Complete drum kit bundle schema for kit.yaml files.
 *
 * Version 1: Uses individual WAV files, auto-detected from filenames
 *            using the pattern `{TYPE} {##}.wav`.
 * Version 2: Uses a single source WAV + slice definitions for deferred chopping.
 */
export const DrumKitBundleSchema = z.object({
  /** Format identifier - must be 'drum-kit-bundle' */
  format: z.literal('drum-kit-bundle'),

  /** Schema version: 1 (individual WAVs) or 2 (source + slices) */
  version: z.union([z.literal(1), z.literal(2)]),

  /** Human-readable name for the drum kit bundle */
  name: z.string().min(1).max(64),

  /** Optional description */
  description: z.string().optional(),

  /** Sample rate for all samples: 15000 or 30000 Hz (default: 15000) */
  sampleRate: z.union([z.literal(15000), z.literal(30000)]).default(15000),

  /** Base MIDI note for the first kit (default: C2 = MIDI 36) */
  baseNote: MidiNoteSchema.default('C2'),

  /**
   * Transpose value in semitones for pitch adjustment (-64 to +63, default: 0).
   * Use negative values to pitch down, positive to pitch up.
   * Common use case: sample at high speed, then pitch down for more sample time.
   */
  transpose: z.number().int().min(-64).max(63).default(0).optional(),

  /**
   * Version 1: Optional explicit kit definitions.
   * If omitted, kits are auto-detected from filenames.
   */
  kits: z.array(DrumKitEntryBundleSchema).optional(),

  /**
   * Version 2: Source WAV filename (e.g., "source.wav").
   * The full source audio is stored in this file.
   */
  source: z.string().optional(),

  /**
   * Version 2: Slice definitions with sample boundaries.
   * Each slice references a region of the source WAV.
   */
  slices: z.array(SliceDefinitionSchema).optional(),
});

// Type exports
export type DrumKitSamples = z.infer<typeof DrumKitSamplesSchema>;
export type DrumKitEntryBundle = z.infer<typeof DrumKitEntryBundleSchema>;
export type SliceDefinition = z.infer<typeof SliceDefinitionSchema>;
export type DrumKitBundle = z.infer<typeof DrumKitBundleSchema>;
