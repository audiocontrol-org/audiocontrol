/**
 * Web MIDI types for S-330 Editor
 *
 * Re-exports shared MIDI types and defines S-330 specific type alias.
 */

// Re-export shared types
export type {
  MidiPortInfo,
  SysExCallback,
  MidiIO,
  ConnectionStatus,
  MidiConnectionState,
  WebMidiAccess,
  BrowserCompatibility,
} from '@audiocontrol/shared-midi';

// S-330 specific type alias for MidiIO
import type { MidiIO } from '@audiocontrol/shared-midi';
export type S330MidiIO = MidiIO;
