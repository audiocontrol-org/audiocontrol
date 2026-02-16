/**
 * Launch Control XL 3 MIDI library for Web MIDI API
 *
 * This library provides TypeScript/JavaScript support for communicating with
 * the Novation Launch Control XL 3 MIDI controller via the Web MIDI API.
 *
 * Based on reverse-engineered SysEx protocol from the official web editor.
 */

// Export all types
export * from './types';

// Export Midimunge encoding/decoding functions
export * from './midimunge';

// Export the main client
export { LaunchControlXL3Client } from './client';

// Re-export commonly used items for convenience
export {
  MANUFACTURER_ID,
  DEVICE_ID,
  SysExCommand,
  SysExSubCommand,
  DataType,
  ControlType,
  LEDState,
  FACTORY_PRESETS,
} from './types';

export {
  eightToSeven,
  sevenToEight,
  encodeString,
  decodeString,
  validateSysEx,
  chunkSysEx,
} from './midimunge';

/**
 * Quick start example
 *
 * ```typescript
 * import { LaunchControlXL3Client } from '@/launch-control-xl3';
 *
 * const client = new LaunchControlXL3Client();
 *
 * // Connect to device
 * await client.connect();
 *
 * // Read custom mode from slot 3
 * const mode = await client.readCustomMode(3);
 *
 * // Set up event handlers
 * client.onControlChange = (channel, cc, value) => {
 *   console.log(`CC ${cc}: ${value}`);
 * };
 * ```
 */