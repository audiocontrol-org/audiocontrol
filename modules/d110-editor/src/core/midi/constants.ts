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

/**
 * Partial parameter offsets within a partial's 58-byte data block
 * Used for sending individual parameter changes to hardware
 */
export const PARTIAL_PARAM_OFFSETS = {
  // Pitch section (0-7)
  PITCH_COARSE: 0,
  PITCH_FINE: 1,
  PITCH_KEYFOLLOW: 2,
  PITCH_BENDER_SWITCH: 3,
  WAVEFORM: 4,
  PCM_WAVE_NUMBER: 5,
  PULSE_WIDTH: 6,
  PULSE_WIDTH_VELOCITY: 7,

  // Pitch envelope (8-19)
  PITCH_ENV_DEPTH: 8,
  PITCH_ENV_VELOCITY: 9,
  PITCH_ENV_TIME_KF: 10,
  PITCH_ENV_T1: 11,
  PITCH_ENV_T2: 12,
  PITCH_ENV_T3: 13,
  PITCH_ENV_T4: 14,
  PITCH_ENV_L0: 15,
  PITCH_ENV_L1: 16,
  PITCH_ENV_L2: 17,
  PITCH_ENV_SUS_L: 18,
  PITCH_ENV_END_L: 19,

  // TVF section (20-37)
  TVF_CUTOFF: 20,
  TVF_RESONANCE: 21,
  TVF_KEYFOLLOW: 22,
  TVF_BIAS_POINT: 23,
  TVF_BIAS_LEVEL: 24,
  TVF_ENV_DEPTH: 25,
  TVF_ENV_VELOCITY: 26,
  TVF_ENV_DEPTH_KF: 27,
  TVF_ENV_TIME_KF: 28,
  TVF_ENV_T1: 29,
  TVF_ENV_T2: 30,
  TVF_ENV_T3: 31,
  TVF_ENV_T4: 32,
  TVF_ENV_T5: 33,
  TVF_ENV_L1: 34,
  TVF_ENV_L2: 35,
  TVF_ENV_L3: 36,
  TVF_ENV_SUS_L: 37,

  // TVA section (38-54)
  TVA_LEVEL: 38,
  TVA_VELOCITY: 39,
  TVA_BIAS_POINT_1: 40,
  TVA_BIAS_LEVEL_1: 41,
  TVA_BIAS_POINT_2: 42,
  TVA_BIAS_LEVEL_2: 43,
  TVA_ENV_TIME_KF: 44,
  TVA_ENV_T1_VELOCITY: 45,
  TVA_ENV_T1: 46,
  TVA_ENV_T2: 47,
  TVA_ENV_T3: 48,
  TVA_ENV_T4: 49,
  TVA_ENV_T5: 50,
  TVA_ENV_L1: 51,
  TVA_ENV_L2: 52,
  TVA_ENV_L3: 53,
  TVA_ENV_SUS_L: 54,

  // LFO section (55-57)
  LFO_RATE: 55,
  LFO_DEPTH: 56,
  LFO_MOD_SENS: 57,
} as const;

/**
 * Keyfollow curve names for display
 */
export const KEYFOLLOW_NAMES: readonly string[] = [
  '-1',
  '-1/2',
  '-1/4',
  '0',
  '1/8',
  '1/4',
  '3/8',
  '1/2',
  '5/8',
  '3/4',
  '7/8',
  '1',
  '5/4',
  '3/2',
  '2',
  's1',
  's2',
] as const;

/**
 * PCM wave names for Bank A (0-127)
 * From Edisyn D-110 implementation - one-shot and some looped samples
 */
