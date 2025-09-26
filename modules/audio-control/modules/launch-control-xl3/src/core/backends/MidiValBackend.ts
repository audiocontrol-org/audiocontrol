/**
 * MidiVal MIDI backend - modern cross-platform MIDI library
 */

import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '../MidiInterface';

/**
 * MidiVal backend implementation
 */
export class MidiValBackend implements MidiBackendInterface {
  private MidiVal: any;
  private inputs: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import for MidiVal
      const module = await import('@midival/core');
      this.MidiVal = module.MIDIVal;
      this.isInitialized = true;
    } catch (error) {
      throw new Error('MidiVal not available. Install with: npm install @midival/core');
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const access = await this.MidiVal.connect();
    const ports: MidiPortInfo[] = [];

    for (const input of access.inputs.values()) {
      ports.push({
        id: input.id,
        name: input.name || 'Unknown',
        manufacturer: input.manufacturer
      });
    }

    return ports;
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const access = await this.MidiVal.connect();
    const ports: MidiPortInfo[] = [];

    for (const output of access.outputs.values()) {
      ports.push({
        id: output.id,
        name: output.name || 'Unknown',
        manufacturer: output.manufacturer
      });
    }

    return ports;
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const access = await this.MidiVal.connect();
    const input = access.inputs.get(portId);

    if (!input) {
      // Try to find by name
      for (const inp of access.inputs.values()) {
        if (inp.name === portId) {
          return this.openInput(inp.id);
        }
      }
      throw new Error(`Input port not found: ${portId}`);
    }

    const port: MidiInputPort = {
      id: portId,
      name: input.name || 'Unknown',
      type: 'input',
      close: async () => {
        input.onmidimessage = null;
        this.inputs.delete(portId);
      },
      onMessage: undefined
    };

    // Set up message handler
    input.onmidimessage = (event: any) => {
      if (port.onMessage) {
        port.onMessage({
          timestamp: event.timeStamp || Date.now(),
          data: Array.from(event.data)
        });
      }
    };

    this.inputs.set(portId, input);
    return port;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const access = await this.MidiVal.connect();
    const output = access.outputs.get(portId);

    if (!output) {
      // Try to find by name
      for (const out of access.outputs.values()) {
        if (out.name === portId) {
          return this.openOutput(out.id);
        }
      }
      throw new Error(`Output port not found: ${portId}`);
    }

    this.outputs.set(portId, output);

    const port: MidiOutputPort = {
      id: portId,
      name: output.name || 'Unknown',
      type: 'output',
      close: async () => {
        this.outputs.delete(portId);
      }
    };

    return port;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const output = this.outputs.get(port.id);
    if (!output) {
      throw new Error('Output port not open');
    }

    output.send(message.data);
  }

  async closePort(port: MidiPort): Promise<void> {
    await port.close();
  }

  async cleanup(): Promise<void> {
    // Close all open ports
    for (const [id, input] of this.inputs.entries()) {
      input.onmidimessage = null;
    }
    this.inputs.clear();
    this.outputs.clear();
    this.isInitialized = false;
  }
}