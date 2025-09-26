/**
 * @ol-dsp/launch-control-xl3
 *
 * TypeScript library for controlling the Novation Launch Control XL 3
 * hardware MIDI controller.
 *
 * @packageDocumentation
 */

// Main controller class
export { LaunchControlXL3 } from './LaunchControlXL3.js';
export type { LaunchControlXL3Options, LaunchControlXL3Events } from './LaunchControlXL3.js';
export { default } from './LaunchControlXL3.js';

// Core components
export * from './core/MidiInterface.js';
export * from './core/SysExParser.js';
export * from './core/Midimunge.js';

// Device management
export * from './device/DeviceManager.js';

// Custom modes
export * from './modes/CustomModeManager.js';

// Builders
export { CustomModeBuilder, Color } from './builders/CustomModeBuilder.js';

// Control mapping
export * from './mapping/ControlMapper.js';

// LED control
export * from './led/LedController.js';

// Type definitions (exclude types already exported by core modules)
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
  ParsedMidiMessage,
  MidiParseResult,
  MidiEventHandlers,
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
  DeviceConnectionState,
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
  LowLevelControlType,
  LowLevelCustomMode,
  CustomMode,
  ControlBehavior,
  Control,
  CustomModeResponse,
  ProtocolCustomMode,
  ProtocolControlType,
  CustomModeSlot,
  LedColor,
  LedBehaviour,
  ControlBehaviour,
  ControlType
} from './types/index.js';

export {
  createCCNumber,
  createMidiChannel,
  createMidiValue,
  createNoteNumber,
  createVelocity,
  DEVICE_LAYOUT,
  DEFAULT_KNOB_CONFIG,
  DEFAULT_BUTTON_CONFIG,
  DEFAULT_FADER_CONFIG
} from './types/index.js';

// Utilities
export * from './utils/validators.js';
export * from './utils/converters.js';
export * from './utils/helpers.js';
export * from './utils/bitwise.js';

// Re-export constants for convenience
export {
  CONTROL_IDS,
  LED_COLORS,
} from './modes/CustomModeManager.js';

export {
  LED_COLOR_VALUES,
  LED_NOTE_MAP,
} from './led/LedController.js';

export {
  ValueTransformers,
  RelativeHandlers,
} from './mapping/ControlMapper.js';

// Version information
export const VERSION = '0.1.0';
export const LIBRARY_NAME = '@ol-dsp/launch-control-xl3';
export const SUPPORTED_DEVICE = 'Novation Launch Control XL 3';

/**
 * Quick start example:
 *
 * ```typescript
 * import { LaunchControlXL3 } from '@ol-dsp/launch-control-xl3';
 *
 * // Create controller instance
 * const controller = new LaunchControlXL3({
 *   autoConnect: true,
 *   enableLedControl: true,
 *   enableCustomModes: true,
 * });
 *
 * // Initialize and connect
 * await controller.initialize();
 *
 * // Listen for control changes
 * controller.on('control:change', (controlId, value) => {
 *   console.log(`Control ${controlId} changed to ${value}`);
 * });
 *
 * // Set LED colors
 * await controller.setLed('FOCUS1', 'GREEN_FULL');
 *
 * // Load custom mode
 * const mode = await controller.loadCustomMode(0);
 *
 * // Clean up when done
 * await controller.cleanup();
 * ```
 */