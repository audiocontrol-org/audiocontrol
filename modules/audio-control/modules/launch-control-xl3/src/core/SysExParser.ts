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

import { Midimunge } from './Midimunge.js';
import type { CustomMode, ControlMapping, ColorMapping } from '../types/CustomMode.js';

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
  serialNumber?: string | number[];
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
// ControlMapping and ColorMapping interfaces are now imported from types/CustomMode.ts

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
      manufacturerId: [data[4] ?? 0, data[5] ?? 0, data[6] ?? 0],
      familyCode: ((data[7] ?? 0) << 8) | (data[8] ?? 0),
      familyMember: ((data[9] ?? 0) << 8) | (data[10] ?? 0),
      softwareRevision: [data[11] ?? 0, data[12] ?? 0, data[13] ?? 0, data[14] ?? 0],
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
      templateNumber: data[2] ?? 0,
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
    const slot = data[5] ?? 0;

    if (operation !== 0x10) {
      throw new Error(`Unexpected operation in Launch Control XL 3 response: 0x${(operation ?? 0).toString(16)}`);
    }

    // Parse the actual custom mode data (starts after slot byte at position 6)
    const rawModeData = data.slice(6);
    const { controls, colors, name } = this.parseCustomModeData(rawModeData);

    const message: CustomModeMessage = {
      type: 'custom_mode_response',
      manufacturerId: MANUFACTURER_ID,
      slot,
      controls,
      colors,
      data,
    };

    if (name !== undefined) {
      message.name = name;
    }

    return message;
  }

  /**
   * Parse legacy custom mode response (for older devices)
   */
  private static parseCustomModeResponse(data: number[]): CustomModeMessage {
    if (data.length < 4) {
      throw new Error('Invalid custom mode response');
    }

    const slot = data[2];
    if (slot === undefined) {
      throw new Error('Invalid slot in custom mode response');
    }
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
      for (let i = nameStart; i < data.length - 2; i++) {
        const byte = data[i];
        const nextByte = data[i + 1];
        const thirdByte = data[i + 2];

        // Stop at specific pattern: 0x49 0x21 0x00 (write response control section start)
        if (byte === 0x49 && nextByte === 0x21 && thirdByte === 0x00) {
          nameEnd = i;
          break;
        }

        // Stop when we encounter non-printable ASCII
        if (byte === undefined || byte < 32 || byte > 126) {
          nameEnd = i;
          break;
        }

        // Stop at control markers (0x48 or 0x49) that look like valid control structures
        if ((byte === 0x48 || byte === 0x49) && i >= nameStart + 1) {
          // Validate this is actually a control marker by checking next few bytes
          const defType = data[i + 2];
          if (nextByte !== undefined && defType === 0x02 && nextByte >= 0x20 && nextByte <= 0x7F) {
            nameEnd = i;
            break;
          }
        }

        // Add printable ASCII to name
        nameBytes.push(byte);

        // Safety limit: mode names shouldn't exceed 16 characters
        if (nameBytes.length >= 16) {
          nameEnd = i + 1;
          break;
        }
      }

      if (nameBytes.length > 0) {
        modeName = String.fromCharCode(...nameBytes).trim();
      }
    }

    // Parse control definitions
    // In READ responses: 0x48 [ID] 0x02 [TYPE] [CH] 0x01 0x48 [MIN] [CC] [MAX]
    // In WRITE responses: different format with 0x40 markers

    // Find where controls actually start (after name)
    let controlsStart = nameEnd > 0 ? nameEnd : 0;
    let controlNamesStart = -1;

    // Handle response format after WRITE operation
    // Look for pattern: 0x49 0x21 0x00 followed by 0x40 control data
    let writeResponseStart = -1;
    for (let i = controlsStart; i < data.length - 2; i++) {
      if (data[i] === 0x49 && data[i + 1] === 0x21 && data[i + 2] === 0x00) {
        writeResponseStart = i + 3;
        break;
      }
    }

    if (writeResponseStart > 0) {
      // Parse write response format: series of 0x40 [cc_number] pairs
      // The control IDs are inferred from the sequence position
      let controlIndex = 0;
      const expectedControls = [
        // Top row encoders (0x10-0x17)
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        // Middle row encoders (0x18-0x1F)
        0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
        // Bottom row encoders (0x20-0x27)
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27
      ];

      for (let i = writeResponseStart; i < data.length - 1; i += 2) {
        if (data[i] === 0x40) {
          const ccNumber = data[i + 1];

          if (ccNumber !== undefined && controlIndex < expectedControls.length) {
            const controlId = expectedControls[controlIndex];

            if (controlId === undefined) {
              continue;
            }

            controls.push({
              controlId,
              channel: 0, // Default channel
              ccNumber,
              minValue: 0,
              maxValue: 127,
              behaviour: 'absolute' as any,
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
              behaviour: 'static', // Default behavior
            });

            controlIndex++;
          }
        } else {
          // Stop parsing if we don't find expected 0x40 marker
          break;
        }
      }
    } else {
      // Fall back to original parsing for READ responses
      for (let i = controlsStart; i < data.length - 9; i++) {
        // Handle both 0x48 (read) and 0x49 (write) markers
        if (data[i] === 0x48 || data[i] === 0x49) {
          if (i + 9 < data.length) {
            const controlId = data[i + 1];
            const defType = data[i + 2];
            const _controlType = data[i + 3];
            const channel = data[i + 4];
            const param1 = data[i + 5];

            // Validate it's a control structure (not part of name or other data)
            const isValidControl = defType === 0x02 &&
                                  (param1 === 0x01 || param1 === 0x00) &&
                                  controlId !== undefined && controlId <= 0x3F; // Valid control ID range

            if (isValidControl && controlId !== undefined) {
              const minValue = data[i + 7];
              const ccNumber = data[i + 8];
              const maxValue = data[i + 9];

              // Ensure all required values are defined
              if (minValue !== undefined && ccNumber !== undefined && maxValue !== undefined &&
                  channel !== undefined && _controlType !== undefined) {
                // Determine control behavior
                let behaviour = 'absolute';

                controls.push({
                  controlId,
                  channel,
                  ccNumber,
                  minValue,
                  maxValue,
                  behaviour: behaviour as any,
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
                  behaviour: 'static', // Default behavior
                });
              }

              // Skip to next potential control (9 bytes processed)
              i += 9;
            }
          }
        }
      }
    }

    // Parse control names - they appear after all control definitions
    // Look for the control names section which starts with byte patterns like 0x62, 0x68, 0x69
    if (controls.length > 0) {
      // Find where control names section starts - usually after last control definition
      // Look for patterns like 0x62, 0x68, 0x69 followed by ASCII text
      for (let i = controlsStart; i < data.length - 2; i++) {
        // Check if we've passed all control definitions and found name markers
        const byte = data[i];
        if ((byte === 0x62 || byte === 0x68 || byte === 0x69 || byte === 0x60 || byte === 0x6A || byte === 0x6F) &&
            data[i + 1] !== undefined && data[i + 1]! >= 0x30) { // Followed by ASCII
          controlNamesStart = i;
          break;
        }
      }

      if (controlNamesStart >= 0) {
        // Parse control names
        const controlNames: Map<number, string> = new Map();
        let currentControlId = -1;
        let currentName = '';

        for (let i = controlNamesStart; i < data.length; i++) {
          const byte = data[i];

          // Check for control ID markers (0x60-0x6F range often used)
          if (byte !== undefined && byte >= 0x60 && byte <= 0x6F) {
            // Save previous name if exists
            if (currentControlId >= 0 && currentName.length > 0) {
              controlNames.set(currentControlId, currentName.trim());
            }

            // Map marker to control ID (this mapping may need adjustment)
            // Based on hex dump: 0x69 = control 0x28-0x2F range, 0x62 = 0x30 range, etc.
            if (byte === 0x69) {
              // Next byte after 0x69 is the control index
              const nextByte = data[i + 1];
              if (nextByte !== undefined && nextByte >= 0x28 && nextByte <= 0x3F) {
                currentControlId = nextByte;
                i++; // Skip the control ID byte
              }
            } else if (byte === 0x62 || byte === 0x68 || byte === 0x6A || byte === 0x6F) {
              // These seem to be followed by control index
              const nextByte = data[i + 1];
              if (nextByte !== undefined && nextByte >= 0x30 && nextByte <= 0x3F) {
                currentControlId = nextByte;
                i++; // Skip the control ID byte
              }
            } else if (byte === 0x60) {
              // 0x60 followed by control ID
              const nextByte = data[i + 1];
              if (nextByte !== undefined && (nextByte >= 0x28 && nextByte <= 0x3F)) {
                currentControlId = nextByte;
                i++; // Skip the control ID byte
              }
            }
            currentName = '';
          } else if (byte !== undefined && byte >= 32 && byte <= 126) {
            // ASCII printable character - part of name
            currentName += String.fromCharCode(byte);
          } else if (currentName.length > 0 && (byte === 0x60 || byte === 0x00 || byte === 0xF7)) {
            // End of current name
            if (currentControlId >= 0 && currentName.length > 0) {
              controlNames.set(currentControlId, currentName.trim());
              currentName = '';
            }
          }
        }

        // Save last name if exists
        if (currentControlId >= 0 && currentName.length > 0) {
          controlNames.set(currentControlId, currentName.trim());
        }

        // Apply names to controls
        for (const control of controls) {
          if (control.controlId !== undefined) {
            const name = controlNames.get(control.controlId);
            if (name) {
              control.name = name;
            }
          }
        }
      }
    }

    const result: { controls: ControlMapping[]; colors: ColorMapping[]; name?: string } = {
      controls,
      colors
    };

    if (modeName !== undefined) {
      result.name = modeName;
    }

    return result;
  }

  /**
   * Build device inquiry request
   * @deprecated Use the complete handshake sequence with buildNovationSyn()
   * and buildUniversalDeviceInquiry() instead. This method only performs
   * partial handshake and uses incorrect device ID.
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
   * Build Novation SYN message for complete handshake sequence
   *
   * This is the first message in the 4-message handshake protocol.
   * The device will respond with a SYN-ACK containing its serial number.
   *
   * Message format: F0 00 20 29 00 42 02 F7 (8 bytes)
   *
   * @returns {number[]} SysEx message bytes for Novation SYN request
   */
  static buildNovationSyn(): number[] {
    return [
      0xF0,              // SysEx start
      0x00, 0x20, 0x29,  // Novation manufacturer ID
      0x00,              // Device model (Launch Control)
      0x42,              // Command (handshake)
      0x02,              // Sub-command (SYN)
      0xF7               // SysEx end
    ];
  }

  /**
   * Build Universal Device Inquiry message with correct device ID
   *
   * This is the third message in the 4-message handshake protocol (ACK).
   * Uses the correct broadcast device ID (0x7F) instead of 0x00.
   *
   * Message format: F0 7E 7F 06 01 F7 (6 bytes)
   *
   * @returns {number[]} SysEx message bytes for Universal Device Inquiry
   */
  static buildUniversalDeviceInquiry(): number[] {
    return [
      0xF0,              // SysEx start
      0x7E,              // Universal Non-Realtime
      0x7F,              // Device ID (broadcast)
      0x06,              // Sub-ID 1 (Device Inquiry)
      0x01,              // Sub-ID 2 (Inquiry Request)
      0xF7               // SysEx end
    ];
  }

  /**
   * Parse Novation SYN-ACK response and extract serial number
   *
   * This parses the second message in the 4-message handshake protocol.
   * The SYN-ACK response contains the device's serial number.
   *
   * Expected format: F0 00 20 29 00 42 02 [SERIAL_NUMBER] F7 (22 bytes)
   * Serial number is 14 ASCII characters at bytes 7-20.
   *
   * @param {number[]} data - Raw SysEx message bytes including F0/F7
   * @returns {object} Parsing result with validity flag and optional serial number
   * @returns {boolean} returns.valid - True if message is valid SYN-ACK
   * @returns {string} [returns.serialNumber] - Device serial number if valid
   */
  static parseNovationSynAck(data: number[]): { valid: boolean; serialNumber?: string } {
    // Validate message length (should be exactly 22 bytes)
    if (data.length !== 22) {
      return { valid: false };
    }

    // Validate SysEx start and end bytes
    if (data[0] !== 0xF0 || data[data.length - 1] !== 0xF7) {
      return { valid: false };
    }

    // Verify Novation manufacturer ID (bytes 1-3)
    if (data[1] !== 0x00 || data[2] !== 0x20 || data[3] !== 0x29) {
      return { valid: false };
    }

    // Verify command bytes (bytes 4-6)
    if (data[4] !== 0x00 || data[5] !== 0x42 || data[6] !== 0x02) {
      return { valid: false };
    }

    // Extract serial number (bytes 7-20, 14 characters)
    const serialBytes = data.slice(7, 21);

    // Validate that all serial bytes are printable ASCII
    for (const byte of serialBytes) {
      if (byte < 32 || byte > 126) {
        return { valid: false };
      }
    }

    const serialNumber = String.fromCharCode(...serialBytes);

    // Basic validation of Launch Control XL3 serial number format
    // Should start with "LX2" followed by digits
    if (!serialNumber.startsWith('LX2') || serialNumber.length !== 14) {
      return { valid: false };
    }

    return { valid: true, serialNumber };
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
   * Build custom mode write message from CustomMode object
   */
  static buildCustomModeWriteMessage(slot: number, customMode: CustomMode): number[] {
    if (slot < 0 || slot > 15) {
      throw new Error('Custom mode slot must be 0-15');
    }

    const rawData: number[] = [];

    // Header: Mode data format indicator
    rawData.push(0x00, 0x20, 0x08);

    // Mode name: Direct ASCII encoding (max 8 chars)
    const nameBytes = customMode.name.substring(0, 8);
    for (let i = 0; i < nameBytes.length; i++) {
      rawData.push(nameBytes.charCodeAt(i));
    }

    // Sort controls by ID for consistency
    const sortedControls = Object.values(customMode.controls)
      .filter(control => control.controlId !== undefined)
      .sort((a, b) => (a.controlId ?? 0) - (b.controlId ?? 0));

    // Add control definitions with 0x49 marker and offset
    for (const control of sortedControls) {
      // Write control structure: 11 bytes
      rawData.push(0x49); // Write control marker
      rawData.push((control.controlId ?? 0) + 0x28); // Control ID with offset
      rawData.push(0x02); // Definition type
      // Convert control type to number if it's a string
      const controlType = control.controlType ?? control.type ?? 0x00;
      const controlTypeNum = typeof controlType === 'string' ?
        (controlType === 'knob' ? 0x05 : controlType === 'fader' ? 0x00 : controlType === 'button' ? 0x09 : 0x00) :
        controlType;
      rawData.push(controlTypeNum); // Control type
      rawData.push(control.midiChannel ?? control.channel ?? 0); // MIDI channel (0-15)
      rawData.push(0x01); // Parameter 1
      rawData.push(0x40); // Parameter 2
      rawData.push(0x00); // Min value (always 0 in write)
      rawData.push(control.ccNumber ?? control.cc ?? 0); // CC number
      rawData.push(0x7F); // Max value (always 0x7F in write)
      rawData.push(0x00); // Terminator
    }

    // Add label data if present
    if (customMode.labels && customMode.labels.size > 0) {
      for (const [controlId, label] of customMode.labels) {
        rawData.push(0x69); // Label marker
        rawData.push(controlId + 0x28); // Control ID with offset
        // Add label text
        for (let i = 0; i < label.length; i++) {
          rawData.push(label.charCodeAt(i));
        }
      }
    } else {
      // Generate default labels for controls
      for (const control of sortedControls) {
        const controlId = control.controlId ?? 0;
        rawData.push(0x69); // Label marker
        rawData.push(controlId + 0x28); // Control ID with offset
        const label = this.generateControlLabel(controlId);
        for (let i = 0; i < label.length; i++) {
          rawData.push(label.charCodeAt(i));
        }
      }
    }

    // Add color data if present
    if (customMode.colors && customMode.colors.size > 0) {
      for (const [controlId, color] of customMode.colors) {
        rawData.push(0x60); // Color marker
        rawData.push(controlId + 0x28); // Control ID with offset
        rawData.push(color); // Color value
      }
    } else {
      // Add default colors (off) for all controls
      for (const control of sortedControls) {
        const controlId = control.controlId ?? 0;
        rawData.push(0x60); // Color marker
        rawData.push(controlId + 0x28); // Control ID with offset
      }
    }

    // Build complete message
    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x45,             // Write operation
      slot,             // Slot number
      ...rawData,       // Custom mode data
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

    // VERIFIED PROTOCOL: Based on actual web editor traffic capture
    // Format: F0 00 20 29 02 15 05 00 45 [SLOT] [encoded data] F7
    // The web editor DOES use 0x45 for write operations with full data payload
    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x45,             // Write operation with data (confirmed from web editor)
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
      const ccNumber = control.ccNumber ?? control.cc ?? 0;
      if (ccNumber < 0 || ccNumber > 127) {
        throw new Error('CC number must be 0-127');
      }

      const channel = control.channel ?? control.midiChannel ?? 0;
      if (channel < 0 || channel > 15) {
        throw new Error('Channel must be 0-15');
      }

      const minValue = control.minValue ?? control.min ?? 0;
      if (minValue < 0 || minValue > 127) {
        throw new Error('Min value must be 0-127');
      }

      const maxValue = control.maxValue ?? control.max ?? 127;
      if (maxValue < 0 || maxValue > 127) {
        throw new Error('Max value must be 0-127');
      }

      if (minValue > maxValue) {
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
   *
   * IMPORTANT: This creates a complete message with ALL hardware controls,
   * not just the ones specified in modeData.controls. The device expects
   * definitions for all possible control IDs.
   */
  private static encodeCustomModeData(modeData: CustomModeMessage): number[] {
    const rawData: number[] = [];

    // Header: Mode data format indicator
    rawData.push(0x00, 0x20, 0x08);

    // Mode name: Direct ASCII encoding (max 8 chars according to protocol)
    const modeName = modeData.name || 'CUSTOM';
    const nameToUse = modeName.substring(0, 8);
    for (let i = 0; i < nameToUse.length; i++) {
      rawData.push(nameToUse.charCodeAt(i));
    }

    // Create a mapping of provided controls for lookup
    const controlMap = new Map<number, ControlMapping>();
    for (const control of modeData.controls) {
      if (control.controlId !== undefined) {
        controlMap.set(control.controlId, control);
      }
    }

    // Define ALL hardware control IDs that need to be included
    // Based on Launch Control XL 3 hardware layout
    const allControlIds = [
      // Faders (0x00-0x07)
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      // Top row encoders (0x10-0x17)
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      // Middle row encoders (0x18-0x1F)
      0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
      // Bottom row encoders (0x20-0x27)
      0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
      // Side buttons (0x28-0x2F)
      0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F,
      // Bottom buttons (0x30-0x37)
      0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37
    ];

    // Add control definitions for ALL hardware controls
    for (const controlId of allControlIds) {
      // Get user-defined control or create default
      const userControl = controlMap.get(controlId);
      const channel = userControl?.channel ?? userControl?.midiChannel ?? 0;
      const ccNumber = userControl?.ccNumber ?? userControl?.cc ?? controlId; // Default CC = control ID

      rawData.push(0x49); // Control marker for WRITE
      rawData.push(controlId + 0x28); // Add 0x28 offset for controls
      rawData.push(0x02); // Control definition type

      // Control type based on hardware position
      let controlType = 0x00;
      if (controlId >= 0x10 && controlId <= 0x17) {
        controlType = 0x05; // Top row encoders
      } else if (controlId >= 0x18 && controlId <= 0x1F) {
        controlType = 0x09; // Middle row encoders
      } else if (controlId >= 0x20 && controlId <= 0x27) {
        controlType = 0x0D; // Bottom row encoders
      } else if (controlId >= 0x00 && controlId <= 0x07) {
        controlType = 0x00; // Faders
      } else if (controlId >= 0x28 && controlId <= 0x3F) {
        controlType = 0x19; // Buttons (typical button type)
      }

      rawData.push(controlType);
      rawData.push(channel); // Channel (0-based)
      rawData.push(0x01); // Parameter 1
      rawData.push(0x40); // Parameter 2 (behavior)
      rawData.push(0x00); // Min value (always 0x00 in write)
      rawData.push(ccNumber); // CC number
      rawData.push(0x7F); // Max value (always 0x7F in write)
      rawData.push(0x00); // Terminator
    }

    // CRITICAL: Add label/color data after controls - REQUIRED by device!
    // Without this section, the device rejects the message

    // Add label data for ALL controls
    for (const controlId of allControlIds) {
      const userControl = controlMap.get(controlId);
      rawData.push(0x69); // Label marker
      rawData.push(controlId + 0x28); // Control ID with offset

      // Use actual control name if available, otherwise generate generic label
      const labelText = userControl?.name && userControl.name.trim() !== ''
        ? userControl.name.substring(0, 12) // Truncate to max 12 chars for device compatibility
        : this.generateControlLabel(controlId);
      for (let i = 0; i < labelText.length; i++) {
        rawData.push(labelText.charCodeAt(i));
      }
    }

    // Add color data for ALL controls (required for device acceptance)
    for (const controlId of allControlIds) {
      // Find the corresponding color for this control
      const colorEntry = modeData.colors?.find(c => c.controlId === controlId);
      const colorValue = colorEntry?.color ?? 0x0C; // Default color if not specified

      rawData.push(0x60); // Color marker
      rawData.push(controlId + 0x28); // Control ID with offset
      rawData.push(colorValue); // Actual color value
    }

    return rawData;
  }


  /**
   * Generate a simple label for a control based on its ID and type
   */
  private static generateControlLabel(controlId: number): string {
    if (controlId >= 0x00 && controlId <= 0x07) {
      return `Fader ${controlId + 1}`;
    } else if (controlId >= 0x10 && controlId <= 0x17) {
      return `Top ${controlId - 0x10 + 1}`;
    } else if (controlId >= 0x18 && controlId <= 0x1F) {
      return `Mid ${controlId - 0x18 + 1}`;
    } else if (controlId >= 0x20 && controlId <= 0x27) {
      return `Bot ${controlId - 0x20 + 1}`;
    } else if (controlId >= 0x28 && controlId <= 0x3F) {
      return `Btn ${controlId - 0x28 + 1}`;
    } else {
      return `Ctrl ${controlId}`;
    }
  }

  /**
   * Build LED control message
   */
  static buildLedControl(controlId: number, color: number, behaviour: 'static' | 'flash' | 'pulse' | 'flashing' | 'pulsing' = 'static'): number[] {
    if (controlId < 0 || controlId > 127) {
      throw new Error('Control ID must be 0-127');
    }

    if (color < 0 || color > 127) {
      throw new Error('Color must be 0-127');
    }

    let behaviorByte = color;

    if (behaviour === 'flash' || behaviour === 'flashing') {
      behaviorByte |= 0x08;
    } else if (behaviour === 'pulse' || behaviour === 'pulsing') {
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
   * Check if SysEx message is a device inquiry response
   *
   * This validates the fourth message in the 4-message handshake protocol.
   * Device inquiry responses follow the Universal Non-Realtime format.
   *
   * Expected format: F0 7E [device_id] 06 02 [manufacturer_id] [device_info] F7
   *
   * @param {number[]} data - Raw SysEx message bytes including F0/F7
   * @returns {boolean} True if message is a valid device inquiry response
   */
  static isDeviceInquiryResponse(data: number[]): boolean {
    // Minimum length check (F0 7E XX 06 02 + at least 3 bytes manufacturer ID + F7)
    if (data.length < 9) {
      return false;
    }

    // Validate SysEx start and end bytes
    if (data[0] !== 0xF0 || data[data.length - 1] !== 0xF7) {
      return false;
    }

    // Check Universal Non-Realtime header
    if (data[1] !== 0x7E) {
      return false;
    }

    // Device ID can be any value (data[2])

    // Check Sub-ID1 (General Information)
    if (data[3] !== 0x06) {
      return false;
    }

    // Check Sub-ID2 (Identity Reply)
    if (data[4] !== 0x02) {
      return false;
    }

    // Must have at least manufacturer ID (3 bytes minimum)
    if (data.length < 9) {
      return false;
    }

    return true;
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
    const manufacturerByte = data[1];
    if (manufacturerByte === undefined) {
      return null;
    }

    if (manufacturerByte === 0x7E || manufacturerByte === 0x7F) {
      return null;
    }

    // Extract 3-byte manufacturer ID
    if (manufacturerByte === 0x00) {
      return data.slice(1, 4);
    }

    // Single byte manufacturer ID
    return [manufacturerByte];
  }
}

export default SysExParser;