/**
 * Custom Mode Manager for Launch Control XL 3
 *
 * Handles reading, writing, and managing custom mode configurations
 * for the Launch Control XL 3 device. Each custom mode defines how
 * controls map to MIDI messages and LED states.
 */

import { EventEmitter } from 'eventemitter3';
import { DeviceManager } from '../device/DeviceManager.js';
import { ControlMapping, ColorMapping } from '../types/CustomMode.js';
import {
  CustomMode,
  CustomModeSlot,
  ControlBehaviour,
  ControlType
} from '../types/index.js';

export interface CustomModeManagerOptions {
  deviceManager: DeviceManager;
  autoSync?: boolean;
  cacheTimeout?: number;
}

export interface CustomModeEvents {
  'mode:loaded': (slot: number, mode: CustomMode) => void;
  'mode:saved': (slot: number, mode: CustomMode) => void;
  'mode:error': (error: Error) => void;
  'cache:updated': (slot: number) => void;
  'cache:cleared': () => void;
}

/**
 * Control ID mapping for Launch Control XL 3
 */
export const CONTROL_IDS = {
  // Send A knobs (top row)
  SEND_A1: 0x0D, SEND_A2: 0x0E, SEND_A3: 0x0F, SEND_A4: 0x10,
  SEND_A5: 0x11, SEND_A6: 0x12, SEND_A7: 0x13, SEND_A8: 0x14,

  // Send B knobs (middle row)
  SEND_B1: 0x1D, SEND_B2: 0x1E, SEND_B3: 0x1F, SEND_B4: 0x20,
  SEND_B5: 0x21, SEND_B6: 0x22, SEND_B7: 0x23, SEND_B8: 0x24,

  // Pan/Device knobs (bottom row)
  PAN1: 0x31, PAN2: 0x32, PAN3: 0x33, PAN4: 0x34,
  PAN5: 0x35, PAN6: 0x36, PAN7: 0x37, PAN8: 0x38,

  // Faders
  FADER1: 0x4D, FADER2: 0x4E, FADER3: 0x4F, FADER4: 0x50,
  FADER5: 0x51, FADER6: 0x52, FADER7: 0x53, FADER8: 0x54,

  // Track focus buttons
  FOCUS1: 0x29, FOCUS2: 0x2A, FOCUS3: 0x2B, FOCUS4: 0x2C,
  FOCUS5: 0x2D, FOCUS6: 0x2E, FOCUS7: 0x2F, FOCUS8: 0x30,

  // Track control buttons
  CONTROL1: 0x39, CONTROL2: 0x3A, CONTROL3: 0x3B, CONTROL4: 0x3C,
  CONTROL5: 0x3D, CONTROL6: 0x3E, CONTROL7: 0x3F, CONTROL8: 0x40,

  // Side buttons
  DEVICE: 0x69, MUTE: 0x6A, SOLO: 0x6B, RECORD: 0x6C,
  UP: 0x68, DOWN: 0x6D, LEFT: 0x6E, RIGHT: 0x6F,
} as const;

/**
 * LED color values for Launch Control XL 3
 */
export const LED_COLORS = {
  OFF: 0x0C,
  RED_LOW: 0x0D,
  RED_FULL: 0x0F,
  AMBER_LOW: 0x1D,
  AMBER_FULL: 0x3F,
  YELLOW: 0x3E,
  GREEN_LOW: 0x1C,
  GREEN_FULL: 0x3C,
} as const;

/**
 * Custom Mode Manager
 */
export class CustomModeManager extends EventEmitter {
  private deviceManager: DeviceManager;
  private options: Required<CustomModeManagerOptions>;
  private modeCache: Map<number, { mode: CustomMode; timestamp: number }> = new Map();
  private pendingOperations: Map<number, Promise<CustomMode>> = new Map();

  constructor(options: CustomModeManagerOptions) {
    super();

    this.deviceManager = options.deviceManager;
    this.options = {
      deviceManager: options.deviceManager,
      autoSync: options.autoSync ?? true,
      cacheTimeout: options.cacheTimeout ?? 300000, // 5 minutes
    };

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen for device connection changes
    this.deviceManager.on('device:connected', () => {
      if (this.options.autoSync) {
        this.syncAllModes().catch(error => {
          this.emit('mode:error', error);
        });
      }
    });

    this.deviceManager.on('device:disconnected', () => {
      this.clearCache();
    });
  }

  /**
   * Read a custom mode from the device
   */
  async readMode(slot: CustomModeSlot): Promise<CustomMode> {
    this.validateSlot(slot);

    // Check if we have a pending operation for this slot
    const pending = this.pendingOperations.get(slot);
    if (pending) {
      return pending;
    }

    // Check cache
    const cached = this.getCachedMode(slot);
    if (cached) {
      return cached;
    }

    // Create read operation
    const operation = this.performReadMode(slot);
    this.pendingOperations.set(slot, operation);

    try {
      const mode = await operation;
      this.cacheMode(slot, mode);
      this.emit('mode:loaded', slot, mode);
      return mode;
    } finally {
      this.pendingOperations.delete(slot);
    }
  }

