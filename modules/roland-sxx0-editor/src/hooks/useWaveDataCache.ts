/**
 * useWaveDataCache — per-tone Int16Array sample cache.
 *
 * Owns the lifecycle of decoded 16-bit audio samples for tones whose wave
 * data has been pulled from the device. Used by the loop editor (and any
 * future consumer that needs decoded samples without re-fetching).
 *
 * Responsibilities:
 *   - Cache decoded `Int16Array` keyed by tone index.
 *   - Coalesce loads (no double-fetch if already cached OR in-flight).
 *   - Expose progress + loading flags for UI.
 *   - Provide a range-invalidator for callers that just force-reloaded
 *     a bank (cached samples for those slots are now stale).
 *
 * Decode path: device sends packed 12-bit samples; we unpack to 16-bit
 * once and cache the result. Loop editor and waveform render want 16-bit.
 *
 * Concurrency: cache + in-flight tracking are kept in refs (not state)
 * so the coalesce check always reads live values. With state-only
 * tracking, two rapid `loadWaveData(N)` calls could both pass the
 * `has()` guard against a stale closure and fire duplicate fetches.
 * `setVersion` is bumped on cache writes to trigger consumer re-render.
 */

import { useCallback, useRef, useState, type MutableRefObject } from 'react';
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
  /** True while any load is in flight. */
  isLoading: boolean;
  /** Current load progress as 0-100, or undefined when not loading. */
  progress: number | undefined;
  /**
   * Fetch and cache wave data for a tone slot. No-op if already cached
   * OR if a load for the same index is already in flight.
   *
   * The optional `onProgress` callback receives the same 0-100 percentage
   * that drives the cache's shared `progress` state. Per-call consumers
   * (e.g., the sample-export UI) wire this to their local progress UI so
   * they don't have to re-fetch just to observe transfer progress. When
   * the load is a cache or in-flight hit, `onProgress` is NOT invoked.
   */
  loadWaveData: (toneIndex: number, onProgress?: (pct: number) => void) => Promise<void>;
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
  // Cache and in-flight set live in refs so the coalesce check below
  // always reads live values. Using useState would freeze the closure.
  const cacheRef = useRef<Map<number, Int16Array>>(new Map());
  const inFlightRef = useRef<Set<number>>(new Set());

  // Bump on cache writes / invalidations so `getSamples` consumers re-render.
  const [, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const loadWaveData = useCallback(
    async (
      toneIndex: number,
      onProgress?: (pct: number) => void
    ): Promise<void> => {
      if (!clientRef.current) return;

      // Coalesce against both cached AND in-flight reads. Without the
      // in-flight guard, rapid double-clicks on Load fire two fetches
      // because the first fetch hasn't yet written to the cache.
      if (cacheRef.current.has(toneIndex)) return;
      if (inFlightRef.current.has(toneIndex)) return;

      inFlightRef.current.add(toneIndex);
      setIsLoading(true);
      setProgress(0);
      setError(null);

      try {
        const waveResponse = await clientRef.current.requestWaveData(
          toneIndex,
          (bytesReceived, totalBytes) => {
            const pct = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
            setProgress(pct);
            onProgress?.(pct);
          }
        );

        // Convert from packed 12-bit samples to 16-bit for downstream UI.
        const samples = unpack12BitTo16Bit(waveResponse.data);

        cacheRef.current.set(toneIndex, samples);
        setVersion((v) => v + 1);
      } catch (err) {
        console.error('[useWaveDataCache] Failed to load wave data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load wave data');
      } finally {
        inFlightRef.current.delete(toneIndex);
        if (inFlightRef.current.size === 0) {
          setIsLoading(false);
          setProgress(undefined);
        }
      }
    },
    [clientRef, setError]
  );

  const getSamples = useCallback(
    (toneIndex: number): Int16Array | null => cacheRef.current.get(toneIndex) ?? null,
    []
  );

  const invalidateRange = useCallback((startIndex: number, count: number) => {
    let changed = false;
    for (let i = startIndex; i < startIndex + count; i++) {
      if (cacheRef.current.delete(i)) changed = true;
    }
    if (changed) setVersion((v) => v + 1);
  }, []);

  return { isLoading, progress, loadWaveData, getSamples, invalidateRange };
}
