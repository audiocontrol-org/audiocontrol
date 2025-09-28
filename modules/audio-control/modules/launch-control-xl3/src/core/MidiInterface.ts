/**
 * Platform-agnostic MIDI interface
 *
 * Provides abstraction layer for different MIDI backends (node-midi, Web MIDI API, etc.)
 */

import { EventEmitter } from 'eventemitter3';

// Base MIDI Message type
export interface MidiMessage {
  readonly timestamp: number;
  readonly data: readonly number[];
  type?: string;
  channel?: number;
  controller?: number;
  value?: number;
  note?: number;
  velocity?: number;
}

// Port information
export interface MidiPortInfo {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly version?: string;
}

// MIDI Port abstraction
export interface MidiPort {
  readonly id: string;
  readonly name: string;
  readonly type: 'input' | 'output';

  close(): Promise<void>;
}

// Input port with message handler
export interface MidiInputPort extends MidiPort {
  readonly type: 'input';
  onMessage?: ((message: MidiMessage) => void) | undefined;
}

// Output port
export interface MidiOutputPort extends MidiPort {
  readonly type: 'output';
}

// Backend interface that different MIDI implementations must satisfy
export interface MidiBackendInterface {
  initialize(): Promise<void>;

  getInputPorts(): Promise<MidiPortInfo[]>;

  getOutputPorts(): Promise<MidiPortInfo[]>;

  openInput(portId: string): Promise<MidiInputPort>;

  openOutput(portId: string): Promise<MidiOutputPort>;

  sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void>;

  closePort(port: MidiPort): Promise<void>;

  cleanup(): Promise<void>;
}

// Events emitted by MidiInterface
export interface MidiInterfaceEvents {
  message: (message: MidiMessage) => void;
  connected: (port: MidiPort) => void;
  disconnected: (port: MidiPort) => void;
  error: (error: Error) => void;
}

/**
 * Main MIDI interface class
 * Manages MIDI connections and message routing
 */
export class MidiInterface extends EventEmitter {
  private backend?: MidiBackendInterface | undefined;
  private inputPort?: MidiInputPort | undefined;
  private outputPort?: MidiOutputPort | undefined;
  private isInitialized = false;
  private messageBuffer: MidiMessage[] = [];
  private readonly maxBufferSize = 1000;

  constructor(backend?: MidiBackendInterface) {
    super();
    this.backend = backend;
  }

