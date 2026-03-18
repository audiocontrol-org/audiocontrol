/**
 * Trigger Mappings Hook
 *
 * Manages trigger-to-slice index mappings and playback configuration.
 * Three mapping layers merge with last-wins priority:
 *   restored (saved) ← recorded ← learned (MIDI learn)
 */

import { useState, useCallback, useMemo } from 'react';
import type { TriggerId } from '@/ui/hooks/useTriggerInput.js';
import {
  type TriggerPlaybackConfig,
  type PolyphonyMode,
  type PlaybackMode,
  DEFAULT_PLAYBACK_CONFIG,
} from '@/ui/hooks/useTriggerPlayback.js';

export interface TriggerMapping {
  triggerId: TriggerId;
  sliceIndex: number;
}

export interface UseTriggerMappingsParams {
  /** Restored trigger mappings from a saved sample */
  initialTriggers?: TriggerMapping[];
  /** Restored playback config from a saved sample */
  initialPlaybackConfig?: TriggerPlaybackConfig;
  /** Recorded trigger→slice mapping from the recorder hook */
  recordedMapping: Map<TriggerId, number>;
}

export interface UseTriggerMappingsReturn {
  /** Merged effective mapping (restored ← recorded ← learned) */
  effectiveMapping: Map<TriggerId, number>;
  /** Trigger mappings array for saving */
  triggerMappings: TriggerMapping[];
  /** Current playback configuration */
  playbackConfig: TriggerPlaybackConfig;
  /** Set polyphony mode */
  setPolyphony: (mode: PolyphonyMode) => void;
  /** Set playback mode */
  setPlaybackMode: (mode: PlaybackMode) => void;
  /** Set mute group for a slice */
  setMuteGroup: (sliceIndex: number, group: number) => void;
  /** Learn a trigger for a specific slice (MIDI learn) */
  learnTrigger: (sliceIndex: number, triggerId: TriggerId) => void;
  /** Clear a learned trigger for a specific slice */
  clearLearnedTrigger: (sliceIndex: number) => void;
  /** Clear all learned triggers */
  clearAllLearnedTriggers: () => void;
  /** Reset all mappings and playback config to defaults */
  reset: () => void;
}

export function useTriggerMappings({
  initialTriggers,
  initialPlaybackConfig,
  recordedMapping,
}: UseTriggerMappingsParams): UseTriggerMappingsReturn {
  const [playbackConfig, setPlaybackConfig] = useState<TriggerPlaybackConfig>(
    initialPlaybackConfig ?? DEFAULT_PLAYBACK_CONFIG,
  );

  const [learnedMappings, setLearnedMappings] = useState<Map<TriggerId, number>>(new Map());

  // Restored mapping from saved trigger data
  const restoredMapping = useMemo(() => {
    if (!initialTriggers || initialTriggers.length === 0) return null;
    const map = new Map<TriggerId, number>();
    for (const t of initialTriggers) {
      map.set(t.triggerId, t.sliceIndex);
    }
    return map;
  }, [initialTriggers]);

  // Effective mapping: restored ← recorded ← learned (last wins)
  const effectiveMapping = useMemo(() => {
    const merged = new Map<TriggerId, number>();
    if (restoredMapping) {
      for (const [id, idx] of restoredMapping) merged.set(id, idx);
    }
    if (recordedMapping.size > 0) {
      for (const [id, idx] of recordedMapping) merged.set(id, idx);
    }
    for (const [id, idx] of learnedMappings) merged.set(id, idx);
    return merged;
  }, [restoredMapping, recordedMapping, learnedMappings]);

  const triggerMappings = useMemo((): TriggerMapping[] => {
    return [...effectiveMapping.entries()].map(([triggerId, sliceIndex]) => ({
      triggerId,
      sliceIndex,
    }));
  }, [effectiveMapping]);

  const learnTrigger = useCallback((sliceIndex: number, triggerId: TriggerId) => {
    setLearnedMappings((prev) => {
      const next = new Map(prev);
      for (const [id, idx] of next) {
        if (idx === sliceIndex) next.delete(id);
      }
      next.set(triggerId, sliceIndex);
      return next;
    });
  }, []);

  const clearLearnedTrigger = useCallback((sliceIndex: number) => {
    setLearnedMappings((prev) => {
      const next = new Map(prev);
      for (const [id, idx] of next) {
        if (idx === sliceIndex) next.delete(id);
      }
      return next;
    });
  }, []);

  const clearAllLearnedTriggers = useCallback(() => {
    setLearnedMappings(new Map());
  }, []);

  const setPolyphony = useCallback((mode: PolyphonyMode) => {
    setPlaybackConfig((prev) => ({ ...prev, polyphony: mode }));
  }, []);

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    setPlaybackConfig((prev) => ({ ...prev, playbackMode: mode }));
  }, []);

  const setMuteGroup = useCallback((sliceIndex: number, group: number) => {
    setPlaybackConfig((prev) => {
      const muteGroups = [...prev.muteGroups];
      muteGroups[sliceIndex] = group;
      return { ...prev, muteGroups };
    });
  }, []);

  const reset = useCallback(() => {
    setLearnedMappings(new Map());
    setPlaybackConfig(DEFAULT_PLAYBACK_CONFIG);
  }, []);

  return {
    effectiveMapping,
    triggerMappings,
    playbackConfig,
    setPolyphony,
    setPlaybackMode,
    setMuteGroup,
    learnTrigger,
    clearLearnedTrigger,
    clearAllLearnedTriggers,
    reset,
  };
}
