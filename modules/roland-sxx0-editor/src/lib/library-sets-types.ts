/**
 * Shared callback types for set save/load operations.
 *
 * Split out of `library-sets.ts` so that the incremental-save module
 * can import them without depending on the larger set-operations file.
 */

import type {
  S330Tone,
  S330Patch,
  S330WaveDataResponse,
} from '@/core/midi/S330Client';

/** Callback for fetching tone data from device */
export type FetchToneDataCallback = (toneIndex: number) => Promise<S330Tone | null>;

/** Callback for fetching patch data from device */
export type FetchPatchDataCallback = (patchIndex: number) => Promise<S330Patch | null>;

/** Callback for fetching wave data from device */
export type FetchWaveDataCallback = (
  toneIndex: number,
  onWaveProgress?: (bytesReceived: number, totalBytes: number) => void
) => Promise<S330WaveDataResponse>;
