import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '../MidiInterface.js';

export class EasyMidiBackend implements MidiBackendInterface {
  private easymidi: any;
  private inputs: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private portWrappers: Map<string, MidiPort> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const module = await import('easymidi');
      this.easymidi = module.default || module;
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`easymidi not available: ${(error as Error).message}. Install with: npm install easymidi`);
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const inputs = this.easymidi.getInputs();
      return inputs.map((name: string) => ({
        id: name,
        name: name
      }));
    } catch (error) {
      throw new Error(`Failed to get input ports: ${(error as Error).message}`);
    }
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const outputs = this.easymidi.getOutputs();
      return outputs.map((name: string) => ({
        id: name,
        name: name
      }));
    } catch (error) {
      throw new Error(`Failed to get output ports: ${(error as Error).message}`);
    }
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const easyInput = new this.easymidi.Input(portId);

      const port: MidiInputPort = {
        id: portId,
        name: portId,
        type: 'input',
        close: async () => {
          if (easyInput && easyInput.close) {
            easyInput.close();
          }
          this.inputs.delete(portId);
          this.portWrappers.delete(portId);
        },
        onMessage: undefined
      };

      easyInput.on('sysex', (bytes: number[]) => {
        console.log('[EasyMidiBackend] Received SysEx:', bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        if (port.onMessage) {
          port.onMessage({
            timestamp: Date.now(),
            data: bytes
          });
        }
      });

      easyInput.on('cc', (msg: any) => {
        console.log('[EasyMidiBackend] Received CC:', msg);
        if (port.onMessage) {
          const data = [0xB0 | (msg.channel & 0x0F), msg.controller, msg.value];
          port.onMessage({
            timestamp: Date.now(),
            data
          });
        }
      });

      easyInput.on('noteon', (msg: any) => {
        if (port.onMessage) {
          const data = [0x90 | (msg.channel & 0x0F), msg.note, msg.velocity];
          port.onMessage({
            timestamp: Date.now(),
            data
          });
        }
      });

      easyInput.on('noteoff', (msg: any) => {
        if (port.onMessage) {
          const data = [0x80 | (msg.channel & 0x0F), msg.note, msg.velocity];
          port.onMessage({
            timestamp: Date.now(),
            data
          });
        }
      });

      this.inputs.set(portId, easyInput);
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
      const easyOutput = new this.easymidi.Output(portId);

      const port: MidiOutputPort = {
        id: portId,
        name: portId,
        type: 'output',
        close: async () => {
          if (easyOutput && easyOutput.close) {
            easyOutput.close();
          }
          this.outputs.delete(portId);
          this.portWrappers.delete(portId);
        }
      };

      this.outputs.set(portId, easyOutput);
      this.portWrappers.set(portId, port);
      return port;
    } catch (error) {
      throw new Error(`Failed to open output port ${portId}: ${(error as Error).message}`);
    }
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const easyOutput = this.outputs.get(port.id);
    if (!easyOutput) {
      throw new Error(`Output port not open: ${port.id}`);
    }

    try {
      const data = Array.isArray(message.data) ? message.data : Array.from(message.data);

      if (data[0] === 0xF0 && data[data.length - 1] === 0xF7) {
        console.log('[EasyMidiBackend] Sending SysEx:', data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        easyOutput.send('sysex', data);
      } else {
        throw new Error('Only SysEx messages are currently supported by EasyMidiBackend');
      }
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

  static async isAvailable(): Promise<boolean> {
    try {
      const module = await import('easymidi');
      return !!(module.default || module);
    } catch {
      return false;
    }
  }
}