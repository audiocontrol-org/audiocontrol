/**
 * Launch Control XL3 Controller Adapter
 *
 * Reference implementation showing how to integrate any MIDI controller
 * into the controller-workflow system.
 *
 * @module adapters/controllers/LaunchControlXL3Adapter
 */

import { LaunchControlXL3, NodeMidiBackend } from '@audiocontrol/launch-control-xl3/node';
import type {
  CustomMode as LCXL3CustomMode,
  ControlMapping as LCXL3ControlMapping,
  LaunchControlXL3Info,
} from '@audiocontrol/launch-control-xl3';
import type {
  ControllerAdapterInterface,
  ControllerCapabilities,
  ControllerConfiguration,
  ConfigurationSlot,
  DeviceInfo,
  ControlMapping,
  ControlType,
} from '@/types/index.js';

/**
 * Adapter for Novation Launch Control XL 3
 *
 * Wraps the @audiocontrol/launch-control-xl3 device library and provides
 * a generic interface for the controller-workflow system.
 */
export class LaunchControlXL3Adapter implements ControllerAdapterInterface {
  readonly manufacturer = 'Novation';
  readonly model = 'Launch Control XL 3';
  readonly capabilities: ControllerCapabilities = {
    supportsCustomModes: true,
    maxConfigSlots: 16, // Slots 0-15 (16 total: 0-14 user-programmable, 15 factory)
    supportsRead: true,
    supportsWrite: true,
    supportedControlTypes: ['encoder', 'slider', 'button'],
  };

  constructor(private device: LaunchControlXL3) {}

  /**
   * Factory method to create and connect adapter
   *
   * @returns Connected LaunchControlXL3Adapter instance
   * @throws Error if device connection fails
   */
  static async create(): Promise<LaunchControlXL3Adapter> {
    // Create Node MIDI backend for direct hardware access (no server needed)
    const backend = new NodeMidiBackend();
    const device = new LaunchControlXL3({
      enableCustomModes: true,
      midiBackend: backend
    });
    await device.connect();
    return new LaunchControlXL3Adapter(device);
  }

  /**
   * Connect to the device
   */
  async connect(): Promise<void> {
    if (!this.isConnected()) {
      await this.device.connect();
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    if (this.isConnected()) {
      await this.device.disconnect();
    }
  }

  /**
   * Check if device is connected
   */
  isConnected(): boolean {
    return this.device.isConnected();
  }

  /**
   * List all configuration slots
   *
   * Reads all 16 slots (0-15) from the device.
   * Slots 0-14 are user-programmable, slot 15 is factory preset.
   * Returns their status (empty or populated with mode name).
   */
  async listConfigurations(): Promise<ConfigurationSlot[]> {
    const slots: ConfigurationSlot[] = [];

    // Read all 16 slots (0-15)
    for (let i = 0; i < 16; i++) {
      try {
        const mode = await this.device.readCustomMode(i);
        const slot: ConfigurationSlot = {
          index: i,
          isEmpty: mode === null,
        };
        // Only include name if it exists
        if (mode?.name !== undefined) {
          slot.name = mode.name;
        }
        slots.push(slot);
      } catch (error) {
        // If read fails (timeout, empty slot, or unsupported slot like factory preset),
        // mark the slot as empty
        slots.push({
          index: i,
          isEmpty: true,
        });
      }
    }

    return slots;
  }

  /**
   * Read configuration from a specific slot
   *
   * Converts LCXL3 CustomMode format to generic ControllerConfiguration.
   *
   * @param slot - Slot number (0-15)
   * @returns Generic controller configuration
   * @throws Error if slot is empty or read fails
   */
  async readConfiguration(slot: number): Promise<ControllerConfiguration> {
    this.validateSlot(slot);

    const customMode = await this.device.readCustomMode(slot);
    if (!customMode) {
      throw new Error(`No configuration found in slot ${slot}`);
    }

    return this.convertFromLCXL3(customMode, slot);
  }

  /**
   * Write configuration to a specific slot
   *
   * Converts generic ControllerConfiguration to LCXL3 CustomMode format.
   *
   * @param slot - Slot number (0-15)
   * @param config - Generic controller configuration
   * @throws Error if conversion or write fails
   */
  async writeConfiguration(slot: number, config: ControllerConfiguration): Promise<void> {
    this.validateSlot(slot);

    const customMode = this.convertToLCXL3(config);
    await this.device.writeCustomMode(slot, customMode);
  }

  /**
   * Get device information
   *
   * @returns Device metadata including firmware version
   * @throws Error if device not connected or handshake failed
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const info: LaunchControlXL3Info = await this.device.verifyDevice();

    return {
      manufacturer: this.manufacturer,
      model: this.model,
      firmwareVersion: info.firmwareVersion,
    };
  }

  // ============================================
  // Private Conversion Methods
  // ============================================

  /**
   * Convert LCXL3 CustomMode to generic ControllerConfiguration
   */
  private convertFromLCXL3(mode: LCXL3CustomMode, slot?: number): ControllerConfiguration {
    const controls: ControlMapping[] = [];

    // Convert LCXL3 control mappings to generic format
    for (const [controlId, control] of Object.entries(mode.controls)) {
      const mapping = this.convertControlFromLCXL3(controlId, control);
      controls.push(mapping);
    }

    // Check for labels and colors both at top level and in metadata
    const labels = mode.labels ?? (mode.metadata ? mode.metadata['labels'] : undefined);
    const colors = mode.colors ?? (mode.metadata ? mode.metadata['colors'] : undefined);

    return {
      name: mode.name,
      controls,
      metadata: {
        ...mode.metadata,
        slot: (mode.metadata ? mode.metadata['slot'] : undefined) ?? slot,
        labels: labels ? this.mapToObject(labels) : undefined,
        colors: colors ? this.mapToObject(colors) : undefined,
      },
    };
  }

  /**
   * Convert a single LCXL3 control to generic ControlMapping
   */
  private convertControlFromLCXL3(
    controlId: string,
    control: LCXL3ControlMapping,
  ): ControlMapping {
    // Extract CC number (support both 'cc' and 'ccNumber' properties)
    const cc = control.cc ?? control.ccNumber;

    // Extract channel (support both 'channel' and 'midiChannel' properties)
    const channel = control.channel ?? control.midiChannel;

    // Extract range (support both 'min/max' and 'minValue/maxValue')
    const minValue = control.min ?? control.minValue ?? 0;
    const maxValue = control.max ?? control.maxValue ?? 127;

    // Map LCXL3 control type to generic ControlType
    const type = this.mapControlType(control.type ?? control.controlType);

    const mapping: ControlMapping = {
      id: controlId,
      type,
      range: [minValue, maxValue],
    };

    // Only add optional properties if they exist
    if (control.name !== undefined) {
      mapping.name = control.name;
    }
    if (cc !== undefined) {
      mapping.cc = cc;
    }
    if (channel !== undefined) {
      mapping.channel = channel;
    }

    return mapping;
  }

  /**
   * Convert generic ControllerConfiguration to LCXL3 CustomMode
   */
  private convertToLCXL3(config: ControllerConfiguration): LCXL3CustomMode {
    const controls: Record<string, LCXL3ControlMapping> = {};

    // Convert generic controls to LCXL3 format
    for (const control of config.controls) {
      const lcxl3Control = this.convertControlToLCXL3(control);
      controls[control.id] = lcxl3Control;
    }

    const mode: LCXL3CustomMode = {
      name: this.truncateName(config.name, 8), // LCXL3 mode names are max 8 chars
      controls,
    };

    // Only include metadata if it exists
    if (config.metadata !== undefined) {
      mode.metadata = config.metadata;
    }

    return mode;
  }

  /**
   * Truncate name to specified length
   * @param name - Name to truncate
   * @param maxLength - Maximum length
   * @returns Truncated name (exactly maxLength characters)
   */
  private truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) {
      return name;
    }

