/**
 * Shared Web MIDI types for AudioControl editors
 */

import type { SdsTransferProgress, SdsDumpHeader } from './sds/sds-types';

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
 * Dedicated channel for SDS (Sample Dump Standard) transfers.
 *
 * Separate from MidiIO because SDS requires tight send-ACK handshaking
 * that cannot share a queue with SysEx parameter commands.
 */
export interface SdsChannel {
  uploadSample(
    sampleNumber: number,
    channel: number,
    sampleRate: number,
    samples: Int16Array,
    onProgress?: (progress: SdsTransferProgress) => void,
  ): Promise<void>;

  downloadSample(
    sampleNumber: number,
    channel: number,
    onProgress?: (progress: SdsTransferProgress) => void,
  ): Promise<{ header: SdsDumpHeader; samples: Int16Array }>;
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
