/**
 * EasyMidi backend implementation
 *
 * Provides a MidiBackend implementation using the easymidi library.
 * This is the default backend for Node.js environments.
 */

import * as easymidi from 'easymidi';
import {
  MidiBackend,
  MidiPortInfo,
  RawMidiInput,
  RawMidiOutput
} from '@/backend.js';

/**
 * EasyMidi-based MIDI backend
 *
 * Uses the easymidi library to provide cross-platform MIDI support in Node.js.
 */
export class EasyMidiBackend implements MidiBackend {
  getInputs(): MidiPortInfo[] {
    return easymidi.getInputs().map(name => ({ name }));
  }

  getOutputs(): MidiPortInfo[] {
    return easymidi.getOutputs().map(name => ({ name }));
  }

  createInput(name: string, virtual?: boolean): RawMidiInput {
    return new easymidi.Input(name, virtual);
  }

  createOutput(name: string, virtual?: boolean): RawMidiOutput {
    return new easymidi.Output(name, virtual);
  }
}