    return name.substring(0, maxLength);
  }

  /**
   * Convert a single generic ControlMapping to LCXL3 format
   */
  private convertControlToLCXL3(control: ControlMapping): LCXL3ControlMapping {
    const [minValue, maxValue] = control.range ?? [0, 127];

    // Map generic type to LCXL3 type (reverse of mapControlType)
    let lcxl3Type: string;
    switch (control.type) {
      case 'encoder':
        lcxl3Type = 'knob';
        break;
      case 'slider':
        lcxl3Type = 'fader';
        break;
      case 'button':
        lcxl3Type = 'button';
        break;
      default:
        lcxl3Type = 'knob'; // Default fallback
    }

    const lcxl3Control: LCXL3ControlMapping = {
      type: lcxl3Type as any,
      minValue,
      maxValue,
      behavior: 'absolute', // Default behavior
    };

    // Only add optional properties if they exist
    if (control.name !== undefined) {
      lcxl3Control.name = control.name;
    }
    if (control.cc !== undefined) {
      lcxl3Control.cc = control.cc;
    }
    if (control.channel !== undefined) {
      lcxl3Control.channel = control.channel;
    }

    return lcxl3Control;
  }

  /**
   * Map LCXL3 control type to generic ControlType
   *
   * LCXL3 uses numeric codes or string types. We normalize to generic types.
   */
  private mapControlType(
    type: number | string | undefined,
  ): ControlType {
    if (typeof type === 'string') {
      // String types: 'knob' | 'fader' | 'button'
      switch (type) {
        case 'knob':
          return 'encoder';
        case 'fader':
          return 'slider';
        case 'button':
          return 'button';
        default:
          return 'encoder'; // Default fallback
      }
    }

    // Numeric types from LCXL3 protocol
    // 0x00, 0x05, 0x09 = encoders
    // 0x0D = faders
    // 0x19, 0x25 = buttons
    if (type === 0x0d) {
      return 'slider';
    } else if (type === 0x19 || type === 0x25) {
      return 'button';
    } else {
      return 'encoder'; // 0x00, 0x05, 0x09, or default
    }
  }

  /**
   * Validate slot number is in valid range
   */
  private validateSlot(slot: number): void {
    if (slot < 0 || slot >= 16) {
      throw new Error(`Invalid slot number ${slot}. Must be 0-15.`);
    }
  }

  /**
   * Convert ES6 Map to plain object for serialization
   */
  private mapToObject<T>(map: Map<number, T>): Record<number, T> {
    const obj: Record<number, T> = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  }
}
