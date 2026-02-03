export interface MidiChannel {
  channel: number;
}

export interface MidiNote {
  note: number;
  velocity?: number;
}

export interface MidiCC {
  controller: number;
  value?: number;
}

export interface MidiMessage {
  type: 'note' | 'cc' | 'program-change' | 'pitch-bend';
  channel: number;
}

export interface MidiNoteMessage extends MidiMessage {
  type: 'note';
  note: number;
  velocity: number;
}

export interface MidiCCMessage extends MidiMessage {
  type: 'cc';
  controller: number;
  value: number;
}

export interface MidiProgramChangeMessage extends MidiMessage {
  type: 'program-change';
  program: number;
}

export interface MidiPitchBendMessage extends MidiMessage {
  type: 'pitch-bend';
  value: number;
}

export type MidiEventType = MidiNoteMessage | MidiCCMessage | MidiProgramChangeMessage | MidiPitchBendMessage;