  /**
   * Perform actual mode read from device
   */
  private async performReadMode(slot: CustomModeSlot): Promise<CustomMode> {
    const response = await this.deviceManager.readCustomMode(slot);
    return this.parseCustomModeResponse(slot, response);
  }

  /**
   * Write a custom mode to the device
   */
  async writeMode(slot: CustomModeSlot, mode: CustomMode): Promise<void> {
    this.validateSlot(slot);
    this.validateMode(mode);

    // Convert to device format
    const deviceMode = this.convertToDeviceFormat(slot, mode);

    // Send to device
    await this.deviceManager.writeCustomMode(slot, deviceMode);

    // Update cache
    this.cacheMode(slot, mode);
    this.emit('mode:saved', slot, mode);
  }

  /**
   * Parse custom mode response from device
   */
  private parseCustomModeResponse(slot: number, response: any): CustomMode {
    // The response from DeviceManager is already partially parsed
    // We need to enhance it with our type system

    const mode: CustomMode = {
      name: response.name || `Custom ${slot + 1}`,
      controls: {},
      leds: new Map(),
      metadata: {
        slot,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }
    };

    // Parse control mappings
    if (response.controls) {
      for (const control of response.controls) {
        const controlId = this.getControlIdName(control.controlId);
        if (controlId) {
          mode.controls[controlId] = {
            type: this.getControlType(control.controlId),
            channel: control.channel,
            cc: control.ccNumber,
            min: control.minValue,
            max: control.maxValue,
            behaviour: control.behaviour as ControlBehaviour,
          };
        }
      }
    }

    // Parse LED mappings
    if (response.colors) {
      for (const color of response.colors) {
        const controlId = this.getControlIdName(color.controlId);
        if (controlId && mode.leds) {
          mode.leds.set(color.controlId, {
            color: color.color,
            behaviour: color.behaviour ?? 'static',
          });
        }
      }
    }

    return mode;
  }

  /**
   * Convert custom mode to device format
   */
  private convertToDeviceFormat(slot: number, mode: CustomMode): CustomMode {
    const controls: ControlMapping[] = [];
    const colors: ColorMapping[] = [];

    // Convert control mappings
    for (const [key, control] of Object.entries(mode.controls)) {
      const controlId = this.getControlIdValue(key);
      if (controlId !== undefined) {
        const ctrl = control as any;
        controls.push({
          controlId,
          channel: ctrl.channel,
          ccNumber: ctrl.cc,
          minValue: ctrl.min,
          maxValue: ctrl.max,
          behaviour: ctrl.behaviour,
        });
      }
    }

    // Convert LED mappings
    for (const [key, led] of Object.entries(mode.leds || {})) {
      const controlId = this.getControlIdValue(key);
      if (controlId !== undefined) {
        const ledConfig = led as any;
        colors.push({
          controlId,
          color: ledConfig.color as number,
          behaviour: ledConfig.behaviour,
        });
      }
    }

    return {
      slot,
      name: mode.name,
      controls,
      colors,
    } as any;
  }

  /**
   * Get control ID value from name
   */
  private getControlIdValue(name: string): number | undefined {
    return (CONTROL_IDS as any)[name];
  }

