/**
 * Web MIDI API adapter for D-110 SysEx communication
 *
 * Re-exports shared Web MIDI utilities from @audiocontrol/shared-midi
 */

export {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
  openMidiPorts,
} from '@audiocontrol/shared-midi';
