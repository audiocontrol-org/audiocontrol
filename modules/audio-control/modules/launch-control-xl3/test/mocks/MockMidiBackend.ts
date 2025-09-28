/**
 * Mock MIDI backend for testing
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
 * Mock MIDI backend implementation for testing
 */
export class MockMidiBackend implements MidiBackendInterface {
  private inputPorts: Map<string, MidiInputPort> = new Map();
  private outputPorts: Map<string, MidiOutputPort> = new Map();
  private isInitialized = false;

  // For testing: store sent messages
  public sentMessages: MidiMessage[] = [];

  // For testing: simulate incoming messages
  public simulateIncomingMessage?: (message: MidiMessage) => void;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    // Return mock Launch Control XL 3 port
    return [
      {
        id: 'mock-input-1',
        name: 'Launch Control XL MK3',
        manufacturer: 'Novation',
        version: '1.0'
      }
    ];
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    // Return mock Launch Control XL 3 port
    return [
      {
        id: 'mock-output-1',
        name: 'Launch Control XL MK3',
        manufacturer: 'Novation',
        version: '1.0'
      }
    ];
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const port: MidiInputPort = {
      id: portId,
      name: 'Launch Control XL MK3',
      type: 'input',
      close: async () => {
        this.inputPorts.delete(portId);
      },
      onMessage: undefined
    };

    this.inputPorts.set(portId, port);

    // Set up message simulation
    this.simulateIncomingMessage = (message: MidiMessage) => {
      if (port.onMessage) {
        port.onMessage(message);
      }
    };

    return port;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const port: MidiOutputPort = {
      id: portId,
      name: 'Launch Control XL MK3',
      type: 'output',
      close: async () => {
        this.outputPorts.delete(portId);
      }
    };

    this.outputPorts.set(portId, port);
    return port;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    if (!this.outputPorts.has(port.id)) {
      throw new Error('Port not open');
    }

    // Store sent message for testing
    this.sentMessages.push(message);

    // For testing: echo SysEx inquiry responses
    if (message.data[0] === 0xF0 && message.data[1] === 0x7E) {
      // Device inquiry - send mock response
      setTimeout(() => {
        if (this.simulateIncomingMessage) {
          this.simulateIncomingMessage({
            timestamp: Date.now(),
            data: [
              0xF0, // Start
              0x7E, // Universal non-realtime
              0x00, // Device ID
              0x06, // Inquiry response
              0x02, // Sub-ID
              0x00, 0x20, 0x29, // Manufacturer ID (Novation)
              0x00, 0x61, // Family code
              0x00, 0x01, // Family member
              0x01, 0x00, 0x00, 0x00, // Software revision
              0xF7, // End
            ]
          });
        }
      }, 10);
    }
  }

  async closePort(port: MidiPort): Promise<void> {
    if (port.type === 'input') {
      this.inputPorts.delete(port.id);
    } else {
      this.outputPorts.delete(port.id);
    }
  }

  async cleanup(): Promise<void> {
    this.inputPorts.clear();
    this.outputPorts.clear();
    this.sentMessages = [];
    delete this.simulateIncomingMessage;
    this.isInitialized = false;
  }

  // Test helper methods

  /**
   * Simulate a control change message for testing
   */
  simulateControlChange(channel: number, cc: number, value: number): void {
    if (this.simulateIncomingMessage) {
      this.simulateIncomingMessage({
        timestamp: Date.now(),
        data: [0xB0 | (channel & 0x0F), cc, value]
      });
    }
  }

  /**
   * Simulate a note message for testing
   */
  simulateNote(channel: number, note: number, velocity: number, on = true): void {
    if (this.simulateIncomingMessage) {
      const status = on ? (0x90 | (channel & 0x0F)) : (0x80 | (channel & 0x0F));
      this.simulateIncomingMessage({
        timestamp: Date.now(),
        data: [status, note, velocity]
      });
    }
  }

  /**
   * Get the last sent message
   */
  getLastSentMessage(): MidiMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Clear sent messages
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }
}