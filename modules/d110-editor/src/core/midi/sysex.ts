/**
 * Roland D-110 SysEx message generation and parsing
 *
 * SysEx format:
 * F0 41 [dev] 16 [cmd] [AA] [BB] [CC] [data...] [checksum] F7
 *
 * Where:
 * - F0 = SysEx start
 * - 41 = Roland manufacturer ID
 * - dev = Device ID (0x10-0x1F)
 * - 16 = D-110 model ID
 * - cmd = Command (0x11 = RQ1 request, 0x12 = DT1 data)
 * - AA BB CC = 3-byte address
 * - data = Parameter data (for DT1) or size (for RQ1)
 * - checksum = Roland checksum
 * - F7 = SysEx end
 */

import type { D110Address } from '@/core/midi/types';
import {
  ROLAND_ID,
  D110_MODEL_ID,
  DEFAULT_DEVICE_ID,
  SYSEX_START,
  SYSEX_END,
  D110_COMMANDS,
} from '@/core/midi/constants';

/**
 * Calculate Roland checksum for address and data bytes
 *
 * Algorithm:
 * 1. Sum all address and data bytes
 * 2. Apply modulo 128
 * 3. Subtract from 128
 * 4. If result is 128, return 0
 *
 * @param data - Array of bytes to checksum
 * @returns Checksum byte (0-127)
 */
export function calculateChecksum(data: number[]): number {
  let sum = 0;
  for (const byte of data) {
    sum += byte;
  }
  sum = sum & 0x7f; // mod 128
  sum = 0x80 - sum; // subtract from 128
  if (sum === 0x80) {
    sum = 0; // if result is 128, return 0
  }
  return sum;
}

/**
 * Build a DT1 (Data Set) SysEx message
 *
 * Used to send parameter values to the D-110.
 *
 * @param address - 3-byte address
 * @param data - Data bytes to send
 * @param deviceId - Device ID (default 0x10)
 * @returns Complete SysEx message as byte array
 */