export const PCM_WAVE_NAMES_A: readonly string[] = [
  'Bass Drum-1', 'Bass Drum-2', 'Bass Drum-3', 'Snare Drum-1',
  'Snare Drum-2', 'Snare Drum-3', 'Snare Drum-4', 'Tom Tom-1',
  'Tom Tom-2', 'High Hat', 'High Hat (Loop)', 'Crash Cymbal-1',
  'Crash Cymbal-2 (Loop)', 'Ride Cymbal-1', 'Ride Cymbal-2 (Loop)', 'Cup',
  'China Cymbal-1', 'China Cymbal-2 (Loop)', 'Rim Shot', 'Hand Clap',
  'Mute High Conga', 'Conga', 'Bongo', 'Cowbell',
  'Tambourine', 'Agogo', 'Claves', 'Timbale High',
  'Timbale Low', 'Cabasa', 'Timpani Attack', 'Timpani',
  'Acoustic Piano High', 'Acoustic Piano Low', 'Piano Forte Thump', 'Organ Percussion',
  'Trumpet', 'Lips', 'Trombone', 'Clarinet',
  'Flute High', 'Flute Low', 'Steamer', 'Indian Flute',
  'Breath', 'Vibraphone High', 'Vibraphone Low', 'Marimba',
  'Xylophone High', 'Xylophone Low', 'Kalimba', 'Wind Bell',
  'Chime Bar', 'Hammer', 'Guiro', 'Chink',
  'Nails', 'Fretless Bass', 'Pull Bass', 'Slap Bass',
  'Thump Bass', 'Acoustic Bass', 'Electric Bass', 'Gut Guitar',
  'Steel Guitar', 'Dirty Guitar', 'Pizzicato', 'Harp',
  'Contrabass', 'Cello', 'Violin-1', 'Violin-2',
  'Koto', 'Draw Bars (Loop)', 'High Organ (Loop)', 'Low Organ (Loop)',
  'Trumpet (Loop)', 'Trombone (Loop)', 'Sax-1 (Loop)', 'Sax-2 (Loop)',
  'Reed (Loop)', 'Slap Bass (Loop)', 'Acoustic Bass (Loop)', 'Electric Bass-1 (Loop)',
  'Electric Bass-2 (Loop)', 'Gut Guitar (Loop)', 'Steel Guitar (Loop)', 'Electric Guitar (Loop)',
  'Clav (Loop)', 'Cello (Loop)', 'Violin (Loop)', 'Electric Piano-1 (Loop)',
  'Electric Piano-2 (Loop)', 'Harpsichord-1 (Loop)', 'Harpsichord-2 (Loop)', 'Telephone Bell (Loop)',
  'Female Voice-1 (Loop)', 'Female Voice-2 (Loop)', 'Male Voice-1 (Loop)', 'Male Voice-2 (Loop)',
  'Spectrum-1 (Loop)', 'Spectrum-2 (Loop)', 'Spectrum-3 (Loop)', 'Spectrum-4 (Loop)',
  'Spectrum-5 (Loop)', 'Spectrum-6 (Loop)', 'Spectrum-7 (Loop)', 'Spectrum-8 (Loop)',
  'Spectrum-9 (Loop)', 'Spectrum-10 (Loop)', 'Noise (Loop)', 'Shot-1',
  'Shot-2', 'Shot-3', 'Shot-4', 'Shot-5',
  'Shot-6', 'Shot-7', 'Shot-8', 'Shot-9',
  'Shot-10', 'Shot-11', 'Shot-12', 'Shot-13',
  'Shot-14', 'Shot-15', 'Shot-16', 'Shot-17',
] as const;

/**
 * PCM wave names for Bank B (0-127)
 * From Edisyn D-110 implementation - looped versions and additional samples
 */
