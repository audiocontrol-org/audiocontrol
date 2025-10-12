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
  ControlType,
  LedBehaviour
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
  'cache:cleared': () => void;
  'cache:updated': (slot: number) => void;
}

/**
 * Control ID mapping for Launch Control XL 3
 * PHASE 1 FIX: Updated to match web editor control ID mapping
 *
 * Based on web editor analysis:
 * - Encoders 1-8 (top row): 0x10-0x17
 * - Encoders 9-16 (middle row): 0x18-0x1F
 * - Encoders 17-24 (bottom row): 0x20-0x27
 * - Faders 1-8: 0x28-0x2F
 * - Buttons 1-8: 0x30-0x37
 * - Buttons 9-16: 0x38-0x3F
 */
export const CONTROL_IDS = {
  // Send A knobs (top row) - FIXED: 0x10-0x17 (was 0x0D-0x14)
  SEND_A1: 0x10, SEND_A2: 0x11, SEND_A3: 0x12, SEND_A4: 0x13,
  SEND_A5: 0x14, SEND_A6: 0x15, SEND_A7: 0x16, SEND_A8: 0x17,

  // Send B knobs (middle row) - FIXED: 0x18-0x1F (was 0x1D-0x24)
  SEND_B1: 0x18, SEND_B2: 0x19, SEND_B3: 0x1A, SEND_B4: 0x1B,
  SEND_B5: 0x1C, SEND_B6: 0x1D, SEND_B7: 0x1E, SEND_B8: 0x1F,

  // Pan/Device knobs (bottom row) - FIXED: 0x20-0x27 (was 0x31-0x38)
  PAN1: 0x20, PAN2: 0x21, PAN3: 0x22, PAN4: 0x23,
  PAN5: 0x24, PAN6: 0x25, PAN7: 0x26, PAN8: 0x27,

  // Faders - FIXED: 0x28-0x2F (was 0x4D-0x54)
  FADER1: 0x28, FADER2: 0x29, FADER3: 0x2A, FADER4: 0x2B,
  FADER5: 0x2C, FADER6: 0x2D, FADER7: 0x2E, FADER8: 0x2F,

  // Track focus buttons - FIXED: 0x30-0x37 (was 0x29-0x30)
  FOCUS1: 0x30, FOCUS2: 0x31, FOCUS3: 0x32, FOCUS4: 0x33,
  FOCUS5: 0x34, FOCUS6: 0x35, FOCUS7: 0x36, FOCUS8: 0x37,

  // Track control buttons - FIXED: 0x38-0x3F (was 0x39-0x40)
  CONTROL1: 0x38, CONTROL2: 0x39, CONTROL3: 0x3A, CONTROL4: 0x3B,
  CONTROL5: 0x3C, CONTROL6: 0x3D, CONTROL7: 0x3E, CONTROL8: 0x3F,

  // Side buttons - These will need further analysis in future phases
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
 * Valid LED behaviours
 */
const VALID_LED_BEHAVIOURS: LedBehaviour[] = ['static', 'flash', 'pulse', 'flashing', 'pulsing'];

/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  mode: CustomMode;
  timestamp: number;
}

/**
 * Custom Mode Manager
 */
export class CustomModeManager extends EventEmitter {
  private deviceManager: DeviceManager;
  private options: Required<CustomModeManagerOptions>;
  private pendingOperations: Map<number, Promise<CustomMode>> = new Map();
  private cache: Map<number, CacheEntry> = new Map();

  constructor(options: CustomModeManagerOptions) {
    super();

    this.deviceManager = options.deviceManager;
    this.options = {
      deviceManager: options.deviceManager,
      autoSync: options.autoSync ?? true,
      cacheTimeout: options.cacheTimeout ?? 300000, // Default 5 minutes
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

    // Check if we have a valid cached mode for this slot
    const cached = this.getCachedMode(slot);
    if (cached) {
      return cached;
    }

    // Check if we have a pending operation for this slot
    const pending = this.pendingOperations.get(slot);
    if (pending) {
      return pending;
    }

    // Create read operation
    const operation = this.performReadMode(slot);
    this.pendingOperations.set(slot, operation);

    try {
      const mode = await operation;
      this.emit('mode:loaded', slot, mode);
      return mode;
    } finally {
      this.pendingOperations.delete(slot);
    }
  }

  /**
   * Get cached mode if it exists and is not expired
   */
  private getCachedMode(slot: number): CustomMode | undefined {
    const entry = this.cache.get(slot);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > this.options.cacheTimeout) {
      // Cache expired
      this.cache.delete(slot);
      return undefined;
    }

    return entry.mode;
  }

