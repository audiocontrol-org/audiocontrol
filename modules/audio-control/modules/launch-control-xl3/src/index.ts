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

// Type definitions
export type {
  // MIDI types
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
  // Device types
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
  // Protocol types
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
  ProtocolControlType,
  KnobPosition,
  KnobRow,
  ButtonPosition,
  FaderPosition,
  // Custom mode types (canonical)
  CustomMode,
  ControlType,
  ControlBehavior,
  Control,
  CustomModeResponse,
  CustomModeMessage,
  ControlMapping,
  ColorMapping,
  // Convenience types
  CustomModeSlot,
  LedColor,
  LedBehaviour,
  ControlBehaviour
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
 *   enableCustomModes: true,
 * });
 *
 * // Connect to device
 * await controller.connect();
 *
 * // Listen for control changes
 * controller.on('control:change', (controlId, value) => {
 *   console.log(`Control ${controlId} changed to ${value}`);
 * });
 *
 *
 * // Load custom mode
 * const mode = await controller.loadCustomMode(0);
 *
 * // Clean up when done
 * await controller.cleanup();
 * ```
 */
