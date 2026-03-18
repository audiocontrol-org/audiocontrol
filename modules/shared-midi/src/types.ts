/**
 * Shared Web MIDI types for AudioControl editors
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
 * Generic MIDI I/O interface for SysEx communication
 *
 * This interface is device-agnostic and can be used by any
 * synthesizer/sampler editor that needs SysEx support.
 */
export interface MidiIO {
  /** Send a MIDI message (typically SysEx) */
  send(message: number[]): void;

  /** Register a callback for incoming SysEx messages */
  onSysEx(callback: SysExCallback): void;

  /** Remove a previously registered SysEx callback */
  removeSysExListener(callback: SysExCallback): void;
}

/**
 * Connection status for MIDI devices
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
 * Result from requesting Web MIDI access
 */
export interface WebMidiAccess {
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
}

/**
 * Browser compatibility information
 */
export interface BrowserCompatibility {
  supported: boolean;
  browser: string;
  notes: string;
  requiresSecureContext?: boolean;
}
