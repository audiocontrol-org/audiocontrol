import { z } from 'zod';

const ValueRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  default: z.number().optional(),
});

const InputBehaviorSchema = z.object({
  mode: z.enum(['absolute', 'relative', 'toggle', 'momentary']).optional(),
  sensitivity: z.number().min(0).max(1).optional(),
  deadzone: z.number().min(0).max(1).optional(),
  curve: z.enum(['linear', 'exponential', 'logarithmic', 'custom']).optional(),
  invert: z.boolean().optional(),
});

// Legacy schemas - kept for backwards compatibility during migration
const MappingBehaviorSchema = z.object({
  scaling: z.enum(['linear', 'exponential', 'logarithmic', 'custom']).optional(),
  curve: z.array(z.number()).optional(),
  quantize: z.number().optional(),
  smoothing: z.number().min(0).max(1).optional(),
  bipolar: z.boolean().optional(),
});

const MidiInputDefinitionSchema = z.object({
  type: z.enum(['cc', 'note', 'pitchbend', 'aftertouch', 'program']),
  channel: z.number().min(1).max(16).optional(),
  number: z.number().min(0).max(127).optional(),
  range: ValueRangeSchema.optional(),
  behavior: InputBehaviorSchema.optional(),
});

const PluginTargetDefinitionSchema = z.object({
  type: z.enum(['parameter', 'bypass', 'preset', 'macro']),
  identifier: z.string(),
  name: z.string().optional(),
  range: ValueRangeSchema.optional(),
  units: z.string().optional(),
  category: z.string().optional(),
});

// Export legacy schemas for potential migration scripts
export { MappingBehaviorSchema, MidiInputDefinitionSchema, PluginTargetDefinitionSchema };

const ButtonDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  cc: z.number().min(0).max(127),
  channel: z.union([z.string(), z.number()]),
  mode: z.enum(['toggle', 'momentary']),
  plugin_parameter: z.union([z.string(), z.number()]).optional(),
});

const ControlDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['encoder', 'slider', 'button', 'button_group']),
  cc: z.number().min(0).max(127).optional(),
  channel: z.union([z.string(), z.number()]).optional(),
  range: z.array(z.number()).length(2).optional(),
  description: z.string().optional(),
  mode: z.enum(['toggle', 'momentary']).optional(),
  plugin_parameter: z.union([z.string(), z.number()]).optional(),
  buttons: z.array(ButtonDefinitionSchema).optional(),
});

const MapMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const DeviceDefinitionSchema = z.object({
  manufacturer: z.string(),
  model: z.string(),
  firmware: z.string().optional(),
});

const PluginDefinitionSchema = z.object({
  manufacturer: z.string(),
  name: z.string(),
  version: z.string().optional(),
  format: z.enum(['VST', 'VST3', 'AU', 'AAX', 'LV2', 'CLAP']).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export const CanonicalMidiMapSchema = z.object({
  version: z.string(),
  device: DeviceDefinitionSchema,
  metadata: MapMetadataSchema,
  plugin: PluginDefinitionSchema.optional(),
  midi_channel: z.number().min(1).max(16).optional(),
  midi_channel_registry: z.string().optional(),
  controls: z.array(ControlDefinitionSchema),
});

export type CanonicalMidiMapInput = z.input<typeof CanonicalMidiMapSchema>;
export type CanonicalMidiMapOutput = z.output<typeof CanonicalMidiMapSchema>;