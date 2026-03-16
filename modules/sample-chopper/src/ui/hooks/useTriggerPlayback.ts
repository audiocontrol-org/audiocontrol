/**
 * Trigger Playback Hook
 *
 * Polyphonic voice engine for trigger-based slice playback.
 * Supports mono/poly voice modes, one-shot/gate playback, and mute groups.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';

export type PolyphonyMode = 'mono' | 'poly';
export type PlaybackMode = 'one-shot' | 'gate';

export interface TriggerPlaybackConfig {
  polyphony: PolyphonyMode;
  playbackMode: PlaybackMode;
  /** Mute group per slice index. 0 = no mute group. Slices in the same non-zero group choke each other. */
  muteGroups: number[];
}

export const DEFAULT_PLAYBACK_CONFIG: TriggerPlaybackConfig = {
  polyphony: 'poly',
  playbackMode: 'one-shot',
  muteGroups: [],
};

interface Voice {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  sliceIndex: number;
}

export interface UseTriggerPlaybackParams {
  samples: Int16Array | null;
  sampleRate: number;
  slices: SliceDefinitionOutput[];
  config: TriggerPlaybackConfig;
}

export interface UseTriggerPlaybackReturn {
  playSlice: (index: number) => void;
  stopSlice: (index: number) => void;
  stopAll: () => void;
}

export function useTriggerPlayback({
  samples,
  sampleRate,
  slices,
  config,
}: UseTriggerPlaybackParams): UseTriggerPlaybackReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeVoicesRef = useRef<Map<number, Voice>>(new Map());
  const configRef = useRef(config);
  const samplesRef = useRef(samples);
  const slicesRef = useRef(slices);

  configRef.current = config;
  samplesRef.current = samples;
  slicesRef.current = slices;

  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stopVoice = useCallback((sliceIndex: number) => {
    const voice = activeVoicesRef.current.get(sliceIndex);
    if (!voice) return;
    try {
      voice.gainNode.gain.setValueAtTime(0, voice.gainNode.context.currentTime);
      voice.source.stop();
    } catch {
      // already stopped
    }
    voice.source.disconnect();
    voice.gainNode.disconnect();
    activeVoicesRef.current.delete(sliceIndex);
  }, []);

  const stopAll = useCallback(() => {
    for (const sliceIndex of [...activeVoicesRef.current.keys()]) {
      stopVoice(sliceIndex);
    }
  }, [stopVoice]);

  const playSlice = useCallback((index: number) => {
    const currentSamples = samplesRef.current;
    const currentSlices = slicesRef.current;
    const cfg = configRef.current;
    if (!currentSamples || !currentSlices[index]) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const slice = currentSlices[index];

    // Voice stealing based on polyphony mode
    if (cfg.polyphony === 'mono') {
      stopAll();
    } else {
      // Poly: check mute groups
      const group = cfg.muteGroups[index] ?? 0;
      if (group > 0) {
        for (const [activeIndex] of activeVoicesRef.current) {
          if ((cfg.muteGroups[activeIndex] ?? 0) === group) {
            stopVoice(activeIndex);
          }
        }
      }
    }

    // Stop any existing voice for this same slice
    stopVoice(index);

    // Create audio buffer from slice region
    const startSample = slice.startSample;
    const endSample = slice.endSample;
    const portion = currentSamples.slice(startSample, endSample);
    if (portion.length === 0) return;

    const buffer = ctx.createBuffer(1, portion.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < portion.length; i++) {
      channelData[i] = portion[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.onended = () => {
      // Only remove from tracking if this is still the active voice for this slice.
      // A retrigger may have already replaced us in the map.
      const current = activeVoicesRef.current.get(index);
      if (current?.source === source) {
        activeVoicesRef.current.delete(index);
      }
      source.disconnect();
      gainNode.disconnect();
    };

    source.start();
    activeVoicesRef.current.set(index, { source, gainNode, sliceIndex: index });
  }, [sampleRate, getAudioContext, stopAll, stopVoice]);

  const stopSlice = useCallback((index: number) => {
    stopVoice(index);
  }, [stopVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const voice of activeVoicesRef.current.values()) {
        try { voice.source.stop(); } catch { /* */ }
        voice.source.disconnect();
        voice.gainNode.disconnect();
      }
      activeVoicesRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return { playSlice, stopSlice, stopAll };
}
