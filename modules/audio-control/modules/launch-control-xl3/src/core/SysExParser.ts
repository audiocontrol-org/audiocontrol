/**
 * SysEx message parsing and building for Novation Launch Control XL 3
 *
 * Handles all SysEx communication with the device including:
 * - Device inquiry/response
 * - Template changes
 * - Custom mode read/write
 * - LED control
 * - Configuration management
 */

import { Midimunge } from '@/core/Midimunge';

// Novation/Focusrite manufacturer ID
export const MANUFACTURER_ID = [0x00, 0x20, 0x29];

// Device family codes
export const DEVICE_FAMILY = {
  LAUNCH_CONTROL_XL: 0x11,
  LAUNCH_CONTROL_XL_MK3: 0x61,
};

// SysEx message types
export enum SysExMessageType {
  // Standard MIDI messages
  DEVICE_INQUIRY = 0x06,
  DEVICE_INQUIRY_RESPONSE = 0x06,

  // Novation specific messages
  TEMPLATE_CHANGE = 0x77,
  LED_CONTROL = 0x78,
  CUSTOM_MODE_READ = 0x62,
  CUSTOM_MODE_WRITE = 0x63,
  CUSTOM_MODE_RESPONSE = 0x62,
  RESET_LED = 0x79,
}

// Base SysEx message interface
export interface SysExMessage {
  type: string;
  manufacturerId: number[];
  data: number[];
}

// Device inquiry response
export interface DeviceInquiryResponse extends SysExMessage {
  type: 'device_inquiry_response';
  familyCode: number;
  familyMember: number;
  softwareRevision: number[];
}

// Template change message
export interface TemplateChangeMessage extends SysExMessage {
  type: 'template_change';
  templateNumber: number;
}

// Custom mode message
export interface CustomModeMessage extends SysExMessage {
  type: 'custom_mode_response' | 'custom_mode_write';
  slot: number;
  name?: string;
  controls: ControlMapping[];
  colors: ColorMapping[];
}

// Control mapping for custom modes
export interface ControlMapping {
  controlId: number;
  channel: number;
  ccNumber: number;
  minValue: number;
  maxValue: number;
  behaviour: 'absolute' | 'relative1' | 'relative2' | 'relative3';
}

// LED color mapping
export interface ColorMapping {
  controlId: number;
  color: number;
  behaviour: 'static' | 'flash' | 'pulse';
}

/**
 * SysEx message parser and builder
 */
export class SysExParser {
  /**
   * Parse a SysEx message
   */
  static parse(data: number[]): SysExMessage {
    // Check start byte first
    if (data.length === 0 || data[0] !== 0xF0) {
      throw new Error('Invalid SysEx message: missing start byte');
    }

    // Then check end byte
    if (data[data.length - 1] !== 0xF7) {
      throw new Error('Invalid SysEx message: missing end byte');
    }

    // Finally check minimum length
    if (data.length < 5) {
      throw new Error('Invalid SysEx message: too short');
    }

    // Remove start and end bytes
    const content = data.slice(1, -1);

    // Check for universal device inquiry response
    if (content[0] === 0x7E && content[2] === 0x06) {
      return this.parseDeviceInquiryResponse(content);
    }

    // Check for Novation manufacturer ID
    if (content[0] === MANUFACTURER_ID[0] &&
        content[1] === MANUFACTURER_ID[1] &&
        content[2] === MANUFACTURER_ID[2]) {
      return this.parseNovationMessage(content);
    }

    throw new Error('Unknown SysEx message format');
  }

  /**
   * Parse universal device inquiry response
   */
  private static parseDeviceInquiryResponse(data: number[]): DeviceInquiryResponse {
    // Format: 7E <device ID> 06 02 <manufacturer ID> <family> <member> <version>
    if (data.length < 15) {
      throw new Error('Invalid device inquiry response');
    }

    return {
      type: 'device_inquiry_response',
      manufacturerId: [data[4], data[5], data[6]],
      familyCode: (data[7] << 8) | data[8],
      familyMember: (data[9] << 8) | data[10],
      softwareRevision: [data[11], data[12], data[13], data[14]],
      data,
    };
  }

