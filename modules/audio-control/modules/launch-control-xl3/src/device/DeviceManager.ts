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
  private dawMidi: MidiInterface; // Separate MIDI interface for DAW communication
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

  // Write acknowledgement handling (persistent listener approach)
  private pendingAcknowledgements = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

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
    this.dawMidi = new MidiInterface(this.options.midiBackend); // Separate instance for DAW communication
    this.setupMidiHandlers();
  }

  /**
   * Initialize the device manager and optionally connect to device
   */
  async initialize(): Promise<void> {
    try {
      await this.midi.initialize();
      await this.dawMidi.initialize(); // Initialize DAW MIDI interface

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
   * Wait for write acknowledgement from device (persistent listener pattern)
   *
   * Discovery: Playwright + CoreMIDI spy (2025-09-30)
   * Device sends acknowledgement SysEx after receiving each page write:
   * Format: F0 00 20 29 02 15 05 00 15 [page] [status] F7
   * Example: F0 00 20 29 02 15 05 00 15 00 06 F7 (page 0, status 0x06 success)
   *
   * CRITICAL: Uses persistent listener set up during handshake.
   * Registers promise in queue; acknowledgement handler resolves it.
   * This avoids race conditions from rapid device responses (24-27ms).
   *
   * @param expectedPage - Page number to wait acknowledgement for (0 or 3)
   * @param timeoutMs - Timeout in milliseconds (typical ACK arrives within 24-27ms)
   */
  private async waitForWriteAcknowledgement(expectedPage: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAcknowledgements.delete(expectedPage);
        reject(new Error(`Write acknowledgement timeout for page ${expectedPage} after ${timeoutMs}ms`));
      }, timeoutMs);

      // Register in queue - persistent listener will route acknowledgement here
      this.pendingAcknowledgements.set(expectedPage, { resolve, reject, timeout });
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

    // CRITICAL: SysEx listener must ALWAYS be active (persistent connection)
    // Acknowledgements and other responses can arrive during ANY state
    this.midi.on('sysex', (message: MidiMessage) => {
      // Always handle SysEx messages for acknowledgements/responses
      this.handleSysExMessage([...message.data]);

      // Only emit event when fully connected (not during handshake)
      if (!this.isInitializing && this.connectionState === 'connected') {
        this.emit('sysex:received', message.data);
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

        case 'write_acknowledgement':
          // Route acknowledgement to pending promise (persistent listener pattern)
          const ack = parsed as any; // WriteAcknowledgementMessage
          const pending = this.pendingAcknowledgements.get(ack.page);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingAcknowledgements.delete(ack.page);
            if (ack.status === 0x06) {
              pending.resolve();
            } else {
              pending.reject(new Error(`Write failed for page ${ack.page}: status 0x${ack.status.toString(16)}`));
            }
          }
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

    // Validate SysEx message format
    if (!data || data.length < 2) {
      throw new Error('Invalid SysEx message: too short');
    }

    if (data[0] !== 0xF0) {
      throw new Error(`Invalid SysEx message: must start with 0xF0, got 0x${data[0]?.toString(16)}`);
    }

    if (data[data.length - 1] !== 0xF7) {
      throw new Error(`Invalid SysEx message: must end with 0xF7, got 0x${data[data.length - 1]?.toString(16)}`);
    }

    // Ensure all bytes between F0 and F7 are 7-bit values
    for (let i = 1; i < data.length - 1; i++) {
      const byte = data[i];
      if (byte === undefined || byte > 127 || byte < 0) {
        throw new Error(`Invalid SysEx message: byte ${i} value 0x${byte?.toString(16)} is not a valid 7-bit value`);
      }
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
   * Read custom mode from device (fetches both pages)
   */
  async readCustomMode(slot: number): Promise<CustomMode> {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    // TEMPORARY: Testing if SysEx slot byte works without DAW port
    // await this.selectSlot(slot);

    // Helper function to read a single page
    const readPage = (page: number): Promise<any> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.midi.removeListener('sysex', handleResponse);
          reject(new Error(
            `Custom mode read timeout after ${this.options.inquiryTimeout}ms for slot ${slot}, page ${page}. ` +
            'The device may be unresponsive or the slot may be empty.'
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
                resolve(response);
              }
            } catch {
              // Ignore parse errors
            }
          }
        };

        this.midi.on('sysex', handleResponse);

        // Send custom mode read request for this page
        const message = SysExParser.buildCustomModeReadRequest(slot, page);
        this.sendSysEx(message).catch(reject);
      });
    };

    try {
      // Read pages SEQUENTIALLY (not in parallel) to match web editor behavior
      // Web editor analysis shows device expects sequential requests:
      // 1. Send page 0 request
      // 2. Wait for page 0 response
      // 3. Send page 1 request (no ACK needed)
      // 4. Wait for page 1 response
      const page0Response = await readPage(0); // Page 0: Controls 0x10-0x27 (encoders)
      const page1Response = await readPage(1); // Page 1: Controls 0x28-0x3F (faders/buttons)

      // Combine the responses from both pages
      // Note: responses contain arrays that need to be combined
      const page0Controls = Array.isArray(page0Response.controls) ? page0Response.controls : [];
      const page1Controls = Array.isArray(page1Response.controls) ? page1Response.controls : [];
      const allControls = [...page0Controls, ...page1Controls];

      const page0Colors = Array.isArray(page0Response.colors) ? page0Response.colors : [];
      const page1Colors = Array.isArray(page1Response.colors) ? page1Response.colors : [];
      const allColors = [...page0Colors, ...page1Colors];

      // Extract labels from control objects into a Map
      const allLabels = new Map<number, string>();
      for (const control of allControls) {
        if (control.name && control.controlId !== undefined) {
          allLabels.set(control.controlId, control.name);
        }
      }

      // Convert arrays to Record format expected by CustomMode type
      // Use control_XX format to match CustomModeBuilder.build()
      // Normalize property names to match Control interface
      const controlsRecord: Record<string, any> = {};
      for (const control of allControls) {
        // Derive controlType from controlId if not present (parser doesn't extract this field)
        let controlType = control.controlType ?? control.type;
        if (controlType === undefined && control.controlId !== undefined) {
          controlType = this.deriveControlType(control.controlId);
        }

        // Ensure consistent property names (handle ControlMapping alternatives)
        const normalizedControl = {
          controlId: control.controlId,
          controlType,
          midiChannel: control.channel ?? control.midiChannel,
          ccNumber: control.ccNumber ?? control.cc,
          minValue: control.minValue ?? control.min ?? 0,
          maxValue: control.maxValue ?? control.max ?? 127,
          behavior: (control.behaviour ?? control.behavior ?? 'absolute') as any
        };
        controlsRecord[`control_${control.controlId}`] = normalizedControl;
      }

      // Convert colors array to Map format expected by CustomMode type
      const colorsMap = new Map<number, number>();
      for (const colorMapping of allColors) {
        if (colorMapping.controlId !== undefined) {
          colorsMap.set(colorMapping.controlId, colorMapping.color);
        }
      }

      // Use the name from the first page (they should be the same)
      const name = page0Response.name || page1Response.name || `Custom ${slot + 1}`;

      return {
        slot: page0Response.slot ?? slot,
        name,
        controls: controlsRecord,
        colors: colorsMap,
        labels: allLabels,
      };
    } catch (error) {
      // If we fail to read both pages, try reading just page 0 for backward compatibility
      try {
        const page0Response = await readPage(0);
        const controls = Array.isArray(page0Response.controls) ? page0Response.controls : [];
        const colors = Array.isArray(page0Response.colors) ? page0Response.colors : [];

        const controlsRecord: Record<string, any> = {};
        for (const control of controls) {
          // Derive controlType from controlId if not present (parser doesn't extract this field)
          let controlType = control.controlType ?? control.type;
          if (controlType === undefined && control.controlId !== undefined) {
            controlType = this.deriveControlType(control.controlId);
          }

          // Ensure consistent property names (handle ControlMapping alternatives)
          const normalizedControl = {
            controlId: control.controlId,
            controlType,
            midiChannel: control.midiChannel ?? control.channel,
            ccNumber: control.ccNumber ?? control.cc,
            minValue: control.minValue ?? control.min ?? 0,
            maxValue: control.maxValue ?? control.max ?? 127,
            behavior: (control.behavior ?? control.behaviour ?? 'absolute') as any
          };
          controlsRecord[`control_${control.controlId}`] = normalizedControl;
        }

        const colorsMap = new Map<number, number>();
        for (const colorMapping of colors) {
          if (colorMapping.controlId !== undefined) {
            colorsMap.set(colorMapping.controlId, colorMapping.color);
          }
        }

        return {
          slot: page0Response.slot ?? slot,
          name: page0Response.name || `Custom ${slot + 1}`,
          controls: controlsRecord,
          colors: colorsMap,
        };
      } catch {
        throw error; // Re-throw the original error
      }
    }
  }

  /**
   * Write custom mode to device
   */
  async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    // TEMPORARY: Testing if SysEx slot byte works without DAW port
    // await this.selectSlot(slot);

    const modeData = {
      slot,
      name: mode.name,
      controls: mode.controls,
      colors: mode.colors,
      labels: mode.labels,
    };

    const validatedModeData = this.validateCustomModeData(modeData);

    // CRITICAL: Web editor always writes ALL 48 controls (0x10-0x3F)
    // If a control is not in the mode data, it must still be written with empty/default values
    // Otherwise the device will leave those controls in an undefined state
    const existingControlIds = new Set(validatedModeData.controls.map((c: any) => c.controlId));

    // Add missing controls with CH0/CC0 (empty/unconfigured state)
    for (let controlId = 0x10; controlId <= 0x3F; controlId++) {
      if (!existingControlIds.has(controlId)) {
        const controlType = this.deriveControlType(controlId);
        validatedModeData.controls.push({
          controlId,
          controlType,
          midiChannel: 0,
          ccNumber: 0,
          minValue: 0,
          maxValue: 127,
          behavior: 'absolute'
        });
      }
    }

    // CRITICAL: Write protocol requires TWO pages (verified from web editor MIDI captures)
    // Page 0: Mode name + controls 0x10-0x27 (IDs 16-39, first 24 controls)
    // Page 3: Mode name + controls 0x28-0x3F (IDs 40-63, remaining 24 controls)
    // Note: Control IDs 0x00-0x0F do not exist on the device

    // Split controls by page
    const page0Controls = validatedModeData.controls.filter((c: any) => {
      const id = c.id ?? c.controlId;
      return id >= 0x10 && id <= 0x27;
    });

    const page3Controls = validatedModeData.controls.filter((c: any) => {
      const id = c.id ?? c.controlId;
      return id >= 0x28 && id <= 0x3F;
    });

    // Split labels by page
    const page0Labels = new Map<number, string>();
    const page3Labels = new Map<number, string>();

    if (validatedModeData.labels) {
      for (const [controlId, label] of validatedModeData.labels.entries()) {
        if (controlId >= 0x10 && controlId <= 0x27) {
          page0Labels.set(controlId, label);
        } else if (controlId >= 0x28 && controlId <= 0x3F) {
          page3Labels.set(controlId, label);
        }
      }
    }

    // Send page 0
    const page0Data = { ...validatedModeData, controls: page0Controls, labels: page0Labels };
    const page0Message = SysExParser.buildCustomModeWriteRequest(0, page0Data);
    await this.sendSysEx(page0Message);

    // CRITICAL: Wait for device acknowledgement before sending next page
    // Discovery: Playwright + CoreMIDI spy (2025-09-30)
    // Device sends ACK (0x15 00 06) within 24-27ms after receiving page 0
    await this.waitForWriteAcknowledgement(0, 100); // Wait up to 100ms for page 0 ACK

    // Send page 3 (only if there are controls in this range)
    if (page3Controls.length > 0) {
      const page3Data = { ...validatedModeData, controls: page3Controls, labels: page3Labels };
      const page3Message = SysExParser.buildCustomModeWriteRequest(3, page3Data);
      await this.sendSysEx(page3Message);

      // Wait for page 3 acknowledgement
      // WORKAROUND: JUCE backend sometimes doesn't forward page 3 ACKs immediately
      // Device sends ACK within 24-80ms, but backend may delay delivery
      await this.waitForWriteAcknowledgement(3, 2000); // Wait up to 2000ms for page 3 ACK
    }

    // Allow device time to process and persist the write
    await new Promise(resolve => setTimeout(resolve, 50));
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
  private validateCustomModeResponse(response: unknown): { slot?: number; name?: string; controls?: any; colors?: any; labels?: any } {
    const schema = z.object({
      type: z.literal('custom_mode_response'),
      slot: z.number().min(0).max(15).optional(),
      name: z.string().optional(),
      controls: z.any().optional(), // Complex type, validate separately
      colors: z.any().optional(),
      labels: z.any().optional(),
    });

    try {
      const validated = schema.parse(response);
      const result: { slot?: number; name?: string; controls?: any; colors?: any; labels?: any } = {};

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
      if (validated.labels !== undefined) {
        result.labels = validated.labels;
      }

      return result;
    } catch (error) {
      throw new Error(`Invalid custom mode response format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert CustomMode to CustomModeMessage format and validate
   */
  private validateCustomModeData(data: { slot: number; name: string; controls: any; colors: any; labels?: any }): any {
    // Convert controls from Record<string, ControlMapping> to Control[]
    const controls: any[] = [];
    if (data.controls && typeof data.controls === 'object') {
      for (const [key, controlMapping] of Object.entries(data.controls)) {
        const mapping = controlMapping as any;

        // Convert ControlMapping to Control format
        const control = {
          controlId: mapping.controlId ?? parseInt(key.replace('control_', ''), 10) ?? 0,
          controlType: mapping.controlType ?? mapping.type ?? 0x05,
          // Both midiChannel and channel are 0-based, no conversion needed
          midiChannel: mapping.midiChannel ?? mapping.channel ?? 0,
          ccNumber: mapping.ccNumber ?? mapping.cc ?? 0,
          minValue: mapping.minValue ?? mapping.min ?? 0,
          maxValue: mapping.maxValue ?? mapping.max ?? 127,
          behavior: mapping.behavior ?? mapping.behaviour ?? 'absolute'
        };

        controls.push(control);
      }
    }

    // Convert colors from Map<number, Color> to ColorMapping[]
    const colors: any[] = [];
    if (data.colors) {
      if (data.colors instanceof Map) {
        for (const [controlId, color] of data.colors.entries()) {
          colors.push({
            controlId,
            color: typeof color === 'number' ? color : 0x0C,
            behaviour: 'static'
          });
        }
      } else if (Array.isArray(data.colors)) {
        colors.push(...data.colors);
      }
    }

    const converted = {
      slot: data.slot,
      name: data.name,
      controls,
      colors,
      labels: data.labels
    };

    // Basic validation
    if (converted.slot < 0 || converted.slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }
    if (!converted.name || typeof converted.name !== 'string') {
      throw new Error('Custom mode name is required');
    }
    if (!Array.isArray(converted.controls)) {
      throw new Error('Custom mode must have controls array');
    }
    if (!Array.isArray(converted.colors)) {
      throw new Error('Custom mode must have colors array');
    }

    return converted;
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
   * Initialize DAW port for slot selection using separate MIDI interface
   */
  private async initializeDawPort(): Promise<void> {
    try {
      console.log('[DeviceManager] Initializing DAW port using separate MIDI interface...');

      // Open DAW output port using separate MIDI interface
      await this.dawMidi.openOutput('LCXL3 1 DAW In');
      console.log('[DeviceManager] DAW output port opened successfully');

      // Try to open DAW input for bidirectional communication
      // This may fail on some backends, so we handle it gracefully
      let waitForMessageFunc: ((predicate: (data: number[]) => boolean, timeout: number) => Promise<number[]>) | undefined;

      try {
        console.log('[DeviceManager] Attempting to open DAW input port...');
        await this.dawMidi.openInput('LCXL3 1 DAW Out');
        console.log('[DeviceManager] DAW input port opened successfully');
        waitForMessageFunc = async (predicate: (data: number[]) => boolean, timeout: number) => {
          return this.waitForDawMessage(predicate, timeout);
        };
      } catch (inputError) {
        console.warn('DAW input port not available - response handling disabled:', inputError);
        // Continue without input port - output-only mode
      }

      console.log('[DeviceManager] Creating DAW port controller...');
      // Create DAW port controller using the separate MIDI interface
      this.dawPortController = new DawPortControllerImpl(
        async (message: number[]) => {
          console.log('[DeviceManager] Sending DAW message via separate MIDI interface');
          await this.dawMidi.sendMessage(message);
        },
        waitForMessageFunc  // May be undefined if input port failed
      );
      console.log('[DeviceManager] DAW port controller created successfully');
    } catch (error) {
      console.error('DAW port initialization failed - device will not function properly:', error);
      throw new Error(`Failed to initialize DAW port: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Wait for a DAW port message matching the predicate
   */
  private async waitForDawMessage(predicate: (data: number[]) => boolean, timeout: number): Promise<number[]> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('DAW message timeout'));
        }
      }, timeout);

      // Set up message listener on DAW input
      const handler = (message: any) => {
        if (!resolved && predicate(message.data)) {
          resolved = true;
          clearTimeout(timeoutId);
          this.dawMidi.off('message', handler);
          resolve(Array.from(message.data));
        }
      };

      this.dawMidi.on('message', handler);
    });
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
   * Derive controlType from controlId based on hardware layout
   * The parser doesn't extract this field, so we derive it from the ID
   */
  private deriveControlType(controlId: number): number {
    if (controlId >= 0x10 && controlId <= 0x17) {
      return 0x05; // Top row encoders
    } else if (controlId >= 0x18 && controlId <= 0x1F) {
      return 0x09; // Middle row encoders
    } else if (controlId >= 0x20 && controlId <= 0x27) {
      return 0x0D; // Bottom row encoders
    } else if (controlId >= 0x28 && controlId <= 0x2F) {
      return 0x09; // Faders
    } else if (controlId >= 0x30 && controlId <= 0x37) {
      return 0x19; // Side buttons (track focus)
    } else if (controlId >= 0x38 && controlId <= 0x3F) {
      return 0x25; // Bottom buttons (track control)
    }
    return 0x00; // Default/unknown
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.clearTimers();
    await this.disconnect();
    await this.midi.cleanup();
    await this.dawMidi.cleanup(); // Clean up DAW MIDI interface
    this.removeAllListeners();
  }
}

export default DeviceManager;