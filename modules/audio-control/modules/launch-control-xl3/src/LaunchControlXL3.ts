/**
 * Launch Control XL 3 - Main Controller Class
 *
 * High-level interface for interacting with the Novation Launch Control XL 3
 * hardware controller. Provides a unified API for device management, control
 * mapping, LED control, and custom modes.
 */

import { EventEmitter } from 'eventemitter3';
import type { Logger } from './core/Logger.js';
import { ConsoleLogger } from './core/Logger.js';
import { MidiBackendInterface, MidiMessage } from './core/MidiInterface.js';
import { DeviceManager, DeviceStatus } from './device/DeviceManager.js';
import { CustomModeManager, CONTROL_IDS, LED_COLORS } from './modes/CustomModeManager.js';
import { ControlMapper, ValueTransformers } from './mapping/ControlMapper.js';
import {
  LaunchControlXL3Info,
  CustomMode,
  CustomModeSlot,
  ControlMapping,
  ControlType,
  MidiChannel,
  CCNumber,
} from './types/index.js';

export interface LaunchControlXL3Options {
  midiBackend?: MidiBackendInterface;
  logger?: Logger;
  enableCustomModes?: boolean;
  enableValueSmoothing?: boolean;
  smoothingFactor?: number;
  deviceNameFilter?: string;
  reconnectOnError?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface LaunchControlXL3Events {
  // Device events
  'device:connected': (device: LaunchControlXL3Info) => void;
  'device:disconnected': (reason?: string) => void;
  'device:ready': () => void;
  'device:error': (error: Error) => void;

  // Control events
  'control:change': (controlId: string, value: number, channel?: number) => void;
  'control:mapped': (controlId: string, mapping: ControlMapping) => void;

  // MIDI events
  'midi:in': (message: MidiMessage) => void;
  'midi:out': (message: MidiMessage) => void;

  // Mode events
  'mode:changed': (slot: number, mode: CustomMode) => void;
  'mode:loaded': (slot: number, mode: CustomMode) => void;
  'mode:saved': (slot: number, mode: CustomMode) => void;
}

/**
 * Main Launch Control XL 3 Controller
 */
export class LaunchControlXL3 extends EventEmitter {
  private options: Required<Omit<LaunchControlXL3Options, 'midiBackend' | 'logger'>> & {
    midiBackend?: MidiBackendInterface | undefined;
    logger?: Logger | undefined;
  };
  private readonly logger: Logger;
  private deviceManager: DeviceManager;
  private customModeManager?: CustomModeManager | undefined;
  private controlMapper: ControlMapper;
  private isInitialized = false;
  private currentMode?: CustomMode | undefined;
  private currentSlot?: CustomModeSlot | undefined;

  // Public static exports
  static readonly CONTROL_IDS = CONTROL_IDS;
  static readonly LED_COLORS = LED_COLORS;
  static readonly ValueTransformers = ValueTransformers;

