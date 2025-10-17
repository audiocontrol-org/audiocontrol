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
import type { ControlMapping, ColorMapping } from '../types/CustomMode.js';

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
  labels?: Map<number, string>;  // Control labels by ID
}

// Write acknowledgement message
export interface WriteAcknowledgementMessage extends SysExMessage {
  type: 'write_acknowledgement';
  page: number;
  status: number;
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

    // Check for Launch Control XL 3 format: 02 15 05 00 [operation] [slot/page]
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

      // Check if this is a write acknowledgement (operation 0x15)
      if (operation === 0x15) {
        return this.parseWriteAcknowledgement(messageData);
      }

      // If it's some other operation in the XL3 format, throw error
      throw new Error(`Unexpected operation in Launch Control XL 3 response: 0x${(operation ?? 0).toString(16)}`);
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
   * Parse write acknowledgement message
   *
   * Format: 02 15 05 00 15 [page] [status]
   *
   * Discovery: Playwright + CoreMIDI spy (2025-09-30)
   * Device sends ACK 24-27ms after receiving each page write.
   * Status 0x06 indicates successful receipt.
   *
   * Example: 02 15 05 00 15 00 06 = ACK for page 0, status success
   */
  private static parseWriteAcknowledgement(data: number[]): WriteAcknowledgementMessage {
    if (data.length < 7) {
      throw new Error('Invalid write acknowledgement message');
    }

    // Expected format after F0/F7 and manufacturer ID stripped:
    // 02 15 05 00 15 [PAGE] [STATUS]
    // Positions: 0  1  2  3  4     5      6
    const operation = data[4];
    const page = data[5] ?? 0;
    const status = data[6] ?? 0;

    if (operation !== 0x15) {
      throw new Error(`Unexpected operation in write acknowledgement: 0x${(operation ?? 0).toString(16)}`);
    }

    return {
      type: 'write_acknowledgement',
      manufacturerId: MANUFACTURER_ID,
      page,
      status,
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
   * Phase 1 Enhancement: Handle hybrid response format with mixed 0x48/0x49/0x40 markers
   * Device returns mixed format: 0x49 markers from writes become 0x48 in reads
   */
  private static parseCustomModeData(data: number[]): {
    controls: ControlMapping[];
    colors: ColorMapping[];
    name?: string;
  } {
    const controls: ControlMapping[] = [];
    const colors: ColorMapping[] = [];
    let modeName: string | undefined;

    // Phase 1 Fix: Enhanced name parsing with factory fallback handling
    modeName = this.parseName(data);

    // Phase 1 Fix: Enhanced control parsing with mixed format support
    const { parsedControls, parsedColors } = this.parseControls(data);
    controls.push(...parsedControls);
    colors.push(...parsedColors);

    // Phase 1 Fix: Enhanced label parsing with non-sequential control ID mapping
    this.parseControlLabels(data, controls);

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
   * Phase 1 Fix: Enhanced name parsing with factory fallback handling
   * Handles both custom names and factory format fallbacks (0x20 0x1F pattern)
   *
   * BUGFIX (2025-10-11): Stop reading at marker byte boundaries (0x48, 0x49, 0x60, 0x69, 0xF7)
   * to prevent including control/label/color markers in mode name.
   *
   * BUGFIX (Issue #40): Fixed parser pattern to match actual device format:
   * - Changed from 0x06 0x20 to just 0x20 (confirmed by MIDI capture analysis)
   * - Adjusted nameStart offset from i+3 to i+2 to account for removed byte
   */
  private static parseName(data: number[]): string | undefined {
    let nameStart = -1;
    let nameLength = -1;

    // Look for name patterns - check multiple possible formats
    for (let i = 0; i < data.length - 4; i++) {
      // Format 1: 0x01 0x20 0x10 0x2A (4 bytes + name) - write format
      if (data[i] === 0x01 && data[i + 1] === 0x20 && data[i + 2] === 0x10 && data[i + 3] === 0x2A) {
        nameStart = i + 4;
        // No explicit length, will read until terminator
        break;
      }
      // Format 2: 0x20 [length] [name bytes] - actual device format
      if (data[i] === 0x20) {
        const lengthByte = data[i + 1];
        // Check for factory pattern: 0x20 0x1F (indicates factory data)
        if (lengthByte === 0x1F) {
          // This is factory data, use slot-based fallback name
          return undefined; // Let caller use default slot name
        }
        // Use the length byte to know exactly how many characters to read
        nameLength = lengthByte ?? 0;
        nameStart = i + 2;  // FIXED: was i + 3
        break;
      }
      // Format 3: Direct ASCII after control sections - fallback
      const currentByte = data[i];
      if (i > 10 && currentByte !== undefined && currentByte >= 0x41 && currentByte <= 0x5A) { // Capital letters
        // Check if this looks like start of a mode name
        let possibleName = '';
        for (let j = i; j < Math.min(i + 20, data.length); j++) {
          const b = data[j];
          if (b !== undefined && b >= 0x20 && b <= 0x7E) {
            possibleName += String.fromCharCode(b);
          } else {
            break;
          }
        }
        // If it contains our test name or looks like a mode name
        if (possibleName.includes('ROUND_TRIP') ||
            (possibleName.length >= 3 && /^[A-Z_]+/.test(possibleName))) {
          nameStart = i;
          break;
        }
      }
    }

    if (nameStart >= 0) {
      const nameBytes = [];

      // If we have an explicit length from the header, use it
      if (nameLength > 0) {
        for (let i = 0; i < nameLength && nameStart + i < data.length; i++) {
          const byte = data[nameStart + i];
          if (byte !== undefined && byte >= 0x20 && byte <= 0x7E) {
            nameBytes.push(byte);
          }
        }
      } else {
        // Fall back to terminator-based parsing for formats without length
        // BUGFIX: Check for marker bytes BEFORE adding to nameBytes
        for (let i = nameStart; i < data.length; i++) {
          const byte = data[i];

          if (byte === undefined) break;

          // Stop at control marker bytes (0x48, 0x49)
          if (byte === 0x48 || byte === 0x49) {
            break;
          }

          // Stop at label marker byte (0x69)
          if (byte === 0x69) {
            break;
          }

          // Stop at color marker byte (0x60)
          if (byte === 0x60) {
            break;
          }

          // Stop at end of message (0xF7)
          if (byte === 0xF7) {
            break;
          }

          // Stop at terminator 0x21 (!)
          if (byte === 0x21) {
            break;
          }

          // Add printable ASCII characters
          if (byte >= 0x20 && byte <= 0x7E) {
            nameBytes.push(byte);
            // Safety limit
            if (nameBytes.length >= 20) {
              break;
            }
          } else if (nameBytes.length > 0) {
            // Non-printable after we've started collecting - likely end of name
            break;
          }
        }
      }

      if (nameBytes.length > 0) {
        return String.fromCharCode(...nameBytes).trim();
      }
    }

    return undefined;
  }

  /**
   * Phase 1 Fix: Enhanced control parsing with mixed format support
   * Handles hybrid format with mixed 0x48/0x49/0x40 markers
   */
  private static parseControls(data: number[]): {
    parsedControls: ControlMapping[];
    parsedColors: ColorMapping[];
  } {
    const controls: ControlMapping[] = [];
    const colors: ColorMapping[] = [];

    // Find where controls actually start (after name)
    let controlsStart = 0;

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
      // Phase 1 Fix: Parse write response format with 0x40 markers
      this.parseWriteResponseFormat(data, writeResponseStart, controls, colors);
    } else {
      // Phase 1 Fix: Enhanced parsing for READ responses with mixed formats
      this.parseReadResponseFormat(data, controlsStart, controls, colors);
    }

    return { parsedControls: controls, parsedColors: colors };
  }

  /**
   * Parse write response format: series of 0x40 [cc_number] pairs
   */
  private static parseWriteResponseFormat(
    data: number[],
    startPos: number,
    controls: ControlMapping[],
    colors: ColorMapping[]
  ): void {
    let controlIndex = 0;
    const expectedControls = [
      // Top row encoders (0x10-0x17)
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      // Middle row encoders (0x18-0x1F)
      0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
      // Bottom row encoders (0x20-0x27)
      0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27
    ];

    for (let i = startPos; i < data.length - 1; i += 2) {
      if (data[i] === 0x40) {
        const ccNumber = data[i + 1];

        if (ccNumber !== undefined && controlIndex < expectedControls.length) {
          const controlId = expectedControls[controlIndex];

          if (controlId === undefined) {
            controlIndex++;
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
          const color = this.getDefaultColorForControl(controlId);
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
  }

  /**
   * Parse read response format with 0x48 control definition markers
   */
  private static parseReadResponseFormat(
    data: number[],
    startPos: number,
    controls: ControlMapping[],
    colors: ColorMapping[]
  ): void {
    // Parse 0x48 control definition sections (device stores as 0x48, not 0x49)
    for (let i = startPos; i < data.length - 9; i++) {
      if (data[i] === 0x48) {
        const controlId = data[i + 1];
        const defType = data[i + 2];
        const channel = data[i + 4];
        const param1 = data[i + 5];
        const minValue = data[i + 7];
        const ccNumber = data[i + 8];
        const maxValue = data[i + 9];

        // Validate it's a control structure
        const isValidControl = defType === 0x02 &&
                              (param1 === 0x01 || param1 === 0x00) &&
                              controlId !== undefined && controlId <= 0x3F;

        if (isValidControl && controlId !== undefined &&
            minValue !== undefined && ccNumber !== undefined &&
            maxValue !== undefined && channel !== undefined) {

          controls.push({
            controlId,
            channel,
            ccNumber,
            minValue,
            maxValue,
            behaviour: 'absolute' as any,
          });

          // Create color mapping
          const color = this.getDefaultColorForControl(controlId);
          colors.push({
            controlId,
            color,
            behaviour: 'static',
          });

          // Skip ahead to avoid re-parsing this control
          i += 9;
        }
      }
    }
  }

  /**
   * Get default color for a control based on its ID range
   */
  private static getDefaultColorForControl(controlId: number): number {
    if (controlId >= 0x10 && controlId <= 0x17) {
      return 0x60; // Blue for top row encoders
    } else if (controlId >= 0x18 && controlId <= 0x1F) {
      return 0x48; // Yellow for middle row encoders
    } else if (controlId >= 0x20 && controlId <= 0x27) {
      return 0x3C; // Green for bottom row encoders
    } else if (controlId >= 0x28 && controlId <= 0x2F) {
      return 0x0F; // Red for faders
    } else if (controlId >= 0x30 && controlId <= 0x3F) {
      return 0x0F; // Red for buttons
    }
    return 0x0C; // Default off
  }


  /**
   * Phase 2 Fix: Parse control labels using length-encoding scheme
   *
   * Format discovered through empirical testing:
   * [0x60 + length] [controlID] [name_bytes] [0x60_terminator]
   *
   * The marker byte encodes the string length:
   * - 0x60 = empty string (0 chars)
   * - 0x65 = 5 chars (e.g., "TEST1")
   * - 0x69 = 9 chars (e.g., "High Pass")
   * - 0x6F = 15 chars (maximum length)
   */
  private static parseControlLabels(data: number[], controls: ControlMapping[]): void {
    if (controls.length === 0) {
      return;
    }

    const controlNames: Map<number, string> = new Map();

    // Scan for label entries
    for (let i = 0; i < data.length - 2; i++) {
      const markerByte = data[i];

      // Look for marker byte that encodes length (0x60-0x6F)
      if (markerByte !== undefined && markerByte >= 0x60 && markerByte <= 0x6F) {
        const length = markerByte - 0x60;
        const controlId = data[i + 1];

        // Verify this is a valid control ID (0x10-0x3F)
        if (controlId !== undefined && controlId >= 0x10 && controlId <= 0x3F) {
          // Read exactly `length` bytes as the name
          const nameBytes: number[] = [];
          for (let j = 0; j < length; j++) {
            const nameByte = data[i + 2 + j];
            if (nameByte !== undefined && nameByte >= 0x20 && nameByte <= 0x7E) {
              nameBytes.push(nameByte);
            }
          }

          // Store the name
          if (nameBytes.length > 0) {
            const name = String.fromCharCode(...nameBytes).trim();
            const canonicalControlId = this.mapLabelControlId(controlId);
            controlNames.set(canonicalControlId, name);
          }

          // Skip past this label entry (marker + controlID + name bytes + terminator)
          // But don't skip the terminator itself as it might be the marker for the next label
          i += 1 + length; // Will be incremented by loop, so this positions us at the terminator
        }
      }
    }

    // Apply names to controls based on their actual control IDs
    for (const control of controls) {
      if (control.controlId !== undefined) {
        const name = controlNames.get(control.controlId);
        if (name) {
          control.name = name;
        }
      }
    }
  }

  /**
   * Phase 2 Fix: Map label control IDs to canonical control IDs
   * Handles cases where labels use different control IDs than definitions
   *
   * Discovered mapping through empirical testing:
   * - Label IDs 0x19-0x1c (25-28) map to control IDs 26-29 (+1 offset)
   * - All other label IDs map directly to control IDs
   */
  private static mapLabelControlId(labelControlId: number): number {
    // Special case: label IDs 25-28 map to control IDs 26-29
    if (labelControlId >= 25 && labelControlId <= 28) {
      return labelControlId + 1;
    }
    // Default: direct mapping
    return labelControlId;
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
   *
   * UPDATED (Issue #36 Fix): Changed device ID from 0x11 (legacy Launch Control XL)
   * to 0x02 (Launch Control XL 3) to match the XL3 protocol used in read/write operations.
   *
   * Format: F0 00 20 29 02 77 [slot] F7
   * - 0x02 = Launch Control XL 3 device ID
   * - 0x77 = Template change message type
   */
  static buildTemplateChange(templateNumber: number): number[] {
    if (templateNumber < 0 || templateNumber > 15) {
      throw new Error('Template number must be 0-15');
    }

    return [
      0xF0, // SysEx start
      ...MANUFACTURER_ID,
      0x02, // Device ID (Launch Control XL 3) - FIXED from 0x11
      SysExMessageType.TEMPLATE_CHANGE,
      templateNumber,
      0xF7, // SysEx end
    ];
  }

  /**
   * Build custom mode read request with page support
   * Two requests are sent for a complete mode fetch:
   * - Page 0 (0x00): Gets controls 0x10-0x27 (encoders)
   * - Page 1 (0x03): Gets controls 0x28-0x3F (faders/buttons)
   *
   * The slot byte in the SysEx message directly selects the target slot (0-14).
   * Slot 15 is reserved for immutable factory content and cannot be read or written.
   * DAW port protocol is NOT required for slot selection.
   */
  static buildCustomModeReadRequest(slot: number, page: number = 0): number[] {
    if (slot < 0 || slot > 14) {
      throw new Error('Custom mode slot must be 0-14');
    }
    if (page < 0 || page > 1) {
      throw new Error('Page must be 0 (encoders) or 1 (faders/buttons)');
    }

    // Format: F0 00 20 29 02 15 05 00 40 [PAGE] [SLOT] F7
    // Where PAGE = 0x00 for first 24 controls, 0x03 for second 24 controls
    // And SLOT = slot number (0-14) - slot 15 is reserved for immutable factory content
    //
    // Discovery (2025-10-01): The SysEx message includes a slot parameter.
    // Using the slot number directly (0-14) works correctly.
    // Slot 15 (0x0F) is reserved and cannot be read or written.
    // DAW port protocol is NOT required for slot selection.
    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x40,             // Read operation
      page === 0 ? 0x00 : 0x03, // Page byte: 0x00 for encoders, 0x03 for faders/buttons
      slot,             // Slot byte: slot number (0-14, slot 15 reserved)
      0xF7              // SysEx end
    ];
  }


  /**
   * Build custom mode write request
   *
   * The slot byte in the SysEx message directly selects the target slot (0-14).
   * Slot 15 is reserved for immutable factory content and cannot be written.
   * DAW port protocol is NOT required for slot selection.
   */
  static buildCustomModeWriteRequest(slot: number, page: number, modeData: CustomModeMessage): number[] {
    if (slot < 0 || slot > 14) {
      throw new Error('Custom mode slot must be 0-14');
    }
    if (page < 0 || page > 3) {
      throw new Error('Page must be 0-3');
    }

    // Validate the custom mode data
    this.validateCustomModeData(modeData);

    // Encode the custom mode data
    const encodedData = this.encodeCustomModeData(modeData);

    // CRITICAL DISCOVERY FROM WEB EDITOR ANALYSIS:
    // Write protocol requires multiple pages. The page parameter specifies which page.
    // Page 0: Controls 0x10-0x27 (IDs 16-39, first 24 hardware controls)
    // Page 3: Controls 0x28-0x3F (IDs 40-63, remaining 24 hardware controls)
    // Note: Control IDs 0x00-0x0F do not exist on the device hardware
    //
    // Format: F0 00 20 29 02 15 05 00 45 [page] [slot] [encoded data] F7
    //
    // The slot byte directly selects the target slot (0-14).
    // Slot 15 (0x0F) is reserved for immutable factory content and cannot be written.
    // DAW port protocol is NOT required for slot selection.

    return [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID (Novation)
      0x02,             // Device ID (Launch Control XL 3)
      0x15,             // Command (Custom mode)
      0x05,             // Sub-command
      0x00,             // Reserved
      0x45,             // Write operation with data
      page,             // Page number (0 or 3 for write operations)
      slot,             // Slot byte: slot number (0-14, slot 15 reserved)
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

    // Add encoded name with correct prefix
    const modeName = modeData.name || 'CUSTOM';
    const nameEncoded = this.encodeName(modeName);
    rawData.push(...nameEncoded);

    // Create a map of user-provided controls by ID
    const userControls = new Map<number, any>();
    for (const control of modeData.controls) {
      const controlId = control.controlId;
      if (controlId !== undefined) {
        userControls.set(controlId, control);
      }
    }

    // Web editor format: ONLY send controls that are actually specified
    // Sort control IDs for consistent output
    const specifiedControlIds = Array.from(userControls.keys()).sort((a, b) => a - b);

    // Write control definitions ONLY for user-specified controls
    for (const controlId of specifiedControlIds) {
      const userControl = userControls.get(controlId);

      // Determine control type based on ID range
      let controlType: number;
      let defaultCC: number;

      if (controlId >= 0x10 && controlId <= 0x17) {
        // Top row encoders
        controlType = 0x05;
        defaultCC = 0x0D + (controlId - 0x10); // CC 13-20
      } else if (controlId >= 0x18 && controlId <= 0x1F) {
        // Middle row encoders
        controlType = 0x09;
        defaultCC = 0x15 + (controlId - 0x18); // CC 21-28
      } else if (controlId >= 0x20 && controlId <= 0x27) {
        // Bottom row encoders
        controlType = 0x0D;
        defaultCC = 0x1D + (controlId - 0x20); // CC 29-36
      } else if (controlId >= 0x28 && controlId <= 0x2F) {
        // Faders
        controlType = 0x00;
        defaultCC = 0x05 + (controlId - 0x28); // CC 5-12
      } else if (controlId >= 0x30 && controlId <= 0x37) {
        // First row buttons
        controlType = 0x19;
        defaultCC = 0x25 + (controlId - 0x30); // CC 37-44
      } else {
        // Second row buttons (0x38-0x3F)
        controlType = 0x25;
        defaultCC = 0x2D + (controlId - 0x38); // CC 45-52
      }

      // Use user-provided CC if available, otherwise use default
      const cc = userControl ? (userControl.ccNumber ?? userControl.cc ?? defaultCC) : defaultCC;

      // Use user-provided channel if available, otherwise default to 0 (channel 1)
      const channel = userControl ? (userControl.midiChannel ?? userControl.channel ?? 0) : 0;

      // Write control structure: 11 bytes (matching web editor format exactly)
      rawData.push(0x49); // Write control marker
      rawData.push(controlId); // Control ID
      rawData.push(0x02); // Definition type
      rawData.push(controlType); // Control type based on position
      rawData.push(channel); // MIDI channel (0-15)
      rawData.push(0x01); // Always 0x01
      rawData.push(0x48); // Always 0x48 (verified from web editor MIDI captures)
      rawData.push(0x00); // Always 0x00
      rawData.push(cc); // CC number
      rawData.push(0x7F); // Max value (always 0x7F in write)
      rawData.push(0x00); // Terminator
    }

    // Web editor format: Color markers ONLY for specified controls, 2 bytes each
    for (const controlId of specifiedControlIds) {
      rawData.push(0x60); // LED color marker
      rawData.push(controlId); // Control ID
      // Note: Web editor format is exactly 2 bytes - no color value byte
    }

    // Encode labels if provided
    // Format: [0x60 + length] [controlID] [name_bytes]
    // The marker byte encodes the string length: 0x60=0 chars, 0x65=5 chars, 0x6F=15 chars (max)
    if (modeData.labels && modeData.labels.size > 0) {
      // Sort labels by control ID for consistent output
      const sortedLabels = Array.from(modeData.labels.entries()).sort((a, b) => a[0] - b[0]);

      for (const [controlId, label] of sortedLabels) {
        if (label && label.length > 0) {
          // Truncate to 15 characters max (0x6F - 0x60 = 15)
          const truncatedLabel = label.substring(0, 15);
          const labelBytes = Array.from(truncatedLabel).map(c => c.charCodeAt(0));

          // Marker byte: 0x60 + length
          rawData.push(0x60 + labelBytes.length);
          // Control ID
          rawData.push(controlId);
          // Label bytes
          rawData.push(...labelBytes);
        }
      }

      // Terminator: 0x60 (empty marker) to end label section
      rawData.push(0x60);
    }

    return rawData;
  }

  /**
   * Encode a name string with the correct Launch Control XL3 prefix
   * Uses 0x20 [length] [name_bytes] format as confirmed by MIDI capture analysis
   *
   * @param name - Name string to encode (max 18 chars per PROTOCOL.md v2.1)
   * @returns Encoded name bytes with prefix
   */
  private static encodeName(name: string): number[] {
    // Truncate to 18 characters and convert to bytes (FIXED: was 16)
    const nameBytes = Array.from(name.substring(0, 18)).map(c => c.charCodeAt(0));

    // Web editor format: 0x20 [length] [name_bytes]
    return [
      0x20,              // Prefix byte
      nameBytes.length,  // Length byte
      ...nameBytes
    ];
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
