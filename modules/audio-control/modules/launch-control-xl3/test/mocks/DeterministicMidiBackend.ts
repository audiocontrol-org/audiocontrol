/**
 * Deterministic MIDI Backend for Testing
 *
 * A completely deterministic MIDI backend that eliminates all sources of
 * non-determinism including async timing, microtasks, and real time dependencies.
 *
 * Unlike MockMidiBackend, this implementation:
 * - Uses a response queue for controlled message flow
 * - No queueMicrotask or setTimeout usage
 * - Completely synchronous or explicitly controlled async operations
 * - Provides helper methods for common test scenarios
 *
 * @example
 * ```typescript
 * describe('MIDI tests', () => {
 *   let backend: DeterministicMidiBackend;
 *   let clock: SyntheticClock;
 *
 *   beforeEach(() => {
 *     clock = new SyntheticClock();
 *     backend = new DeterministicMidiBackend(clock.createTimestampFunction());
 *   });
 *
 *   it('should handle device inquiry', async () => {
 *     // Queue the expected response
 *     backend.queueDeviceInquiryResponse();
 *
 *     const port = await backend.openOutput('test-port');
 *     await backend.sendMessage(port, { timestamp: clock.now(), data: [0xF0, 0x7E, ...] });
 *
 *     // Process the queued response
 *     backend.processNextResponse();
 *
 *     expect(backend.getReceivedMessages()).toHaveLength(1);
 *   });
 * });
 * ```
 */

import type {
  MidiBackendInterface,
  MidiPortInfo,
  MidiInputPort,
  MidiOutputPort,
  MidiPort,
  MidiMessage
} from '../../src/core/MidiInterface.js';

/**
 * Response function type for queued responses
 */
type ResponseFunction = () => void;

/**
 * Configuration for creating deterministic port responses
 */
interface PortConfig {
  /** Port ID */
  id: string;
  /** Port name */
  name: string;
  /** Manufacturer name */
  manufacturer?: string;
  /** Version string */
  version?: string;
}

/**
 * A completely deterministic MIDI backend for testing
 *
 * Eliminates all sources of non-determinism:
 * - No real time dependencies (uses injected clock)
 * - No queueMicrotask or setTimeout
 * - Controlled async operations via response queue
 * - Predictable message flow
 */
export class DeterministicMidiBackend implements MidiBackendInterface {
  private readonly timestampFn: () => number;
  private readonly inputPorts = new Map<string, MidiInputPort>();
  private readonly outputPorts = new Map<string, MidiOutputPort>();
  private readonly responseQueue: ResponseFunction[] = [];
  private readonly sentMessages: MidiMessage[] = [];
  private readonly receivedMessages: MidiMessage[] = [];
  private isInitialized = false;

  // Configuration for available ports
  private readonly availableInputPorts: PortConfig[] = [
    {
      id: 'test-input-1',
      name: 'Launch Control XL MK3',
      manufacturer: 'Novation',
      version: '1.0'
    }
  ];

  private readonly availableOutputPorts: PortConfig[] = [
    {
      id: 'test-output-1',
      name: 'Launch Control XL MK3',
      manufacturer: 'Novation',
      version: '1.0'
    }
  ];

  /**
   * Create a new deterministic MIDI backend
   * @param timestampFn Function to generate timestamps (should be from SyntheticClock)
   */
  constructor(timestampFn: () => number = () => 0) {
    this.timestampFn = timestampFn;
  }