  constructor(options: LaunchControlXL3Options = {}) {
    super();

    this.logger = options.logger ?? new ConsoleLogger({ prefix: 'LaunchControlXL3' });

    this.options = {
      midiBackend: options.midiBackend,
      logger: options.logger,
      enableCustomModes: options.enableCustomModes ?? true,
      enableValueSmoothing: options.enableValueSmoothing ?? false,
      smoothingFactor: options.smoothingFactor ?? 3,
      deviceNameFilter: options.deviceNameFilter ?? 'Launch Control XL',
      reconnectOnError: options.reconnectOnError ?? true,
      reconnectDelay: options.reconnectDelay ?? 2000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };

    // Initialize core components
    this.deviceManager = new DeviceManager({
      midiBackend: this.options.midiBackend,
      autoConnect: false,
      deviceNameFilter: this.options.deviceNameFilter,
      retryAttempts: this.options.maxReconnectAttempts,
      retryDelay: this.options.reconnectDelay,
    });

    this.controlMapper = new ControlMapper({
      enableValueSmoothing: this.options.enableValueSmoothing,
      smoothingFactor: this.options.smoothingFactor,
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to device
   *
   * Automatically initializes the controller if needed.
   */
  async connect(): Promise<void> {
    this.logger.info('Connecting to device...');

    // Initialize if needed
    if (!this.isInitialized) {
      try {
        this.logger.debug('Initializing device manager...');
        await this.deviceManager.initialize();
        this.isInitialized = true;
        this.logger.debug('Device manager initialized');
      } catch (error) {
        this.logger.error('Failed to initialize device manager:', (error as Error).message);
        this.emit('device:error', error as Error);
        throw error;
      }
    }

    try {
      await this.deviceManager.connect();

      this.logger.info('Device connected successfully');

      // Initialize optional components after connection
      if (this.options.enableCustomModes) {
        this.logger.debug('Initializing custom mode manager...');
        this.customModeManager = new CustomModeManager({
          deviceManager: this.deviceManager,
          autoSync: true,
        });
      }

      // Load default mappings
      this.loadDefaultMappings();

      this.logger.info('Device ready');
      this.emit('device:ready');
    } catch (error) {
      this.logger.error('Connection failed:', (error as Error).message);
      this.emit('device:error', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from device...');

    await this.deviceManager.disconnect();

    if (this.customModeManager) {
      this.customModeManager.cleanup();
      this.customModeManager = undefined;
    }

    this.controlMapper.resetAll();
    this.currentMode = undefined;
    this.currentSlot = undefined;

    this.logger.info('Disconnected from device');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Device events

    this.deviceManager.on('device:connected', (device) => {
      this.logger.debug('Device connected event received', device);
      this.emit('device:connected', device);
    });

    this.deviceManager.on('device:disconnected', (reason) => {
      this.logger.info('Device disconnected', reason ? `Reason: ${reason}` : '');
      this.emit('device:disconnected', reason);
    });

    this.deviceManager.on('device:error', (error: Error) => {
      this.handleError(error);
    });

    // Control events
    this.deviceManager.on('control:change', (controlId: string, value: number, channel) => {
      // Process through control mapper
      const message = this.controlMapper.processControlValue(controlId, value);

      if (message) {
        this.emit('midi:out', message);
      }

      this.emit('control:change', controlId, value, channel);
    });

    // Control mapper events
    this.controlMapper.on('control:mapped', (controlId, mapping) => {
      this.emit('control:mapped', controlId, mapping);
    });

    this.controlMapper.on('midi:out', (message) => {
      this.emit('midi:out', message);
    });

    // Custom mode events
    if (this.customModeManager) {
      this.customModeManager.on('mode:loaded', (slot, mode) => {
        this.emit('mode:loaded', slot, mode);
      });

      this.customModeManager.on('mode:saved', (slot, mode) => {
        this.emit('mode:saved', slot, mode);
      });
    }


    // MIDI input events
    this.deviceManager.on('sysex:received', (data) => {
      this.emit('midi:in', {
        type: 'sysex',
        data,
      });
    });
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.logger.error('Error:', error.message);
    this.emit('device:error', error);

    // Attempt reconnection if enabled
    if (this.options.reconnectOnError && this.isInitialized) {
      this.logger.info(`Attempting reconnection in ${this.options.reconnectDelay}ms...`);
      setTimeout(() => {
        this.connect().catch((e) => {
          this.logger.error('Reconnection failed:', e.message);
        });
      }, this.options.reconnectDelay);
    }
  }

  /**
   * Load default control mappings
   */
  private loadDefaultMappings(): void {
    const defaultMappings = ControlMapper.createDefaultMappings();

    for (const [controlId, mapping] of defaultMappings.entries()) {
      const type = mapping.type ?? mapping.controlType ?? 'knob';
      this.controlMapper.mapControl(controlId, type as ControlType, mapping);
    }
  }

  // ============================================
  // Custom Mode Management
  // ============================================

  /**
   * Load a custom mode
   */
  async loadCustomMode(slot: CustomModeSlot): Promise<CustomMode> {
    if (!this.customModeManager) {
      throw new Error('Custom modes not enabled');
    }

    const mode = await this.customModeManager.readMode(slot);

    // Apply control mappings
    this.controlMapper.loadFromCustomMode(mode);


    this.currentMode = mode;
    this.currentSlot = slot;

    this.emit('mode:changed', slot, mode);

    return mode;
  }

  /**
   * Save a custom mode
   */
  async saveCustomMode(slot: CustomModeSlot, mode: CustomMode): Promise<void> {
    if (!this.customModeManager) {
      throw new Error('Custom modes not enabled');
    }

    await this.customModeManager.writeMode(slot, mode);
  }

  /**
   * Create a new custom mode
   */
  createCustomMode(name?: string): CustomMode {
    if (!this.customModeManager) {
      throw new Error('Custom modes not enabled');
    }

    return this.customModeManager.createDefaultMode(name);
  }

  /**
   * Read a custom mode from the device
   * @param slot - Slot number (0-14 for slots 1-15)
   * @returns Promise resolving to the custom mode or null if slot is empty
   */
  async readCustomMode(slot: number): Promise<CustomMode | null> {
    if (!this.isConnected()) {
      throw new Error('Device is not connected');
    }
    return this.deviceManager.readCustomMode(slot);
  }

  /**
   * Write a custom mode to the device
   * @param slot - Slot number (0-14 for slots 1-15)
   * @param mode - Custom mode to write
   */
  async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Device is not connected');
    }
    return this.deviceManager.writeCustomMode(slot, mode);
  }

  /**
   * Export current mappings as custom mode
   */
  exportCurrentAsCustomMode(name: string): CustomMode {
    const controls = this.controlMapper.exportToCustomMode();

    const leds = new Map<number, { color: number; behaviour: string }>();

    return {
      name,
      controls,
      leds,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date(),
      },
    };
  }

  // ============================================
  // Control Mapping
  // ============================================

  /**
   * Map a control
   */
  mapControl(
    controlId: string,
    channel: MidiChannel,
    cc: CCNumber,
    options?: Partial<ControlMapping>,
  ): void {
    const controlType = this.getControlType(controlId);
    const mapping: ControlMapping = {
      type: controlType,
      channel,
      cc,
      min: options?.min ?? 0,
      max: options?.max ?? 127,
      behaviour: options?.behaviour ?? 'absolute',
      ...(options?.transform && { transform: options.transform }),
    };

    this.controlMapper.mapControl(controlId, controlType ?? 'knob', mapping);
  }

  /**
   * Unmap a control
   */
  unmapControl(controlId: string): void {
    this.controlMapper.unmapControl(controlId);
  }

  /**
   * Get control mapping
   */
  getControlMapping(controlId: string): ControlMapping | undefined {
    const mapped = this.controlMapper.getMapping(controlId);
    return mapped?.mapping;
  }

  /**
   * Update control mapping
   */
  updateControlMapping(controlId: string, updates: Partial<ControlMapping>): void {
    this.controlMapper.updateMapping(controlId, updates);
  }


  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get control type from control ID
   */
  private getControlType(controlId: string): 'knob' | 'fader' | 'button' {
    if (controlId.includes('SEND') || controlId.includes('PAN')) {
      return 'knob';
    } else if (controlId.includes('FADER')) {
      return 'fader';
    } else {
      return 'button';
    }
  }

  /**
   * Send raw MIDI message
   */
  async sendMidi(message: MidiMessage): Promise<void> {
    await this.deviceManager.sendCC(
      message.controller ?? 0,
      message.value ?? 0,
      message.channel ?? 0,
    );
  }

  /**
   * Send SysEx message
   */
  async sendSysEx(data: number[]): Promise<void> {
    await this.deviceManager.sendSysEx(data);
  }

  /**
   * Select template
   */
  async selectTemplate(slot: number): Promise<void> {
    await this.deviceManager.selectTemplate(slot);
  }

  /**
   * Get device status
   */
  getStatus(): DeviceStatus {
    return this.deviceManager.getStatus();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    const status = this.getStatus();
    return status.connected;
  }

  /**
   * Get current mode
   */
  getCurrentMode(): CustomMode | undefined {
    return this.currentMode;
  }

  /**
   * Get current slot
   */
  getCurrentSlot(): CustomModeSlot | undefined {
    return this.currentSlot;
  }

  /**
   * Verify device identity and retrieve hardware information
   * @returns Device information
   * @throws Error if not connected or handshake fails
   */
  async verifyDevice(): Promise<LaunchControlXL3Info> {
    if (!this.isConnected()) {
      throw new Error('Device not connected. Call connect() first before verifying device.');
    }

    const status = this.getStatus();
    if (!status.deviceInfo) {
      throw new Error(
        'Device connected but device information not available. Device handshake may have failed.',
      );
    }

    // Return the existing device info since the device is already connected and verified
    // The handshake has already been performed during connect()
    return status.deviceInfo;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resources...');
    await this.disconnect();
    await this.deviceManager.cleanup();
    this.controlMapper.cleanup();
    this.removeAllListeners();
    this.isInitialized = false;
    this.logger.info('Cleanup complete');
  }
}

// Export everything for convenience
export * from './types/index.js';

export default LaunchControlXL3;
