/**
 * Web MIDI API backend for browser environments
 *
 * Implements MIDI interface using the Web MIDI API for browser-based applications.
 * Requires HTTPS in production environments and explicit SysEx permission.
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
 * WebMidiBackend implementation using Web MIDI API
 */
export class WebMidiBackend implements MidiBackendInterface {
  private midiAccess?: MIDIAccess;
  private openInputs: Map<string, MIDIInput> = new Map();
  private openOutputs: Map<string, MIDIOutput> = new Map();
  private dawInputs: Map<string, MIDIInput> = new Map();
  private dawOutputs: Map<string, MIDIOutput> = new Map();
  private portWrappers: Map<string, MidiInputPort | MidiOutputPort> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Check if Web MIDI API is available
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not available. Requires modern browser with MIDI support and HTTPS.');
    }

    try {
      // Request MIDI access with SysEx permission (critical for custom modes)
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });

      // Set up connection state change handler
      this.midiAccess.onstatechange = (event) => {
        if (event.port) {
          console.debug('MIDI port state changed:', event.port.name, event.port.state);
        }
      };

      this.isInitialized = true;
    } catch (error: any) {
      if (error.name === 'SecurityError') {
        throw new Error('MIDI access denied. Web MIDI requires user permission and HTTPS in production.');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Web MIDI API not supported in this browser.');
      } else {
        throw new Error(`Failed to initialize Web MIDI API: ${error.message}`);
      }
    }
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    const ports: MidiPortInfo[] = [];
    this.midiAccess.inputs.forEach((port, id) => {
      ports.push({
        id,
        name: port.name || `Input ${id}`,
        ...(port.manufacturer && { manufacturer: port.manufacturer }),
        ...(port.version && { version: port.version })
      });
    });

    return ports;
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    const ports: MidiPortInfo[] = [];
    this.midiAccess.outputs.forEach((port, id) => {
      ports.push({
        id,
        name: port.name || `Output ${id}`,
        ...(port.manufacturer && { manufacturer: port.manufacturer }),
        ...(port.version && { version: port.version })
      });
    });

    return ports;
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    let midiInput: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((input, id) => {
      if (id === portId) {
        midiInput = input;
      }
    });

    if (!midiInput) {
      throw new Error(`Input port not found: ${portId}`);
    }

    try {
      // Open the Web MIDI port
      await midiInput.open();

      const port: MidiInputPort = {
        id: portId,
        name: midiInput.name || `Input ${portId}`,
        type: 'input',
        close: async () => {
          await this.closeWebMidiPort(midiInput!);
          this.openInputs.delete(portId);
          this.portWrappers.delete(portId);
        },
        onMessage: undefined
      };

      // Set up message handler
      midiInput.onmidimessage = (event: any) => {
        if (port.onMessage) {
          // Convert Uint8Array to number array
          const data: number[] = Array.from(event.data as Uint8Array);
          port.onMessage({
            timestamp: event.timeStamp,
            data
          });
        }
      };

      this.openInputs.set(portId, midiInput);
      this.portWrappers.set(portId, port);

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open input port ${portId}: ${error.message}`);
    }
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    let midiOutput: MIDIOutput | undefined;
    this.midiAccess.outputs.forEach((output, id) => {
      if (id === portId) {
        midiOutput = output;
      }
    });

    if (!midiOutput) {
      throw new Error(`Output port not found: ${portId}`);
    }

    try {
      // Open the Web MIDI port
      await midiOutput.open();

      const port: MidiOutputPort = {
        id: portId,
        name: midiOutput.name || `Output ${portId}`,
        type: 'output',
        close: async () => {
          await this.closeWebMidiPort(midiOutput!);
          this.openOutputs.delete(portId);
          this.portWrappers.delete(portId);
        }
      };

      this.openOutputs.set(portId, midiOutput);
      this.portWrappers.set(portId, port);

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open output port ${portId}: ${error.message}`);
    }
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    // Check both regular outputs and DAW outputs
    let midiOutput = this.openOutputs.get(port.id);
    if (!midiOutput) {
      midiOutput = this.dawOutputs.get(port.id);
    }

    if (!midiOutput) {
      throw new Error(`Output port not open: ${port.id}`);
    }

    try {
      // Convert message data to array format expected by Web MIDI
      const data: number[] = Array.isArray(message.data)
        ? message.data as number[]
        : Array.from(message.data);

      // Send message immediately (no timestamp)
      // Note: We don't pass message.timestamp because it uses Date.now()
      // which is incompatible with Web MIDI's performance.now() timestamps.
      // Web MIDI expects timestamps relative to page load, not Unix epoch.
      midiOutput.send(data);
    } catch (error: any) {
      throw new Error(`Failed to send message to port ${port.id}: ${error.message}`);
    }
  }

  async closePort(port: MidiPort): Promise<void> {
    await port.close();
  }

  /**
   * Get DAW input ports
   */
  async getDawInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    const ports: MidiPortInfo[] = [];
    this.midiAccess.inputs.forEach((port, id) => {
      if (port.name && port.name.includes('DAW Out')) {
        ports.push({
          id,
          name: port.name || `DAW Input ${id}`,
          ...(port.manufacturer && { manufacturer: port.manufacturer }),
          ...(port.version && { version: port.version })
        });
      }
    });

    return ports;
  }

  /**
   * Get DAW output ports
   */
  async getDawOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    const ports: MidiPortInfo[] = [];
    this.midiAccess.outputs.forEach((port, id) => {
      if (port.name && port.name.includes('DAW In')) {
        ports.push({
          id,
          name: port.name || `DAW Output ${id}`,
          ...(port.manufacturer && { manufacturer: port.manufacturer }),
          ...(port.version && { version: port.version })
        });
      }
    });

    return ports;
  }

  /**
   * Open DAW input port
   */
  async openDawInput(portId: string): Promise<MidiInputPort> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    let midiInput: MIDIInput | undefined;
    this.midiAccess.inputs.forEach((input, id) => {
      if (id === portId) {
        midiInput = input;
      }
    });

    if (!midiInput) {
      throw new Error(`DAW input port not found: ${portId}`);
    }

    try {
      await midiInput.open();

      const port: MidiInputPort = {
        id: portId,
        name: midiInput.name || `DAW Input ${portId}`,
        type: 'input',
        close: async () => {
          await this.closeWebMidiPort(midiInput!);
          this.dawInputs.delete(portId);
          this.portWrappers.delete(portId);
        },
        onMessage: undefined
      };

      // Set up message handler
      midiInput.onmidimessage = (event: any) => {
        if (port.onMessage) {
          const data: number[] = Array.from(event.data as Uint8Array);
          port.onMessage({
            timestamp: event.timeStamp,
            data
          });
        }
      };

      this.dawInputs.set(portId, midiInput);
      this.portWrappers.set(portId, port);

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open DAW input port ${portId}: ${error.message}`);
    }
  }

  /**
   * Open DAW output port
   */
  async openDawOutput(portId: string): Promise<MidiOutputPort> {
    if (!this.isInitialized || !this.midiAccess) {
      throw new Error('Backend not initialized');
    }

    let midiOutput: MIDIOutput | undefined;
    this.midiAccess.outputs.forEach((output, id) => {
      if (id === portId) {
        midiOutput = output;
      }
    });

    if (!midiOutput) {
      throw new Error(`DAW output port not found: ${portId}`);
    }

    try {
      await midiOutput.open();

      const port: MidiOutputPort = {
        id: portId,
        name: midiOutput.name || `DAW Output ${portId}`,
        type: 'output',
        close: async () => {
          await this.closeWebMidiPort(midiOutput!);
          this.dawOutputs.delete(portId);
          this.portWrappers.delete(portId);
        }
      };

      this.dawOutputs.set(portId, midiOutput);
      this.portWrappers.set(portId, port);

      return port;
    } catch (error: any) {
      throw new Error(`Failed to open DAW output port ${portId}: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    // Close all open ports
    const closePromises: Promise<void>[] = [];

    for (const [_id, midiInput] of this.openInputs.entries()) {
      closePromises.push(this.closeWebMidiPort(midiInput));
    }

    for (const [_id, midiOutput] of this.openOutputs.entries()) {
      closePromises.push(this.closeWebMidiPort(midiOutput));
    }

    for (const [_id, dawInput] of this.dawInputs.entries()) {
      closePromises.push(this.closeWebMidiPort(dawInput));
    }

    for (const [_id, dawOutput] of this.dawOutputs.entries()) {
      closePromises.push(this.closeWebMidiPort(dawOutput));
    }

    await Promise.all(closePromises);

    // Clear all maps
    this.openInputs.clear();
    this.openOutputs.clear();
    this.dawInputs.clear();
    this.dawOutputs.clear();
    this.portWrappers.clear();

    // Remove event handlers
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
    }

    this.isInitialized = false;
  }

  /**
   * Check if Web MIDI API is available in the current environment
   */
  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' &&
           typeof navigator.requestMIDIAccess === 'function';
  }

  /**
   * Check if SysEx is supported (requires permission)
   */
  isSysExEnabled(): boolean {
    return this.midiAccess?.sysexEnabled || false;
  }

  /**
   * Helper method to close Web MIDI ports with error handling
   */
  private async closeWebMidiPort(port: MIDIPort): Promise<void> {
    try {
      if (port.connection === 'open') {
        await port.close();
      }
    } catch (error: any) {
      console.warn(`Warning: Failed to close MIDI port ${port.name}: ${error.message}`);
    }
  }
}