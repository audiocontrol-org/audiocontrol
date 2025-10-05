/**
 * MIDI communication abstraction
 *
 * This module provides a unified interface for MIDI I/O operations,
 * supporting both input and output port management with listener registration.
 *
 * @remarks
 * Architecture: Interface-first design with dependency injection.
 * The MidiSystem class requires a MidiBackend to be explicitly injected,
 * enabling testing without hardware and supporting multiple backend implementations.
 *
 * @example
 * ```typescript
 * import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';
 *
 * const backend = new EasyMidiBackend();
 * const midiSystem = new MidiSystem(backend);
 * await midiSystem.start({ debug: true, enableSysex: true });
 *
 * // List available ports
 * console.log('Inputs:', midiSystem.getInputs());
 * console.log('Outputs:', midiSystem.getOutputs());
 *
 * // Add listener for incoming messages
 * midiSystem.addListener('noteon', (msg) => {
 *   console.log('Note on:', msg);
 * });
 *
 * // Send MIDI messages
 * const output = midiSystem.getCurrentOutput();
 * if (output) {
 *   output.sendNoteOn(60, 100, 0);
 * }
 * ```
 */

import { ProcessOutput, newClientOutput } from "@oletizi/sampler-lib";
import { MidiBackend, RawMidiInput, RawMidiOutput } from "@/backend.js";

/**
 * Basic MIDI port information.
 */
export interface MidiPort {
  /** Port name */
  readonly name: string;
  /** Manufacturer name (optional) */
  readonly manufacturer?: string;
}

/**
 * MIDI input port with listener management.
 */
export interface MidiInput extends MidiPort {
  /**
   * Adds an event listener to the input port.
   *
   * @param event - Event type (e.g., 'noteon', 'noteoff', 'sysex')
   * @param callback - Callback function to handle the event
   */
  addListener(event: string, callback: (message: unknown) => void): void;

  /**
   * Removes an event listener from the input port.
   *
   * @param event - Event type to remove listener from
   * @param callback - Specific callback to remove
   */
  removeListener(event: string, callback: (message: unknown) => void): void;

  /**
   * Closes the input port.
   */
  close(): void;
}

/**
 * MIDI output port with message sending capabilities.
 */
export interface MidiOutput extends MidiPort {
  /**
   * Sends a generic MIDI event.
   *
   * @param eventType - MIDI event type (e.g., 'noteon', 'cc', 'programchange')
   * @param message - Event-specific message data
   */
  send(eventType: string, message: unknown): void;

  /**
   * Sends a MIDI System Exclusive (SysEx) message.
   *
   * @param data - Array of SysEx data bytes
   *
   * @remarks
   * Automatically wraps data with SysEx start (0xF0) and end (0xF7) bytes if not present.
   */
  sendSysex(data: number[]): void;

  /**
   * Sends a note on message.
   *
   * @param note - MIDI note number (0-127)
   * @param velocity - Note velocity (0-127)
   * @param channel - MIDI channel (0-15)
   */
  sendNoteOn(note: number, velocity: number, channel: number): void;

  /**
   * Sends a note off message.
   *
   * @param note - MIDI note number (0-127)
   * @param velocity - Release velocity (0-127)
   * @param channel - MIDI channel (0-15)
   */
  sendNoteOff(note: number, velocity: number, channel: number): void;

  /**
   * Closes the output port.
   */
  close(): void;
}

/**
 * Configuration options for the MIDI system.
 */
export interface MidiConfig {
  /** Enable System Exclusive (SysEx) message support (default: true) */
  enableSysex?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Interface for the MIDI system.
 *
 * @remarks
 * Provides port enumeration, selection, and message handling.
 */
export interface MidiSystemInterface {
  /**
   * Starts the MIDI system with optional configuration.
   *
   * @param config - Configuration options
   * @returns Promise resolving when system is ready
   *
   * @remarks
   * Automatically selects the first available input and output ports if any exist.
   */
  start(config?: MidiConfig): Promise<void>;

  /**
   * Stops the MIDI system and closes all ports.
   *
   * @returns Promise resolving when system is stopped
   */
  stop(): Promise<void>;

