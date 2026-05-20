/**
 * useToneSampleExport — export a single device tone as a WAV download.
 *
 * Mirrors the `useDeviceToneChopper` shape (DI-by-options, state
 * encapsulated, returns operation handlers) so consumers can compose
 * both hooks against the same `useWaveDataCache` instance without
 * duplicating the cache-then-fetch sequence.
 *
 * Operation flow:
 *   1. Fetch fresh tone data via `clientRef.current.requestToneData` —
 *      we want the live name + sample rate for the filename, not the
 *      stale store value. Tone metadata is a separate SysEx from wave
 *      bytes and is not cached. `requestToneData` resolves to
 *      `SamplerTone | null`; null is a hard failure (we cannot derive
 *      a filename or sample rate without it), surfaced via `setError`.
 *   2. Read decoded samples through `waveCache.getSamples`. On cache
 *      miss, call `loadWaveData(idx, onProgress)` to populate the
 *      cache, then re-read.
 *   3. Invariant guard: if the cache is still empty after `loadWaveData`
 *      resolves, throw with a clear message — the cache is the single
 *      source of truth and a silent fallback would mask a real failure.
 *   4. Build the WAV file and trigger the download via
 *      `exportSamplesAsWav` (centralizes the sanitization rule).
 *   5. Propagate the freshly-fetched tone back to the editor's data
 *      store so subsequent reads see the latest values.
 *
 * The hook is device-agnostic: no S-330 / S-550 conditionals, no model
 * checks. It composes the generic primitives (cache, export helper)
 * the page already has in scope.
 */

import { useCallback, useState, type MutableRefObject } from 'react';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import { toneSampleRateHz } from '@/core/midi/SamplerClient';
import type { UseWaveDataCacheResult } from '@/hooks/useWaveDataCache';
import { exportSamplesAsWav } from '@/lib/wave-export';

interface UseToneSampleExportOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  /**
   * Wave-data cache injected by the page. Required, not optional —
   * routing the wave-bytes path through the shared cache keeps fetch +
   * decode in one place (see `useWaveDataCache` JSDoc and #395).
   */
  waveCache: UseWaveDataCacheResult;
  /**
   * Propagate the freshly-fetched tone back to the editor's data store.
   * Signature matches `useDeviceDataStore.setTone`.
   */
  setTone: (index: number, tone: SamplerTone, totalTones: number) => void;
  /**
   * Surface failures to the caller's error channel (typically the
   * editor store's `setError`).
   */
  setError: (msg: string | null) => void;
  totalTones: number;
}

export interface UseToneSampleExportResult {
  /** True while an export is in flight (fetch + cache load + WAV build). */
  isExporting: boolean;
  /**
   * Current load progress as 0-100 while a cache miss is being filled,
   * or `undefined` when no transfer is in flight (or on cache hit, where
   * there's no transfer to track). The page's progress UI mirrors this.
   */
  exportProgress: number | undefined;
  /**
   * Trigger an export for the given tone slot. Resolves when the WAV
   * download has been initiated (the actual download is browser-managed
   * after `URL.createObjectURL` + click). Errors are surfaced via
   * `setError`; this function does not reject.
   */
  handleExportSample: (selectedToneIndex: number) => Promise<void>;
}

export function useToneSampleExport({
  clientRef,
  waveCache,
  setTone,
  setError,
  totalTones,
}: UseToneSampleExportOptions): UseToneSampleExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | undefined>(undefined);

  const handleExportSample = useCallback(
    async (selectedToneIndex: number): Promise<void> => {
      if (!clientRef.current) return;

      setIsExporting(true);
      setExportProgress(0);
      setError(null);

      try {
        // Fetch fresh tone data for the filename (don't use stale cached data).
        // `requestToneData` may resolve to `null` on transport failure or when
        // the slot is unreadable; we cannot derive a filename or sample rate
        // without it, so refuse to fall back to a synthesised name + default
        // rate (the wrong-rate fallback would be a silent bug).
        const tone = await clientRef.current.requestToneData(selectedToneIndex);
        if (!tone) {
          throw new Error(
            `[useToneSampleExport] requestToneData(${selectedToneIndex}) returned null; ` +
              'cannot determine sample rate or filename for export.',
          );
        }

        let samples = waveCache.getSamples(selectedToneIndex);
        if (samples === null) {
          await waveCache.loadWaveData(selectedToneIndex, (pct) => setExportProgress(pct));
          samples = waveCache.getSamples(selectedToneIndex);
          if (samples === null) {
            // Invariant violation: cache says it has no entry even though
            // `loadWaveData` resolved on the success path. Throw internally
            // so the catch block routes the error through `setError` with
            // the same path as transport failures. Preserves the stack
            // trace and surfaces a single error pathway to the consumer.
            throw new Error(
              `[useToneSampleExport] Cache miss after loadWaveData(${selectedToneIndex}); ` +
                'wave data unavailable for export.',
            );
          }
        } else {
          // Cache hit: nothing to transfer; reflect that in the progress UI.
          setExportProgress(100);
        }

        // Sample rate comes from tone metadata (no wave-data response on cache hit).
        const sampleRate = toneSampleRateHz(tone);

        exportSamplesAsWav(samples, sampleRate, tone.name);

        // Update cached tone data with fresh data.
        setTone(selectedToneIndex, tone, totalTones);
      } catch (err) {
        console.error('[useToneSampleExport] Failed to export sample:', err);
        setError(err instanceof Error ? err.message : 'Failed to export sample');
      } finally {
        setIsExporting(false);
        setExportProgress(undefined);
      }
    },
    [clientRef, waveCache, setTone, setError, totalTones],
  );

  return { isExporting, exportProgress, handleExportSample };
}