  /**
   * Get control ID name from value
   */
  private getControlIdName(value: number): string | undefined {
    for (const [key, val] of Object.entries(CONTROL_IDS)) {
      if (val === value) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Get control type from control ID
   */
  private getControlType(controlId: number): ControlType {
    if (controlId >= 0x0D && controlId <= 0x38) {
      return 'knob';
    } else if (controlId >= 0x4D && controlId <= 0x54) {
      return 'fader';
    } else {
      return 'button';
    }
  }

  /**
   * Sync all modes from device
   */
  async syncAllModes(): Promise<CustomMode[]> {
    const modes: CustomMode[] = [];

    for (let slot = 0; slot < 16; slot++) {
      try {
        const mode = await this.readMode(slot as CustomModeSlot);
        modes.push(mode);
      } catch (error) {
        // Log error but continue syncing other slots
        console.error(`Failed to read mode from slot ${slot}:`, error);
      }
    }

    return modes;
  }

  /**
   * Copy a mode from one slot to another
   */
  async copyMode(sourceSlot: CustomModeSlot, targetSlot: CustomModeSlot): Promise<void> {
    const sourceMode = await this.readMode(sourceSlot);

    // Create a copy with new metadata
    const targetMode: CustomMode = {
      ...sourceMode,
      metadata: {
        ...sourceMode.metadata,
        slot: targetSlot,
        modifiedAt: new Date(),
      }
    };

    await this.writeMode(targetSlot, targetMode);
  }

  /**
   * Create a default mode
   */
  createDefaultMode(name?: string): CustomMode {
    const mode: CustomMode = {
      name: name || 'Default Mode',
      controls: {},
      leds: new Map(),
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date(),
      }
    };

    // Setup default control mappings
    // Send A knobs - CC 13-20
    for (let i = 0; i < 8; i++) {
      const key = `SEND_A${i + 1}`;
      mode.controls[key] = {
        type: 'knob',
        channel: 0,
        cc: 13 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };
    }

    // Send B knobs - CC 29-36
    for (let i = 0; i < 8; i++) {
      const key = `SEND_B${i + 1}`;
      mode.controls[key] = {
        type: 'knob',
        channel: 0,
        cc: 29 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };
    }

    // Pan knobs - CC 49-56
    for (let i = 0; i < 8; i++) {
      const key = `PAN${i + 1}`;
      mode.controls[key] = {
        type: 'knob',
        channel: 0,
        cc: 49 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };
    }

    // Faders - CC 77-84
    for (let i = 0; i < 8; i++) {
      const key = `FADER${i + 1}`;
      mode.controls[key] = {
        type: 'fader',
        channel: 0,
        cc: 77 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };
    }

    // Setup default LED colors
    for (let i = 0; i < 8; i++) {
      mode.leds!.set(i + 0x10, { // Focus buttons start at 0x10
        color: LED_COLORS.AMBER_LOW as any,
        behaviour: 'static',
      });

      mode.leds!.set(i + 0x28, { // Control buttons start at 0x28
        color: LED_COLORS.GREEN_LOW as any,
        behaviour: 'static',
      });
    }

    return mode;
  }

  /**
   * Export mode to JSON
   */
  exportMode(mode: CustomMode): string {
    return JSON.stringify(mode, null, 2);
  }

  /**
   * Import mode from JSON
   */
  importMode(json: string): CustomMode {
    const parsed = JSON.parse(json);
    this.validateMode(parsed);
    return parsed;
  }

  /**
   * Validate slot number
   */
  private validateSlot(slot: number): void {
    if (slot < 0 || slot > 15) {
      throw new Error(`Invalid slot number: ${slot}. Must be 0-15.`);
    }
  }

  /**
   * Validate custom mode
   */
  private validateMode(mode: CustomMode): void {
    if (!mode.name || typeof mode.name !== 'string') {
      throw new Error('Mode must have a name');
    }

    if (!mode.controls || typeof mode.controls !== 'object') {
      throw new Error('Mode must have controls object');
    }

    // Validate each control mapping
    for (const [key, control] of Object.entries(mode.controls)) {
      if (!this.getControlIdValue(key)) {
        throw new Error(`Invalid control ID: ${key}`);
      }

      const ctrl = control as any; // Type assertion for validation

      if (ctrl.channel < 0 || ctrl.channel > 15) {
        throw new Error(`Invalid channel for ${key}: ${ctrl.channel}`);
      }

      if (ctrl.cc !== undefined && (ctrl.cc < 0 || ctrl.cc > 127)) {
        throw new Error(`Invalid CC for ${key}: ${ctrl.cc}`);
      }

      if (ctrl.min !== undefined && (ctrl.min < 0 || ctrl.min > 127)) {
        throw new Error(`Invalid min value for ${key}: ${ctrl.min}`);
      }

      if (ctrl.max !== undefined && (ctrl.max < 0 || ctrl.max > 127)) {
        throw new Error(`Invalid max value for ${key}: ${ctrl.max}`);
      }

      if (ctrl.min !== undefined && ctrl.max !== undefined && ctrl.min > ctrl.max) {
        throw new Error(`Min value greater than max for ${key}`);
      }
    }

    // Validate LED mappings if present
    if (mode.leds) {
      for (const [key, led] of Object.entries(mode.leds)) {
        if (!this.getControlIdValue(key)) {
          throw new Error(`Invalid LED control ID: ${key}`);
        }

        const ledConfig = led as any; // Type assertion for validation
        const validBehaviours = ['static', 'flash', 'pulse'];
        if (ledConfig.behaviour && !validBehaviours.includes(ledConfig.behaviour)) {
          throw new Error(`Invalid LED behaviour for ${key}: ${ledConfig.behaviour}`);
        }
      }
    }
  }

  /**
   * Get cached mode
   */
  private getCachedMode(slot: number): CustomMode | null {
    const cached = this.modeCache.get(slot);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    const now = Date.now();
    if (now - cached.timestamp > this.options.cacheTimeout) {
      this.modeCache.delete(slot);
      return null;
    }

    return cached.mode;
  }

  /**
   * Cache a mode
   */
  private cacheMode(slot: number, mode: CustomMode): void {
    this.modeCache.set(slot, {
      mode,
      timestamp: Date.now(),
    });

    this.emit('cache:updated', slot);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.modeCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get all cached modes
   */
  getCachedModes(): Map<number, CustomMode> {
    const modes = new Map<number, CustomMode>();

    for (const [slot, cached] of this.modeCache.entries()) {
      const now = Date.now();
      if (now - cached.timestamp <= this.options.cacheTimeout) {
        modes.set(slot, cached.mode);
      }
    }

    return modes;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.clearCache();
    this.pendingOperations.clear();
    this.removeAllListeners();
  }
}

export default CustomModeManager;