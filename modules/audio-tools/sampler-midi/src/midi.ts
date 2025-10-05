/**
 * MIDI communication abstraction
 *
 * This module provides a unified interface for MIDI I/O operations,
 * supporting both input and output port management with listener registration.
 *
 * Architecture: Interface-first design with dependency injection.
 * The MidiSystem class requires a MidiBackend to be explicitly injected.
 */

import { ProcessOutput, newClientOutput } from "@oletizi/sampler-lib";
import { MidiBackend, RawMidiInput, RawMidiOutput } from "@/backend.js";

export interface MidiPort {
  readonly name: string;
  readonly manufacturer?: string;
}

export interface MidiInput extends MidiPort {
  addListener(event: string, callback: (message: unknown) => void): void;
  removeListener(event: string, callback: (message: unknown) => void): void;
  close(): void;
}

export interface MidiOutput extends MidiPort {
  send(eventType: string, message: unknown): void;
  sendSysex(data: number[]): void;
  sendNoteOn(note: number, velocity: number, channel: number): void;
  sendNoteOff(note: number, velocity: number, channel: number): void;
  close(): void;
}

export interface MidiConfig {
  enableSysex?: boolean;
  debug?: boolean;
}

export interface MidiSystemInterface {
  start(config?: MidiConfig): Promise<void>;
  stop(): Promise<void>;

  getInputs(): MidiPort[];
  getOutputs(): MidiPort[];

  getCurrentInput(): MidiInput | undefined;
  getCurrentOutput(): MidiOutput | undefined;

  setInput(input: MidiInput | string): void;
  setOutput(output: MidiOutput | string): void;

  addListener(event: string, callback: (message: unknown) => void): void;
  removeListener(event: string, callback: (message: unknown) => void): void;
}

interface ListenerSpec {
  eventName: string;
  eventListener: (message: unknown) => void;
}

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
 * MIDI system with dependency injection
 *
 * This class requires explicit injection of a MidiBackend implementation.
 * No default backend is provided - users must choose their backend explicitly.
 *
 * @example
 * ```typescript
 * import { MidiSystem } from '@oletizi/sampler-midi';
 * import { EasyMidiBackend } from '@oletizi/sampler-midi';
 *
 * const backend = new EasyMidiBackend();
 * const system = new MidiSystem(backend);
 * await system.start();
 * ```
 */
export class MidiSystem implements MidiSystemInterface {
  private currentInput?: MidiInput;
  private currentOutput?: MidiOutput;
  private listeners: ListenerSpec[] = [];
  private readonly out: ProcessOutput;
  private readonly backend: MidiBackend;
  private config: MidiConfig = {};

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