  /**
   * Parse Novation-specific message
   */
  private static parseNovationMessage(data: number[]): SysExMessage {
    // Skip manufacturer ID (first 3 bytes: 00 20 29)
    const messageData = data.slice(3);

    if (messageData.length < 2) {
      throw new Error('Invalid Novation SysEx message');
    }

    // Check for Launch Control XL 3 format: 02 15 05 00 [operation] [slot]
    if (messageData.length >= 7 &&
        messageData[0] === 0x02 &&  // Device ID (Launch Control XL 3)
        messageData[1] === 0x15 &&  // Command (Custom mode)
        messageData[2] === 0x05 &&  // Sub-command
        messageData[3] === 0x00) {  // Reserved

      const operation = messageData[4];

      // Check if this is a custom mode response (operation 0x10)
      if (operation === 0x10) {
        return this.parseCustomModeResponseXL3(messageData); // Pass message data (F0/F7 and manufacturer ID stripped)
      }
    }

    // Fallback to legacy format parsing
    const deviceId = messageData[0];
    const messageType = messageData[1];

    switch (messageType) {
      case SysExMessageType.TEMPLATE_CHANGE:
        return this.parseTemplateChange(messageData);

      case SysExMessageType.CUSTOM_MODE_RESPONSE:
        return this.parseCustomModeResponse(data);

      default:
        return {
          type: 'unknown',
          manufacturerId: MANUFACTURER_ID,
          data: messageData,
        };
    }
  }

  /**
   * Parse template change message
   */
  private static parseTemplateChange(data: number[]): TemplateChangeMessage {
    if (data.length < 3) {
      throw new Error('Invalid template change message');
    }

    return {
      type: 'template_change',
      manufacturerId: MANUFACTURER_ID,
      templateNumber: data[2],
      data,
    };
  }

  /**
   * Parse Launch Control XL 3 custom mode response (expects messageData without F0/F7 and manufacturer ID)
   */
  private static parseCustomModeResponseXL3(data: number[]): CustomModeMessage {
    if (data.length < 6) {
      throw new Error('Invalid Launch Control XL 3 custom mode response');
    }

    // Expected format after F0/F7 and manufacturer ID stripped by parseNovationMessage:
    // 02 15 05 00 10 [SLOT] [419 bytes of data]
    // Positions: 0  1  2  3  4     5
    const operation = data[4];
    const slot = data[5];

    if (operation !== 0x10) {
      throw new Error(`Unexpected operation in Launch Control XL 3 response: 0x${operation.toString(16)}`);
    }

    // Parse the actual custom mode data (starts after slot byte at position 6)
    const rawModeData = data.slice(6);
    const { controls, colors, name } = this.parseCustomModeData(rawModeData);

    return {
      type: 'custom_mode_response',
      manufacturerId: MANUFACTURER_ID,
      slot,
      name,
      controls,
      colors,
      data,
    };
  }

  /**
   * Parse legacy custom mode response (for older devices)
   */
  private static parseCustomModeResponse(data: number[]): CustomModeMessage {
    if (data.length < 4) {
      throw new Error('Invalid custom mode response');
    }

    const slot = data[2];
    const encodedData = data.slice(3);

    // Decode the Midimunge-encoded custom mode data
    const decodedData = Midimunge.decode(encodedData);

    // Parse the decoded data into control and color mappings
    const { controls, colors } = this.parseCustomModeData(decodedData);

    return {
      type: 'custom_mode_response',
      manufacturerId: MANUFACTURER_ID,
      slot,
      controls,
      colors,
      data,
    };
  }

