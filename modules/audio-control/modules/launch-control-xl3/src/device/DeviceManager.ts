/**
 * Device Manager for Novation Launch Control XL 3
 *
 * Handles device discovery, connection, initialization, and communication
 * with the Launch Control XL 3 hardware via MIDI and SysEx.
 */

import { EventEmitter } from 'events';
import {
  MidiInterface,
  MidiPortInfo,
  MidiMessage,
  MidiBackendInterface
} from '../core/MidiInterface.js';
import { SysExParser } from '../core/SysExParser.js';
import {
  LaunchControlXL3Info,
  DeviceMode,
  DeviceConnectionState,
  CustomMode,
  DeviceInquiryResponse
} from '../types/index.js';

export interface DeviceManagerOptions {
  midiBackend?: MidiBackendInterface | undefined;
  autoConnect?: boolean;
  deviceNameFilter?: string;
  inquiryTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DeviceStatus {
  connected: boolean;
  state: DeviceConnectionState;
  deviceInfo?: LaunchControlXL3Info | undefined;
  currentMode?: DeviceMode | undefined;
  lastSeen?: Date;
  error?: string;
}

export interface DeviceEvents {
  'device:connected': (device: LaunchControlXL3Info) => void;
  'device:disconnected': (reason?: string) => void;
  'device:ready': (device: LaunchControlXL3Info) => void;
  'device:error': (error: Error) => void;
  'device:modeChanged': (mode: DeviceMode) => void;
  'control:change': (control: string, value: number, channel?: number) => void;
  'sysex:received': (message: number[]) => void;
}

/**
 * Main device manager for Launch Control XL 3
 */
export class DeviceManager extends EventEmitter {
  private midi: MidiInterface;
  private options: Required<Omit<DeviceManagerOptions, 'midiBackend'>> & { midiBackend?: MidiBackendInterface | undefined };
  private deviceInfo?: LaunchControlXL3Info | undefined;
  private connectionState: DeviceConnectionState = 'disconnected';
  private inputPortId?: string | undefined;
  private outputPortId?: string | undefined;
  private currentMode?: DeviceMode | undefined;
  private inquiryTimer?: NodeJS.Timeout | undefined;
  private reconnectTimer?: NodeJS.Timeout | undefined;
  private isInitializing = false;

  constructor(options: DeviceManagerOptions = {}) {
    super();

    this.options = {
      midiBackend: options.midiBackend,
      autoConnect: options.autoConnect ?? true,
      deviceNameFilter: options.deviceNameFilter ?? 'Launch Control XL',
      inquiryTimeout: options.inquiryTimeout ?? 5000,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000,
    };

    this.midi = new MidiInterface(this.options.midiBackend);
    this.setupMidiHandlers();
  }

