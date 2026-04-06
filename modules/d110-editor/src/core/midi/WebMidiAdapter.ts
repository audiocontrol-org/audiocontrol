/**
 * Web MIDI API adapter for D-110 SysEx communication
 *
 * Re-exports shared Web MIDI utilities from @audiocontrol/midi-core
 */

export {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
  openMidiPorts,
} from '@audiocontrol/midi-core';
