/**
 * Node.js MIDI backend using node-midi
 */

import { createRequire } from 'module';
import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '../MidiInterface';

// Create require function for ESM compatibility
const require = createRequire(import.meta.url);

/**
 * Node MIDI backend implementation
 */
export class NodeMidiBackend implements MidiBackendInterface {
  private midi: any;
  private inputs: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Use require for native module
      this.midi = require('midi');
      this.isInitialized = true;
    } catch (error: any) {
      console.error('Failed to load midi:', error);
      throw new Error('node-midi not available. Install with: npm install midi');
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const input = new this.midi.Input();
    const ports: MidiPortInfo[] = [];
    const count = input.getPortCount();

    for (let i = 0; i < count; i++) {
      const name = input.getPortName(i);
      ports.push({
        id: `input-${i}`,
        name
      });
    }

    input.closePort();
    return ports;
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const output = new this.midi.Output();
    const ports: MidiPortInfo[] = [];
    const count = output.getPortCount();

    for (let i = 0; i < count; i++) {
      const name = output.getPortName(i);
      ports.push({
        id: `output-${i}`,
        name
      });
    }

    output.closePort();
    return ports;
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    // console.log(`[NodeMidiBackend] Opening input port: ${portId}`);

    // Check if portId is an index or a name
    let index: number;
    const input = new this.midi.Input();

    if (portId.startsWith('input-')) {
      // It's our ID format
      index = parseInt(portId.replace('input-', ''));

      // Validate index
      const count = input.getPortCount();
      if (index < 0 || index >= count) {
        input.closePort();
        throw new Error(`Invalid input port index: ${index} (available: 0-${count-1})`);
      }
    } else {
      // Try to find port by name
      index = -1;
      const count = input.getPortCount();
      for (let i = 0; i < count; i++) {
        if (input.getPortName(i).includes(portId)) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        input.closePort();
        throw new Error(`Input port not found: ${portId}`);
      }
    }

    // Get port name BEFORE opening (node-midi limitation)
    const portName = input.getPortName(index);

    const port: MidiInputPort = {
      id: portId,
      name: portName || `Input ${index}`,
      type: 'input',
      close: async () => {
        input.closePort();
        this.inputs.delete(portId);
      },
      onMessage: undefined
    };

    // CRITICAL FIX: Enable SysEx message reception
    // By default, node-midi ignores SysEx messages
    input.ignoreTypes(false, false, false); // Don't ignore SysEx, timing, active sensing

    // Set up message handler
    input.on('message', (deltaTime: number, message: number[]) => {
      if (port.onMessage) {
        port.onMessage({
          timestamp: Date.now(),
          data: message
        });
      }
    });

    // Open the port
    // console.log(`[NodeMidiBackend] Opening input port at index ${index}`);
    input.openPort(index);
    // console.log(`[NodeMidiBackend] Input port opened successfully`);
    this.inputs.set(portId, input);

    return port;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    // console.log(`[NodeMidiBackend] Opening output port: ${portId}`);

    // Check if portId is an index or a name
    let index: number;
    const output = new this.midi.Output();

    if (portId.startsWith('output-')) {
      // It's our ID format
      index = parseInt(portId.replace('output-', ''));

      // Validate index
      const count = output.getPortCount();
      if (index < 0 || index >= count) {
        output.closePort();
        throw new Error(`Invalid output port index: ${index} (available: 0-${count-1})`);
      }
    } else {
      // Try to find port by name
      index = -1;
      const count = output.getPortCount();
      for (let i = 0; i < count; i++) {
        if (output.getPortName(i).includes(portId)) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        output.closePort();
        throw new Error(`Output port not found: ${portId}`);
      }
    }

    // Get port name BEFORE opening (node-midi limitation)
    // console.log(`[NodeMidiBackend] Getting port name at index ${index}`);
    const portName = output.getPortName(index);
    // console.log(`[NodeMidiBackend] Port name: ${portName}`);

    // Open the port
    // console.log(`[NodeMidiBackend] Opening port at index ${index}`);
    output.openPort(index);
    // console.log(`[NodeMidiBackend] Port opened successfully`);
    this.outputs.set(portId, output);

    const port: MidiOutputPort = {
      id: portId,
      name: portName || `Output ${index}`,
      type: 'output',
      close: async () => {
        output.closePort();
        this.outputs.delete(portId);
      }
    };

    return port;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    // console.log(`[NodeMidiBackend] sendMessage called with port.id: ${port.id}`);
    const output = this.outputs.get(port.id);
    if (!output) {
      throw new Error('Output port not open');
    }

    // Convert to array if needed
    // console.log(`[NodeMidiBackend] Message data:`, message.data);
    const data = Array.isArray(message.data) ? message.data : Array.from(message.data);
    // console.log(`[NodeMidiBackend] Sending message:`, data);

    try {
      output.sendMessage(data);
      // console.log(`[NodeMidiBackend] Message sent successfully`);
    } catch (error) {
      console.error(`[NodeMidiBackend] Error sending message:`, error);
      throw error;
    }
  }

  async closePort(port: MidiPort): Promise<void> {
    await port.close();
  }

  async cleanup(): Promise<void> {
    // Close all open ports
    for (const [id, input] of this.inputs.entries()) {
      input.closePort();
    }
    this.inputs.clear();

    for (const [id, output] of this.outputs.entries()) {
      output.closePort();
    }
    this.outputs.clear();

    this.isInitialized = false;
  }
}