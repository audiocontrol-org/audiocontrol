/**
 * Roland D-110 MIDI constants
 *
 * Based on analysis of the Edisyn implementation and D-110 documentation.
 */

/**
 * Roland manufacturer ID
 */
export const ROLAND_ID = 0x41;

/**
 * D-110 model ID
 */
export const D110_MODEL_ID = 0x16;

/**
 * Default device ID (0x10 = device 17 in 1-indexed terms)
 */
export const DEFAULT_DEVICE_ID = 0x10;

/**
 * SysEx delimiters
 */
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

/**
 * D-110 command types
 */
export const D110_COMMANDS = {
  /** RQ1 - Data request */
  REQUEST: 0x11,
  /** DT1 - Data set */
  DATA: 0x12,
} as const;

/**
 * Memory area addresses (first byte, AA)
 */
export const D110_ADDRESSES = {
  /** Temporary timbre area (part configurations) */
  TIMBRE: 0x03,
  /** Temporary tone area (working tones) */
  TEMP_TONE: 0x04,
  /** Patch memory (64 patches) */
  PATCH: 0x06,
  /** Tone RAM (64 permanent tones) */
  TONE_RAM: 0x08,
  /** System parameters */
  SYSTEM: 0x10,
} as const;

/**
 * Tone data size in bytes
 */
export const TONE_DATA_SIZE = 246;

/**
 * Part timbre data size in bytes
 */
export const PART_TIMBRE_SIZE = 0x10; // 16 bytes

/**
 * System parameters size in bytes
 */
export const SYSTEM_PARAMS_SIZE = 33;

/**
 * Patch data size in bytes
 */
export const PATCH_DATA_SIZE = 138;

/**
 * Number of parts (excluding rhythm)
 */
export const NUM_PARTS = 8;

/**
 * Number of partials per tone
 */
export const NUM_PARTIALS = 4;

/**
 * Partial offsets within tone data
 */
export const PARTIAL_OFFSETS = [0x0e, 0x48, 0x82, 0xbc] as const;

/**
 * Partial parameter size in bytes
 */
export const PARTIAL_PARAM_SIZE = 58;

/**
 * Common parameters size in bytes
 */
export const COMMON_PARAMS_SIZE = 14;

/**
 * Tone name length
 */
export const TONE_NAME_LENGTH = 10;

/**
 * Patch name length
 */
export const PATCH_NAME_LENGTH = 10;

/**
 * Timing constants (milliseconds)
 */
export const TIMING = {
  /** Default timeout for SysEx operations */
  TIMEOUT_MS: 2000,
  /** Delay between SysEx messages */
  MESSAGE_DELAY_MS: 50,
  /** Delay after sending a parameter */
  PARAM_DELAY_MS: 20,
} as const;

/**
 * Parameter ranges
 */
export const PARAM_RANGES = {
  /** Standard 0-100 range (most parameters) */
  STANDARD: { min: 0, max: 100 },
  /** Pitch coarse (C1-C9 in semitones) */
  PITCH_COARSE: { min: 0, max: 96 },
  /** Resonance */
  RESONANCE: { min: 0, max: 30 },
  /** Keyfollow settings */
  KEYFOLLOW: { min: 0, max: 16 },
  /** Bender range */
  BENDER_RANGE: { min: 0, max: 12 },
  /** Output level */
  OUTPUT_LEVEL: { min: 0, max: 100 },
  /** Pan (L50-R50 mapped to 0-100) */
  PAN: { min: 0, max: 100 },
  /** Key range (MIDI note numbers) */
  KEY_RANGE: { min: 0, max: 127 },
  /** Partial reserve (per part) */
  PARTIAL_RESERVE: { min: 0, max: 32 },
  /** MIDI channel (1-16) */
  MIDI_CHANNEL: { min: 1, max: 16 },
  /** Reverb time */
  REVERB_TIME: { min: 0, max: 7 },
  /** Reverb level */
  REVERB_LEVEL: { min: 0, max: 7 },
} as const;

/**
 * Waveform types
 */
export const WAVEFORM_TYPES = {
  SQUARE: 0,
  SAWTOOTH: 1,
} as const;

/**
 * PCM bank selection (in waveform byte)
 */
export const PCM_BANKS = {
  BANK_A: 0,
  BANK_B: 1,
} as const;

/**
 * Structure (algorithm) names
 */
export const STRUCTURE_NAMES: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
] as const;

/**
 * Reverb mode names
 */
export const REVERB_MODE_NAMES: readonly string[] = [
  'Room 1',
  'Room 2',
  'Hall 1',
  'Hall 2',
  'Plate',
  'Delay',
  'Pan Delay',
  'Off',
] as const;

/**
 * Tone group names
 */
export const TONE_GROUP_NAMES: readonly string[] = [
  'Preset A',
  'Preset B',
  'Internal',
  'Card',
] as const;

/**
 * Assign mode names
 */
export const ASSIGN_MODE_NAMES: readonly string[] = [
  'Poly 1',
  'Poly 2',
  'Poly 3',
  'Poly 4',
] as const;

/**
 * Output assign names
 */
export const OUTPUT_ASSIGN_NAMES: readonly string[] = [
  'Mix',
  'Rev',
  'Dir 1',
  'Dir 2',
] as const;
