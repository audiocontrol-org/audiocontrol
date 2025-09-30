// Re-export types from individual modules (excluding conflicting ones)
export type {
  CCNumber,
  MidiChannel,
  MidiValue,
  NoteNumber,
  Velocity,
  ControlChangeMessage,
  NoteOnMessage,
  NoteOffMessage,
  PitchBendMessage,
  SysExMessage,
  ParsedMidiMessage,
  MidiParseResult,
  MidiEventHandlers
} from './midi.js';

// Export smart constructors (named exports, not types)
export {
  CCNumber as createCCNumber,
  MidiChannel as createMidiChannel,
  MidiValue as createMidiValue,
  NoteNumber as createNoteNumber,
  Velocity as createVelocity
} from './midi.js';

export type {
  SlotNumber,
  DeviceState,
  DeviceOptions,
  RetryPolicy,
  HeartbeatConfig,
  ErrorRecoveryConfig,
  TimeoutConfig,
  DeviceOperationResult,
  DeviceError,
  DeviceErrorCode,
  DeviceCapabilities,
  LaunchControlXL3Info,
  LaunchControlXL3Config,
  DeviceMode,
  DeviceConnectionState
} from './device.js';

export type {
  DeviceInquiryResponse
} from './sysex.js';

// Re-export protocol types (device control definitions)
export type {
  ControlId,
  ControlConfig,
  ControlColor,
  ControlRange,
  ModeTemplate,
  TemplatePreset,
  MidiMapping,
  MidiTarget,
  ValueTransform,
  FactoryPreset,
  PresetCategory,
  ProtocolValidation,
  KnobPosition,
  KnobRow,
  ButtonPosition,
  FaderPosition,
  ControlType as ProtocolControlType
} from './protocol.js';

export {
  DEVICE_LAYOUT,
  DEFAULT_KNOB_CONFIG,
  DEFAULT_BUTTON_CONFIG,
  DEFAULT_FADER_CONFIG
} from './protocol.js';

// Re-export custom mode types (THE canonical CustomMode definition)
export type {
  ControlType,
  CustomMode,
  ControlBehavior,
  Control,
  CustomModeMessage,
  CustomModeResponse,
  ControlMapping,
  ColorMapping
} from './CustomMode.js';

// Additional convenience types
export type CustomModeSlot = number; // 0-15
export type LedColor = string;
export type LedBehaviour = 'static' | 'flash' | 'pulse' | 'flashing' | 'pulsing';
export type ControlBehaviour = 'absolute' | 'relative' | 'toggle';