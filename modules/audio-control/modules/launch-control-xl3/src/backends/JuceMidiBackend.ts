/**
 * JUCE MIDI Backend - Proxies MIDI through external JUCE server
 *
 * This backend communicates with a JUCE-based MIDI server to handle
 * all MIDI operations, avoiding the limitations of Node.js MIDI libraries.
 */

import { MidiBackend, MidiPortInfo } from '../types/MidiBackend';
import { EventEmitter } from 'events';

interface JuceServerConfig {
  host: string;
  port: number;
}

export class JuceMidiBackend extends EventEmitter implements MidiBackend {
  private config: JuceServerConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private openPorts: Map<string, string> = new Map(); // portType -> portId

  constructor(config: JuceServerConfig = { host: 'localhost', port: 7777 }) {
    super();
    this.config = config;
  }

  private get baseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  async initialize(): Promise<void> {
    // Check if server is running
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      if (data.status !== 'ok') {
        throw new Error('JUCE MIDI server not healthy');
      }
    } catch (error: any) {
      throw new Error(`Failed to connect to JUCE MIDI server at ${this.baseUrl}: ${error.message}`);
    }
  }

  async getInputs(): Promise<MidiPortInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ports`);
      const data = await response.json();
      return data.inputs.map((name: string, index: number) => ({
        id: `input_${index}`,
        name
      }));
    } catch (error: any) {
      console.error('Failed to get MIDI inputs:', error);
      return [];
    }
  }

  async getOutputs(): Promise<MidiPortInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ports`);
      const data = await response.json();
      return data.outputs.map((name: string, index: number) => ({
        id: `output_${index}`,
        name
      }));
    } catch (error: any) {
      console.error('Failed to get MIDI outputs:', error);
      return [];
    }
  }

  async openInput(portName: string): Promise<void> {
    const portId = `midi_in`;
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portName,
          type: 'input'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open input port: ${portName}`);
      }

      this.openPorts.set('midi_in', portId);

      // Start polling for messages
      this.startPolling();
    } catch (error: any) {
      throw new Error(`Failed to open MIDI input ${portName}: ${error.message}`);
    }
  }

  async openOutput(portName: string): Promise<void> {
    const portId = `midi_out`;
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portName,
          type: 'output'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open output port: ${portName}`);
      }

      this.openPorts.set('midi_out', portId);
    } catch (error: any) {
      throw new Error(`Failed to open MIDI output ${portName}: ${error.message}`);
    }
  }

  async openDawInput(portName: string): Promise<void> {
    const portId = `daw_in`;
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portName,
          type: 'input'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open DAW input port: ${portName}`);
      }

      this.openPorts.set('daw_in', portId);

      // Start polling if not already
      this.startPolling();
    } catch (error: any) {
      throw new Error(`Failed to open DAW input ${portName}: ${error.message}`);
    }
  }

  async openDawOutput(portName: string): Promise<void> {
    const portId = `daw_out`;
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portName,
          type: 'output'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open DAW output port: ${portName}`);
      }

      this.openPorts.set('daw_out', portId);
    } catch (error: any) {
      throw new Error(`Failed to open DAW output ${portName}: ${error.message}`);
    }
  }

  async sendMessage(data: number[]): Promise<void> {
    const portId = this.openPorts.get('midi_out');
    if (!portId) {
      throw new Error('MIDI output port not open');
    }

    try {
      await fetch(`${this.baseUrl}/port/${portId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data
        })
      });
    } catch (error: any) {
      throw new Error(`Failed to send MIDI message: ${error.message}`);
    }
  }

  async sendDawMessage(data: number[]): Promise<void> {
    const portId = this.openPorts.get('daw_out');
    if (!portId) {
      throw new Error('DAW output port not open');
    }

    try {
      await fetch(`${this.baseUrl}/port/${portId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data
        })
      });
    } catch (error: any) {
      throw new Error(`Failed to send DAW message: ${error.message}`);
    }
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      // Poll MIDI input
      const midiInPort = this.openPorts.get('midi_in');
      if (midiInPort) {
        try {
          const response = await fetch(`${this.baseUrl}/port/${midiInPort}/messages?timeout=0`);
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            for (const message of data.messages) {
              this.emit('message', message);
            }
          }
        } catch (error) {
          console.error('Error polling MIDI input:', error);
        }
      }

      // Poll DAW input
      const dawInPort = this.openPorts.get('daw_in');
      if (dawInPort) {
        try {
          const response = await fetch(`${this.baseUrl}/port/${dawInPort}/messages?timeout=0`);
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            for (const message of data.messages) {
              this.emit('dawMessage', message);
            }
          }
        } catch (error) {
          console.error('Error polling DAW input:', error);
        }
      }
    }, 10); // Poll every 10ms for low latency
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async close(): Promise<void> {
    this.stopPolling();

    // Close all open ports
    for (const [_, portId] of this.openPorts) {
      try {
        await fetch(`${this.baseUrl}/port/${portId}`, { method: 'DELETE' });
      } catch (error) {
        console.error(`Error closing port ${portId}:`, error);
      }
    }

    this.openPorts.clear();
    this.removeAllListeners();
  }

  dispose(): void {
    this.close().catch(console.error);
  }
}