  /**
   * Parse custom mode data from raw bytes
   */
  private static parseCustomModeData(data: number[]): {
    controls: ControlMapping[];
    colors: ColorMapping[];
    name?: string;
  } {
    const controls: ControlMapping[] = [];
    const colors: ColorMapping[] = [];
    let modeName: string | undefined;

    // Parse mode name (after 06 20 0E pattern)
    let nameStart = -1;
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x06 && data[i + 1] === 0x20 && data[i + 2] === 0x0E) {
        nameStart = i + 3;
        break;
      }
    }

    if (nameStart > 0) {
      const nameBytes = [];
      for (let i = nameStart; i < data.length - 1; i++) {
        if (data[i] === 0x00 || data[i] === 0x48 || data[i] === 0xF7) break;
        if (data[i] >= 32 && data[i] <= 126) {
          nameBytes.push(data[i]);
        }
      }

      if (nameBytes.length > 0) {
        modeName = String.fromCharCode(...nameBytes);
      }
    }

    // Parse control definitions (marked with 0x48)
    for (let i = 0; i < data.length - 10; i++) {
      if (data[i] === 0x48) { // Control marker
        const controlId = data[i + 1];
        const defType = data[i + 2];
        const controlType = data[i + 3];
        const channel = data[i + 4];
        const param1 = data[i + 5];
        const param2 = data[i + 6];
        const ccNumber = data[i + 7];
        const maxValue = data[i + 8];

        // Determine control behavior based on type
        let behaviour: 'absolute' | 'relative1' | 'relative2' | 'relative3' = 'absolute';
        if (controlType === 0x21 || controlType === 0x2D) {
          // Encoder - might be relative
          behaviour = 'relative1'; // Default for encoders
        }

        controls.push({
          controlId,
          channel,
          ccNumber,
          minValue: 0,
          maxValue,
          behaviour,
        });

        // For now, create a default color mapping
        colors.push({
          controlId,
          color: 0x3F, // Default color
          behaviour: 'static',
        });
      }
    }

    return { controls, colors, name: modeName };
  }

  /**
   * Build device inquiry request
   */
  static buildDeviceQuery(): number[] {
    return [
      0xF0, // SysEx start
      0x7E, // Universal non-realtime
      0x00, // Device ID (broadcast)
      0x06, // General information
      0x01, // Identity request
      0xF7, // SysEx end
    ];
  }

  /**
   * Build template change message
   */
  static buildTemplateChange(templateNumber: number): number[] {
    if (templateNumber < 0 || templateNumber > 15) {
      throw new Error('Template number must be 0-15');
    }

    return [
      0xF0, // SysEx start
      ...MANUFACTURER_ID,
      0x11, // Device ID (Launch Control XL)
      SysExMessageType.TEMPLATE_CHANGE,
      templateNumber,
      0xF7, // SysEx end
    ];
  }

  /**
   * Build custom mode read request
   */
  static buildCustomModeReadRequest(slot: number): number[] {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    // CORRECTED PROTOCOL: Based on working MIDI capture from web editor
    // Format: F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7
    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x40,             // Read operation (CORRECTED from 0x15)
      slot,             // Slot number (0-14 for slots 1-15)
      0x00,             // Parameter (CORRECTED from nothing)
      0xF7              // SysEx end
    ];
  }

  /**
   * Build custom mode write request
   */
  static buildCustomModeWriteRequest(slot: number, modeData: CustomModeMessage): number[] {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    // Validate the custom mode data
    this.validateCustomModeData(modeData);

    // Encode the custom mode data
    const encodedData = this.encodeCustomModeData(modeData);

    // CORRECTED PROTOCOL: Based on Launch Control XL 3 format
    // Format: F0 00 20 29 02 15 05 00 45 [SLOT] [encoded data] F7
    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x45,             // Write operation (assumed based on pattern)
      slot,             // Slot number (0-14 for slots 1-15)
      ...encodedData,   // Encoded custom mode data
      0xF7              // SysEx end
    ];
  }

  /**
   * Validate custom mode data
   */
  static validateCustomModeData(modeData: CustomModeMessage): void {
    if (!modeData.controls || !Array.isArray(modeData.controls)) {
      throw new Error('Custom mode must have controls array');
    }

    if (!modeData.colors || !Array.isArray(modeData.colors)) {
      throw new Error('Custom mode must have colors array');
    }

    // Validate each control mapping
    for (const control of modeData.controls) {
      if (control.ccNumber < 0 || control.ccNumber > 127) {
        throw new Error('CC number must be 0-127');
      }

      if (control.channel < 0 || control.channel > 15) {
        throw new Error('Channel must be 0-15');
      }

      if (control.minValue < 0 || control.minValue > 127) {
        throw new Error('Min value must be 0-127');
      }

      if (control.maxValue < 0 || control.maxValue > 127) {
        throw new Error('Max value must be 0-127');
      }

      if (control.minValue > control.maxValue) {
        throw new Error('Min value cannot be greater than max value');
      }
    }

    // Validate each color mapping
    for (const color of modeData.colors) {
      if (color.color < 0 || color.color > 127) {
        throw new Error('Color value must be 0-127');
      }
    }
  }

  /**
   * Encode custom mode data for transmission
   */
  private static encodeCustomModeData(modeData: CustomModeMessage): number[] {
    // Build the raw custom mode data
    const rawData: number[] = [];

    // TODO: Implement actual encoding based on Launch Control XL 3 format
    // This is a placeholder implementation

    // For now, we'll just encode the control count and basic data
    rawData.push(modeData.controls.length);

    for (const control of modeData.controls) {
      rawData.push(control.controlId);
      rawData.push(control.channel);
      rawData.push(control.ccNumber);
      rawData.push(control.minValue);
      rawData.push(control.maxValue);
      rawData.push(this.encodeBehaviour(control.behaviour));
    }

    rawData.push(modeData.colors.length);

    for (const color of modeData.colors) {
      rawData.push(color.controlId);
      rawData.push(color.color);
      rawData.push(this.encodeColorBehaviour(color.behaviour));
    }

    // Encode using Midimunge
    return Midimunge.encode(rawData);
  }

  /**
   * Encode control behaviour
   */
  private static encodeBehaviour(behaviour: string): number {
    const behaviourMap: Record<string, number> = {
      'absolute': 0,
      'relative1': 1,
      'relative2': 2,
      'relative3': 3,
    };

    return behaviourMap[behaviour] ?? 0;
  }

  /**
   * Encode color behaviour
   */
  private static encodeColorBehaviour(behaviour: string): number {
    const behaviourMap: Record<string, number> = {
      'static': 0,
      'flash': 1,
      'pulse': 2,
    };

    return behaviourMap[behaviour] ?? 0;
  }

  /**
   * Build LED control message
   */
  static buildLedControl(controlId: number, color: number, behaviour: 'static' | 'flash' | 'pulse' = 'static'): number[] {
    if (controlId < 0 || controlId > 127) {
      throw new Error('Control ID must be 0-127');
    }

    if (color < 0 || color > 127) {
      throw new Error('Color must be 0-127');
    }

    let behaviorByte = color;

    if (behaviour === 'flash') {
      behaviorByte |= 0x08;
    } else if (behaviour === 'pulse') {
      behaviorByte |= 0x10;
    }

    return [
      0xF0, // SysEx start
      ...MANUFACTURER_ID,
      0x11, // Device ID
      SysExMessageType.LED_CONTROL,
      controlId,
      behaviorByte,
      0xF7, // SysEx end
    ];
  }

  /**
   * Build LED reset message
   */
  static buildLedReset(): number[] {
    return [
      0xF0, // SysEx start
      ...MANUFACTURER_ID,
      0x11, // Device ID
      SysExMessageType.RESET_LED,
      0x00, // Reset all LEDs
      0xF7, // SysEx end
    ];
  }

  /**
   * Check if data is a valid SysEx message
   */
  static isValidSysEx(data: number[]): boolean {
    if (data.length < 3) {
      return false;
    }

    return data[0] === 0xF0 && data[data.length - 1] === 0xF7;
  }

  /**
   * Extract manufacturer ID from SysEx message
   */
  static getManufacturerId(data: number[]): number[] | null {
    if (!this.isValidSysEx(data)) {
      return null;
    }

    // Universal messages don't have manufacturer ID
    if (data[1] === 0x7E || data[1] === 0x7F) {
      return null;
    }

    // Extract 3-byte manufacturer ID
    if (data[1] === 0x00) {
      return data.slice(1, 4);
    }

    // Single byte manufacturer ID
    return [data[1]];
  }
}

export default SysExParser;