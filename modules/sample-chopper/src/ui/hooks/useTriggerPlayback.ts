/**
 * Trigger Playback Hook
 *
 * Polyphonic voice engine for trigger-based slice playback.
 * Supports mono/poly voice modes, one-shot/gate playback, and mute groups.
 *
 * Delegates to synth-core's useSlicePlayer for audio engine internals.
 */

import { useCallback, useMemo } from 'react';
import { useSlicePlayer } from '@audiocontrol/synth-core';
import type { SliceDefinition } from '@audiocontrol/synth-core';
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
  /** Audio output latency in milliseconds (baseLatency + outputLatency), null if context not yet created */
  latencyMs: number | null;
}

export function useTriggerPlayback({
  samples,
  sampleRate,
  slices,
  config,
}: UseTriggerPlaybackParams): UseTriggerPlaybackReturn {
  const sliceDefinitions: SliceDefinition[] = useMemo(
    () => slices.map(s => ({ startSample: s.startSample, endSample: s.endSample })),
    [slices],
  );

  const maxPolyphony = config.polyphony === 'mono' ? 1 : 16;

  const player = useSlicePlayer({
    samples,
    sampleRate,
    slices: sliceDefinitions,
    muteGroups: config.muteGroups,
    playbackMode: config.playbackMode,
    maxPolyphony,
  });

  const playSlice = useCallback((index: number) => {
    player.playSlice(index);
  }, [player.playSlice]);

  const stopSlice = useCallback((index: number) => {
    player.stopSlice(index);
  }, [player.stopSlice]);

  const latencyMs = player.latencyMs === 0 ? null : player.latencyMs;

  return { playSlice, stopSlice, stopAll: player.stopAll, latencyMs };
}