export const PCM_WAVE_NAMES_B: readonly string[] = [
  'Bass Drum-1', 'Bass Drum-2', 'Bass Drum-3', 'Snare Drum-1',
  'Snare Drum-2', 'Snare Drum-3', 'Snare Drum-4', 'Tom Tom-1',
  'Tom Tom-2', 'High Hat', 'High Hat (Loop)', 'Crash Cymbal-1',
  'Crash Cymbal-2 (Loop)', 'Ride Cymbal-1', 'Ride Cymbal-2 (Loop)', 'Cup',
  'China Cymbal-1', 'China Cymbal-2 (Loop)', 'Rim Shot', 'Hand Clap',
  'Mute High Conga', 'Conga', 'Bongo', 'Cowbell',
  'Tambourine', 'Agogo', 'Claves', 'Timbale High',
  'Timbale Low', 'Cabasa', 'Loop-1', 'Loop-2',
  'Loop-3', 'Loop-4', 'Loop-5', 'Loop-6',
  'Loop-7', 'Loop-8', 'Loop-9', 'Loop-10',
  'Loop-11', 'Loop-12', 'Loop-13', 'Loop-14',
  'Loop-15', 'Loop-16', 'Loop-17', 'Loop-18',
  'Loop-19', 'Loop-20', 'Loop-21', 'Loop-22',
  'Loop-23', 'Loop-24', 'Loop-25', 'Loop-26',
  'Loop-27', 'Loop-28', 'Loop-29', 'Loop-30',
  'Loop-31', 'Loop-32', 'Loop-33', 'Loop-34',
  'Loop-35', 'Loop-36', 'Loop-37', 'Loop-38',
  'Loop-39', 'Loop-40', 'Loop-41', 'Loop-42',
  'Loop-43', 'Loop-44', 'Loop-45', 'Loop-46',
  'Loop-47', 'Loop-48', 'Loop-49', 'Loop-50',
  'Loop-51', 'Loop-52', 'Loop-53', 'Loop-54',
  'Loop-55', 'Loop-56', 'Loop-57', 'Loop-58',
  'Loop-59', 'Loop-60', 'Loop-61', 'Loop-62',
  'Loop-63', 'Loop-64', 'Jam-1', 'Jam-2',
  'Jam-3', 'Jam-4', 'Jam-5', 'Jam-6',
  'Jam-7', 'Jam-8', 'Jam-9', 'Jam-10',
  'Jam-11', 'Jam-12', 'Jam-13', 'Jam-14',
  'Jam-15', 'Jam-16', 'Jam-17', 'Jam-18',
  'Jam-19', 'Jam-20', 'Jam-21', 'Jam-22',
  'Jam-23', 'Jam-24', 'Jam-25', 'Jam-26',
  'Jam-27', 'Jam-28', 'Jam-29', 'Jam-30',
  'Jam-31', 'Jam-32', 'Jam-33', 'Jam-34',
] as const;

/**
 * Get PCM wave name by bank and number
 */
export function getPcmWaveName(bank: number, waveNumber: number): string {
  if (waveNumber < 0 || waveNumber > 127) return `Wave ${waveNumber + 1}`;
  if (bank === 0) return PCM_WAVE_NAMES_A[waveNumber] ?? `Wave A${waveNumber + 1}`;
  if (bank === 1) return PCM_WAVE_NAMES_B[waveNumber] ?? `Wave B${waveNumber + 1}`;
  return `Wave ${waveNumber + 1}`;
}

/**
 * Part timbre parameter offsets within 16-byte part timbre block
 * Used for sending individual part parameter changes to hardware
 */
export const PART_TIMBRE_OFFSETS = {
  TONE_GROUP: 0,
  TONE_NUMBER: 1,
  KEY_SHIFT: 2,
  FINE_TUNE: 3,
  BENDER_RANGE: 4,
  ASSIGN_MODE: 5,
  OUTPUT_ASSIGN: 6,
  // Offset 7 is reserved
  OUTPUT_LEVEL: 8,
  PAN: 9,
  KEY_RANGE_LOWER: 10,
  KEY_RANGE_UPPER: 11,
} as const;

/**
 * System parameter offsets within 33-byte system block
 * Used for sending individual system parameter changes to hardware
 */
export const SYSTEM_PARAM_OFFSETS = {
  MASTER_TUNE: 0,
  REVERB_MODE: 1,
  REVERB_TIME: 2,
  REVERB_LEVEL: 3,
  // Partial reserve for 9 parts (8 + rhythm)
  PARTIAL_RESERVE_1: 4,
  PARTIAL_RESERVE_2: 5,
  PARTIAL_RESERVE_3: 6,
  PARTIAL_RESERVE_4: 7,
  PARTIAL_RESERVE_5: 8,
  PARTIAL_RESERVE_6: 9,
  PARTIAL_RESERVE_7: 10,
  PARTIAL_RESERVE_8: 11,
  PARTIAL_RESERVE_RHYTHM: 12,
  // MIDI channels for 9 parts (8 + rhythm)
  MIDI_CHANNEL_1: 13,
  MIDI_CHANNEL_2: 14,
  MIDI_CHANNEL_3: 15,
  MIDI_CHANNEL_4: 16,
  MIDI_CHANNEL_5: 17,
  MIDI_CHANNEL_6: 18,
  MIDI_CHANNEL_7: 19,
  MIDI_CHANNEL_8: 20,
  MIDI_CHANNEL_RHYTHM: 21,
  // Patch name (10 bytes)
  PATCH_NAME: 22,
} as const;

