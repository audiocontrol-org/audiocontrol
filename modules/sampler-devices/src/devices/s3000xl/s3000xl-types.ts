import type { MidiIO } from '@audiocontrol/shared-midi';
import type { ProgramHeader, KeygroupHeader, SampleHeader } from '@/devices/s3000xl.js';

export type { ProgramHeader, KeygroupHeader, SampleHeader };

/** Progress callback for long-running operations */
export type ProgressCallback = (current: number, total: number, label?: string) => void;

/**
 * Configuration options for the S3000XL client.
 */
export interface S3000xlClientOptions {
  /** MIDI channel (0-15). Default: 0 */
  readonly channel: number;

  /** Akai device ID byte. Default: 0x48 (S3000XL) */
  readonly deviceId: number;

  /** Timeout in milliseconds for waiting on SysEx responses. Default: 3000 */
  readonly timeoutMs: number;

  /** Delay in milliseconds after write operations to allow device to flush. Default: 150 */
  readonly writeFlushDelayMs: number;

  /** Maximum number of retry attempts for failed commands. Default: 3 */
  readonly maxRetries: number;
}

/**
 * Public API for communicating with an Akai S3000XL sampler over MIDI SysEx.
 *
 * Implementations handle SysEx message construction, response parsing,
 * retry logic, and optional caching.
 */
export interface S3000xlClientInterface {
  /** Fetch the list of all resident program names from the device */
  fetchProgramNames(): Promise<string[]>;

  /** Fetch the list of all resident sample names from the device */
  fetchSampleNames(): Promise<string[]>;

  /** Fetch the program header for the given program number */
  fetchProgramHeader(programNumber: number): Promise<ProgramHeader>;

  /** Fetch the sample header for the given sample number */
  fetchSampleHeader(sampleNumber: number): Promise<SampleHeader>;

  /** Fetch the keygroup header for a specific keygroup within a program */
  fetchKeygroupHeader(
    programNumber: number,
    keygroupNumber: number,
  ): Promise<KeygroupHeader>;

  /** Write a modified program header back to the device */
  writeProgramHeader(header: ProgramHeader): Promise<void>;

  /** Write a modified keygroup header back to the device */
  writeKeygroupHeader(header: KeygroupHeader): Promise<void>;

  /** Write a modified sample header back to the device */
  writeSampleHeader(header: SampleHeader): Promise<void>;

  /** Invalidate any cached program data, forcing a fresh fetch on next request */
  invalidateProgramCache(): void;

  /** Invalidate any cached sample data, forcing a fresh fetch on next request */
  invalidateSampleCache(): void;

  /** Invalidate any cached keygroup data, forcing a fresh fetch on next request */
  invalidateKeygroupCache(): void;

  /** Reset client state and cancel any pending operations */
  panic(): void;

  /** Send a raw opcode + data command and return the response payload */
  sendCommand(opcode: number, data: number[]): Promise<number[]>;
}

/**
 * Factory dependencies for creating an S3000XL client.
 */
export interface S3000xlClientDeps {
  /** MIDI I/O interface for sending and receiving SysEx messages */
  readonly midiIO: MidiIO;

  /** Client configuration options */
  readonly options: S3000xlClientOptions;
}
