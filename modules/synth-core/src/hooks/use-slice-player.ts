import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceAllocator } from '@/types/voice-allocator';
import type { OscillatorFactory } from '@/types/oscillator-factory';
import { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
import { createVoiceAllocator } from '@/voice/create-voice-allocator';

export interface SliceDefinition {
  startSample: number;
  endSample: number;
}

export interface UseSlicePlayerParams {
  samples: Int16Array | null;
  sampleRate: number;
  slices: SliceDefinition[];
  muteGroups?: number[];
  playbackMode?: 'one-shot' | 'gate';
  maxPolyphony?: number;
}

export interface UseSlicePlayerReturn {
  playSlice(index: number, velocity?: number): void;
  stopSlice(index: number): void;
  stopAll(): void;
  activeSlices: Set<number>;
  latencyMs: number;
}

const ACTIVE_POLL_INTERVAL_MS = 50;

export function useSlicePlayer(params: UseSlicePlayerParams): UseSlicePlayerReturn {
  const {
    samples,
    sampleRate,
    slices,
    muteGroups,
    playbackMode = 'one-shot',
    maxPolyphony = 16,
  } = params;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const factoryRef = useRef<OscillatorFactory | null>(null);
  const allocatorRef = useRef<VoiceAllocator | null>(null);
  const [activeSlices, setActiveSlices] = useState<Set<number>>(new Set());

  const getOrCreateEngine = useCallback((): {
    factory: OscillatorFactory;
    allocator: VoiceAllocator;
  } | null => {
    if (factoryRef.current && allocatorRef.current) {
      return { factory: factoryRef.current, allocator: allocatorRef.current };
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ latencyHint: 'interactive' });
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const factory = createWebAudioOscillatorFactory(audioCtxRef.current);
    const allocator = createVoiceAllocator(factory, {
      maxPolyphony,
      retrigger: true,
      muteGroups,
      playbackMode,
    });
    factoryRef.current = factory;
    allocatorRef.current = allocator;
    return { factory, allocator };
  }, [maxPolyphony, muteGroups, playbackMode]);

  // Update buffer when samples change
  useEffect(() => {
    if (!samples || sampleRate <= 0) return;
    const engine = getOrCreateEngine();
    if (!engine) return;
    engine.factory.setBuffer(samples, sampleRate);
  }, [samples, sampleRate, getOrCreateEngine]);

  // Recreate allocator when config changes
  useEffect(() => {
    if (!factoryRef.current) return;

    allocatorRef.current?.dispose();
    allocatorRef.current = createVoiceAllocator(factoryRef.current, {
      maxPolyphony,
      retrigger: true,
      muteGroups,
      playbackMode,
    });
  }, [muteGroups, playbackMode, maxPolyphony]);

  // Poll active slices
  useEffect(() => {
    const interval = setInterval(() => {
      if (!allocatorRef.current) return;
      const current = allocatorRef.current.getActiveSlices();
      setActiveSlices(prev => {
        if (prev.size === current.size && [...prev].every(v => current.has(v))) {
          return prev;
        }
        return current;
      });
    }, ACTIVE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      allocatorRef.current?.dispose();
      allocatorRef.current = null;
      factoryRef.current = null;

      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const playSlice = useCallback((index: number, velocity = 127): void => {
    const engine = getOrCreateEngine();
    if (!engine) return;

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const slice = slices[index];
    if (!slice) return;

    engine.allocator.sliceOn(index, slice.startSample, slice.endSample, velocity);
    setActiveSlices(engine.allocator.getActiveSlices());
  }, [getOrCreateEngine, slices]);

  const stopSlice = useCallback((index: number): void => {
    allocatorRef.current?.sliceOff(index);
    setActiveSlices(allocatorRef.current?.getActiveSlices() ?? new Set());
  }, []);

  const stopAll = useCallback((): void => {
    allocatorRef.current?.stopAll();
    setActiveSlices(new Set());
  }, []);

  const latencyMs = audioCtxRef.current
    ? (audioCtxRef.current.baseLatency ?? 0) * 1000
    : 0;

  return {
    playSlice,
    stopSlice,
    stopAll,
    activeSlices,
    latencyMs,
  };
}
