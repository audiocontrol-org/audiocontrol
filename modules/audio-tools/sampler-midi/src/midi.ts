/**
 * MIDI communication abstraction
 *
 * This module provides a unified interface for MIDI I/O operations,
 * supporting both input and output port management with listener registration.
 */

import { ProcessOutput, newClientOutput } from "@oletizi/sampler-lib";
import * as easymidi from "easymidi";

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

export interface MidiSystem {
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

class EasyMidiInput implements MidiInput {
  readonly name: string;
  readonly manufacturer?: string;
  private port: easymidi.Input;

  constructor(name: string) {
    this.name = name;
    this.port = new easymidi.Input(name);
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

class EasyMidiOutput implements MidiOutput {
  readonly name: string;
  readonly manufacturer?: string;
  private port: easymidi.Output;

  constructor(name: string) {
    this.name = name;
    this.port = new easymidi.Output(name);
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

class BasicMidiSystem implements MidiSystem {
  private currentInput?: MidiInput;
  private currentOutput?: MidiOutput;
  private listeners: ListenerSpec[] = [];
  private readonly out: ProcessOutput;
  private config: MidiConfig = {};

  constructor(out: ProcessOutput = newClientOutput(false)) {
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
    return easymidi.getInputs().map(name => ({ name }));
  }

  getOutputs(): MidiPort[] {
    return easymidi.getOutputs().map(name => ({ name }));
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

    // Create new input
    this.currentInput = new EasyMidiInput(inputName);

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

    this.currentOutput = new EasyMidiOutput(outputName);

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

/**
 * Factory function to create a MIDI system instance
 */
export function createMidiSystem(out?: ProcessOutput): MidiSystem {
  return new BasicMidiSystem(out);
}

/**
 * Legacy compatibility: Midi class
 * @deprecated Use createMidiSystem() instead
 */
export class Midi implements MidiSystem {
  private system: MidiSystem;

  constructor() {
    this.system = createMidiSystem();
  }

  async start(config?: MidiConfig): Promise<void> {
    await this.system.start(config);
  }

  async stop(): Promise<void> {
    await this.system.stop();
  }

  getInputs(): MidiPort[] {
    return this.system.getInputs();
  }

  getOutputs(): MidiPort[] {
    return this.system.getOutputs();
  }

  getCurrentInput(): MidiInput | undefined {
    return this.system.getCurrentInput();
  }

  getCurrentOutput(): MidiOutput | undefined {
    return this.system.getCurrentOutput();
  }

  setInput(input: MidiInput | string): void {
    this.system.setInput(input);
  }

  setOutput(output: MidiOutput | string): void {
    this.system.setOutput(output);
  }

  addListener(event: string, callback: (message: unknown) => void): void {
    this.system.addListener(event, callback);
  }

  removeListener(event: string, callback: (message: unknown) => void): void {
    this.system.removeListener(event, callback);
  }

  // Legacy convenience methods
  setInputByName(name: string): MidiInput | undefined {
    const inputs = this.getInputs();
    const selected = inputs.find(input => input.name === name);
    if (selected) {
      this.setInput(selected.name);
    }
    return this.getCurrentInput();
  }

  setOutputByName(name: string): MidiOutput | undefined {
    const outputs = this.getOutputs();
    const selected = outputs.find(output => output.name === name);
    if (selected) {
      this.setOutput(selected.name);
    }
    return this.getCurrentOutput();
  }

  isCurrentInput(name: string): boolean {
    return this.getCurrentInput()?.name === name;
  }

  isCurrentOutput(name: string): boolean {
    return this.getCurrentOutput()?.name === name;
  }

  sendSysex(identifier: number | number[], data: number[]): Midi {
    const output = this.getCurrentOutput();
    if (!output) {
      throw new Error('No MIDI output selected');
    }

    const sysexData = Array.isArray(identifier)
      ? [...identifier, ...data]
      : [identifier, ...data];

    output.sendSysex(sysexData);
    return this;
  }

  noteOn(channels: number | number[], note: number, velocity: number): void {
    const output = this.getCurrentOutput();
    if (!output) {
      throw new Error('No MIDI output selected');
    }

    const channelArray = Array.isArray(channels) ? channels : [channels];
    for (const channel of channelArray) {
      output.sendNoteOn(note, velocity, channel);
    }
  }
}
