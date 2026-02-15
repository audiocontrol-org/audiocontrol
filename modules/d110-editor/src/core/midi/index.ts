/**
 * D-110 MIDI module
 *
 * Exports all MIDI-related types, constants, and functions for
 * communicating with the Roland D-110 synthesizer.
 */

// Types
export type {
  MidiPortInfo,
  SysExCallback,
  D110MidiIO,
  ConnectionStatus,
  MidiConnectionState,
  WebMidiAccess,
  D110Address,
  PartialStructure,
  PartialMutes,
  PitchEnvelope,
  TvfEnvelope,
  TvaEnvelope,
  LfoParams,
  PartialParams,
  ToneCommon,
  D110Tone,
  PartConfig,
  SystemParams,
  D110Patch,
  D110ClientOptions,
  D110ClientInterface,
} from '@/core/midi/types';

// Enums (export as values, which also exports the types)
export {
  ToneGroup,
  AssignMode,
  OutputAssign,
  ReverbMode,
} from '@/core/midi/types';

// Constants
export {
  ROLAND_ID,
  D110_MODEL_ID,
  DEFAULT_DEVICE_ID,
  SYSEX_START,
  SYSEX_END,
  D110_COMMANDS,
  D110_ADDRESSES,
  TONE_DATA_SIZE,
  PART_TIMBRE_SIZE,
  SYSTEM_PARAMS_SIZE,
  PATCH_DATA_SIZE,
  NUM_PARTS,
  NUM_PARTIALS,
  PARTIAL_OFFSETS,
  PARTIAL_PARAM_SIZE,
  COMMON_PARAMS_SIZE,
  TONE_NAME_LENGTH,
  PATCH_NAME_LENGTH,
  TIMING,
  PARAM_RANGES,
  WAVEFORM_TYPES,
  PCM_BANKS,
  STRUCTURE_PCM_FLAGS,
  STRUCTURE_NAMES,
  REVERB_MODE_NAMES,
  TONE_GROUP_NAMES,
  ASSIGN_MODE_NAMES,
  OUTPUT_ASSIGN_NAMES,
  isPartialPCM,
} from '@/core/midi/constants';

// SysEx utilities
export {
  calculateChecksum,
  buildDT1Message,
  buildRQ1Message,
  parseSysExMessage,
  isD110Message,
  getTempToneAddress,
  getToneRamAddress,
  getPartTimbreAddress,
  getSystemAddress,
  getPatchAddress,
  formatBytes,
} from '@/core/midi/sysex';

export type { ParsedSysEx } from '@/core/midi/sysex';

// Web MIDI adapter
export {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
  openMidiPorts,
} from '@/core/midi/WebMidiAdapter';

// D-110 client
export { createD110Client } from '@/core/midi/D110Client';

// Node.js adapter (for testing with easymidi)
export { createEasymidiAdapter, findMidiPort } from '@/core/midi/EasymidiAdapter';
