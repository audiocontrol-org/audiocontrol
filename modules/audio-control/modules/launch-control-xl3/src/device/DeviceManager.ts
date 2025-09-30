/**
 * Device Manager for Novation Launch Control XL 3
 *
 * Handles device discovery, connection, initialization, and communication
 * with the Launch Control XL 3 hardware via MIDI and SysEx.
 */

import { EventEmitter } from 'eventemitter3';
import {
  MidiInterface,
  MidiPortInfo,
  MidiMessage,
  MidiBackendInterface
} from '../core/MidiInterface.js';
import { SysExParser } from '../core/SysExParser.js';
import { DawPortControllerImpl, type DawPortController } from '../core/DawPortController.js';
import {
  LaunchControlXL3Info,
  DeviceMode,
  DeviceConnectionState,
  CustomMode,
  DeviceInquiryResponse
} from '../types/index.js';
import { z } from 'zod';

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
  private dawPortController?: DawPortController | undefined;

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

      // Query device identity using complete 4-message handshake (NO FALLBACK)
      const deviceInfo = await this.queryDeviceIdentity();
      if (deviceInfo) {
        this.deviceInfo = this.parseDeviceInfo(deviceInfo);
      } else {
        throw new Error('Device inquiry returned null response. Device may not be compatible or may be in an invalid state.');
      }

      // Initialize device settings
      await this.initializeDevice();

      // Initialize DAW port for slot selection
      await this.initializeDawPort();

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
    // - Input: "LCXL3 1 MIDI Out" (for receiving control changes from device)
    // - Output: "LCXL3 1 MIDI In" (for sending SysEx/LED control to device)

    // First try to find the specific ports we need
    let inputPort = inputPorts.find(port =>
      port.name === 'LCXL3 1 MIDI Out'
    );

    let outputPort = outputPorts.find(port =>
      port.name === 'LCXL3 1 MIDI In'
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
   * Query device identity using the complete 4-message handshake protocol
   */
  private async queryDeviceIdentity(): Promise<DeviceInquiryResponse | null> {
    let serialNumber: string | undefined;

    // Step 1: Send Novation SYN
    console.log('[DeviceManager] Handshake Step 1: Sending Novation SYN...');
    const synMessage = SysExParser.buildNovationSyn();
    await this.sendSysEx(synMessage);

    // Step 2: Wait for SYN-ACK response
    try {
      const synAckData = await this.waitForMessage(
        (data) => {
          const result = SysExParser.parseNovationSynAck(data);
          return result.valid;
        },
        this.options.inquiryTimeout,
        'SYN-ACK'
      );

      const synAckResult = SysExParser.parseNovationSynAck(synAckData);
      serialNumber = synAckResult.serialNumber;
      console.log('[DeviceManager] Handshake Step 2: Received SYN-ACK with serial:', serialNumber);
    } catch (error) {
      throw new Error(
        `Handshake failed at SYN-ACK step: ${(error as Error).message}. ` +
        'Device may not support complete handshake protocol.'
      );
    }

    // Step 3: Send Universal Device Inquiry (ACK) with correct device ID
    console.log('[DeviceManager] Handshake Step 3: Sending Universal Device Inquiry (ACK)...');
    const ackMessage = SysExParser.buildUniversalDeviceInquiry();
    await this.sendSysEx(ackMessage);

    // Step 4: Wait for Device Response
    try {
      const deviceResponseData = await this.waitForMessage(
        (data) => SysExParser.isDeviceInquiryResponse(data),
        this.options.inquiryTimeout,
        'Device Response'
      );

      console.log('[DeviceManager] Handshake Step 4: Received device response');
      const parsed = SysExParser.parse(deviceResponseData);

      if (parsed.type === 'device_inquiry_response') {
        // Cast parsed to DeviceInquiryResponse from SysExParser
        const parsedResponse = parsed as any; // Type from SysExParser

        // Create response object for validation with type field
        const response = {
          type: 'device_inquiry_response' as const,
          manufacturerId: parsedResponse.manufacturerId || [],
          deviceFamily: parsedResponse.familyCode || 0,
          deviceModel: parsedResponse.familyMember || 0,
          firmwareVersion: parsedResponse.softwareRevision || [],
          ...(serialNumber ? { serialNumber: serialNumber.split('').map(c => c.charCodeAt(0)) } : {}),
          // Include optional properties if present
          ...(parsedResponse.familyCode !== undefined ? { familyCode: parsedResponse.familyCode } : {}),
          ...(parsedResponse.familyMember !== undefined ? { familyMember: parsedResponse.familyMember } : {}),
          ...(parsedResponse.softwareRevision !== undefined ? { softwareRevision: parsedResponse.softwareRevision } : {}),
        };
        const validatedResponse = this.validateDeviceInquiryResponse(response);
        return validatedResponse;
      }

      throw new Error('Invalid device response type');
    } catch (error) {
      throw new Error(
        `Handshake failed at device response step: ${(error as Error).message}. ` +
        'Troubleshooting steps: 1) Verify device is powered and connected, ' +
        '2) Check MIDI cable/USB connection, 3) Ensure device firmware is up to date.'
      );
    }
  }

  /**
   * Wait for a specific MIDI message with timeout
   */
  private async waitForMessage(
    validator: (data: number[]) => boolean,
    timeoutMs: number,
    messageName: string
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.midi.removeListener('sysex', handleResponse);
        reject(new Error(`Handshake timeout waiting for ${messageName} after ${timeoutMs}ms`));
      }, timeoutMs);

      const handleResponse = (message: MidiMessage) => {
        if (message.type === 'sysex' && validator([...message.data])) {
          clearTimeout(timeout);
          this.midi.removeListener('sysex', handleResponse);
          resolve([...message.data]);
        }
      };

      this.midi.on('sysex', handleResponse);
    });
  }

  /**
   * Parse device info from inquiry response
   */
  private parseDeviceInfo(response: DeviceInquiryResponse): LaunchControlXL3Info {
    const validatedInfo = this.validateDeviceInfo({
      manufacturerId: response.manufacturerId.map(b =>
        b.toString(16).padStart(2, '0')
      ).join(' '),
      deviceFamily: response.familyCode ?? response.deviceFamily ?? 0,
      modelNumber: response.familyMember ?? response.deviceModel ?? 0,
      firmwareVersion: response.softwareRevision ?
        `${response.softwareRevision[0]}.${response.softwareRevision[1]}.${response.softwareRevision[2]}.${response.softwareRevision[3]}` :
        (response.firmwareVersion ? Array.from(response.firmwareVersion).join('.') : 'unknown'),
      serialNumber: typeof response.serialNumber === 'string' ?
        response.serialNumber :
        (response.serialNumber ? Array.from(response.serialNumber).join('') : undefined),
    });

    return validatedInfo;
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
          const templateChange = this.validateTemplateChangeResponse(parsed);
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

    // Select the slot first via DAW port (if available) for consistency
    await this.selectSlot(slot);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.midi.removeListener('sysex', handleResponse);
        reject(new Error(
          `Custom mode read timeout after ${this.options.inquiryTimeout}ms for slot ${slot}. ` +
          'The device may be unresponsive or the slot may be empty. ' +
          'Troubleshooting steps: 1) Verify device connection, ' +
          '2) Check if custom mode exists in the specified slot, ' +
          '3) Try reading a different slot, 4) Power cycle the device.'
        ));
      }, this.options.inquiryTimeout);

      const handleResponse = (message: MidiMessage) => {
        if (message.type === 'sysex') {
          try {
            const parsed = SysExParser.parse([...message.data]);

            if (parsed.type === 'custom_mode_response') {
              clearTimeout(timeout);
              this.midi.removeListener('sysex', handleResponse);

              const response = this.validateCustomModeResponse(parsed);
              resolve({
                slot: response.slot ?? slot,
                name: response.name || `Custom ${slot + 1}`,
                controls: response.controls || {},
                colors: response.colors || {},
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

    // Select the slot first via DAW port (if available)
    await this.selectSlot(slot);

    const modeData = {
      slot,
      name: mode.name,
      controls: mode.controls,
      colors: mode.colors,
    };

    const validatedModeData = this.validateCustomModeData(modeData);
    const message = SysExParser.buildCustomModeWriteRequest(slot, validatedModeData);
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
   * Validate device inquiry response with proper type checking
   */
  private validateDeviceInquiryResponse(response: unknown): DeviceInquiryResponse {
    const schema = z.object({
      type: z.literal('device_inquiry_response'),
      manufacturerId: z.array(z.number().min(0).max(127)),
      deviceFamily: z.number().optional(),
      deviceModel: z.number().optional(),
      familyCode: z.number().optional(),
      familyMember: z.number().optional(),
      firmwareVersion: z.array(z.number()).optional(),
      softwareRevision: z.array(z.number()).optional(),
      serialNumber: z.union([z.string(), z.array(z.number())]).optional(),
    });

    try {
      const validated = schema.parse(response);
      // Ensure serialNumber is in the correct format (number array)
      const serialNumberArray = validated.serialNumber
        ? (typeof validated.serialNumber === 'string'
          ? validated.serialNumber.split('').map(c => c.charCodeAt(0))
          : validated.serialNumber)
        : undefined;

      const result: DeviceInquiryResponse = {
        manufacturerId: validated.manufacturerId,
        deviceFamily: validated.deviceFamily ?? validated.familyCode ?? 0,
        deviceModel: validated.deviceModel ?? validated.familyMember ?? 0,
        firmwareVersion: validated.firmwareVersion ?? validated.softwareRevision ?? [],
        ...(serialNumberArray ? { serialNumber: serialNumberArray } : {}),
        // Include optional properties
        ...(validated.familyCode !== undefined ? { familyCode: validated.familyCode } : {}),
        ...(validated.familyMember !== undefined ? { familyMember: validated.familyMember } : {}),
        ...(validated.softwareRevision !== undefined ? { softwareRevision: validated.softwareRevision } : {}),
      };

      return result;
    } catch (error) {
      throw new Error(`Invalid device inquiry response format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate device info with proper typing
   */
  private validateDeviceInfo(info: unknown): LaunchControlXL3Info {
    const schema = z.object({
      manufacturerId: z.string(),
      deviceFamily: z.number(),
      modelNumber: z.number(),
      firmwareVersion: z.string(),
      serialNumber: z.string().optional(),
      deviceName: z.string().optional(),
      portInfo: z.any().optional(), // MidiPortInfo type is complex, allow any for now
    });

    try {
      const validated = schema.parse(info);
      // Construct object with only defined optional properties
      const result: LaunchControlXL3Info = {
        manufacturerId: validated.manufacturerId,
        deviceFamily: validated.deviceFamily,
        modelNumber: validated.modelNumber,
        firmwareVersion: validated.firmwareVersion,
        ...(validated.serialNumber !== undefined && { serialNumber: validated.serialNumber }),
        ...(validated.deviceName !== undefined && { deviceName: validated.deviceName }),
        ...(validated.portInfo !== undefined && { portInfo: validated.portInfo }),
      };

      return result;
    } catch (error) {
      throw new Error(`Invalid device info format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate custom mode response with type guards
   */
  private validateCustomModeResponse(response: unknown): { slot?: number; name?: string; controls?: any; colors?: any } {
    const schema = z.object({
      type: z.literal('custom_mode_response'),
      slot: z.number().min(0).max(15).optional(),
      name: z.string().optional(),
      controls: z.any().optional(), // Complex type, validate separately
      colors: z.any().optional(),
    });

    try {
      const validated = schema.parse(response);
      const result: { slot?: number; name?: string; controls?: any; colors?: any } = {};

      if (validated.slot !== undefined) {
        result.slot = validated.slot;
      }
      if (validated.name !== undefined) {
        result.name = validated.name;
      }
      if (validated.controls !== undefined) {
        result.controls = validated.controls;
      }
      if (validated.colors !== undefined) {
        result.colors = validated.colors;
      }

      return result;
    } catch (error) {
      throw new Error(`Invalid custom mode response format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate custom mode data before sending
   */
  private validateCustomModeData(data: unknown): any {
    const schema = z.object({
      slot: z.number().min(0).max(15),
      name: z.string(),
      controls: z.any(),
      colors: z.any(),
    });

    try {
      return schema.parse(data);
    } catch (error) {
      throw new Error(`Invalid custom mode data format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate template change response with type guards
   */
  private validateTemplateChangeResponse(response: unknown): { templateNumber: number } {
    const schema = z.object({
      type: z.literal('template_change'),
      templateNumber: z.number().min(0).max(15),
    });

    try {
      return schema.parse(response);
    } catch (error) {
      throw new Error(`Invalid template change response format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize DAW port for slot selection
   */
  private async initializeDawPort(): Promise<void> {
    try {
      // Try to open DAW output port for slot selection
      // Use the correct port name pattern: "LCXL3 1 DAW In"
      await this.midi.openDawOutput('LCXL3 1 DAW In');

      // Create DAW port controller
      this.dawPortController = new DawPortControllerImpl(
        async (message: number[]) => {
          await this.midi.sendDawMessage(message);
        }
      );
    } catch (error) {
      console.warn('DAW port initialization failed (slot selection will not work):', error);
      // Don't throw - DAW port is optional, device can still work without it
    }
  }

  /**
   * Select slot before write operations (if DAW port is available)
   */
  private async selectSlot(slot: number): Promise<void> {
    if (this.dawPortController) {
      await this.dawPortController.selectSlot(slot);
    }
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