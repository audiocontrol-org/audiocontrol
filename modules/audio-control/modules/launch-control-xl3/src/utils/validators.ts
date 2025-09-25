/**
 * Zod schemas with custom refinements for runtime validation
 */

import { z } from 'zod';
import { MIDI_RANGES, DEVICE_CAPABILITIES } from '@/utils/constants.js';

// Basic MIDI value schemas
export const MidiChannelSchema = z
  .number()
  .int()
  .min(MIDI_RANGES.CHANNEL.MIN)
  .max(MIDI_RANGES.CHANNEL.MAX)
  .brand('MidiChannel');

export const CCNumberSchema = z
  .number()
  .int()
  .min(MIDI_RANGES.CC_NUMBER.MIN)
  .max(MIDI_RANGES.CC_NUMBER.MAX)
  .brand('CCNumber');

export const MidiValueSchema = z
  .number()
  .int()
  .min(MIDI_RANGES.CC_VALUE.MIN)
  .max(MIDI_RANGES.CC_VALUE.MAX)
  .brand('MidiValue');

export const SlotNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]);

// Control type schemas
export const ControlTypeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('knob'),
    behavior: z.enum(['absolute', 'relative']),
  }),
  z.object({
    type: z.literal('button'),
    behavior: z.enum(['momentary', 'toggle', 'trigger']),
  }),
  z.object({
    type: z.literal('fader'),
    behavior: z.literal('absolute'),
  }),
]);

// Control ID schema
export const ControlIdSchema = z.object({
  type: z.enum(['knob', 'button', 'fader']),
  position: z.number().int().min(1),
  row: z.number().int().min(1).max(3).optional(),
});

// Control configuration schema
export const ControlConfigSchema = z.object({
  id: ControlIdSchema,
  midiChannel: MidiChannelSchema,
  ccNumber: CCNumberSchema,
  controlType: ControlTypeSchema,
  name: z.string().optional(),
  color: z
    .object({
      red: MidiValueSchema,
      green: MidiValueSchema,
      blue: MidiValueSchema,
    })
    .optional(),
  range: z
    .object({
      min: z.number(),
      max: z.number(),
      default: z.number().optional(),
    })
    .optional(),
});

// Custom mode schema
export const CustomModeSchema = z
  .object({
    slot: SlotNumberSchema,
    name: z.string().min(1).max(16), // Device limitation
    controls: z.array(ControlConfigSchema),
    globalChannel: MidiChannelSchema.optional(),
    description: z.string().optional(),
    createdAt: z.date().optional(),
    modifiedAt: z.date().optional(),
  })
  .refine(
    (mode) => mode.controls.length <= DEVICE_CAPABILITIES.KNOBS_TOTAL + DEVICE_CAPABILITIES.BUTTONS_TOTAL + DEVICE_CAPABILITIES.FADERS_TOTAL,
    {
      message: `Cannot exceed ${DEVICE_CAPABILITIES.KNOBS_TOTAL + DEVICE_CAPABILITIES.BUTTONS_TOTAL + DEVICE_CAPABILITIES.FADERS_TOTAL} controls per mode`,
    }
  );

// SysEx message schema
export const SysExMessageSchema = z.object({
  manufacturerId: z.array(z.number().int().min(0).max(127)),
  deviceId: z.array(z.number().int().min(0).max(127)).optional(),
  data: z.array(z.number().int().min(0).max(127)),
});

// MIDI message schemas
export const ControlChangeMessageSchema = z.object({
  type: z.literal('controlChange'),
  channel: MidiChannelSchema,
  cc: CCNumberSchema,
  value: MidiValueSchema,
  timestamp: z.number(),
  data: z.array(z.number()),
});

export const NoteMessageSchema = z.object({
  type: z.enum(['noteOn', 'noteOff']),
  channel: MidiChannelSchema,
  note: z.number().int().min(0).max(127).brand('NoteNumber'),
  velocity: z.number().int().min(0).max(127).brand('Velocity'),
  timestamp: z.number(),
  data: z.array(z.number()),
});

// Device configuration validation
export const DeviceOptionsSchema = z.object({
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0),
      backoffMs: z.number().int().min(0),
      exponentialBackoff: z.boolean().optional(),
    })
    .optional(),
  heartbeat: z
    .object({
      intervalMs: z.number().int().min(1000),
      timeoutMs: z.number().int().min(1000).optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
  errorRecovery: z
    .object({
      autoReconnect: z.boolean(),
      reconnectDelayMs: z.number().int().min(0).optional(),
      maxReconnectAttempts: z.number().int().min(0).optional(),
    })
    .optional(),
  timeout: z
    .object({
      connectionMs: z.number().int().min(1000),
      commandMs: z.number().int().min(100),
      sysexMs: z.number().int().min(100),
    })
    .optional(),
});

// Export type inference helpers
export type ValidatedCustomMode = z.infer<typeof CustomModeSchema>;
export type ValidatedControlConfig = z.infer<typeof ControlConfigSchema>;
export type ValidatedDeviceOptions = z.infer<typeof DeviceOptionsSchema>;
export type ValidatedMidiChannel = z.infer<typeof MidiChannelSchema>;
export type ValidatedCCNumber = z.infer<typeof CCNumberSchema>;
export type ValidatedMidiValue = z.infer<typeof MidiValueSchema>;

// Validation helper functions
export function validateCustomMode(data: unknown): ValidatedCustomMode {
  return CustomModeSchema.parse(data);
}

export function validateControlConfig(data: unknown): ValidatedControlConfig {
  return ControlConfigSchema.parse(data);
}

export function validateDeviceOptions(data: unknown): ValidatedDeviceOptions {
  return DeviceOptionsSchema.parse(data);
}

export function isValidSlotNumber(value: unknown): value is 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  return SlotNumberSchema.safeParse(value).success;
}