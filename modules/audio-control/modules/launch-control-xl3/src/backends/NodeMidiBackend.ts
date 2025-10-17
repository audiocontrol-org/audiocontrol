/**
 * Node.js MIDI Backend - Uses node-midi package for MIDI communication
 *
 * This backend provides MIDI access in Node.js environments using the
 * native node-midi bindings.
 */

import { MidiBackendInterface, MidiPortInfo, MidiInputPort, MidiOutputPort, MidiMessage, MidiPort } from '../core/MidiInterface.js';
import { EventEmitter } from 'events';
import midi from 'midi';

class NodeMidiInputPort implements MidiInputPort {
  readonly type = 'input' as const;
  onMessage?: ((message: MidiMessage) => void) | undefined;

  constructor(
    readonly id: string,
    readonly name: string,
    private backend: NodeMidiBackend,
    private nativeInput: midi.Input
  ) {
    // Set up message handler
    this.nativeInput.on('message', (_deltaTime: number, message: number[]) => {
      const midiMessage: MidiMessage = {
        data: message as readonly number[],
        timestamp: Date.now()
      };

      if (this.onMessage) {
        this.onMessage(midiMessage);
      }

      // Emit for backend-level listeners
      this.backend.emit('message', this, midiMessage);
    });
  }

  async close(): Promise<void> {
    this.nativeInput.closePort();
  }
}

class NodeMidiOutputPort implements MidiOutputPort {
  readonly type = 'output' as const;

  constructor(
    readonly id: string,
    readonly name: string,
    private nativeOutput: midi.Output
  ) {}

  async close(): Promise<void> {
    this.nativeOutput.closePort();
  }
}

export class NodeMidiBackend extends EventEmitter implements MidiBackendInterface {
  private inputs: Map<string, NodeMidiInputPort> = new Map();
  private outputs: Map<string, NodeMidiOutputPort> = new Map();

  async initialize(): Promise<void> {
    // Node-midi doesn't require initialization
    // Just verify we can enumerate ports
    const testInput = new midi.Input();
    const testOutput = new midi.Output();

    try {
      testInput.getPortCount();
      testOutput.getPortCount();
    } finally {
      // Close test instances
      if (testInput) {
        try { testInput.closePort(); } catch {}
      }
      if (testOutput) {
        try { testOutput.closePort(); } catch {}
      }
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    const input = new midi.Input();
    const ports: MidiPortInfo[] = [];

    try {
      const count = input.getPortCount();
      for (let i = 0; i < count; i++) {
        const name = input.getPortName(i);
        ports.push({
          id: name,
          name: name
        });
      }
    } finally {
      try { input.closePort(); } catch {}
    }

    return ports;
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    const output = new midi.Output();
    const ports: MidiPortInfo[] = [];

    try {
      const count = output.getPortCount();
      for (let i = 0; i < count; i++) {
        const name = output.getPortName(i);
        ports.push({
          id: name,
          name: name
        });
      }
    } finally {
      try { output.closePort(); } catch {}
    }

    return ports;
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    // Check if already open
    if (this.inputs.has(portId)) {
      return this.inputs.get(portId)!;
    }

    const input = new midi.Input();

    // CRITICAL: Enable SysEx messages (disabled by default in node-midi)
    input.ignoreTypes(false, false, false);

    // Find port by name
    const count = input.getPortCount();
    let portIndex = -1;

    for (let i = 0; i < count; i++) {
      if (input.getPortName(i) === portId) {
        portIndex = i;
        break;
      }
    }

    if (portIndex === -1) {
      throw new Error(`MIDI input port not found: ${portId}`);
    }

    input.openPort(portIndex);

    const port = new NodeMidiInputPort(portId, portId, this, input);
    this.inputs.set(portId, port);

    return port;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    // Check if already open
    if (this.outputs.has(portId)) {
      return this.outputs.get(portId)!;
    }

    const output = new midi.Output();

    // Find port by name
    const count = output.getPortCount();
    let portIndex = -1;

    for (let i = 0; i < count; i++) {
      if (output.getPortName(i) === portId) {
        portIndex = i;
        break;
      }
    }

    if (portIndex === -1) {
      throw new Error(`MIDI output port not found: ${portId}`);
    }

    output.openPort(portIndex);

    const port = new NodeMidiOutputPort(portId, portId, output);
    this.outputs.set(portId, port);

    return port;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const outputPort = this.outputs.get(port.id);
    if (!outputPort) {
      throw new Error(`Output port not open: ${port.id}`);
    }

    const nativePort = (outputPort as any).nativeOutput as midi.Output;
    // Type assertion needed: node-midi accepts variable-length arrays for SysEx,
    // but TypeScript definitions are overly restrictive (require exactly 3 elements)
    nativePort.sendMessage(Array.from(message.data) as any);
  }

  async closePort(port: MidiPort): Promise<void> {
    if (port.type === 'input') {
      const inputPort = this.inputs.get(port.id);
      if (inputPort) {
        await inputPort.close();
        this.inputs.delete(port.id);
      }
    } else {
      const outputPort = this.outputs.get(port.id);
      if (outputPort) {
        await outputPort.close();
        this.outputs.delete(port.id);
      }
    }
  }

  async cleanup(): Promise<void> {
    // Close all ports
    for (const port of this.inputs.values()) {
      try {
        await port.close();
      } catch (error) {
        console.error(`Error closing input port ${port.id}:`, error);
      }
    }

    for (const port of this.outputs.values()) {
      try {
        await port.close();
      } catch (error) {
        console.error(`Error closing output port ${port.id}:`, error);
      }
    }

    this.inputs.clear();
    this.outputs.clear();
    this.removeAllListeners();
  }

  async close(): Promise<void> {
    await this.cleanup();
  }

  dispose(): void {
    this.close().catch(console.error);
  }
}
