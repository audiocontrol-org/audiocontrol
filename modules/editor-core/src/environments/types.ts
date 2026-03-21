/**
 * Environment capability interfaces for workflow modules.
 *
 * Workflows declare which capabilities they need via WorkflowEnvironment.
 * Each capability is an interface with browser, Electron, and mock
 * implementations — workflows never reference browser globals directly.
 */

import type { MidiTransport } from '@/transports/types';

// ---------------------------------------------------------------------------
// FileIO
// ---------------------------------------------------------------------------

/**
 * Opaque handle to a file. Implementations define the internal shape.
 */
export interface FileHandle {
  readonly name: string;
  readonly kind: 'file';
}

/**
 * Opaque handle to a directory. Implementations define the internal shape.
 */
export interface DirectoryHandle {
  readonly name: string;
  readonly kind: 'directory';
}

/**
 * Entry in a directory listing.
 */
export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly handle: FileHandle | DirectoryHandle;
}

/**
 * Options for the file picker.
 */
export interface FilePickerOptions {
  /** MIME types to accept (e.g. 'audio/wav'). */
  readonly accept?: Record<string, string[]>;
  /** Whether to allow multiple file selection. */
  readonly multiple?: boolean;
}

/**
 * Read/write files, list directories, pick files and directories.
 */
export interface FileIO {
  pickFile(options?: FilePickerOptions): Promise<FileHandle | null>;
  pickDirectory(): Promise<DirectoryHandle | null>;
  readFile(handle: FileHandle): Promise<ArrayBuffer>;
  writeFile(handle: FileHandle, data: ArrayBuffer | Uint8Array): Promise<void>;
  listDirectory(handle: DirectoryHandle): Promise<DirectoryEntry[]>;
}

// ---------------------------------------------------------------------------
// AudioPlayback
// ---------------------------------------------------------------------------

/**
 * Playback state reported by AudioPlayback.
 */
export interface AudioPlaybackState {
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
}

/**
 * Opaque audio buffer. Implementations define the internal representation.
 */
export interface AudioBuffer {
  readonly sampleRate: number;
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly length: number;
}

/**
 * Options for audio playback.
 */
export interface PlayOptions {
  /** Loop playback continuously until stop() is called. */
  loop?: boolean;
  /** Loop region start in seconds (requires loop: true). */
  loopStart?: number;
  /** Loop region end in seconds (requires loop: true). */
  loopEnd?: number;
}

/**
 * Play audio buffers, control playback, observe state changes.
 */
export interface AudioPlayback {
  play(buffer: AudioBuffer, options?: PlayOptions): void;
  stop(): void;
  seek(time: number): void;
  /** Update loop region on the currently playing source. No-op if not looping. */
  setLoopRegion?(loopStart: number, loopEnd: number): void;
  getState(): AudioPlaybackState;
  onStateChange(handler: ((state: AudioPlaybackState) => void) | null): void;
  createBuffer(
    samples: Float32Array | Int16Array,
    sampleRate: number,
    channels?: number,
  ): AudioBuffer;
}

// ---------------------------------------------------------------------------
// WorkflowEnvironment
// ---------------------------------------------------------------------------

/**
 * Composition bag of capabilities provided to workflow modules.
 * Each field is optional — workflows only declare what they need.
 */
export interface WorkflowEnvironment {
  fileIO?: FileIO;
  audio?: AudioPlayback;
  midi?: MidiTransport;
}