  /**
   * Initialize the MIDI interface
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If no backend provided, try to auto-detect
    if (!this.backend) {
      throw new Error('MIDI backend is not initialized');
      //this.backend = await this.autoDetectBackend();
    }

    await this.backend.initialize();
    this.isInitialized = true;
  }

  /**
   * Get available input ports
   */
  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('MidiInterface not initialized');
    }

    if (!this.backend) {
      throw new Error('No MIDI backend available');
    }

    return this.backend.getInputPorts();
  }

  /**
   * Get available output ports
   */
  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('MidiInterface not initialized');
    }

    if (!this.backend) {
      throw new Error('No MIDI backend available');
    }

    return this.backend.getOutputPorts();
  }

  /**
   * Open input port by ID or name
   */
  async openInput(portIdOrName: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MidiInterface not initialized');
    }

    if (!this.backend) {
      throw new Error('No MIDI backend available');
    }

    // Close existing input if open
    if (this.inputPort) {
      await this.closeInput();
    }

    // Find port
    const ports = await this.backend.getInputPorts();
    const port = ports.find((p) => p.id === portIdOrName || p.name === portIdOrName);

    if (!port) {
      throw new Error(`Input port not found: ${portIdOrName}`);
    }

    // Open port
    this.inputPort = await this.backend.openInput(port.id);

    // Set up message handler
    this.inputPort.onMessage = (message: MidiMessage) => {
      this.handleIncomingMessage(message);
    };

    this.emit('connected', this.inputPort);
  }

  /**
   * Open output port by ID or name
   */
  async openOutput(portIdOrName: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MidiInterface not initialized');
    }

    if (!this.backend) {
      throw new Error('No MIDI backend available');
    }

    // Close existing output if open
    if (this.outputPort) {
      await this.closeOutput();
    }

    // Find port
    const ports = await this.backend.getOutputPorts();
    const port = ports.find((p) => p.id === portIdOrName || p.name === portIdOrName);

    if (!port) {
      throw new Error(`Output port not found: ${portIdOrName}`);
    }

    // Open port
    this.outputPort = await this.backend.openOutput(port.id);
    this.emit('connected', this.outputPort);
  }

  /**
   * Send MIDI message
   */
  async sendMessage(data: number[]): Promise<void> {
    if (!this.outputPort) {
      throw new Error('No output port open');
    }

    if (!this.backend) {
      throw new Error('No MIDI backend available');
    }

    const message: MidiMessage = {
      timestamp: Date.now(),
      data,
    };

    await this.backend.sendMessage(this.outputPort, message);
  }

  /**
   * Close input port
   */
  async closeInput(): Promise<void> {
    if (this.inputPort && this.backend) {
      await this.backend.closePort(this.inputPort);
      this.emit('disconnected', this.inputPort);
      this.inputPort = undefined;
    }
  }

  /**
   * Close output port
   */
  async closeOutput(): Promise<void> {
    if (this.outputPort && this.backend) {
      await this.backend.closePort(this.outputPort);
      this.emit('disconnected', this.outputPort);
      this.outputPort = undefined;
    }
  }

  /**
   * Close all ports and cleanup
   */
  async cleanup(): Promise<void> {
    await this.closeInput();
    await this.closeOutput();

    if (this.backend) {
      await this.backend.cleanup();
    }

    this.isInitialized = false;
    this.messageBuffer = [];
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return !!(this.inputPort || this.outputPort);
  }

  /**
   * Get buffered messages
   */
  getBufferedMessages(): MidiMessage[] {
    return [...this.messageBuffer];
  }

  /**
   * Clear message buffer
   */
  clearBuffer(): void {
    this.messageBuffer = [];
  }

  /**
   * Handle incoming MIDI message
   */
  private handleIncomingMessage(message: MidiMessage): void {
    // Add to buffer
    this.messageBuffer.push(message);

    // Limit buffer size
    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.shift();
    }

    // Parse and emit typed MIDI events
    const data = message.data;
    if (data.length > 0) {
      const statusByte = data[0];
      if (statusByte === undefined) return;
      const channel = statusByte & 0x0f;
      const messageType = statusByte & 0xf0;

      const parsedMessage: MidiMessage = {
        timestamp: message.timestamp,
        data: data,
        type: 'unknown',
        channel,
      };

      switch (messageType) {
        case 0xb0: // Control Change
          parsedMessage.type = 'controlchange';
          parsedMessage.controller = data[1] ?? 0;
          parsedMessage.value = data[2] ?? 0;
          this.emit('controlchange', parsedMessage);
          break;

        case 0x90: // Note On
          parsedMessage.type = 'noteon';
          parsedMessage.note = data[1] ?? 0;
          parsedMessage.velocity = data[2] ?? 0;
          this.emit('noteon', parsedMessage);
          break;

        case 0x80: // Note Off
          parsedMessage.type = 'noteoff';
          parsedMessage.note = data[1] ?? 0;
          parsedMessage.velocity = data[2] ?? 0;
          this.emit('noteoff', parsedMessage);
          break;

        case 0xf0: // System Exclusive
          if (data[data.length - 1] === 0xf7) {
            parsedMessage.type = 'sysex';
            this.emit('sysex', parsedMessage);
          }
          break;
      }

      // Always emit the generic message event
      this.emit('message', message);
    }
  }

  /**
   * Auto-detect available MIDI backend
   */
  // private async autoDetectBackend(): Promise<MidiBackendInterface> {
  //   // Try Web MIDI API first (browser environment with native support)
  //   try {
  //     const { WebMidiBackend } = await import('./backends/WebMidiBackend.js');
  //     if (WebMidiBackend.isAvailable()) {
  //       return new WebMidiBackend();
  //     }
  //   } catch (err) {
  //     console.debug('Web MIDI API not available:', err);
  //   }
  //
  //   // Try easymidi (Node.js with native bindings)
  //   try {
  //     const { EasyMidiBackend } = await import('./backends/EasyMidiBackend.js');
  //     const backend = new EasyMidiBackend();
  //     await backend.initialize();
  //     return backend;
  //   } catch (err) {
  //     console.debug('easymidi not available:', err);
  //   }
  //
  //   // Try JZZ (pure JavaScript, works in Node.js and browsers)
  //   try {
  //     const { JzzBackend } = await import('./backends/JzzBackend.js');
  //     const backend = new JzzBackend();
  //     await backend.initialize();
  //     return backend;
  //   } catch (err) {
  //     console.debug('JZZ not available:', err);
  //   }
  //
  //   // Try node-midi (Node.js with native bindings - fallback if easymidi unavailable)
  //   try {
  //     const { NodeMidiBackend } = await import('./backends/NodeMidiBackend.js');
  //     return new NodeMidiBackend();
  //   } catch (err) {
  //     console.debug('node-midi not available:', err);
  //   }
  // }
}