  /**
   * Perform actual mode read from device
   */
  private async performReadMode(slot: CustomModeSlot): Promise<CustomMode> {
    const response = await this.deviceManager.readCustomMode(slot);
    const mode = this.parseCustomModeResponse(slot, response);

    // Cache with timestamp
    this.cache.set(slot, {
      mode,
      timestamp: Date.now()
    });

    this.emit('cache:updated', slot);
    return mode;
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

    // Update cache with the original mode (not device format)
    this.cache.set(slot, {
      mode,
      timestamp: Date.now()
    });

    this.emit('mode:saved', slot, mode);
    this.emit('cache:updated', slot);
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

    // Extract labels Map if present
    const labelsMap = response.labels instanceof Map ? response.labels : new Map();

    // Parse control mappings
    // Handle both array and object formats for controls
    if (response.controls) {
      const controlsArray = Array.isArray(response.controls)
        ? response.controls
        : Object.values(response.controls);

      for (const control of controlsArray) {
        const controlIdValue = control.controlId;

        // Skip unknown control IDs (not in CONTROL_IDS)
        const isKnownControl = Object.values(CONTROL_IDS).includes(controlIdValue);
        if (!isKnownControl) {
          continue; // Skip this control
        }

        const controlId = this.getControlIdName(controlIdValue);
        const label = labelsMap.get(controlIdValue);

        // Handle both property name formats (device may use either):
        // - New format: midiChannel, ccNumber, minValue, maxValue, behavior
        // - Legacy format: channel, cc, min, max, behaviour
        const midiChannel = control.midiChannel ?? control.channel ?? 0;
        const ccNumber = control.ccNumber ?? control.cc ?? 0;
        const minValue = control.minValue ?? control.min ?? 0;
        const maxValue = control.maxValue ?? control.max ?? 127;
        const behavior = (control.behavior ?? control.behaviour ?? 'absolute') as ControlBehaviour;

        mode.controls[controlId] = {
          name: label,
          type: this.getControlType(controlIdValue),
          // Primary property names
          midiChannel,
          ccNumber,
          minValue,
          maxValue,
          behavior,
          // Legacy aliases for backward compatibility
          channel: midiChannel,
          cc: ccNumber,
          min: minValue,
          max: maxValue,
          behaviour: behavior,
        };
      }
    }

    // Parse LED/color mappings if present
    if (response.colors && Array.isArray(response.colors)) {
      for (const colorMapping of response.colors) {
        mode.leds!.set(colorMapping.controlId, {
          color: colorMapping.color,
          colour: colorMapping.color, // Alternative spelling
          behaviour: colorMapping.behaviour || 'static',
        });
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
    const labels = new Map<number, string>();

    // Convert control mappings
    for (const [key, control] of Object.entries(mode.controls)) {
      const controlId = this.getControlIdValue(key);
      if (controlId !== undefined) {
        const ctrl = control as any;

        // Read from primary property names first, fallback to legacy aliases
        const midiChannel = ctrl.midiChannel ?? ctrl.channel ?? 0;
        const ccNumber = ctrl.ccNumber ?? ctrl.cc ?? 0;
        const minValue = ctrl.minValue ?? ctrl.min ?? 0;
        const maxValue = ctrl.maxValue ?? ctrl.max ?? 127;
        const behaviour = ctrl.behaviour ?? ctrl.behavior ?? 'absolute';

        controls.push({
          controlId,
          // Use legacy property names for output (tests expect these)
          channel: midiChannel,
          ccNumber,
          minValue,
          maxValue,
          behaviour,
        });

        // Extract label if present
        if (ctrl.name) {
          labels.set(controlId, ctrl.name);
        }
      }
    }

    // Convert LED mappings
    if (mode.leds) {
      for (const [controlId, led] of mode.leds.entries()) {
        const ledData = led as any;
        colors.push({
          controlId,
          color: ledData.color ?? ledData.colour,
          behaviour: ledData.behaviour ?? 'static',
        });
      }
    }

    return {
      slot,
      name: mode.name,
      controls,
      colors,
      labels,
      metadata: {
        slot,
      }
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
   * Returns either a named constant (SEND_A1, etc.) or control_XX format
   */
  private getControlIdName(value: number): string {
    // First try to find a named constant
    for (const [key, val] of Object.entries(CONTROL_IDS)) {
      if (val === value) {
        return key;
      }
    }

    // If no named constant exists, generate control_XX format
    // This matches the CustomModeBuilder.build() format
    return `control_${value.toString(16)}`;
  }

  /**
   * Get control type from control ID
   * PHASE 1 FIX: Updated ranges to match corrected control ID mapping
   */
  private getControlType(controlId: number): ControlType {
    // Encoders: 0x10-0x27 (top, middle, bottom rows)
    if (controlId >= 0x10 && controlId <= 0x27) {
      return 'knob';
    }
    // Faders: 0x28-0x2F
    else if (controlId >= 0x28 && controlId <= 0x2F) {
      return 'fader';
    }
    // Buttons: 0x30-0x3F and other button ranges
    else {
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
        // Primary property names
        midiChannel: 0,
        ccNumber: 13 + i,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
        // Legacy aliases for backward compatibility
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
        // Primary property names
        midiChannel: 0,
        ccNumber: 29 + i,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
        // Legacy aliases for backward compatibility
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
        // Primary property names
        midiChannel: 0,
        ccNumber: 49 + i,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
        // Legacy aliases for backward compatibility
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
        // Primary property names
        midiChannel: 0,
        ccNumber: 77 + i,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
        // Legacy aliases for backward compatibility
        channel: 0,
        cc: 77 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };
    }

    // Setup default LED mappings for buttons
    // Focus buttons (0x30-0x37) - Green
    for (let i = 0; i < 8; i++) {
      const controlId = CONTROL_IDS[`FOCUS${i + 1}` as keyof typeof CONTROL_IDS];
      mode.leds!.set(controlId, {
        color: LED_COLORS.GREEN_LOW,
        colour: LED_COLORS.GREEN_LOW,
        behaviour: 'static',
      });
    }

    // Control buttons (0x38-0x3F) - Red
    for (let i = 0; i < 8; i++) {
      const controlId = CONTROL_IDS[`CONTROL${i + 1}` as keyof typeof CONTROL_IDS];
      mode.leds!.set(controlId, {
        color: LED_COLORS.RED_LOW,
        colour: LED_COLORS.RED_LOW,
        behaviour: 'static',
      });
    }

    return mode;
  }

  /**
   * Export mode to JSON
   */
  exportMode(mode: CustomMode): string {
    // Convert Map to array for JSON serialization
    const serializable = {
      ...mode,
      leds: mode.leds ? Array.from(mode.leds.entries()) : []
    };
    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Import mode from JSON
   */
  importMode(json: string): CustomMode {
    const parsed = JSON.parse(json);

    // Convert leds array back to Map
    if (parsed.leds && Array.isArray(parsed.leds)) {
      parsed.leds = new Map(parsed.leds);
    }

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
  private validateMode(mode: any): void {
    if (!mode.name || typeof mode.name !== 'string') {
      throw new Error('Mode must have a name');
    }

    if (mode.name.trim() === '') {
      throw new Error('Mode name cannot be empty');
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

      // Validate channel (check both property names)
      const channel = ctrl.channel ?? ctrl.midiChannel;
      if (channel !== undefined && (channel < 0 || channel > 15)) {
        throw new Error(`Invalid channel for ${key}: ${channel}`);
      }

      // Validate CC number (check both property names)
      const cc = ctrl.cc ?? ctrl.ccNumber;
      if (cc !== undefined && (cc < 0 || cc > 127)) {
        throw new Error(`Invalid CC for ${key}: ${cc}`);
      }

      // Validate min value (check both property names)
      const min = ctrl.min ?? ctrl.minValue;
      if (min !== undefined && (min < 0 || min > 127)) {
        throw new Error(`Invalid min value for ${key}: ${min}`);
      }

      // Validate max value (check both property names)
      const max = ctrl.max ?? ctrl.maxValue;
      if (max !== undefined && (max < 0 || max > 127)) {
        throw new Error(`Invalid max value for ${key}: ${max}`);
      }

      if (min !== undefined && max !== undefined && min > max) {
        throw new Error(`Min value greater than max for ${key}`);
      }
    }

    // Validate LED configurations if present
    if (mode.leds) {
      // Handle both Map and object formats
      const ledsMap = mode.leds instanceof Map ? mode.leds : new Map(Object.entries(mode.leds));

      for (const [controlId, led] of ledsMap.entries()) {
        const ledData = led as any;
        const behaviour = ledData.behaviour ?? ledData.behavior;

        if (behaviour && !VALID_LED_BEHAVIOURS.includes(behaviour)) {
          // Get control name for better error message
          // Handle both numeric IDs and string names (like "FOCUS1")
          let controlName: string;
          if (typeof controlId === 'string') {
            // Check if it's a control name (like "FOCUS1") or a numeric string
            const controlIdValue = this.getControlIdValue(controlId);
            if (controlIdValue !== undefined) {
              // It's a valid control name
              controlName = controlId;
            } else {
              // It's a numeric string, parse it
              const controlIdNum = parseInt(controlId, 10);
              controlName = this.getControlIdName(controlIdNum);
            }
          } else {
            // It's a number
            controlName = this.getControlIdName(Number(controlId));
          }
          throw new Error(`Invalid LED behaviour for ${controlName}: ${behaviour}`);
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.pendingOperations.clear();
    this.cache.clear();
    this.removeAllListeners();
  }

  /**
   * Clear the pending operations cache and cached modes
   */
  clearCache(): void {
    this.pendingOperations.clear();
    this.cache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get all cached modes
   * Returns a copy of the cached modes map to prevent external mutation
   * @returns Map of slot numbers to cached CustomMode objects
   */
  getCachedModes(): Map<number, CustomMode> {
    const result = new Map<number, CustomMode>();
    for (const [slot, entry] of this.cache.entries()) {
      result.set(slot, entry.mode);
    }
    return result;
  }
}

export default CustomModeManager;
