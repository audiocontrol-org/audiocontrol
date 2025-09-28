import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage,
} from '@/core/MidiInterface.js';
import type { Logger } from '@/core/Logger.js';
import { ConsoleLogger } from '@/core/Logger.js';

import { ControlChange, getInputs, getOutputs, Input, Note, Output, Sysex } from 'easymidi';

export class EasyMidiBackend implements MidiBackendInterface {
  private inputs: Map<string, Input> = new Map();
  private outputs: Map<string, Output> = new Map();
  private portWrappers: Map<string, MidiPort> = new Map();
  private isInitialized = false;
  private readonly logger: Logger;

  constructor(logger: Logger = new ConsoleLogger({ prefix: 'EasyMidiBackend' })) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing!`)
    this.isInitialized = true;
    return Promise.resolve();
  }

  getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const inputs = getInputs();
      return Promise.resolve(inputs.map((name: string) => ({
        id: name,
        name: name,
      })));
    } catch (error) {
      return Promise.reject(new Error(`Failed to get input ports: ${(error as Error).message}`));
    }
  }

  getOutputPorts(): Promise<MidiPortInfo[]> {

    try {
      const outputs = getOutputs();
      return Promise.resolve(outputs.map((name: string) => ({
        id: name,
        name: name,
      })));
    } catch (error) {
      return Promise.reject(new Error(`Failed to get output ports: ${(error as Error).message}`));
    }
  }

  openInput(portId: string): Promise<MidiInputPort> {
    try {
      const easyInput = new Input(portId);

      const port: MidiInputPort = {
        id: portId,
        name: portId,
        type: 'input',
        close: () => {
          if (easyInput && easyInput.close) {
            easyInput.close();
          }
          this.inputs.delete(portId);
          this.portWrappers.delete(portId);
          return Promise.resolve();
        },
        onMessage: undefined,
      };

      easyInput.on('sysex', (sysex: Sysex) => {
        this.logger.debug(
          'Received SysEx:',
          sysex.bytes.map((b) => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        );
        if (port.onMessage) {
          port.onMessage({
            timestamp: Date.now(),
            data: sysex.bytes,
          });
        }
      });

      easyInput.on('cc', (msg: ControlChange) => {
        this.logger.debug('Received CC:', msg);
        if (port.onMessage) {
          const data = [0xb0 | (msg.channel & 0x0f), msg.controller, msg.value];
          port.onMessage({
            timestamp: Date.now(),
            data,
          });
        }
      });

      easyInput.on('noteon', (msg: Note) => {
        if (port.onMessage) {
          const data = [0x90 | (msg.channel & 0x0f), msg.note, msg.velocity];
          port.onMessage({
            timestamp: Date.now(),
            data,
          });
        }
      });

      easyInput.on('noteoff', (msg: Note) => {
        if (port.onMessage) {
          const data = [0x80 | (msg.channel & 0x0f), msg.note, msg.velocity];
          port.onMessage({
            timestamp: Date.now(),
            data,
          });
        }
      });

      this.inputs.set(portId, easyInput);
      this.portWrappers.set(portId, port);
      return Promise.resolve(port);
    } catch (error) {
      return Promise.reject(new Error(`Failed to open input port ${portId}: ${(error as Error).message}`));
    }
  }

  openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    try {
      const easyOutput = new Output(portId);

      const port: MidiOutputPort = {
        id: portId,
        name: portId,
        type: 'output',
        close: () => {
          if (easyOutput && easyOutput.close) {
            easyOutput.close();
          }
          this.outputs.delete(portId);
          this.portWrappers.delete(portId);
          return Promise.resolve();
        },
      };

      this.outputs.set(portId, easyOutput);
      this.portWrappers.set(portId, port);
      return Promise.resolve(port);
    } catch (error) {
      return Promise.reject(new Error(`Failed to open output port ${portId}: ${(error as Error).message}`));
    }
  }

  sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const easyOutput = this.outputs.get(port.id);
    if (!easyOutput) {
      throw new Error(`Output port not open: ${port.id}`);
    }

    try {
      const data: Array<number> = Array.from(message.data);

      if (data[0] === 0xf0 && data[data.length - 1] === 0xf7) {
        this.logger.debug(
          'Sending SysEx:',
          data.map((b) => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        );
        easyOutput.send('sysex', data);
        return Promise.resolve();
      } else {
        return Promise.reject(new Error('Only SysEx messages are currently supported by EasyMidiBackend'));
      }
    } catch (error) {
      return Promise.reject(new Error(`Failed to send message to port ${port.id}: ${(error as Error).message}`));
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
