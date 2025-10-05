/**
 * MIDI backend abstraction interfaces
 *
 * This module defines the backend interface for MIDI port enumeration and creation.
 * Enables dependency injection and testing without hardware dependencies.
 */

/**
 * Basic port information
 */
export interface MidiPortInfo {
  name: string;
}

/**
 * Raw MIDI input interface - low-level backend
 */
export interface RawMidiInput {
  on(event: string, callback: (...args: any[]) => void): void;
  removeListener(event: string, callback: (...args: any[]) => void): void;
  close(): void;
}

/**
 * Raw MIDI output interface - low-level backend
 */
export interface RawMidiOutput {
  send(type: string, data: any): void;
  close(): void;
}

/**
 * Backend interface for MIDI port management
 *
 * Implementations provide platform-specific MIDI port enumeration
 * and creation (e.g., easymidi, Web MIDI API, etc.)
 */
export interface MidiBackend {
  /**
   * Get list of available MIDI input ports
   */
  getInputs(): MidiPortInfo[];

  /**
   * Get list of available MIDI output ports
   */
  getOutputs(): MidiPortInfo[];

  /**
   * Create a MIDI input port
   * @param name Port name to open
   * @param virtual Whether to create a virtual port (optional)
   */
  createInput(name: string, virtual?: boolean): RawMidiInput;

  /**
   * Create a MIDI output port
   * @param name Port name to open
   * @param virtual Whether to create a virtual port (optional)
   */
  createOutput(name: string, virtual?: boolean): RawMidiOutput;
}