export function buildDT1Message(
  address: D110Address,
  data: number[],
  deviceId: number = DEFAULT_DEVICE_ID
): number[] {
  const addressAndData = [address.aa, address.bb, address.cc, ...data];
  const checksum = calculateChecksum(addressAndData);

  return [
    SYSEX_START,
    ROLAND_ID,
    deviceId,
    D110_MODEL_ID,
    D110_COMMANDS.DATA,
    address.aa,
    address.bb,
    address.cc,
    ...data,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Build an RQ1 (Data Request) SysEx message
 *
 * Used to request data from the D-110.
 *
 * @param address - 3-byte start address
 * @param size - Number of bytes to request (2-byte value)
 * @param deviceId - Device ID (default 0x10)
 * @returns Complete SysEx message as byte array
 */
export function buildRQ1Message(
  address: D110Address,
  size: number,
  deviceId: number = DEFAULT_DEVICE_ID
): number[] {
  // Size is encoded as 2 bytes (MSB, LSB) with 7-bit encoding
  const sizeMsb = (size >> 7) & 0x7f;
  const sizeLsb = size & 0x7f;

  const addressAndSize = [address.aa, address.bb, address.cc, 0x00, sizeMsb, sizeLsb];
  const checksum = calculateChecksum(addressAndSize);

  return [
    SYSEX_START,
    ROLAND_ID,
    deviceId,
    D110_MODEL_ID,
    D110_COMMANDS.REQUEST,
    address.aa,
    address.bb,
    address.cc,
    0x00,
    sizeMsb,
    sizeLsb,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Parsed SysEx message
 */
export interface ParsedSysEx {
  deviceId: number;
  command: number;
  address: D110Address;
  data: number[];
  isValid: boolean;
  error?: string;
}

/**
 * Parse a SysEx message from the D-110
 *
 * @param message - Raw SysEx message bytes
 * @returns Parsed message or error
 */
export function parseSysExMessage(message: number[]): ParsedSysEx {
  // Minimum message: F0 41 dev 16 cmd AA BB CC [data] chk F7 = 11 bytes minimum
  if (message.length < 11) {
    return {
      deviceId: 0,
      command: 0,
      address: { aa: 0, bb: 0, cc: 0 },
      data: [],
      isValid: false,
      error: `Message too short: ${message.length} bytes`,
    };
  }

  // Verify delimiters
  if (message[0] !== SYSEX_START || message[message.length - 1] !== SYSEX_END) {
    return {
      deviceId: 0,
      command: 0,
      address: { aa: 0, bb: 0, cc: 0 },
      data: [],
      isValid: false,
      error: 'Invalid SysEx delimiters',
    };
  }

  // Verify Roland ID
  if (message[1] !== ROLAND_ID) {
    return {
      deviceId: 0,
      command: 0,
      address: { aa: 0, bb: 0, cc: 0 },
      data: [],
      isValid: false,
      error: `Not a Roland message: manufacturer ID ${message[1].toString(16)}`,
    };
  }

  // Verify D-110 model ID
  if (message[3] !== D110_MODEL_ID) {
    return {
      deviceId: 0,
      command: 0,
      address: { aa: 0, bb: 0, cc: 0 },
      data: [],
      isValid: false,
      error: `Not a D-110 message: model ID ${message[3].toString(16)}`,
    };
  }

  const deviceId = message[2];
  const command = message[4];
  const address: D110Address = {
    aa: message[5],
    bb: message[6],
    cc: message[7],
  };

  // Extract data (everything between address and checksum)
  const data = message.slice(8, message.length - 2);
  const receivedChecksum = message[message.length - 2];

  // Verify checksum
  const addressAndData = [address.aa, address.bb, address.cc, ...data];
  const calculatedChecksum = calculateChecksum(addressAndData);

  if (receivedChecksum !== calculatedChecksum) {
    return {
      deviceId,
      command,
      address,
      data,
      isValid: false,
      error: `Checksum mismatch: received ${receivedChecksum.toString(16)}, calculated ${calculatedChecksum.toString(16)}`,
    };
  }

  return {
    deviceId,
    command,
    address,
    data,
    isValid: true,
  };
}

/**
 * Check if a SysEx message is from a D-110
 *
 * @param message - Raw SysEx message bytes
 * @returns True if message is from a D-110
 */
export function isD110Message(message: number[]): boolean {
  return (
    message.length >= 7 &&
    message[0] === SYSEX_START &&
    message[1] === ROLAND_ID &&
    message[3] === D110_MODEL_ID
  );
}

/**
 * Calculate address for temporary tone data
 *
 * @param partIndex - Part index (0-7)
 * @returns 3-byte address
 */
export function getTempToneAddress(partIndex: number): D110Address {
  if (partIndex < 0 || partIndex > 7) {
    throw new Error(`Invalid part index: ${partIndex}`);
  }

  const location = partIndex * 246;
  return {
    aa: 0x04,
    bb: (location >> 7) & 0x7f,
    cc: location & 0x7f,
  };
}

/**
 * Calculate address for permanent tone data
 *
 * @param toneIndex - Tone index (0-63)
 * @returns 3-byte address
 */
export function getToneRamAddress(toneIndex: number): D110Address {
  if (toneIndex < 0 || toneIndex > 63) {
    throw new Error(`Invalid tone index: ${toneIndex}`);
  }

  return {
    aa: 0x08,
    bb: toneIndex * 2,
    cc: 0x00,
  };
}

/**
 * Calculate address for part timbre data
 *
 * @param partIndex - Part index (0-7, 8 for rhythm)
 * @returns 3-byte address
 */
export function getPartTimbreAddress(partIndex: number): D110Address {
  if (partIndex < 0 || partIndex > 8) {
    throw new Error(`Invalid part index: ${partIndex}`);
  }

  return {
    aa: 0x03,
    bb: partIndex * 0x10,
    cc: 0x00,
  };
}

/**
 * Get address for system parameters
 *
 * @returns 3-byte address
 */
export function getSystemAddress(): D110Address {
  return {
    aa: 0x10,
    bb: 0x00,
    cc: 0x00,
  };
}

/**
 * Calculate address for patch memory
 *
 * @param patchIndex - Patch index (0-63)
 * @returns 3-byte address
 */
export function getPatchAddress(patchIndex: number): D110Address {
  if (patchIndex < 0 || patchIndex > 63) {
    throw new Error(`Invalid patch index: ${patchIndex}`);
  }

  return {
    aa: 0x06,
    bb: patchIndex,
    cc: 0x00,
  };
}

/**
 * Format bytes for debug logging
 *
 * @param bytes - Array of bytes
 * @returns Hex string
 */
export function formatBytes(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}
