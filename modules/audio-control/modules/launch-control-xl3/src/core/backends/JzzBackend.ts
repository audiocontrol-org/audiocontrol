/**
 * JZZ MIDI backend - pure JavaScript MIDI library
 * Works in Node.js and browsers without native bindings
 */

import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '../MidiInterface.js';

/**
 * JZZ backend implementation
 */
export class JzzBackend implements MidiBackendInterface {
  private JZZ: any;
  private inputs: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private portWrappers: Map<string, MidiPort> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const module = await import('jzz');
      this.JZZ = module.default || module;

      if (typeof navigator === 'undefined') {
        try {
          const headless = await import('jazz-midi-headless') as any;
          headless.default(this.JZZ);
        } catch (err) {
          console.warn('[JzzBackend] jazz-midi-headless not available, some features may not work');
        }
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`JZZ not available: ${(error as Error).message}. Install with: npm install jzz jazz-midi-headless`);
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const info = await this.JZZ().info();
      const ports: MidiPortInfo[] = [];

      if (info.inputs) {
        for (const input of info.inputs) {
          ports.push({
            id: input.name,
            name: input.name,
            manufacturer: input.manufacturer,
            version: input.version
          });
        }
      }

      return ports;
    } catch (error) {
      throw new Error(`Failed to get input ports: ${(error as Error).message}`);
    }
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const info = await this.JZZ().info();
      const ports: MidiPortInfo[] = [];

      if (info.outputs) {
        for (const output of info.outputs) {
          ports.push({
            id: output.name,
            name: output.name,
            manufacturer: output.manufacturer,
            version: output.version
          });
        }
      }

      return ports;
    } catch (error) {
      throw new Error(`Failed to get output ports: ${(error as Error).message}`);
    }
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const jzzPort = await this.JZZ().openMidiIn(portId);

      const port: MidiInputPort = {
        id: portId,
        name: portId,
        type: 'input',
        close: async () => {
          if (jzzPort && jzzPort.close) {
            jzzPort.close();
          }
          this.inputs.delete(portId);
          this.portWrappers.delete(portId);
        },
        onMessage: undefined
      };

      jzzPort.connect((msg: any) => {
        if (port.onMessage) {
          const data = Array.isArray(msg) ? msg : [];
          console.log('[JzzBackend] Received message:', data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
          port.onMessage({
            timestamp: Date.now(),
            data
          });
        }
      });

      this.inputs.set(portId, jzzPort);
      this.portWrappers.set(portId, port);
      return port;
    } catch (error) {
      throw new Error(`Failed to open input port ${portId}: ${(error as Error).message}`);
    }
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const jzzPort = await this.JZZ().openMidiOut(portId);

      const port: MidiOutputPort = {
        id: portId,
        name: portId,
        type: 'output',
        close: async () => {
          if (jzzPort && jzzPort.close) {
            jzzPort.close();
          }
          this.outputs.delete(portId);
          this.portWrappers.delete(portId);
        }
      };

      this.outputs.set(portId, jzzPort);
      this.portWrappers.set(portId, port);
      return port;
    } catch (error) {
      throw new Error(`Failed to open output port ${portId}: ${(error as Error).message}`);
    }
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const jzzPort = this.outputs.get(port.id);
    if (!jzzPort) {
      throw new Error(`Output port not open: ${port.id}`);
    }

    try {
      const data = Array.isArray(message.data) ? message.data : Array.from(message.data);
      console.log('[JzzBackend] Sending message:', data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      jzzPort.send(data);
    } catch (error) {
      throw new Error(`Failed to send message to port ${port.id}: ${(error as Error).message}`);
    }
  }

  async closePort(port: MidiPort): Promise<void> {
    await port.close();
  }

  async cleanup(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [_id, wrapper] of this.portWrappers.entries()) {
      closePromises.push(wrapper.close());
    }

    await Promise.all(closePromises);

    this.inputs.clear();
    this.outputs.clear();
    this.portWrappers.clear();
    this.isInitialized = false;
  }

  /**
   * Check if JZZ is available in the current environment
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const module = await import('jzz');
      return !!(module.default || module);
    } catch {
      return false;
    }
  }
}