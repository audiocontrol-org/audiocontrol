/**
 * Device constants with const assertions for zero-cost abstractions
 */

// Novation manufacturer and device identification
export const NOVATION_MANUFACTURER_ID = [0x00, 0x20, 0x29] as const;
export const XL3_DEVICE_ID = [0x02, 0x0D] as const;
export const DEVICE_NAME = 'Launch Control XL 3' as const;

// SysEx message constants
export const SYSEX_START = 0xF0 as const;
export const SYSEX_END = 0xF7 as const;

// Device capabilities
export const DEVICE_CAPABILITIES = {
  CUSTOM_MODE_SLOTS: 8,
  KNOBS_TOTAL: 24,
  KNOBS_PER_ROW: 8,
  KNOBS_ROWS: 3,
  BUTTONS_TOTAL: 8,
  FADERS_TOTAL: 8,
  MAX_MIDI_CHANNELS: 16,
  MAX_CC_NUMBERS: 128,
} as const;

// MIDI value ranges
export const MIDI_RANGES = {
  CHANNEL: { MIN: 1, MAX: 16 } as const,
  CC_NUMBER: { MIN: 0, MAX: 127 } as const,
  CC_VALUE: { MIN: 0, MAX: 127 } as const,
  NOTE: { MIN: 0, MAX: 127 } as const,
  VELOCITY: { MIN: 0, MAX: 127 } as const,
  PITCH_BEND: { MIN: 0, MAX: 16383 } as const,
} as const;

// Protocol timing constants
export const TIMING = {
  CONNECTION_TIMEOUT_MS: 5000,
  COMMAND_TIMEOUT_MS: 2000,
  SYSEX_TIMEOUT_MS: 3000,
  HEARTBEAT_INTERVAL_MS: 5000,
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 3,
} as const;

// SysEx command opcodes
export const SYSEX_OPCODES = {
  DEVICE_INQUIRY: 0x7E,
  MODE_READ: 0x45,
  MODE_WRITE: 0x46,
  FACTORY_RESET: 0x47,
  HEARTBEAT: 0x48,
  VERSION_REQUEST: 0x49,
  SERIAL_NUMBER_REQUEST: 0x4A,
} as const;

// Default control configurations
export const DEFAULT_CONTROLS = {
  KNOB: {
    CHANNEL: 1,
    CC_START: 21,
    BEHAVIOR: 'absolute',
  },
  BUTTON: {
    CHANNEL: 1,
    CC_START: 41,
    BEHAVIOR: 'momentary',
  },
  FADER: {
    CHANNEL: 1,
    CC_START: 77,
    BEHAVIOR: 'absolute',
  },
} as const;

// Error codes
export const ERROR_CODES = {
  NO_MIDI_SUPPORT: 'NO_MIDI_SUPPORT',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  COMMAND_TIMEOUT: 'COMMAND_TIMEOUT',
  SYSEX_ERROR: 'SYSEX_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROTOCOL_ERROR: 'PROTOCOL_ERROR',
  DEVICE_BUSY: 'DEVICE_BUSY',
  UNEXPECTED_RESPONSE: 'UNEXPECTED_RESPONSE',
  MIDIMUNGE_ERROR: 'MIDIMUNGE_ERROR',
  CHECKSUM_ERROR: 'CHECKSUM_ERROR',
} as const;