  // ===== MidiBackendInterface Implementation =====

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  /**
   * Synchronous initialization for tests (sets isInitialized flag directly)
   * Use this in test setup to avoid async initialization
   */
  initializeSync(): void {
    this.isInitialized = true;
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }
    return [...this.availableInputPorts];
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }
    return [...this.availableOutputPorts];
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const portConfig = this.availableInputPorts.find(p => p.id === portId);
    if (!portConfig) {
      throw new Error(`Input port not found: ${portId}`);
    }

    const port: MidiInputPort = {
      id: portId,
      name: portConfig.name,
      type: 'input',
      close: async () => {
        this.inputPorts.delete(portId);
      },
      onMessage: undefined
    };

    this.inputPorts.set(portId, port);
    return port;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    const portConfig = this.availableOutputPorts.find(p => p.id === portId);
    if (!portConfig) {
      throw new Error(`Output port not found: ${portId}`);
    }

    const port: MidiOutputPort = {
      id: portId,
      name: portConfig.name,
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
      throw new Error(`Port not open: ${port.id}`);
    }

    // Store sent message with deterministic timestamp
    const deterministicMessage: MidiMessage = {
      timestamp: this.timestampFn(),
      data: [...message.data]
    };

    this.sentMessages.push(deterministicMessage);

    // Auto-queue responses for known message types
    this.autoQueueResponseIfNeeded(deterministicMessage);
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
    this.responseQueue.length = 0;
    this.sentMessages.length = 0;
    this.receivedMessages.length = 0;
    this.isInitialized = false;
  }

  // ===== Test Control Methods =====

  /**
   * Queue a response function to be executed when processNextResponse() is called
   * @param response Function to execute
   */
  queueResponse(response: ResponseFunction): void {
    this.responseQueue.push(response);
  }

  /**
   * Process the next queued response
   * @returns true if a response was processed, false if queue was empty
   */
  processNextResponse(): boolean {
    const response = this.responseQueue.shift();
    if (response) {
      response();
      return true;
    }
    return false;
  }

  /**
   * Process all queued responses
   * @returns Number of responses processed
   */
  processAllResponses(): number {
    let count = 0;
    while (this.processNextResponse()) {
      count++;
    }
    return count;
  }

  /**
   * Get the number of queued responses
   */
  getQueuedResponseCount(): number {
    return this.responseQueue.length;
  }

  /**
   * Clear all queued responses
   */
  clearResponseQueue(): void {
    this.responseQueue.length = 0;
  }

  // ===== Test Helper Methods =====

  /**
   * Get all sent messages
   */
  getSentMessages(): readonly MidiMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Get the last sent message
   */
  getLastSentMessage(): MidiMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Clear sent messages history
   */
  clearSentMessages(): void {
    this.sentMessages.length = 0;
  }

  /**
   * Get all received messages (messages sent to input ports)
   */
  getReceivedMessages(): readonly MidiMessage[] {
    return [...this.receivedMessages];
  }

  /**
   * Clear received messages history
   */
  clearReceivedMessages(): void {
    this.receivedMessages.length = 0;
  }

  /**
   * Simulate receiving a message on an input port
   * @param portId Input port ID
   * @param data MIDI message data
   */
  simulateReceiveMessage(portId: string, data: number[]): void {
    const port = this.inputPorts.get(portId);
    if (!port) {
      throw new Error(`Input port not open: ${portId}`);
    }

    const message: MidiMessage = {
      timestamp: this.timestampFn(),
      data: [...data]
    };

    this.receivedMessages.push(message);

    if (port.onMessage) {
      port.onMessage(message);
    }
  }

  // ===== Pre-configured Response Helpers =====

  /**
   * Queue a standard device inquiry response for Novation Launch Control XL3
   */
  queueDeviceInquiryResponse(): void {
    this.queueResponse(() => {
      // Find first input port to send response to
      const inputPort = this.inputPorts.values().next().value;
      if (inputPort) {
        this.simulateReceiveMessage(inputPort.id, [
          0xF0, // Start
          0x7E, // Universal non-realtime
          0x00, // Device ID
          0x06, // Inquiry response
          0x02, // Sub-ID
          0x00, 0x20, 0x29, // Manufacturer ID (Novation)
          0x00, 0x61, // Family code (Launch Control XL)
          0x00, 0x03, // Family member (XL3)
          0x01, 0x00, 0x00, 0x00, // Software revision
          0xF7  // End
        ]);
      }
    });
  }

  /**
   * Queue a device acknowledgment response
   * @param originalMessage The message being acknowledged
   */
  queueAckResponse(originalMessage?: MidiMessage): void {
    this.queueResponse(() => {
      const inputPort = this.inputPorts.values().next().value;
      if (inputPort) {
        // Simple ACK response
        this.simulateReceiveMessage(inputPort.id, [
          0xF0, // Start
          0x00, 0x20, 0x29, // Novation
          0x02, 0x03, // Launch Control XL3
          0x7F, // ACK
          0xF7  // End
        ]);
      }
    });
  }

  /**
   * Queue a custom mode data response
   * @param modeData Mode configuration data
   */
  queueCustomModeResponse(modeData: number[]): void {
    this.queueResponse(() => {
      const inputPort = this.inputPorts.values().next().value;
      if (inputPort) {
        const response = [
          0xF0, // Start
          0x00, 0x20, 0x29, // Novation
          0x02, 0x03, // Launch Control XL3
          0x40, // Custom mode response
          ...modeData,
          0xF7  // End
        ];
        this.simulateReceiveMessage(inputPort.id, response);
      }
    });
  }

  /**
   * Queue multiple CC messages simulating knob/fader movements
   * @param ccMappings Array of {cc: number, value: number} mappings
   */
  queueControlChangeMessages(ccMappings: Array<{cc: number, value: number}>): void {
    ccMappings.forEach(({cc, value}) => {
      this.queueResponse(() => {
        const inputPort = this.inputPorts.values().next().value;
        if (inputPort) {
          this.simulateReceiveMessage(inputPort.id, [0xB0, cc, value]);
        }
      });
    });
  }

  // ===== Configuration Methods =====

  /**
   * Add a custom input port configuration
   * @param config Port configuration
   */
  addInputPort(config: PortConfig): void {
    this.availableInputPorts.push(config);
  }

  /**
   * Add a custom output port configuration
   * @param config Port configuration
   */
  addOutputPort(config: PortConfig): void {
    this.availableOutputPorts.push(config);
  }

  /**
   * Remove all port configurations and add new ones
   * @param inputPorts Input port configurations
   * @param outputPorts Output port configurations
   */
  setPortConfigurations(inputPorts: PortConfig[], outputPorts: PortConfig[]): void {
    this.availableInputPorts.length = 0;
    this.availableOutputPorts.length = 0;
    this.availableInputPorts.push(...inputPorts);
    this.availableOutputPorts.push(...outputPorts);
  }

  // ===== Private Helper Methods =====

  /**
   * Automatically queue responses for known message types
   * @param message The sent message to analyze
   */
  private autoQueueResponseIfNeeded(message: MidiMessage): void {
    const data = message.data;

    // Device inquiry (F0 7E xx 06 01 F7)
    if (data.length >= 6 &&
        data[0] === 0xF0 &&
        data[1] === 0x7E &&
        data[3] === 0x06 &&
        data[4] === 0x01) {
      // Auto-queue device inquiry response if not already queued
      if (this.responseQueue.length === 0) {
        this.queueDeviceInquiryResponse();
      }
    }
  }
}

