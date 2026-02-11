// Types
export type {
  MidiPortInfo,
  SysExCallback,
  MidiIO,
  ConnectionStatus,
  MidiConnectionState,
  WebMidiAccess,
  BrowserCompatibility,
} from './types';

// Web MIDI utilities
export {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
  openMidiPorts,
} from './WebMidiAdapter';
