/**
 * Launch Control XL 3 protocol message types and control definitions
 */

import type { CCNumber, MidiChannel } from './midi.js';
import type { SlotNumber } from './device.js';

// Control types and behaviors
export type ControlType =
  | { readonly type: 'knob'; readonly behavior: 'absolute' | 'relative' }
  | { readonly type: 'button'; readonly behavior: 'momentary' | 'toggle' | 'trigger' }
  | { readonly type: 'fader'; readonly behavior: 'absolute' };

// Physical control layout positions
export type KnobPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // Row position
export type KnobRow = 1 | 2 | 3; // 3 rows of 8 knobs each
export type ButtonPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 8 buttons
export type FaderPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 8 faders

// Control identifier combining physical position and type
export interface ControlId {
  readonly type: 'knob' | 'button' | 'fader';
  readonly position: number; // 1-based position
  readonly row?: KnobRow; // Only for knobs
}

// Individual control configuration
export interface ControlConfig {
  readonly id: ControlId;
  readonly midiChannel: MidiChannel;
  readonly ccNumber: CCNumber;
  readonly controlType: ControlType;
  readonly name?: string;
  readonly color?: ControlColor;
  readonly range?: ControlRange;
}

// Control color for LED feedback (if supported)
export interface ControlColor {
  readonly red: number; // 0-127
  readonly green: number; // 0-127
  readonly blue: number; // 0-127
}

// Control value range mapping
export interface ControlRange {
  readonly min: number;
  readonly max: number;
  readonly default?: number;
}

// Complete custom mode configuration
export interface CustomMode {
  readonly slot: SlotNumber;
  readonly name: string;
  readonly controls: readonly ControlConfig[];
  readonly globalChannel?: MidiChannel;
  readonly description?: string;
  readonly createdAt?: Date;
  readonly modifiedAt?: Date;
}

// Template for creating custom modes
export interface ModeTemplate {
  readonly name: string;
  readonly description?: string;
  readonly controls: readonly Omit<ControlConfig, 'id'>[];
  readonly presets?: readonly TemplatePreset[];
}

export interface TemplatePreset {
  readonly name: string;
  readonly description?: string;
  readonly values: Record<string, number>; // Control ID -> value mapping
}

// MIDI mapping definition
export interface MidiMapping {
  readonly source: ControlId;
  readonly target: MidiTarget;
  readonly transform?: ValueTransform;
}

export interface MidiTarget {
  readonly type: 'cc' | 'note' | 'pitchBend' | 'aftertouch';
  readonly channel: MidiChannel;
  readonly number?: CCNumber; // For CC and note messages
}

export interface ValueTransform {
  readonly type: 'linear' | 'logarithmic' | 'exponential' | 'curve';
  readonly inputRange: [number, number];
  readonly outputRange: [number, number];
  readonly curve?: readonly number[]; // For custom curve transforms
}

// Device layout constants
export const DEVICE_LAYOUT = {
  KNOBS: {
    TOTAL: 24,
    ROWS: 3,
    PER_ROW: 8,
  },
  BUTTONS: {
    TOTAL: 8,
  },
  FADERS: {
    TOTAL: 8,
  },
} as const;

// Default control configurations
export const DEFAULT_KNOB_CONFIG: Omit<ControlConfig, 'id'> = {
  midiChannel: 1 as MidiChannel,
  ccNumber: 1 as CCNumber,
  controlType: { type: 'knob', behavior: 'absolute' },
} as const;

export const DEFAULT_BUTTON_CONFIG: Omit<ControlConfig, 'id'> = {
  midiChannel: 1 as MidiChannel,
  ccNumber: 1 as CCNumber,
  controlType: { type: 'button', behavior: 'momentary' },
} as const;

export const DEFAULT_FADER_CONFIG: Omit<ControlConfig, 'id'> = {
  midiChannel: 1 as MidiChannel,
  ccNumber: 1 as CCNumber,
  controlType: { type: 'fader', behavior: 'absolute' },
} as const;

// Factory preset mode definitions
export interface FactoryPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly mode: Omit<CustomMode, 'slot'>;
  readonly category: PresetCategory;
}

export type PresetCategory =
  | 'daw'
  | 'synthesizer'
  | 'drums'
  | 'effects'
  | 'utility'
  | 'custom';

// Protocol validation schemas (runtime types)
export interface ProtocolValidation {
  readonly customMode: (data: unknown) => data is CustomMode;
  readonly controlConfig: (data: unknown) => data is ControlConfig;
  readonly modeTemplate: (data: unknown) => data is ModeTemplate;
}