  /**
   * Initialize the device manager and optionally connect to device
   */
  async initialize(): Promise<void> {
    try {
      await this.midi.initialize();

      if (this.options.autoConnect) {
        await this.connect();
      }
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Connect to Launch Control XL 3 device
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');
    this.isInitializing = true;

    try {
      // Find device ports
      const { inputPort, outputPort } = await this.findDevicePorts();

      if (!inputPort || !outputPort) {
        throw new Error('Launch Control XL 3 not found');
      }

      // Open ports
      await this.midi.openInput(inputPort.id);
      await this.midi.openOutput(outputPort.id);

      this.inputPortId = inputPort.id;
      this.outputPortId = outputPort.id;

      // Query device identity (optional - some devices don't respond)
      try {
        const deviceInfo = await this.queryDeviceIdentity();
        if (deviceInfo) {
          this.deviceInfo = this.parseDeviceInfo(deviceInfo);
        }
      } catch (error) {
        console.warn('Device inquiry failed, continuing anyway:', error);
        // Create default device info
        this.deviceInfo = {
          name: 'Launch Control XL 3',
          firmwareVersion: 'Unknown',
          serialNumber: undefined,
          deviceId: 0x11
        } as any;
      }

      // Initialize device settings
      await this.initializeDevice();

      this.setConnectionState('connected');
      this.emit('device:connected', this.deviceInfo);
      this.emit('device:ready', this.deviceInfo);

    } catch (error) {
      this.setConnectionState('error');
      await this.disconnect();
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(reason?: string): Promise<void> {
    this.clearTimers();

    if (this.inputPortId) {
      await this.midi.closeInput();
      this.inputPortId = undefined;
    }

    if (this.outputPortId) {
      await this.midi.closeOutput();
      this.outputPortId = undefined;
    }

    if (this.connectionState !== 'disconnected') {
      this.setConnectionState('disconnected');
      this.emit('device:disconnected', reason);
    }

    this.deviceInfo = undefined;
    this.currentMode = undefined;
  }

  /**
   * Find Launch Control XL 3 ports
   */
  private async findDevicePorts(): Promise<{
    inputPort?: MidiPortInfo | undefined;
    outputPort?: MidiPortInfo | undefined;
  }> {
    const inputPorts = await this.midi.getInputPorts();
    const outputPorts = await this.midi.getOutputPorts();

    // For LCXL3, we need:
    // - Input: "LCXL3 1 MIDI Out" (for control changes)
    // - Output: "LCXL3 1 DAW In" (for SysEx/LED control)

    // First try to find the specific ports we need
    let inputPort = inputPorts.find(port =>
      port.name === 'LCXL3 1 MIDI Out'
    );

    let outputPort = outputPorts.find(port =>
      port.name === 'LCXL3 1 DAW In'
    );

    // Fall back to filter-based search if specific ports not found
    if (!inputPort) {
      inputPort = inputPorts.find(port =>
        port.name.includes(this.options.deviceNameFilter)
      );
    }

    if (!outputPort) {
      outputPort = outputPorts.find(port =>
        port.name.includes(this.options.deviceNameFilter)
      );
    }

    console.log('[DeviceManager] Found ports:', {
      input: inputPort?.name,
      output: outputPort?.name
    });

    return { inputPort, outputPort };
  }

  /**
   * Query device identity using SysEx
   */
  private async queryDeviceIdentity(): Promise<DeviceInquiryResponse | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.midi.removeListener('sysex', handleResponse);
        reject(new Error('Device inquiry timeout'));
      }, this.options.inquiryTimeout);

      const handleResponse = (message: MidiMessage) => {
        if (message.type === 'sysex') {
          try {
            const parsed = SysExParser.parse([...message.data]);

            if (parsed.type === 'device_inquiry_response') {
              clearTimeout(timeout);
              this.midi.removeListener('sysex', handleResponse);
              resolve(parsed as unknown as DeviceInquiryResponse);
            }
          } catch {
            // Ignore parse errors for non-matching messages
          }
        }
      };

      this.midi.on('sysex', handleResponse);

      // Send device inquiry
      const inquiryMessage = SysExParser.buildDeviceQuery();
      this.sendSysEx(inquiryMessage);
    });
  }

  /**
   * Parse device info from inquiry response
   */
  private parseDeviceInfo(response: DeviceInquiryResponse): LaunchControlXL3Info {
    return {
      manufacturerId: response.manufacturerId.map(b =>
        b.toString(16).padStart(2, '0')
      ).join(' '),
      deviceFamily: response.familyCode ?? 0,
      modelNumber: response.familyMember ?? 0,
      firmwareVersion: response.softwareRevision ?
        `${response.softwareRevision[0]}.${response.softwareRevision[1]}.${response.softwareRevision[2]}.${response.softwareRevision[3]}` :
        'unknown',
    };
  }

  /**
   * Initialize device after connection
   */
  private async initializeDevice(): Promise<void> {
    // Additional initialization steps can be added here
    // For example: loading custom modes, setting initial LED states, etc.

    // Set initial mode to User mode
    await this.selectTemplate(0);
  }

  /**
   * Setup MIDI event handlers
   */
  private setupMidiHandlers(): void {
    this.midi.on('controlchange', (message: MidiMessage) => {
      if (!this.isInitializing && this.connectionState === 'connected') {
        const control = this.getControlName(message.controller!, message.channel!);
        this.emit('control:change', control, message.value!, message.channel);
      }
    });

    this.midi.on('sysex', (message: MidiMessage) => {
      if (!this.isInitializing && this.connectionState === 'connected') {
        this.emit('sysex:received', message.data);
        this.handleSysExMessage([...message.data]);
      }
    });

    this.midi.on('error', (error: Error) => {
      this.handleError(error);
    });
  }

  /**
   * Handle incoming SysEx messages
   */
  private handleSysExMessage(data: number[]): void {
    try {
      const parsed = SysExParser.parse(data);

      switch (parsed.type) {
        case 'template_change':
          const templateChange = parsed as any;
          this.currentMode = {
            type: 'template',
            slot: templateChange.templateNumber,
          };
          this.emit('device:modeChanged', this.currentMode);
          break;

        // Add more SysEx message handlers as needed
      }
    } catch {
      // Ignore unrecognized SysEx messages
    }
  }

  /**
   * Get human-readable control name
   */
  private getControlName(controller: number, _channel: number): string {
    // Map CC numbers to control names based on Launch Control XL 3 layout
    const controlMap: Record<number, string> = {
      // Send A knobs
      13: 'sendA1', 14: 'sendA2', 15: 'sendA3', 16: 'sendA4',
      17: 'sendA5', 18: 'sendA6', 19: 'sendA7', 20: 'sendA8',

      // Send B knobs
      29: 'sendB1', 30: 'sendB2', 31: 'sendB3', 32: 'sendB4',
      33: 'sendB5', 34: 'sendB6', 35: 'sendB7', 36: 'sendB8',

      // Pan/Device knobs
      49: 'pan1', 50: 'pan2', 51: 'pan3', 52: 'pan4',
      53: 'pan5', 54: 'pan6', 55: 'pan7', 56: 'pan8',

      // Faders
      77: 'fader1', 78: 'fader2', 79: 'fader3', 80: 'fader4',
      81: 'fader5', 82: 'fader6', 83: 'fader7', 84: 'fader8',
    };

    return controlMap[controller] || `cc${controller}`;
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: DeviceConnectionState): void {
    this.connectionState = state;
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('[DeviceManager] Error:', error.message);
    this.emit('device:error', error);

    if (this.connectionState === 'connected') {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    let attempts = 0;

    const tryReconnect = async () => {
      if (attempts >= this.options.retryAttempts) {
        this.clearTimers();
        await this.disconnect('Max reconnection attempts reached');
        return;
      }

      attempts++;

      try {
        await this.connect();
        this.clearTimers();
      } catch {
        this.reconnectTimer = setTimeout(tryReconnect, this.options.retryDelay);
      }
    };

    this.reconnectTimer = setTimeout(tryReconnect, this.options.retryDelay);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.inquiryTimer) {
      clearTimeout(this.inquiryTimer as NodeJS.Timeout);
      this.inquiryTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer as NodeJS.Timeout);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Send SysEx message to device
   */
  async sendSysEx(data: number[]): Promise<void> {
    if (!this.outputPortId) {
      throw new Error('Device not connected');
    }

    await this.midi.sendMessage(data);
  }

  /**
   * Send CC message to device
   */
  async sendCC(controller: number, value: number, channel: number = 0): Promise<void> {
    if (!this.outputPortId) {
      throw new Error('Device not connected');
    }

    // Build CC message: status byte (0xB0 + channel), controller, value
    const data = [0xB0 | (channel & 0x0F), controller, value];
    await this.midi.sendMessage(data);
  }

  /**
   * Select a template slot (0-15)
   */
  async selectTemplate(slot: number): Promise<void> {
    if (slot < 0 || slot > 15) {
      throw new Error('Template slot must be 0-15');
    }

    // Send template change message
    const message = SysExParser.buildTemplateChange(slot);
    await this.sendSysEx(message);

    this.currentMode = {
      type: 'template',
      slot,
    };

    this.emit('device:modeChanged', this.currentMode);
  }

  /**
   * Read custom mode from device
   */
  async readCustomMode(slot: number): Promise<CustomMode> {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.midi.removeListener('sysex', handleResponse);
        reject(new Error('Custom mode read timeout'));
      }, this.options.inquiryTimeout);

      const handleResponse = (message: MidiMessage) => {
        if (message.type === 'sysex') {
          try {
            const parsed = SysExParser.parse([...message.data]);

            if (parsed.type === 'custom_mode_response') {
              clearTimeout(timeout);
              this.midi.removeListener('sysex', handleResponse);

              const response = parsed as any;
              resolve({
                slot: response.slot,
                name: response.name || `Custom ${slot + 1}`,
                controls: response.controls,
                colors: response.colors,
              });
            }
          } catch {
            // Ignore parse errors
          }
        }
      };

      this.midi.on('sysex', handleResponse);

      // Send custom mode read request
      const message = SysExParser.buildCustomModeReadRequest(slot);
      this.sendSysEx(message);
    });
  }

  /**
   * Write custom mode to device
   */
  async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    const modeData = {
      slot,
      name: mode.name,
      controls: mode.controls,
      colors: mode.colors,
    };

    const message = SysExParser.buildCustomModeWriteRequest(slot, modeData as any);
    await this.sendSysEx(message);
  }

  /**
   * Get current device status
   */
  getStatus(): DeviceStatus {
    const status: DeviceStatus = {
      connected: this.connectionState === 'connected',
      state: this.connectionState,
      deviceInfo: this.deviceInfo,
      currentMode: this.currentMode,
    };

    if (this.deviceInfo) {
      status.lastSeen = new Date();
    }

    return status;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.clearTimers();
    await this.disconnect();
    await this.midi.cleanup();
    this.removeAllListeners();
  }
}

export default DeviceManager;