  /**
   * Gets list of available MIDI input ports.
   *
   * @returns Array of input port information
   */
  getInputs(): MidiPort[];

  /**
   * Gets list of available MIDI output ports.
   *
   * @returns Array of output port information
   */
  getOutputs(): MidiPort[];

  /**
   * Gets the currently active input port.
   *
   * @returns Current input port, or undefined if none selected
   */
  getCurrentInput(): MidiInput | undefined;

  /**
   * Gets the currently active output port.
   *
   * @returns Current output port, or undefined if none selected
   */
  getCurrentOutput(): MidiOutput | undefined;

  /**
   * Sets the active input port.
   *
   * @param input - Input port or port name to activate
   *
   * @remarks
   * Closes the previous input port if one was active.
   * Transfers all registered listeners to the new input port.
   */
  setInput(input: MidiInput | string): void;

  /**
   * Sets the active output port.
   *
   * @param output - Output port or port name to activate
   *
   * @remarks
   * Closes the previous output port if one was active.
   */
  setOutput(output: MidiOutput | string): void;

  /**
   * Adds a listener for MIDI events on the current input port.
   *
   * @param event - Event type (e.g., 'noteon', 'noteoff', 'sysex')
   * @param callback - Callback function to handle the event
   *
   * @remarks
   * Listeners are automatically transferred when the input port changes.
   */
  addListener(event: string, callback: (message: unknown) => void): void;

  /**
   * Removes a listener for MIDI events.
   *
   * @param event - Event type to remove listener from
   * @param callback - Specific callback to remove
   */
  removeListener(event: string, callback: (message: unknown) => void): void;
}

/**
 * Internal listener specification.
 *
 * @internal
 */
interface ListenerSpec {
  eventName: string;
  eventListener: (message: unknown) => void;
}

/**
 * Wrapper for backend MIDI input.
 *
 * @internal
 */
class BackendMidiInput implements MidiInput {
  readonly name: string;
  readonly manufacturer?: string;
  private port: RawMidiInput;

  constructor(name: string, port: RawMidiInput) {
    this.name = name;
    this.port = port;
  }

  addListener(event: string, callback: (message: unknown) => void): void {
    this.port.on(event, callback);
  }

  removeListener(event: string, callback: (message: unknown) => void): void {
    this.port.removeListener(event, callback);
  }

  close(): void {
    this.port.close();
  }
}

/**
 * Wrapper for backend MIDI output.
 *
 * @internal
 */
class BackendMidiOutput implements MidiOutput {
  readonly name: string;
  readonly manufacturer?: string;
  private port: RawMidiOutput;

  constructor(name: string, port: RawMidiOutput) {
    this.name = name;
    this.port = port;
  }

  send(eventType: string, message: unknown): void {
    this.port.send(eventType, message);
  }

  sendSysex(data: number[]): void {
    // easymidi requires sysex arrays to start with 0xF0 and end with 0xF7
    const wrappedData = (data[0] === 0xF0 && data[data.length - 1] === 0xF7) ? data : [0xF0, ...data, 0xF7];
    this.port.send('sysex', { bytes: wrappedData });
  }

  sendNoteOn(note: number, velocity: number, channel: number): void {
    this.port.send('noteon', { note, velocity, channel });
  }

  sendNoteOff(note: number, velocity: number, channel: number): void {
    this.port.send('noteoff', { note, velocity, channel });
  }

  close(): void {
    this.port.close();
  }
}

/**
 * MIDI system with dependency injection.
 *
 * This class requires explicit injection of a MidiBackend implementation.
 * No default backend is provided - users must choose their backend explicitly.
 *
 * @remarks
 * The dependency injection pattern enables:
 * - Testing without hardware (use mock backends)
 * - Multiple backend support (EasyMidi, Web MIDI API, etc.)
 * - Platform-specific optimizations
 * - Clean separation of concerns
 *
 * @example
 * ```typescript
 * import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';
 *
 * // Create backend
 * const backend = new EasyMidiBackend();
 *
 * // Inject backend into system
 * const system = new MidiSystem(backend);
 *
 * // Start and use
 * await system.start({ debug: true });
 *
 * const output = system.getCurrentOutput();
 * if (output) {
 *   output.sendNoteOn(60, 100, 0);
 * }
 * ```
 */
export class MidiSystem implements MidiSystemInterface {
  private currentInput?: MidiInput;
  private currentOutput?: MidiOutput;
  private listeners: ListenerSpec[] = [];
  private readonly out: ProcessOutput;
  private readonly backend: MidiBackend;
  private config: MidiConfig = {};

