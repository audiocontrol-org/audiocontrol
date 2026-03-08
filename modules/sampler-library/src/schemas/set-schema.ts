/**
 * Zod schema for set YAML files.
 *
 * Sets represent a complete device state snapshot, similar to a floppy disk
 * backup on the S-330. They contain all tones, patches, and wave allocation
 * information needed to restore a complete working configuration.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { DeviceTypeSchema } from './common-schema.js';

/**
 * Wave segment allocation for a tone within a set.
 *
 * S-330 has two wave banks (A and B), each with 18 segments.
 * This schema captures where a tone's wave data is stored.
 */
export const WaveSegmentAllocationSchema = z.object({
  /** Wave bank (0 = Bank A, 1 = Bank B) */
  bank: z.union([z.literal(0), z.literal(1)]),
  /** First segment index (0-17) */
  segmentTop: z.number().int().min(0).max(17),
  /** Number of segments used (1-18) */
  segmentLength: z.number().int().min(1).max(18),
});

/**
 * Tone entry in a set manifest.
 *
 * Maps a device slot to a tone file within the set.
 */
export const SetToneEntrySchema = z.object({
  /** Tone slot index (0-31 for S-330, corresponds to T11-T42) */
  slot: z.number().int().min(0).max(31),
  /** Filename reference (without extension, e.g., "T01" for T01.yaml + T01.wav) */
  file: z.string().min(1),
  /** Wave memory allocation */
  waveAllocation: WaveSegmentAllocationSchema,
});

/**
 * Patch entry in a set manifest.
 *
 * Maps a device slot to a patch file within the set.
 */
export const SetPatchEntrySchema = z.object({
  /** Patch slot index (0-15 for S-330, corresponds to P01-P16) */
  slot: z.number().int().min(0).max(15),
  /** Filename reference (without extension, e.g., "P01" for P01.yaml) */
  file: z.string().min(1),
});

/**
 * System parameters that can be stored with a set.
 * These are device-global settings that affect all tones/patches.
 */
export const SetSystemParamsSchema = z.object({
  /** Master tune offset */
  masterTune: z.number().int().min(-64).max(63).optional(),
  /** Master output level (0-127) */
  masterLevel: z.number().int().min(0).max(127).optional(),
}).optional();

/**
 * Complete set manifest schema.
 *
 * This is the schema for set.yaml files that describe the contents
 * of a set and how to restore it to a device.
 */
export const SetYamlSchema = z.object({
  /** Format identifier, always 'sampler-set' */
  format: z.literal('sampler-set'),
  /** Device type */
  device: DeviceTypeSchema,
  /** Schema version for forward compatibility */
  version: z.number().int().positive(),
  /** Human-readable set name */
  name: z.string().min(1).max(64),
  /** Optional description */
  description: z.string().max(256).optional(),
  /** Creation timestamp (ISO 8601) */
  createdAt: z.string().datetime().optional(),
  /** Last modification timestamp (ISO 8601) */
  modifiedAt: z.string().datetime().optional(),
  /** Tone slot assignments */
  tones: z.array(SetToneEntrySchema),
  /** Patch slot assignments */
  patches: z.array(SetPatchEntrySchema),
  /** Optional system parameters */
  system: SetSystemParamsSchema,
});

// Type exports
export type WaveSegmentAllocation = z.infer<typeof WaveSegmentAllocationSchema>;
export type SetToneEntry = z.infer<typeof SetToneEntrySchema>;
export type SetPatchEntry = z.infer<typeof SetPatchEntrySchema>;
export type SetSystemParams = z.infer<typeof SetSystemParamsSchema>;
export type SetYaml = z.infer<typeof SetYamlSchema>;

/**
 * Set information for listings (without loading full contents).
 */
export interface SetInfo {
  /** Set name (directory name) */
  name: string;
  /** Optional description from manifest */
  description?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last modification timestamp */
  modifiedAt?: string;
  /** Number of tones in the set */
  toneCount: number;
  /** Number of patches in the set */
  patchCount: number;
}

/**
 * Complete set data including loaded tones and patches.
 */
export interface SetData {
  /** Set manifest */
  manifest: SetYaml;
  /** Loaded tones keyed by slot number */
  tones: Map<number, { yamlPath: string; wavPath: string }>;
  /** Loaded patches keyed by slot number */
  patches: Map<number, { yamlPath: string }>;
}