/**
 * D-110 Preset A tone names (64 tones)
 * Factory preset tones in bank A
 */
export const PRESET_A_TONE_NAMES: readonly string[] = [
  'Acou Piano1', 'Acou Piano2', 'Acou Piano3', 'Elec Piano1',
  'Elec Piano2', 'Elec Piano3', 'Elec Piano4', 'Honkytonk',
  'Elec Org 1', 'Elec Org 2', 'Elec Org 3', 'Elec Org 4',
  'Pipe Org 1', 'Pipe Org 2', 'Pipe Org 3', 'Accordion',
  'Harpsi 1', 'Harpsi 2', 'Harpsi 3', 'Clav 1',
  'Clav 2', 'Clav 3', 'Celesta 1', 'Celesta 2',
  'Syn Brass1', 'Syn Brass2', 'Syn Brass3', 'Syn Brass4',
  'Syn Bass 1', 'Syn Bass 2', 'Syn Bass 3', 'Syn Bass 4',
  'Fantasy', 'Harmo Pan', 'Chorale', 'Glasses',
  'Soundtrack', 'Atmosphere', 'Warm Bell', 'Funny Vox',
  'Echo Bell', 'Ice Rain', 'Oboe 2001', 'Echo Pan',
  'Doctor Solo', 'Schooldaze', 'Bellsinger', 'SquareWave',
  'Str Sect 1', 'Str Sect 2', 'Str Sect 3', 'Pizzicato',
  'Violin 1', 'Violin 2', 'Cello 1', 'Cello 2',
  'Contrabass', 'Harp 1', 'Harp 2', 'Guitar 1',
  'Guitar 2', 'Elec Gtr 1', 'Elec Gtr 2', 'Sitar',
] as const;

/**
 * D-110 Preset B tone names (64 tones)
 * Factory preset tones in bank B
 */
export const PRESET_B_TONE_NAMES: readonly string[] = [
  'Acou Bass1', 'Acou Bass2', 'Elec Bass1', 'Elec Bass2',
  'Slap Bass1', 'Slap Bass2', 'Fretless 1', 'Fretless 2',
  'Flute 1', 'Flute 2', 'Piccolo', 'Pan Flute',
  'Blow Pipe', 'Bottleblow', 'Breathpipe', 'Whistle',
  'Sax 1', 'Sax 2', 'Sax 3', 'Sax 4',
  'Clarinet 1', 'Clarinet 2', 'Oboe', 'Engl Horn',
  'Bassoon', 'Harmonica', 'Trumpet 1', 'Trumpet 2',
  'Trombone 1', 'Trombone 2', 'Fr Horn 1', 'Fr Horn 2',
  'Tuba', 'Brs Sect 1', 'Brs Sect 2', 'Vibe 1',
  'Vibe 2', 'Syn Mallet', 'Windbell', 'Glock',
  'Tube Bell', 'Xylophone', 'Marimba', 'Koto',
  'Sho', 'Shakuhachi', 'Whistle 2', 'Breathpipe2',
  'Timpani', 'Melodic Tom', 'Deep Snare', 'Elec Perc 1',
  'Elec Perc 2', 'Taiko', 'Taiko Rim', 'Cymbal',
  'Castanets', 'Triangle', 'Orche Hit', 'Telephone',
  'Bird Tweet', 'One Note Jam', 'Water Bells', 'Jungle Tune',
] as const;

/**
 * Get tone name by group and number
 * @param group - Tone group (0=Preset A, 1=Preset B, 2=Internal, 3=Card)
 * @param number - Tone number (0-63)
 * @returns Tone name or generic label for Internal/Card
 */
export function getToneName(group: number, number: number): string {
  if (number < 0 || number > 63) return `Tone ${number + 1}`;

  // Ensure group is treated as a number (handles enum values)
  const groupNum = Number(group);

  if (groupNum === 0) {
    // Preset A
    return PRESET_A_TONE_NAMES[number] ?? `Preset A ${number + 1}`;
  } else if (groupNum === 1) {
    // Preset B
    return PRESET_B_TONE_NAMES[number] ?? `Preset B ${number + 1}`;
  } else if (groupNum === 2) {
    // Internal
    return `Internal ${number + 1}`;
  } else if (groupNum === 3) {
    // Card
    return `Card ${number + 1}`;
  }

  return `Tone ${number + 1}`;
}
