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
   * Updated to handle Launch Control XL 3 format (not Midimunge)
   * Note: Device uses 0x48 in READ responses, 0x49 in WRITE commands
   */
  private static parseCustomModeData(data: number[]): {
    controls: ControlMapping[];
    colors: ColorMapping[];
    name?: string;
  } {
    const controls: ControlMapping[] = [];
    const colors: ColorMapping[] = [];
    let modeName: string | undefined;

    // Parse mode name - look for ASCII after header pattern
    let nameStart = -1;
    let nameEnd = -1;

    // Look for the 0x06 0x20 0x08 or 0x00 0x20 0x08 header pattern first
    for (let i = 0; i < data.length - 3; i++) {
      if ((data[i] === 0x06 || data[i] === 0x00) && data[i + 1] === 0x20 && data[i + 2] === 0x08) {
        nameStart = i + 3;
        break;
      }
    }

    if (nameStart > 0) {
      const nameBytes = [];
      for (let i = nameStart; i < data.length - 1; i++) {
        // Stop at terminator 0x21 0x00 or first control marker
        if ((data[i] === 0x21 && data[i + 1] === 0x00) ||
            (data[i] === 0x48 && i > nameStart + 2)) {
          nameEnd = i;
          break;
        }
        if (data[i] >= 32 && data[i] <= 126) { // Printable ASCII
          nameBytes.push(data[i]);
        }
      }

      if (nameBytes.length > 0) {
        modeName = String.fromCharCode(...nameBytes);
      }
    }

    // Parse control definitions
    // In READ responses: 0x48 [ID] 0x02 [TYPE] [CH] 0x01 0x48 [MIN] [CC] [MAX]
    // In WRITE commands: 0x49 [ID] 0x02 [TYPE] [CH] 0x01 0x40 [MIN] [CC] [MAX] 0x00

    // Find where controls actually start (after name and terminator)
    let controlsStart = nameEnd > 0 ? nameEnd + 2 : 0; // Skip 0x21 0x00 after name

    for (let i = controlsStart; i < data.length - 9; i++) {
      // Handle both 0x48 (read) and 0x49 (write) markers
      if (data[i] === 0x48 || data[i] === 0x49) {
        if (i + 9 < data.length) {
          const controlId = data[i + 1];
          const defType = data[i + 2];
          const controlType = data[i + 3];
          const channel = data[i + 4];
          const param1 = data[i + 5];

          // Validate it's a control structure (not part of name or other data)
          const isValidControl = defType === 0x02 &&
                                (param1 === 0x01 || param1 === 0x00) &&
                                controlId <= 0x3F; // Valid control ID range

          if (isValidControl) {
            const param2 = data[i + 6];
            const minValue = data[i + 7];
            const ccNumber = data[i + 8];
            const maxValue = data[i + 9];

            // Determine control behavior
            let behaviour: 'absolute' | 'relative1' | 'relative2' | 'relative3' = 'absolute';

            controls.push({
              controlId,
              channel,
              ccNumber,
              minValue,
              maxValue,
              behaviour,
            });

            // Create color mapping based on control ID
            let color = 0x3F; // Default
            if (controlId >= 0x10 && controlId <= 0x17) {
              color = 0x60; // Blue for top row encoders
            } else if (controlId >= 0x18 && controlId <= 0x1F) {
              color = 0x48; // Yellow for middle row encoders
            } else if (controlId >= 0x20 && controlId <= 0x27) {
              color = 0x3C; // Green for bottom row encoders
            } else if (controlId >= 0x28 && controlId <= 0x3F) {
              color = 0x0F; // Red for buttons/other controls
            } else if (controlId <= 0x07) {
              color = 0x0F; // Red for faders
            }

            colors.push({
              controlId,
              color,
              behaviour: 'static',
            });

            // Skip to next potential control (9 bytes processed)
            i += 9;
          }
        }
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
   * Encode custom mode data for Launch Control XL 3 transmission
   * Based on actual web editor protocol analysis
   */
  private static encodeCustomModeData(modeData: CustomModeMessage): number[] {
    const rawData: number[] = [];

    // Header: Mode data format indicator
    rawData.push(0x00, 0x20, 0x08);

    // Mode name: Direct ASCII encoding (not Midimunge!)
    if (modeData.name) {
      for (let i = 0; i < modeData.name.length && i < 16; i++) {
        rawData.push(modeData.name.charCodeAt(i));
      }
    }

    // Add control definitions - must be in specific order for device to accept
    // Sort controls by ID to ensure proper order
    const sortedControls = [...modeData.controls].sort((a, b) => a.controlId - b.controlId);

    for (const control of sortedControls) {
      // Control format from web editor for WRITE operation:
      // Faders: 0x49 [ID] 0x02 0x00 [CH] 0x01 0x40 0x00 [CC] 0x7F 0x00
      // Top encoders: 0x49 [ID] 0x02 0x05 [CH] 0x01 0x40 0x00 [CC] 0x7F 0x00
      // Mid encoders: 0x49 [ID] 0x02 0x09 [CH] 0x01 0x40 0x00 [CC] 0x7F 0x00
      // Bot encoders: 0x49 [ID] 0x02 0x0D [CH] 0x01 0x40 0x00 [CC] 0x7F 0x00

      rawData.push(0x49); // Control marker for WRITE
      rawData.push(control.controlId + 0x28); // IMPORTANT: Add 0x28 offset for controls!
      rawData.push(0x02); // Control definition type

      // Control type based on hardware position
      let controlType = 0x00;
      if (control.controlId >= 0x10 && control.controlId <= 0x17) {
        controlType = 0x05; // Top row encoders
      } else if (control.controlId >= 0x18 && control.controlId <= 0x1F) {
        controlType = 0x09; // Middle row encoders
      } else if (control.controlId >= 0x20 && control.controlId <= 0x27) {
        controlType = 0x0D; // Bottom row encoders
      } else if (control.controlId >= 0x00 && control.controlId <= 0x07) {
        controlType = 0x00; // Faders
      }

      rawData.push(controlType);
      rawData.push(control.channel); // Channel (0-based)
      rawData.push(0x01); // Parameter 1
      rawData.push(0x40); // Parameter 2 (behavior)
      rawData.push(0x00); // Min value (always 0x00 in write)
      rawData.push(control.ccNumber); // CC number
      rawData.push(0x7F); // Max value (always 0x7F in write)
      rawData.push(0x00); // Terminator
    }

    // CRITICAL: Add color/label data after controls - REQUIRED by device!
    // Without this section, the device rejects the message

    // Add minimal color data for each control (required)
    for (const control of sortedControls) {
      rawData.push(0x60); // Color marker
      rawData.push(control.controlId + 0x28); // Control ID with offset

      // You can also add label data with 0x69 marker, but colors seem to be minimum requirement
    }

    return rawData;
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