/**
 * SysEx message types for Launch Control XL 3 communication
 */

import type { SlotNumber } from './device.js';

// Novation manufacturer ID and device-specific identifiers
export const NOVATION_MANUFACTURER_ID = [0x00, 0x20, 0x29] as const;
export const XL3_DEVICE_ID = [0x02, 0x0D] as const; // Device family and model

// SysEx command types
export type SysExCommand =
  | 'deviceInquiry'
  | 'modeRead'
  | 'modeWrite'
  | 'factoryReset'
  | 'heartbeat'
  | 'versionRequest'
  | 'serialNumberRequest';

// Template literal types for SysEx message validation
export type SysExHeader = `F0 ${string}`;
export type NovationSysExHeader = `F0 00 20 29 ${string}`;
export type XL3SysExHeader = `${NovationSysExHeader} 02 0D ${string}`;

// SysEx message structure
export interface SysExMessageData {
  readonly command: SysExCommand;
  readonly slot?: SlotNumber;
  readonly payload?: readonly number[];
  readonly checksum?: number;
}

// Parsed SysEx message
export interface ParsedSysExMessage {
  readonly manufacturerId: readonly number[];
  readonly deviceId: readonly number[];
  readonly command: SysExCommand;
  readonly slot?: SlotNumber;
  readonly payload: readonly number[];
  readonly checksum: number;
  readonly rawData: readonly number[];
}

// SysEx parsing result
export interface SysExParseResult {
  readonly success: boolean;
  readonly message?: ParsedSysExMessage;
  readonly error?: string;
}

// SysEx command definitions with their opcodes
export const SYSEX_COMMANDS = {
  deviceInquiry: 0x7E, // Standard MIDI device inquiry
  modeRead: 0x45, // Read custom mode from slot
  modeWrite: 0x46, // Write custom mode to slot
  factoryReset: 0x47, // Reset device to factory settings
  heartbeat: 0x48, // Heartbeat/ping command
  versionRequest: 0x49, // Request firmware version
  serialNumberRequest: 0x4A, // Request device serial number
} as const;

export type SysExOpcode = typeof SYSEX_COMMANDS[keyof typeof SYSEX_COMMANDS];

// SysEx message builder options
export interface SysExMessageOptions {
  readonly command: SysExCommand;
  readonly slot?: SlotNumber;
  readonly payload?: readonly number[];
  readonly includeChecksum?: boolean;
}

// Midimunge encoding/decoding for 7-bit safe data transmission
export interface MidimungeResult {
  readonly success: boolean;
  readonly data?: readonly number[];
  readonly error?: string;
  readonly originalLength?: number;
  readonly encodedLength?: number;
}

// Device response types
export interface DeviceInquiryResponse {
  readonly manufacturerId: readonly number[];
  readonly deviceFamily: number;
  readonly deviceModel: number;
  readonly firmwareVersion: readonly number[];
  readonly serialNumber?: readonly number[];
  // Additional properties used in code
  readonly familyCode?: number;
  readonly familyMember?: number;
  readonly softwareRevision?: readonly number[];
}

export interface ModeReadResponse {
  readonly slot: SlotNumber;
  readonly modeData: readonly number[];
  readonly checksum: number;
}

export interface ModeWriteResponse {
  readonly slot: SlotNumber;
  readonly success: boolean;
  readonly error?: string;
}

export interface VersionResponse {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly build?: number;
}

export interface HeartbeatResponse {
  readonly timestamp: number;
  readonly deviceStatus: number;
}