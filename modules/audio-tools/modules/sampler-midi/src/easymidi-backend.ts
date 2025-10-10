/**
 * EasyMidi backend implementation
 *
 * Provides a MidiBackend implementation using the easymidi library.
 * This is the default backend for Node.js environments.
 *
 * @remarks
 * The EasyMidi library provides cross-platform MIDI support for Node.js
 * using native bindings. It supports:
 * - CoreMIDI on macOS
 * - ALSA on Linux
 * - Windows Multimedia API on Windows
 *
 * @example
 * ```typescript
 * import { EasyMidiBackend, MidiSystem } from '@oletizi/sampler-midi';
 *
 * const backend = new EasyMidiBackend();
 * const midiSystem = new MidiSystem(backend);
 * await midiSystem.start();
 *
 * console.log('Available inputs:', midiSystem.getInputs());
 * console.log('Available outputs:', midiSystem.getOutputs());
 * ```
 */

import * as easymidi from 'easymidi';
import {
  MidiBackend,
  MidiPortInfo,
  RawMidiInput,
  RawMidiOutput
} from '@/backend.js';

/**
 * EasyMidi-based MIDI backend.
 *
 * Uses the easymidi library to provide cross-platform MIDI support in Node.js.
 *
 * @remarks
 * This backend is suitable for:
 * - Desktop Node.js applications
 * - Server-side MIDI processing
 * - CLI tools requiring MIDI communication
 *
 * Not suitable for:
 * - Browser environments (use Web MIDI API backend instead)
 * - Environments without native module support
 *
 * @example
 * ```typescript
 * const backend = new EasyMidiBackend();
 *
 * // Query available ports
 * const inputs = backend.getInputs();
 * const outputs = backend.getOutputs();
 *
 * // Create ports
 * if (inputs.length > 0) {
 *   const input = backend.createInput(inputs[0].name);
 *   input.on('noteon', (msg) => console.log('Note on:', msg));
 * }
 * ```
 */
export class EasyMidiBackend implements MidiBackend {
  /**
   * Gets list of available MIDI input ports.
   *
   * @returns Array of input port information
   *
   * @example
   * ```typescript
   * const backend = new EasyMidiBackend();
   * const inputs = backend.getInputs();
   * inputs.forEach(input => console.log('Input:', input.name));
   * ```
   */
  getInputs(): MidiPortInfo[] {
    return easymidi.getInputs().map(name => ({ name }));
  }

  /**
   * Gets list of available MIDI output ports.
   *
   * @returns Array of output port information
   *
   * @example
   * ```typescript
   * const backend = new EasyMidiBackend();
   * const outputs = backend.getOutputs();
   * outputs.forEach(output => console.log('Output:', output.name));
   * ```
   */
  getOutputs(): MidiPortInfo[] {
    return easymidi.getOutputs().map(name => ({ name }));
  }

  /**
   * Creates a MIDI input port.
   *
   * @param name - Port name to open
   * @param virtual - Whether to create a virtual port (default: false)
   * @returns Raw MIDI input interface
   *
   * @throws {Error} If port name is invalid or port cannot be opened
   *
   * @example
   * ```typescript
   * const backend = new EasyMidiBackend();
   * const input = backend.createInput('IAC Driver Bus 1');
   *
   * input.on('noteon', (msg) => {
   *   console.log('Note on:', msg.note, msg.velocity, msg.channel);
   * });
   *
   * input.on('sysex', (msg) => {
   *   console.log('SysEx:', msg.bytes);
   * });
   * ```
   *
   * @remarks
   * Virtual ports (when supported by the platform) allow other applications
   * to connect to this port as if it were a hardware MIDI device.
   */
  createInput(name: string, virtual?: boolean): RawMidiInput {
    return new easymidi.Input(name, virtual);
  }

  /**
   * Creates a MIDI output port.
   *
   * @param name - Port name to open
   * @param virtual - Whether to create a virtual port (default: false)
   * @returns Raw MIDI output interface
   *
   * @throws {Error} If port name is invalid or port cannot be opened
   *
   * @example
   * ```typescript
   * const backend = new EasyMidiBackend();
   * const output = backend.createOutput('S3000XL');
   *
   * output.send('noteon', { note: 60, velocity: 100, channel: 0 });
   * output.send('noteoff', { note: 60, velocity: 0, channel: 0 });
   *
   * output.send('sysex', { bytes: [0xF0, 0x47, 0x00, 0xF7] });
   * ```
   *
   * @remarks
   * Virtual ports (when supported by the platform) allow other applications
   * to receive MIDI from this port as if it were a hardware MIDI device.
   */
  createOutput(name: string, virtual?: boolean): RawMidiOutput {
    return new easymidi.Output(name, virtual);
  }
}