/**
 * Factory for creating pre-configured deterministic backends
 */
export class DeterministicMidiBackendFactory {
  /**
   * Create a backend configured for Launch Control XL3 testing
   * @param timestampFn Timestamp function (typically from SyntheticClock)
   */
  static createForLaunchControlXL3(timestampFn?: () => number): DeterministicMidiBackend {
    const backend = new DeterministicMidiBackend(timestampFn);

    // Pre-configure with Launch Control XL3 specific ports
    backend.setPortConfigurations(
      [
        {
          id: 'lcxl3-input',
          name: 'Launch Control XL MK3',
          manufacturer: 'Novation',
          version: '1.0'
        }
      ],
      [
        {
          id: 'lcxl3-output',
          name: 'Launch Control XL MK3',
          manufacturer: 'Novation',
          version: '1.0'
        }
      ]
    );

    return backend;
  }

  /**
   * Create a backend with no available ports (for testing error conditions)
   */
  static createEmpty(timestampFn?: () => number): DeterministicMidiBackend {
    const backend = new DeterministicMidiBackend(timestampFn);
    backend.setPortConfigurations([], []);
    return backend;
  }

  /**
   * Create a backend with multiple ports for complex scenarios
   */
  static createMultiPort(timestampFn?: () => number): DeterministicMidiBackend {
    const backend = new DeterministicMidiBackend(timestampFn);

    backend.setPortConfigurations(
      [
        { id: 'input-1', name: 'Device 1 Input', manufacturer: 'Test', version: '1.0' },
        { id: 'input-2', name: 'Device 2 Input', manufacturer: 'Test', version: '1.0' }
      ],
      [
        { id: 'output-1', name: 'Device 1 Output', manufacturer: 'Test', version: '1.0' },
        { id: 'output-2', name: 'Device 2 Output', manufacturer: 'Test', version: '1.0' }
      ]
    );

    return backend;
  }
}