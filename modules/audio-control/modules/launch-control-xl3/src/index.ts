/**
 * @fileoverview Launch Control XL 3 TypeScript Library
 *
 * This library provides comprehensive support for the Novation Launch Control XL 3
 * MIDI controller, including device communication, custom mode management,
 * and SysEx protocol implementation.
 *
 * @author OL DSP Team
 * @version 0.1.0
 */

// Core classes - main library interface
export { LaunchControlXL3 } from './core/Device.js';
export { MidiInterface } from './core/MidiInterface.js';
export { SysExParser } from './core/SysExParser.js';
export { Midimunge } from './core/Midimunge.js';
export { MessageQueue } from './core/MessageQueue.js';
export { Protocol } from './core/Protocol.js';

// Data models
export { CustomMode } from './models/CustomMode.js';
export { Control } from './models/Control.js';
export { Template } from './models/Template.js';
export { Mapping } from './models/Mapping.js';
export { Constants } from './models/Constants.js';

// Services - high-level operations
export { DeviceService } from './services/DeviceService.js';
export { ModeManager } from './services/ModeManager.js';
export { ConfigManager } from './services/ConfigManager.js';
export { PresetManager } from './services/PresetManager.js';
export { ValidationService } from './services/ValidationService.js';

// Utilities
export * from './utils/validators.js';
export * from './utils/converters.js';
export * from './utils/helpers.js';
export * from './utils/performance.js';
export * from './utils/bitwise.js';

// Constants (re-export specific items to avoid conflicts)
export {
  DEVICE_CAPABILITIES,
  MIDI_RANGES,
  TIMING,
  SYSEX_OPCODES,
  DEFAULT_CONTROLS,
  ERROR_CODES
} from './utils/constants.js';

// Types - comprehensive type definitions
export type * from './types/index.js';

// Factory functions for common use cases
export { createDevice, createDeviceService } from './factories.js';

// Version and metadata
export const VERSION = '0.1.0';
export const LIBRARY_NAME = '@ol-dsp/launch-control-xl3';
export const SUPPORTED_DEVICE = 'Novation Launch Control XL 3';