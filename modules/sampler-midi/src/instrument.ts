/**
 * MIDI Instrument abstraction
 *
 * Provides a simplified interface for playing notes on a MIDI instrument
 * with channel management.
 *
 * @remarks
 * The instrument abstraction simplifies MIDI note operations by managing
 * channel assignment and output routing internally.
 */

import type { MidiSystemInterface, MidiOutput } from "@/midi.js";

/**
 * Interface for a MIDI instrument with note control.
 *
 * @remarks
 * Provides a simplified API for sending note on/off messages
 * on a specific MIDI channel.
 */
export interface MidiInstrument {
  /**
   * Sends a note on message.
   *
   * @param note - MIDI note number (0-127)
   * @param velocity - Note velocity (0-127)
   * @throws {Error} If no MIDI output is available
   *
   * @example
   * ```typescript
   * instrument.noteOn(60, 100); // Middle C at velocity 100
   * ```
   */
  noteOn(note: number, velocity: number): void;

  /**
   * Sends a note off message.
   *
   * @param note - MIDI note number (0-127)
   * @param velocity - Release velocity (0-127)
   * @throws {Error} If no MIDI output is available
   *
   * @example
   * ```typescript
   * instrument.noteOff(60, 64); // Release middle C
   * ```
   */
  noteOff(note: number, velocity: number): void;

  /**
   * Gets the MIDI channel this instrument is assigned to.
   *
   * @returns MIDI channel number (0-15)
   */
  getChannel(): number;
}

/**
 * Basic implementation of MidiInstrument.
 *
 * @internal
 */
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
 * Factory function to create a MIDI instrument.
 *
 * @param midiSystem - The MIDI system to use for communication
 * @param channel - MIDI channel for the instrument (0-15)
 * @returns New MidiInstrument instance
 * @throws {Error} If channel is not in the valid range (0-15)
 *
 * @example
 * ```typescript
 * import { MidiSystem, EasyMidiBackend, createMidiInstrument } from '@audiocontrol/sampler-midi';
 *
 * const backend = new EasyMidiBackend();
 * const midiSystem = new MidiSystem(backend);
 * await midiSystem.start();
 *
 * const instrument = createMidiInstrument(midiSystem, 0);
 * instrument.noteOn(60, 100);
 * setTimeout(() => instrument.noteOff(60, 64), 500);
 * ```
 */
export function createMidiInstrument(
  midiSystem: MidiSystemInterface,
  channel: number
): MidiInstrument {
  return new BasicMidiInstrument(midiSystem, channel);
}

/**
 * Legacy factory function alias.
 *
 * @param midiSystem - The MIDI system to use for communication
 * @param channel - MIDI channel for the instrument (0-15)
 * @returns New MidiInstrument instance
 * @throws {Error} If channel is not in the valid range (0-15)
 *
 * @deprecated Use createMidiInstrument() instead
 */
export function newMidiInstrument(
  midiSystem: MidiSystemInterface,
  channel: number
): MidiInstrument {
  return createMidiInstrument(midiSystem, channel);
}