  /**
   * Creates a new MIDI system with the specified backend.
   *
   * @param backend - MIDI backend implementation (e.g., EasyMidiBackend)
   * @param out - Optional output handler for logging (default: client output)
   *
   * @example
   * ```typescript
   * const backend = new EasyMidiBackend();
   * const customOutput = newServerOutput(true, 'MIDI');
   * const system = new MidiSystem(backend, customOutput);
   * ```
   */
  constructor(
    backend: MidiBackend,
    out: ProcessOutput = newClientOutput(false)
  ) {
    this.backend = backend;
    this.out = out;
  }

  async start(config: MidiConfig = {}): Promise<void> {
    this.config = { enableSysex: true, debug: false, ...config };

    // Auto-select first available ports if any exist
    const inputs = this.getInputs();
    const outputs = this.getOutputs();

    if (outputs.length > 0) {
      this.setOutput(outputs[0].name);
    }

    if (inputs.length > 0) {
      this.setInput(inputs[0].name);
    }

    if (this.config.debug) {
      this.out.log(`MIDI started. Inputs: ${inputs.length}, Outputs: ${outputs.length}`);
    }
  }

  async stop(): Promise<void> {
    if (this.currentInput) {
      this.currentInput.close();
      this.currentInput = undefined;
    }

    if (this.currentOutput) {
      this.currentOutput.close();
      this.currentOutput = undefined;
    }

    this.listeners = [];

    if (this.config.debug) {
      this.out.log('MIDI stopped');
    }
  }

  getInputs(): MidiPort[] {
    return this.backend.getInputs();
  }

  getOutputs(): MidiPort[] {
    return this.backend.getOutputs();
  }

  getCurrentInput(): MidiInput | undefined {
    return this.currentInput;
  }

  getCurrentOutput(): MidiOutput | undefined {
    return this.currentOutput;
  }

  setInput(input: MidiInput | string): void {
    const inputName = typeof input === 'string' ? input : input.name;

    // Remove listeners from previous input
    if (this.currentInput) {
      for (const spec of this.listeners) {
        this.currentInput.removeListener(spec.eventName, spec.eventListener);
      }
      this.currentInput.close();
    }

    // Create new input using backend
    const rawInput = this.backend.createInput(inputName);
    this.currentInput = new BackendMidiInput(inputName, rawInput);

    // Attach listeners to new input
    for (const spec of this.listeners) {
      this.currentInput.addListener(spec.eventName, spec.eventListener);
    }

    if (this.config.debug) {
      this.out.log(`Set MIDI input: ${inputName}`);
    }
  }

  setOutput(output: MidiOutput | string): void {
    const outputName = typeof output === 'string' ? output : output.name;

    if (this.currentOutput) {
      this.currentOutput.close();
    }

    // Create new output using backend
    const rawOutput = this.backend.createOutput(outputName);
    this.currentOutput = new BackendMidiOutput(outputName, rawOutput);

    if (this.config.debug) {
      this.out.log(`Set MIDI output: ${outputName}`);
    }
  }

  addListener(event: string, callback: (message: unknown) => void): void {
    this.listeners.push({ eventName: event, eventListener: callback });

    if (this.currentInput) {
      this.currentInput.addListener(event, callback);

      if (this.config.debug) {
        this.out.log(`Added MIDI listener: ${event} to ${this.currentInput.name}`);
      }
    }
  }

  removeListener(event: string, callback: (message: unknown) => void): void {
    this.listeners = this.listeners.filter(
      spec => spec.eventName !== event || spec.eventListener !== callback
    );

    if (this.currentInput) {
      this.currentInput.removeListener(event, callback);

      if (this.config.debug) {
        this.out.log(`Removed MIDI listener: ${event} from ${this.currentInput.name}`);
      }
    }
  }
}
