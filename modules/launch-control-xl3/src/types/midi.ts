/**
 * MIDI message types for Launch Control XL 3
 */

// Branded types for type safety
export type CCNumber = number & { readonly __brand: 'CCNumber' };
export type MidiChannel = number & { readonly __brand: 'MidiChannel' };
export type MidiValue = number & { readonly __brand: 'MidiValue' };
export type NoteNumber = number & { readonly __brand: 'NoteNumber' };
export type Velocity = number & { readonly __brand: 'Velocity' };

// Smart constructors with validation
export const CCNumber = (value: number): CCNumber => {
  if (value < 0 || value > 127) {
    throw new Error(`Invalid CC number: ${value}. Must be 0-127.`);
  }
  return value as CCNumber;
};

export const MidiChannel = (value: number): MidiChannel => {
  if (value < 1 || value > 16) {
    throw new Error(`Invalid MIDI channel: ${value}. Must be 1-16.`);
  }
  return value as MidiChannel;
};

export const MidiValue = (value: number): MidiValue => {
  if (value < 0 || value > 127) {
    throw new Error(`Invalid MIDI value: ${value}. Must be 0-127.`);
  }
  return value as MidiValue;
};

export const NoteNumber = (value: number): NoteNumber => {
  if (value < 0 || value > 127) {
    throw new Error(`Invalid note number: ${value}. Must be 0-127.`);
  }
  return value as NoteNumber;
};

export const Velocity = (value: number): Velocity => {
  if (value < 0 || value > 127) {
    throw new Error(`Invalid velocity: ${value}. Must be 0-127.`);
  }
  return value as Velocity;
};

// MIDI message interfaces
export interface MidiMessage {
  readonly timestamp: number;
  readonly data: readonly number[];
}

export interface ControlChangeMessage extends MidiMessage {
  readonly type: 'controlChange';
  readonly channel: MidiChannel;
  readonly cc: CCNumber;
  readonly value: MidiValue;
}

export interface NoteOnMessage extends MidiMessage {
  readonly type: 'noteOn';
  readonly channel: MidiChannel;
  readonly note: NoteNumber;
  readonly velocity: Velocity;
}

export interface NoteOffMessage extends MidiMessage {
  readonly type: 'noteOff';
  readonly channel: MidiChannel;
  readonly note: NoteNumber;
  readonly velocity: Velocity;
}

export interface PitchBendMessage extends MidiMessage {
  readonly type: 'pitchBend';
  readonly channel: MidiChannel;
  readonly value: number; // 14-bit value (0-16383)
}

export interface SysExMessage extends MidiMessage {
  readonly type: 'sysEx';
  readonly manufacturerId: readonly number[];
  readonly deviceId?: number;
  readonly data: readonly number[];
}

export type ParsedMidiMessage =
  | ControlChangeMessage
  | NoteOnMessage
  | NoteOffMessage
  | PitchBendMessage
  | SysExMessage;

// MIDI message parsing results
export interface MidiParseResult {
  readonly success: boolean;
  readonly message?: ParsedMidiMessage;
  readonly error?: string;
}

// MIDI event handlers
export interface MidiEventHandlers {
  readonly controlChange?: (message: ControlChangeMessage) => void;
  readonly noteOn?: (message: NoteOnMessage) => void;
  readonly noteOff?: (message: NoteOffMessage) => void;
  readonly pitchBend?: (message: PitchBendMessage) => void;
  readonly sysEx?: (message: SysExMessage) => void;
  readonly raw?: (message: MidiMessage) => void;
}