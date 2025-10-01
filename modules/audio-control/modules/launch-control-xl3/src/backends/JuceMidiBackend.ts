/**
 * JUCE MIDI Backend - Proxies MIDI through external JUCE server
 *
 * This backend communicates with a JUCE-based MIDI server to handle
 * all MIDI operations, avoiding the limitations of Node.js MIDI libraries.
 */

import { MidiBackendInterface, MidiPortInfo, MidiInputPort, MidiOutputPort, MidiMessage, MidiPort } from '../core/MidiInterface.js';
import { EventEmitter } from 'events';

interface JuceServerConfig {
  host: string;
  port: number;
}

class JuceMidiInputPort implements MidiInputPort {
  readonly type = 'input' as const;
  onMessage?: ((message: MidiMessage) => void) | undefined;

  constructor(
    readonly id: string,
    readonly name: string,
    private backend: JuceMidiBackend
  ) {}

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }
}

class JuceMidiOutputPort implements MidiOutputPort {
  readonly type = 'output' as const;

  constructor(
    readonly id: string,
    readonly name: string,
    private backend: JuceMidiBackend
  ) {}

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }
}

export class JuceMidiBackend extends EventEmitter implements MidiBackendInterface {
  private config: JuceServerConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private openPorts: Map<string, MidiPort> = new Map(); // portId -> MidiPort

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

  async getInputPorts(): Promise<MidiPortInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ports`);
      const data = await response.json();
      return data.inputs.map((name: string) => ({
        id: name,
        name
      }));
    } catch (error: any) {
      console.error('Failed to get MIDI inputs:', error);
      return [];
    }
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ports`);
      const data = await response.json();
      return data.outputs.map((name: string) => ({
        id: name,
        name
      }));
    } catch (error: any) {
      console.error('Failed to get MIDI outputs:', error);
      return [];
    }
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portId,
          type: 'input'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open input port: ${portId}`);
      }

      const port = new JuceMidiInputPort(portId, portId, this);
      this.openPorts.set(portId, port);

      // Start polling for messages
      this.startPolling();

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open MIDI input ${portId}: ${error.message}`);
    }
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    try {
      const response = await fetch(`${this.baseUrl}/port/${portId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: portId,
          type: 'output'
        })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(`Failed to open output port: ${portId}`);
      }

      const port = new JuceMidiOutputPort(portId, portId, this);
      this.openPorts.set(portId, port);

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open MIDI output ${portId}: ${error.message}`);
    }
  }



  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/port/${port.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: Array.from(message.data)
        })
      });
    } catch (error: any) {
      throw new Error(`Failed to send MIDI message: ${error.message}`);
    }
  }

  async closePort(port: MidiPort): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/port/${port.id}`, { method: 'DELETE' });
      this.openPorts.delete(port.id);
    } catch (error: any) {
      throw new Error(`Failed to close port ${port.id}: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    this.stopPolling();

    // Close all open ports
    for (const port of Array.from(this.openPorts.values())) {
      try {
        await this.closePort(port);
      } catch (error) {
        console.error(`Error closing port ${port.id}:`, error);
      }
    }

    this.openPorts.clear();
    this.removeAllListeners();
  }


  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      // Poll all open input ports
      for (const [portId, port] of Array.from(this.openPorts.entries())) {
        if (port.type === 'input') {
          try {
            const response = await fetch(`${this.baseUrl}/port/${portId}/messages?timeout=0`);
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
              for (const messageData of data.messages) {
                const message = {
                  data: new Uint8Array(messageData),
                  timestamp: Date.now()
                };
                // Call the onMessage callback if set
                const inputPort = port as JuceMidiInputPort;
                if (inputPort.onMessage) {
                  inputPort.onMessage(message);
                }
                // Emit for backend-level listeners
                this.emit('message', port, message);
              }
            }
          } catch (error) {
            console.error(`Error polling MIDI input ${portId}:`, error);
          }
        }
      }

      // Poll DAW input if open
      if (this.openPorts.has('daw_in')) {
        try {
          const response = await fetch(`${this.baseUrl}/port/daw_in/messages?timeout=0`);
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            for (const messageData of data.messages) {
              const message = {
                data: new Uint8Array(messageData),
                timestamp: Date.now()
              };
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
    for (const [portId, _] of Array.from(this.openPorts.entries())) {
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