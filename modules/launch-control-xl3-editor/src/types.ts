/**
 * TypeScript interfaces for Novation Launch Control XL 3 MIDI protocol
 * Based on reverse-engineered SysEx communication
 */

// Constants
export const MANUFACTURER_ID = [0x00, 0x20, 0x29] as const; // Focusrite/Novation
export const DEVICE_ID = 0x02; // Launch Control XL 3
export const FIRMWARE_VERSION = 1364; // Example firmware version

// SysEx Commands
export enum SysExCommand {
  CUSTOM_MODE = 0x15,
}

// SysEx Sub-Commands
export enum SysExSubCommand {
  CUSTOM_MODE_DATA = 0x05,
}

// Data Type Identifiers
export enum DataType {
  READ = 0x40,
  WRITE = 0x45,
}

// Control Types
export enum ControlType {
  BUTTON = 0x11,
  ENCODER = 0x19,
  FADER = 0x31,
}

// Slot range: 1-15 (encoded as 0x00-0x0E)
export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/**
 * MIDI Channel type (1-16, encoded as 0-15 in protocol)
 */
export type MidiChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/**
 * MIDI CC number (0-127)
 */
export type CCNumber = number; // 0-127

/**
 * Control definition for a single knob, fader, or button
 */
export interface ControlDefinition {
  id: number; // Control ID (0x10-0x3F range)
  type: ControlType;
  name: string;
  channel: MidiChannel;
  ccNumber: CCNumber;
  minValue: number; // Usually 0
  maxValue: number; // Usually 127
}

/**
 * Complete custom mode configuration
 */
export interface CustomMode {
  name: string;
  controls: ControlDefinition[];
}

/**
 * SysEx message structure for reading custom modes
 */
export interface ReadCustomModeRequest {
  manufacturerId: typeof MANUFACTURER_ID;
  deviceId: typeof DEVICE_ID;
  command: SysExCommand.CUSTOM_MODE;
  subCommand: SysExSubCommand.CUSTOM_MODE_DATA;
  dataType: DataType.READ;
  slot: SlotNumber;
}

/**
 * SysEx message structure for writing custom modes
 */
export interface WriteCustomModeRequest {
  manufacturerId: typeof MANUFACTURER_ID;
  deviceId: typeof DEVICE_ID;
  command: SysExCommand.CUSTOM_MODE;
  subCommand: SysExSubCommand.CUSTOM_MODE_DATA;
  dataType: DataType.WRITE;
  slot: SlotNumber;
  mode: CustomMode;
}

/**
 * Helper function to encode slot number
 */
export function encodeSlot(slot: SlotNumber): number {
  return slot - 1; // Convert 1-15 to 0x00-0x0E
}

/**
 * Helper function to encode MIDI channel
 */
export function encodeChannel(channel: MidiChannel): number {
  return channel - 1; // Convert 1-16 to 0x00-0x0F
}

/**
 * Build a SysEx message for reading a custom mode
 */
export function buildReadRequest(slot: SlotNumber): Uint8Array {
  return new Uint8Array([
    0xF0, // SysEx start
    ...MANUFACTURER_ID,
    DEVICE_ID,
    SysExCommand.CUSTOM_MODE,
    SysExSubCommand.CUSTOM_MODE_DATA,
    0x00, // Reserved
    DataType.READ,
    encodeSlot(slot),
    0x02, // Additional parameter
    0xF7, // SysEx end
  ]);
}

/**
 * Build a SysEx message for writing a custom mode
 * Note: This is simplified - actual implementation needs Midimunge encoding
 */
export function buildWriteRequest(slot: SlotNumber, mode: CustomMode): Uint8Array[] {
  // This would need to:
  // 1. Encode the mode data
  // 2. Apply 7-bit encoding via Midimunge
  // 3. Split into multiple messages if needed
  // 4. Return array of SysEx messages

  throw new Error('Write request building requires Midimunge encoding implementation');
}

/**
 * Known factory preset names
 */
export const FACTORY_PRESETS = [
  'Default Custom Mode',
  'Serum',
  'Arturia',
  'Peak',
  'GForce Bass Station',
  'Circuit Tracks synth',
  'Circuit Tracks mixer',
  'Circuit Rhythm mixer',
  'Digitakt mixer',
  'Digitone mixer',
  'Digitone II synth & mixer',
  'Octatrack amp & mixer',
  'Octatrack effects & cue',
  'OP-XY mixer',
  'OP-XY track',
] as const;

/**
 * Control layout positions on the hardware
 */
export interface ControlLayout {
  // Top row of knobs (Send A)
  sendA: [1, 2, 3, 4, 5, 6, 7, 8];

  // Middle row of knobs (Send B)
  sendB: [9, 10, 11, 12, 13, 14, 15, 16];

  // Bottom row of knobs (Pan/Device)
  panDevice: [17, 18, 19, 20, 21, 22, 23, 24];

  // Faders
  faders: [25, 26, 27, 28, 29, 30, 31, 32];

  // Track Focus buttons
  trackFocus: [33, 34, 35, 36, 37, 38, 39, 40];

  // Track Control buttons
  trackControl: [41, 42, 43, 44, 45, 46, 47, 48];
}

/**
 * LED states for buttons
 */
export enum LEDState {
  OFF = 0x00,
  RED_LOW = 0x01,
  RED_FULL = 0x03,
  AMBER_LOW = 0x11,
  AMBER_FULL = 0x33,
  YELLOW = 0x13,
  GREEN_LOW = 0x10,
  GREEN_FULL = 0x30,
}

/**
 * MIDI port names
 */
export interface MIDIPorts {
  midiIn: 'LCXL3 1 MIDI In';
  midiOut: 'LCXL3 1 MIDI Out';
  dawIn: 'LCXL3 1 DAW In';
  dawOut: 'LCXL3 1 DAW Out';
}