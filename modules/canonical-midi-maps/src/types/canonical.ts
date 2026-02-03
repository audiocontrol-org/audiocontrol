export interface CanonicalMidiMap {
  version: string;
  device: DeviceDefinition;
  metadata: MapMetadata;
  plugin?: PluginDefinition;
  midi_channel?: number;
  midi_channel_registry?: string; // Path to registry file
  controls: ControlDefinition[];
}

export interface MapMetadata {
  name: string;
  description?: string;
  author?: string;
  date?: string;
  tags?: string[];
}

export interface DeviceDefinition {
  manufacturer: string;
  model: string;
  firmware?: string;
}

export interface PluginDefinition {
  manufacturer: string;
  name: string;
  version?: string;
  format?: 'VST' | 'VST3' | 'AU' | 'AAX' | 'LV2' | 'CLAP';
  description?: string;
  notes?: string;
}

export interface ControlDefinition {
  id: string;
  name: string;
  type: 'encoder' | 'slider' | 'button' | 'button_group';
  cc?: number;
  channel?: string | number;
  range?: number[];
  description?: string;
  mode?: 'toggle' | 'momentary';
  plugin_parameter?: string | number;
  buttons?: ButtonDefinition[];
}

export interface ButtonDefinition {
  id: string;
  name: string;
  cc: number;
  channel: string | number;
  mode: 'toggle' | 'momentary';
  plugin_parameter?: string | number;
}

// Legacy interface for backwards compatibility during migration
export interface LegacyMidiMapping {
  id: string;
  description?: string;
  midiInput: MidiInputDefinition;
  pluginTarget: PluginTargetDefinition;
  mapping?: MappingBehavior;
  enabled?: boolean;
}

export interface MidiInputDefinition {
  type: 'cc' | 'note' | 'pitchbend' | 'aftertouch' | 'program';
  channel?: number;
  number?: number;
  range?: ValueRange;
  behavior?: InputBehavior;
}

export interface PluginTargetDefinition {
  type: 'parameter' | 'bypass' | 'preset' | 'macro';
  identifier: string;
  name?: string;
  range?: ValueRange;
  units?: string;
  category?: string;
}

export interface ValueRange {
  min: number;
  max: number;
  default?: number;
}

export interface InputBehavior {
  mode?: 'absolute' | 'relative' | 'toggle' | 'momentary';
  sensitivity?: number;
  deadzone?: number;
  curve?: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  invert?: boolean;
}

export interface MappingBehavior {
  scaling?: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  curve?: number[];
  quantize?: number;
  smoothing?: number;
  bipolar?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}