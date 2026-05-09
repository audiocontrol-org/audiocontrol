/**
 * useWaveDataCache — per-tone Int16Array sample cache.
 *
 * Owns the lifecycle of decoded 16-bit audio samples for tones whose wave
 * data has been pulled from the device. Used by the loop editor (and any
 * future consumer that needs decoded samples without re-fetching).
 *
 * Responsibilities:
 *   - Cache decoded `Int16Array` keyed by tone index.
 *   - Coalesce loads (no double-fetch if already cached).
 *   - Expose progress + loading flags for UI.
 *   - Provide a range-invalidator for callers that just force-reloaded
 *     a bank (cached samples for those slots are now stale).
 *
 * Decode path: device sends packed 12-bit samples; we unpack to 16-bit
 * once and cache the result. Loop editor and waveform render want 16-bit.
 */

import { useCallback, useState, type MutableRefObject } from 'react';
import type { SamplerClientInterface } from '@/core/midi/SamplerClient';
import { unpack12BitTo16Bit } from '@/lib/wave-export';

interface UseWaveDataCacheOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  /**
   * Surface load failures to the caller's error channel (e.g. the
   * editor store's `setError`). The cache itself does not own UI error
   * state — it's a side-effect-free getter once a load completes.
   */
  setError: (msg: string | null) => void;
}

export interface UseWaveDataCacheResult {
  /** True while a load is in flight. */
  isLoading: boolean;
  /** Current load progress as 0-100, or undefined when not loading. */
  progress: number | undefined;
  /**
   * Fetch and cache wave data for a tone slot. No-op if already cached.
   * Returns void; call `getSamples` afterwards to read the result.
   */
  loadWaveData: (toneIndex: number) => Promise<void>;
  /** Synchronous read of cached samples, or null if not loaded. */
  getSamples: (toneIndex: number) => Int16Array | null;
  /**
   * Drop cached entries for slots in [startIndex, startIndex + count).
   * Call after a force-reload of a tone bank so subsequent reads
   * re-fetch fresh data.
   */
  invalidateRange: (startIndex: number, count: number) => void;
}

export function useWaveDataCache({
  clientRef,
  setError,
}: UseWaveDataCacheOptions): UseWaveDataCacheResult {
  const [cache, setCache] = useState<Map<number, Int16Array>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const loadWaveData = useCallback(
    async (toneIndex: number): Promise<void> => {
      if (!clientRef.current) return;

      // Coalesce: if already cached, nothing to do.
      if (cache.has(toneIndex)) return;

      setIsLoading(true);
      setProgress(0);
      setError(null);

      try {
        const waveResponse = await clientRef.current.requestWaveData(
          toneIndex,
          (bytesReceived, totalBytes) => {
            const pct = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
            setProgress(pct);
          }
        );

        // Convert from packed 12-bit samples to 16-bit for downstream UI.
        const samples = unpack12BitTo16Bit(waveResponse.data);

        setCache((prev) => {
          const next = new Map(prev);
          next.set(toneIndex, samples);
          return next;
        });
      } catch (err) {
        console.error('[useWaveDataCache] Failed to load wave data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load wave data');
      } finally {
        setIsLoading(false);
        setProgress(undefined);
      }
    },
    [clientRef, cache, setError]
  );

  const getSamples = useCallback(
    (toneIndex: number): Int16Array | null => cache.get(toneIndex) ?? null,
    [cache]
  );

  const invalidateRange = useCallback((startIndex: number, count: number) => {
    setCache((prev) => {
      const next = new Map(prev);
      for (let i = startIndex; i < startIndex + count; i++) {
        next.delete(i);
      }
      return next;
    });
  }, []);

  return { isLoading, progress, loadWaveData, getSamples, invalidateRange };
}
