/**
 * Zod schema for tone YAML files.
 *
 * Supports device-agnostic base fields with device-specific extensions.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import {
  DeviceTypeSchema,
  BaseWaveParamsSchema,
  S330EnvelopeSchema,
} from './common-schema.js';

/**
 * S-330 LFO parameters.
 */
export const S330LfoParamsSchema = z.object({
  /** LFO rate/speed (0-127) */
  rate: z.number().int().min(0).max(127),
  /** Key sync on/off */
  sync: z.boolean(),
  /** LFO delay time (0-127) */
  delay: z.number().int().min(0).max(127),
  /** LFO mode */
  mode: z.enum(['normal', 'one-shot']),
  /** LFO polarity */
  polarity: z.boolean().optional(),
  /** LFO offset (0-127) */
  offset: z.number().int().min(0).max(127).optional(),
});

/**
 * S-330 TVF (Time Variant Filter) parameters.
 */
export const S330TvfParamsSchema = z.object({
  /** Filter cutoff frequency (0-127) */
  cutoff: z.number().int().min(0).max(127),
  /** Filter resonance (0-127) */
  resonance: z.number().int().min(0).max(127),
  /** Keyboard follow for filter (0-127) */
  keyFollow: z.number().int().min(0).max(127),
  /** LFO modulation depth (0-127) */
  lfoDepth: z.number().int().min(0).max(127).optional(),
  /** Envelope depth (0-127) */
  egDepth: z.number().int().min(0).max(127),
  /** Envelope polarity */
  egPolarity: z.enum(['normal', 'reverse']),
  /** Level curve (0-5) */
  levelCurve: z.number().int().min(0).max(5).optional(),
  /** Key rate follow (0-127) */
  keyRateFollow: z.number().int().min(0).max(127).optional(),
  /** Velocity rate follow (0-127) */
  velRateFollow: z.number().int().min(0).max(127).optional(),
  /** Filter on/off */
  enabled: z.boolean(),
  /** 8-point envelope */
  envelope: S330EnvelopeSchema.optional(),
});

/**
 * S-330 TVA (Time Variant Amplifier) parameters.
 */
export const S330TvaParamsSchema = z.object({
  /** Output level (0-127) */
  level: z.number().int().min(0).max(127),
  /** LFO modulation depth (0-127) */
  lfoDepth: z.number().int().min(0).max(127).optional(),
  /** Keyboard rate follow (0-127) */
  keyRate: z.number().int().min(0).max(127).optional(),
  /** Velocity rate follow (0-127) */
  velRate: z.number().int().min(0).max(127).optional(),
  /** Level curve (0-5) */
  levelCurve: z.number().int().min(0).max(5).optional(),
  /** 8-point envelope */
  envelope: S330EnvelopeSchema,
});

/**
 * S-330 specific tone extension fields.
 */
export const S330ToneExtensionSchema = z.object({
  /** Original key number (MIDI note 11-108) */
  originalKey: z.number().int().min(11).max(108),
  /** Output assignment (0-7) */
  outputAssign: z.number().int().min(0).max(7),
  /** Source tone number (0-31) */
  sourceTone: z.number().int().min(0).max(31).optional(),
  /** Transpose in semitones (-64 to +63, 0=no change) */
  transpose: z.number().int().min(-64).max(63).default(0),
  /** Fine tune (-64 to +63) */
  fineTune: z.number().int().min(-64).max(63).default(0),
  /** LFO parameters */
  lfo: S330LfoParamsSchema.optional(),
  /** TVF parameters */
  tvf: S330TvfParamsSchema.optional(),
  /** TVA parameters */
  tva: S330TvaParamsSchema.optional(),
  /** Pitch bender enabled */
  benderEnabled: z.boolean().optional(),
  /** Aftertouch enabled */
  aftertouchEnabled: z.boolean().optional(),
  /** Pitch follow for loop */
  pitchFollow: z.boolean().optional(),
});

/**
 * Complete tone YAML schema.
 *
 * Contains common fields plus device-specific extension object.
 */
export const ToneYamlSchema = z.object({
  /** Format identifier */
  format: z.literal('sampler-tone'),
  /** Device type */
  device: DeviceTypeSchema,
  /** Schema version */
  version: z.number().int().positive(),
  /** Tone name */
  name: z.string().min(1).max(12),
  /** Wave parameters */
  wave: BaseWaveParamsSchema,
  /** S-330 specific parameters */
  s330: S330ToneExtensionSchema.optional(),
  // Future device extensions:
  // jv1080: JV1080ToneExtensionSchema.optional(),
  // d110: D110ToneExtensionSchema.optional(),
}).refine(
  (data) => {
    // Ensure the device-specific extension matches the device type
    if (data.device === 's330' && !data.s330) {
      return false;
    }
    return true;
  },
  {
    message: 'Device-specific extension must be present for the specified device type',
  }
);

/**
 * Inferred type from the schema.
 */
export type ToneYaml = z.infer<typeof ToneYamlSchema>;

/**
 * S-330 tone extension type.
 */
export type S330ToneExtension = z.infer<typeof S330ToneExtensionSchema>;
