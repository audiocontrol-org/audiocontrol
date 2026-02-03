/**
 * Mock MIDI backend for testing - Deterministic implementation
 */

import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '@/core/MidiInterface.js';

/**
 * Mock MIDI backend implementation for testing
 * This implementation is designed to be completely deterministic for reliable unit testing.
 */
export class MockMidiBackend implements MidiBackendInterface {
  private inputPorts: Map<string, MidiInputPort> = new Map();
  private outputPorts: Map<string, MidiOutputPort> = new Map();
  private isInitialized = false;

  // For testing: store sent messages
  public sentMessages: MidiMessage[] = [];

  // For testing: simulate incoming messages
  public simulateIncomingMessage?: (message: MidiMessage) => void;

  // Handshake configuration options
  public shouldRespondToInquiry = true;
  public shouldRespondToSyn = true;
  public invalidSynAck = false;
  public corruptManufacturerId = false;

  // Deterministic response queue instead of async operations
  private queuedResponses: Array<() => void> = [];

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

    const data = Array.isArray(message.data) ? message.data : Array.from(message.data);

    // Handle Novation SYN message for handshake testing
    if (this.isNovationSyn(data)) {
      if (this.shouldRespondToSyn) {
        this.queuedResponses.push(() => {
          this.simulateNovationSynAck();
        });
      }
      return;
    }

    // Handle Universal Device Inquiry for handshake testing
    if (this.shouldRespondToInquiry && this.isDeviceInquiry(data)) {
      this.queuedResponses.push(() => {
        this.simulateDeviceResponse();
      });
      return;
    }

    // For legacy tests: echo SysEx inquiry responses
    if (message.data[0] === 0xF0 && message.data[1] === 0x7E) {
      // Device inquiry - send mock response after queuing
      this.queuedResponses.push(() => {
        this.simulateLegacyDeviceInquiryResponse();
      });
    }
  }

  /**
   * Process all queued responses synchronously.
   * This replaces asynchronous operations for deterministic testing.
   */
  processQueuedResponses(): void {
    while (this.queuedResponses.length > 0) {
      const response = this.queuedResponses.shift();
      if (response) {
        response();
      }
    }
  }

  private isNovationSyn(data: number[]): boolean {
    const synPattern = [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7];
    return this.arraysEqual(data, synPattern);
  }

  private isDeviceInquiry(data: number[]): boolean {
    // Accept both legacy (0x00) and new (0x7F) device IDs
    const legacyInquiryPattern = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
    const newInquiryPattern = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
    return this.arraysEqual(data, legacyInquiryPattern) || this.arraysEqual(data, newInquiryPattern);
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  simulateNovationSynAck(): void {
    if (!this.simulateIncomingMessage) {
      return;
    }

    const serialNumber = 'LX21234567890123'; // 14 character serial
    let response: number[] = [
      0xF0, 0x00, 0x20, 0x29,  // Start + Novation manufacturer ID
      0x00, 0x42, 0x02,        // Device model + command + sub-command
      ...Array.from(serialNumber).map(c => c.charCodeAt(0)), // Serial number
      0xF7                     // End
    ];

    // Corrupt message if requested
    if (this.invalidSynAck) {
      response[6] = 0xFF; // Corrupt sub-command byte
    }

    if (this.corruptManufacturerId) {
      response[1] = 0xFF; // Corrupt manufacturer ID
    }

    this.simulateIncomingMessage({
      timestamp: 1704067200000, // Use fixed timestamp for deterministic testing
      data: response,
      type: 'sysex',
    });
  }

  simulateDeviceResponse(): void {
    if (!this.simulateIncomingMessage) {
      return;
    }

    const response: number[] = [
      0xF0, 0x7E, 0x00, 0x06, 0x02,
      0x00, 0x20, 0x29,
      0x48, 0x01,
      0x00, 0x00,
      0x01, 0x00, 0x0A, 0x54,
      0xF7
    ];

    this.simulateIncomingMessage({
      timestamp: 1704067200000, // Use fixed timestamp for deterministic testing
      data: response,
      type: 'sysex',
    });
  }

  simulateDeviceInquiryResponse(): void {
    this.simulateDeviceResponse(); // Same as device response
  }

  /**
   * Legacy device inquiry response for backward compatibility
   */
  private simulateLegacyDeviceInquiryResponse(): void {
    if (!this.simulateIncomingMessage) {
      return;
    }

    this.simulateIncomingMessage({
      timestamp: 1704067200000, // Use fixed timestamp for deterministic testing
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
    this.queuedResponses = [];
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
        timestamp: 1704067200000, // Use fixed timestamp for deterministic testing
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
        timestamp: 1704067200000, // Use fixed timestamp for deterministic testing
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

  /**
   * Reset all test state for clean test isolation
   */
  resetTestState(): void {
    this.clearSentMessages();
    this.queuedResponses = [];
    this.shouldRespondToInquiry = true;
    this.shouldRespondToSyn = true;
    this.invalidSynAck = false;
    this.corruptManufacturerId = false;
  }
}