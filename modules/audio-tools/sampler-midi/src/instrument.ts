/**
 * MIDI Instrument abstraction
 *
 * Provides a simplified interface for playing notes on a MIDI instrument
 * with channel management.
 */

import { MidiSystem, MidiOutput } from "./midi";

export interface MidiInstrument {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number, velocity: number): void;
  getChannel(): number;
}

class BasicMidiInstrument implements MidiInstrument {
  private readonly midiSystem: MidiSystem;
  private output?: MidiOutput;
  private readonly channel: number;

  constructor(midiSystem: MidiSystem, channel: number) {
    this.midiSystem = midiSystem;
    this.channel = channel;
    this.output = midiSystem.getCurrentOutput();
  }

  noteOn(note: number, velocity: number): void {
    if (!this.output) {
      this.output = this.midiSystem.getCurrentOutput();
    }

    if (!this.output) {
      throw new Error('No MIDI output available for instrument');
    }

    this.output.sendNoteOn(note, velocity, this.channel);
  }

  noteOff(note: number, velocity: number): void {
    if (!this.output) {
      this.output = this.midiSystem.getCurrentOutput();
    }

    if (!this.output) {
      throw new Error('No MIDI output available for instrument');
    }

    this.output.sendNoteOff(note, velocity, this.channel);
  }

  getChannel(): number {
    return this.channel;
  }
}

/**
 * Factory function to create a MIDI instrument
 *
 * @param midiSystem - The MIDI system to use for communication
 * @param channel - The MIDI channel (0-15)
 * @returns A MIDI instrument instance
 */
export function createMidiInstrument(
  midiSystem: MidiSystem,
  channel: number
): MidiInstrument {
  if (channel < 0 || channel > 15) {
    throw new Error(`Invalid MIDI channel: ${channel}. Must be 0-15.`);
  }

  return new BasicMidiInstrument(midiSystem, channel);
}

/**
 * Legacy compatibility function
 * @deprecated Use createMidiInstrument() instead
 */
export function newMidiInstrument(
  midiSystem: MidiSystem,
  channel: number
): MidiInstrument {
  return createMidiInstrument(midiSystem, channel);
}
