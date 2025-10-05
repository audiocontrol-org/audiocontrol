/**
 * MIDI Instrument abstraction
 *
 * Provides a simplified interface for playing notes on a MIDI instrument
 * with channel management.
 */

import type { MidiSystemInterface, MidiOutput } from "@/midi.js";

export interface MidiInstrument {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number, velocity: number): void;
  getChannel(): number;
}

class BasicMidiInstrument implements MidiInstrument {
  private readonly midiSystem: MidiSystemInterface;
  private output?: MidiOutput;
  private readonly channel: number;

  constructor(midiSystem: MidiSystemInterface, channel: number) {
    if (channel < 0 || channel > 15) {
      throw new Error(`Invalid MIDI channel: ${channel}. Must be between 0 and 15.`);
    }

    this.midiSystem = midiSystem;
    this.channel = channel;
    this.output = midiSystem.getCurrentOutput();
  }

  noteOn(note: number, velocity: number): void {
    if (!this.output) {
      throw new Error('No MIDI output available for instrument');
    }
    this.output.sendNoteOn(note, velocity, this.channel);
  }

  noteOff(note: number, velocity: number): void {
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
 */
export function createMidiInstrument(
  midiSystem: MidiSystemInterface,
  channel: number
): MidiInstrument {
  return new BasicMidiInstrument(midiSystem, channel);
}

/**
 * Legacy factory function alias
 * @deprecated Use createMidiInstrument() instead
 */
export function newMidiInstrument(
  midiSystem: MidiSystemInterface,
  channel: number
): MidiInstrument {
  return createMidiInstrument(midiSystem, channel);
}
