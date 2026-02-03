/**
 * Web MIDI types for S-330 Editor
 */

/**
 * MIDI port information
 */
export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: 'connected' | 'disconnected';
}

/**
 * Callback for SysEx messages
 */
export type SysExCallback = (message: number[]) => void;

/**
 * MIDI I/O interface matching S330MidiIO from sampler-midi
 */
export interface S330MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MIDI connection state
 */
export interface MidiConnectionState {
  status: ConnectionStatus;
  inputPort: MidiPortInfo | null;
  outputPort: MidiPortInfo | null;
  sysExEnabled: boolean;
  error: string | null;
}

/**
 * Web MIDI access result
 */
export interface WebMidiAccess {
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
}
