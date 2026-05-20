/**
 * Hook for opening the sample chopper on a device tone and saving
 * the result as a drum kit to the library.
 */

import { useCallback, useState, type RefObject } from 'react';
import type { ChopperResult, ChopperSavePayload } from '@audiocontrol/sample-chopper/ui';
import { saveSample, createWav, type SampleYaml } from '@audiocontrol/sampler-library/browser';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import { toneSampleRateHz } from '@/core/midi/SamplerClient';
import type { S330KitConfig } from '@/components/library/S330KitOutputConfig';
import type { StorageDirectoryHandle } from '@/lib/library-service';
import type { UseWaveDataCacheResult } from '@/hooks/useWaveDataCache';

interface UseDeviceToneChopperOptions {
  clientRef: RefObject<SamplerClientInterface | null>;
  libraryDirectoryHandle: StorageDirectoryHandle | null;
  /**
   * Wave-data cache injected by the page. The chopper reads samples from
   * the cache (cache hit = no device read) and falls through to
   * `loadWaveData` only on miss. Routing through the cache keeps the
   * fetch-and-decode logic in one place; see `useWaveDataCache` JSDoc.
   */
  waveCache: UseWaveDataCacheResult;
}

const DEFAULT_KIT_CONFIG: S330KitConfig = {
  name: '',
  sampleRate: 15000,
  baseNote: 36,
  transpose: 0,
  velocitySensitivity: 2,
};

export function useDeviceToneChopper({
  clientRef,
  libraryDirectoryHandle,
  waveCache,
}: UseDeviceToneChopperOptions) {
  const [chopperOpen, setChopperOpen] = useState(false);
  const [chopperSamples, setChopperSamples] = useState<Int16Array | null>(null);
  const [chopperSampleRate, setChopperSampleRate] = useState(15000);
  const [kitConfig, setKitConfig] = useState<S330KitConfig>(DEFAULT_KIT_CONFIG);
  // Local loading flag: mirrors the chopper open-flow (load + render),
  // not the cache's shared `isLoading` (which is global across consumers).
  // The Chop button gates on this; switching to `waveCache.isLoading` would
  // disable the button while an unrelated loop-editor load is in flight.
  const [isLoadingWav, setIsLoadingWav] = useState(false);

  const openChopper = useCallback(async (toneIndex: number, tone: SamplerTone) => {
    if (!clientRef.current) return;

    setIsLoadingWav(true);
    try {
      // Route through the cache: hits skip the device read, misses
      // fetch + cache. `loadWaveData` is a no-op on cache hit.
      await waveCache.loadWaveData(toneIndex);
      const samples = waveCache.getSamples(toneIndex);
      if (samples === null) {
        // Invariant: cache must contain the entry once `loadWaveData`
        // resolves (success path). Null here means the load failed
        // silently OR the cache was invalidated mid-flight, both of
        // which the cache is expected to surface via `setError`. We
        // refuse to silently fall back; throw with a clear message.
        throw new Error(
          `[useDeviceToneChopper] Cache miss after loadWaveData(${toneIndex}); ` +
            'wave data unavailable.'
        );
      }
      const sampleRate = toneSampleRateHz(tone);

      setChopperSamples(samples);
      setChopperSampleRate(sampleRate);
      setKitConfig((prev) => ({
        ...prev,
        name: prev.name || tone.name.trim().toUpperCase().slice(0, 12),
      }));
      setChopperOpen(true);
    } finally {
      setIsLoadingWav(false);
    }
  }, [clientRef, waveCache]);

  const closeChopper = useCallback(() => {
    setChopperOpen(false);
    setChopperSamples(null);
  }, []);

  const handleConfirm = useCallback(async (_result: ChopperResult) => {
    // Device-specific drum kit storage has been removed.
    // Use handleSave (which saves to the common area) instead.
    throw new Error('Device-specific drum kit storage has been removed. Use Save to Library instead.');
  }, []);

  const handleSave = useCallback(async (payload: ChopperSavePayload) => {
    if (!libraryDirectoryHandle) return;

    const yaml: SampleYaml = {
      format: 'sample',
      version: 1,
      name: payload.name,
      file: 'sample.wav',
      sampleRate: payload.sourceAudio.sampleRate,
      slices: payload.slices.map((s) => ({ label: s.label, startSample: s.startSample, endSample: s.endSample })),
      triggers: payload.triggers,
      playback: payload.playbackConfig,
      modifiedAt: new Date().toISOString(),
    };

    const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);

    try {
      await saveSample(libraryDirectoryHandle, { name: payload.name, yaml, wavData }, []);
      closeChopper();
    } catch (err) {
      console.error('[useDeviceToneChopper] Failed to save chopped sample:', err);
    }
  }, [libraryDirectoryHandle, closeChopper]);

  return {
    chopperOpen,
    chopperSamples,
    chopperSampleRate,
    kitConfig,
    setKitConfig,
    isLoadingWav,
    openChopper,
    closeChopper,
    handleConfirm,
    handleSave,
  };
}
