/**
 * Common Zod schemas shared across tone, patch, and template definitions.
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Device type discriminator.
 * Add new device types here as they are supported.
 */
export const DeviceTypeSchema = z.enum(['s330', 's550', 'jv1080', 'd110']);

/**
 * Loop mode options.
 */
export const LoopModeSchema = z.enum(['oneShot', 'forward', 'alternating', 'reverse']);

/**
 * Base wave parameters common to all devices.
 */
export const BaseWaveParamsSchema = z.object({
  /** Filename of the associated WAV file */
  file: z.string().min(1),
  /** Sample rate in Hz */
  sampleRate: z.number().int().positive(),
  /** Loop playback mode */
  loopMode: LoopModeSchema,
  /** Loop start point (sample offset) */
  loopPoint: z.number().int().min(0).optional(),
});

/**
 * 8-point envelope used by S-330 TVA and TVF.
 * Other devices may use simpler ADSR envelopes.
 */
export const S330EnvelopeSchema = z.object({
  /** 8 level values (0-127) */
  levels: z.tuple([
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
    z.number().int().min(0).max(127),
  ]),
  /** 8 rate values (1-127) */
  rates: z.tuple([
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
    z.number().int().min(1).max(127),
  ]),
  /** Sustain point (0-7) */
  sustainPoint: z.number().int().min(0).max(7),
  /** End point (1-8) */
  endPoint: z.number().int().min(1).max(8),
});

/**
 * Simple ADSR envelope for devices that use it.
 */
export const AdsrEnvelopeSchema = z.object({
  attack: z.number().int().min(0).max(127),
  decay: z.number().int().min(0).max(127),
  sustain: z.number().int().min(0).max(127),
  release: z.number().int().min(0).max(127),
});

/**
 * MIDI note name pattern (e.g., "C2", "F#4", "Bb3").
 */
export const MidiNoteNameSchema = z.string().regex(
  /^[A-Ga-g][#b]?-?[0-9]$/,
  'Must be a valid MIDI note name (e.g., C2, F#4, Bb3)'
);

/**
 * MIDI note as either a name or number.
 */
export const MidiNoteSchema = z.union([
  MidiNoteNameSchema,
  z.number().int().min(0).max(127),
]);

/**
 * Velocity range [min, max] inclusive.
 */
export const VelocityRangeSchema = z.tuple([
  z.number().int().min(1).max(127),
  z.number().int().min(1).max(127),
]).refine(
  ([min, max]) => min <= max,
  { message: 'Velocity range min must be <= max' }
);

/**
 * Key range [low, high] as MIDI note numbers.
 */
export const KeyRangeSchema = z.tuple([
  z.number().int().min(0).max(127),
  z.number().int().min(0).max(127),
]).refine(
  ([low, high]) => low <= high,
  { message: 'Key range low must be <= high' }
);

// Type exports
export type DeviceTypeZ = z.infer<typeof DeviceTypeSchema>;
export type LoopModeZ = z.infer<typeof LoopModeSchema>;
export type BaseWaveParamsZ = z.infer<typeof BaseWaveParamsSchema>;
export type S330EnvelopeZ = z.infer<typeof S330EnvelopeSchema>;
export type AdsrEnvelopeZ = z.infer<typeof AdsrEnvelopeSchema>;
