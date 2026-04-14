import type { MidiIO, SdsChannel, SdsLoopType, SdsTransferProgress, SdsDumpHeader } from '@audiocontrol/midi-core';
import type { ProgramHeader, KeygroupHeader, SampleHeader, MiscellaneousData } from '@/devices/s3000xl.js';

export type { ProgramHeader, KeygroupHeader, SampleHeader, MiscellaneousData };

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

  /** Bypass all caching — every read fetches fresh from the device. Default: false */
  readonly noCache: boolean;

  /** Dedicated SDS channel for sample transfers (bypasses MidiIO queue). */
  readonly sdsChannel: SdsChannel;
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

  /** Fetch the miscellaneous (global/multi) data block from the device */
  fetchMiscData(): Promise<MiscellaneousData>;

  /** Write modified miscellaneous data back to the device */
  writeMiscData(data: MiscellaneousData): Promise<void>;

  /**
   * Upload a sample via SDS without RSLIST polling or renaming.
   * For batch uploads — caller is responsible for verification and renaming.
   */
  uploadSampleRaw(
    sampleNumber: number,
    sampleData: Int16Array,
    sampleRate: number,
    onProgress?: (progress: SdsTransferProgress) => void,
  ): Promise<void>;

  /** Send a sample to the device via MIDI Sample Dump Standard */
  sendSampleViaSds(
    sampleNumber: number,
    sampleData: Int16Array,
    sampleRate: number,
    options?: {
      name?: string;
      loopStart?: number;
      loopEnd?: number;
      loopType?: SdsLoopType;
      onProgress?: (progress: SdsTransferProgress) => void;
    },
  ): Promise<void>;

  /** Receive a sample from the device via MIDI Sample Dump Standard */
  receiveSampleViaSds(
    sampleNumber: number,
    onProgress?: (progress: SdsTransferProgress) => void,
  ): Promise<{ header: SdsDumpHeader; samples: Int16Array }>;

  /**
   * Create a new keygroup in the specified program.
   *
   * Clones an existing keygroup (or uses the provided template) and sends it
   * to the device with the new keygroup index. The device auto-increments
   * the program's GROUPS count and manages the NXTKG chain.
   *
   * @param programNumber - Index of the program to add the keygroup to
   * @param keygroupNumber - Index for the new keygroup (should equal current GROUPS count)
   * @param template - Optional keygroup header to use as the base; if omitted, keygroup 0 is cloned
   */
  createKeygroup(
    programNumber: number,
    keygroupNumber: number,
    template?: KeygroupHeader,
  ): Promise<void>;

  /**
   * Delete a keygroup from the specified program.
   *
   * Sends the DELK opcode to remove the keygroup at the given index.
   * The device auto-decrements the program's GROUPS count.
   *
   * @param programNumber - Index of the program containing the keygroup
   * @param keygroupNumber - Index of the keygroup to delete
   */
  deleteKeygroup(
    programNumber: number,
    keygroupNumber: number,
  ): Promise<void>;

  /**
   * Create a new program on the device.
   *
   * Clones an existing program (or uses the provided template) and sends it
   * via PDATA with the target program number. Per S1000 SysEx spec: if the
   * program number is above the highest existing program number, a new
   * program is created. The created program will have dummy keygroups.
   *
   * @param programNumber - Target program index (must be >= current program count to create)
   * @param template - Optional program header to use as base; if omitted, program 0 is cloned
   */
  createProgram(
    programNumber: number,
    template?: ProgramHeader,
  ): Promise<void>;

  /**
   * Delete a program and all its keygroups from the device.
   *
   * Sends the DELP opcode to remove the program at the given RPLIST index.
   *
   * @param programNumber - RPLIST index of the program to delete
   */
  deleteProgram(programNumber: number): Promise<void>;

  /** Delete a sample from the device by its RSLIST index */
  deleteSample(sampleNumber: number): Promise<void>;

  /** Rename a sample on the device */
  renameSample(sampleNumber: number, newName: string): Promise<void>;

  /** Rename a program on the device */
  renameProgram(programNumber: number, newName: string): Promise<void>;

  /**
   * Clone a program to a new slot at the end of the RPLIST.
   *
   * Copies the source program header (with a new name) and all its keygroups.
   * Returns the index of the newly created program.
   *
   * @param onProgress - Optional callback for step-by-step progress
   */
  cloneProgram(
    sourceProgramNumber: number,
    newName: string,
    onProgress?: (step: string, current: number, total: number) => void,
  ): Promise<number>;

  /** Force refresh of sample names from device (invalidates cache and re-fetches) */
  refreshSampleNames(): Promise<string[]>;

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
