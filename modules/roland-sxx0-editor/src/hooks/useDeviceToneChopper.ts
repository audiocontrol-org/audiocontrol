/**
 * Hook for opening the sample chopper on a device tone and saving
 * the result as a drum kit to the library.
 */

import { useCallback, useState, type RefObject } from 'react';
import type { ChopperResult, ChopperSavePayload } from '@audiocontrol/sample-chopper/ui';
import { saveSample, createWav, type SampleYaml } from '@audiocontrol/sampler-library/browser';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import type { S330KitConfig } from '@/components/library/S330KitOutputConfig';
import { unpack12BitTo16Bit } from '@/lib/wave-export';
import type { StorageDirectoryHandle } from '@/lib/library-service';

interface UseDeviceToneChopperOptions {
  clientRef: RefObject<SamplerClientInterface | null>;
  libraryDirectoryHandle: StorageDirectoryHandle | null;
}

const DEFAULT_KIT_CONFIG: S330KitConfig = {
  name: '',
  sampleRate: 15000,
  baseNote: 36,
  transpose: 0,
  velocitySensitivity: 2,
};

export function useDeviceToneChopper({ clientRef, libraryDirectoryHandle }: UseDeviceToneChopperOptions) {
  const [chopperOpen, setChopperOpen] = useState(false);
  const [chopperSamples, setChopperSamples] = useState<Int16Array | null>(null);
  const [chopperSampleRate, setChopperSampleRate] = useState(15000);
  const [kitConfig, setKitConfig] = useState<S330KitConfig>(DEFAULT_KIT_CONFIG);
  const [isLoadingWav, setIsLoadingWav] = useState(false);

  const openChopper = useCallback(async (toneIndex: number, tone: SamplerTone) => {
    if (!clientRef.current) return;

    setIsLoadingWav(true);
    try {
      const waveResponse = await clientRef.current.requestWaveData(toneIndex);
      const samples = unpack12BitTo16Bit(waveResponse.data);
      const sampleRate = tone.sampleRate === '30kHz' ? 30000 : 15000;

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
  }, [clientRef]);

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
