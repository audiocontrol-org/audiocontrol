/**
 * @ol-dsp/launch-control-xl3
 *
 * TypeScript library for controlling the Novation Launch Control XL 3
 * hardware MIDI controller.
 *
 * @packageDocumentation
 */

// Main controller class
export { LaunchControlXL3, LaunchControlXL3Options, LaunchControlXL3Events } from './LaunchControlXL3';
export { default } from './LaunchControlXL3';

// Core components
export * from './core/MidiInterface';
export * from './core/SysExParser';
export * from './core/Midimunge';

// Device management
export * from './device/DeviceManager';

// Custom modes
export * from './modes/CustomModeManager';

// Control mapping
export * from './mapping/ControlMapper';

// LED control
export * from './led/LedController';

// Type definitions
export * from './types';

// Utilities
export * from './utils/validators';
export * from './utils/converters';
export * from './utils/helpers';
export * from './utils/bitwise';

// Re-export constants for convenience
export {
  CONTROL_IDS,
  LED_COLORS,
} from './modes/CustomModeManager';

export {
  LED_COLOR_VALUES,
  LED_NOTE_MAP,
} from './led/LedController';

export {
  ValueTransformers,
  RelativeHandlers,
} from './mapping/ControlMapper';

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