/**
 * Trigger Recorder Hook
 *
 * Recording workflow only — wraps useTriggerInput to capture trigger events
 * at playback positions and derive SliceDefinitionOutput[] from them.
 *
 * Key fix: recordedSlices returns the ACTUAL computed slices from trigger
 * events (the internal memo), not a passthrough of input slices.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useTriggerInput,
  type TriggerState,
  type TriggerId,
} from '@/ui/hooks/useTriggerInput.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';
import type { MutableRefObject } from 'react';

interface TriggerEvent {
  samplePosition: number;
  triggerId: TriggerId;
}

export interface UseTriggerRecorderParams {
  /** Ref for low-latency playback position reads */
  playbackPositionRef: MutableRefObject<number | null>;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start audio playback (full sample) */
  onPlay: () => void;
  /** Stop audio playback */
  onStop: () => void;
  /** Total number of samples in the audio */
  totalSamples: number;
  /** Kit labels (comma-separated) for naming slices */
  kitLabels: string;
}

export interface UseTriggerRecorderReturn {
  /** Current trigger state machine state */
  state: TriggerState;
  /** Whether MIDI is available */
  midiAvailable: boolean;
  /** Number of triggers recorded so far */
  triggerCount: number;
  /** Slices derived from trigger positions (the actual computed slices) */
  recordedSlices: SliceDefinitionOutput[];
  /** Trigger ID → slice index mapping from recorded events */
  triggerToSliceIndex: Map<TriggerId, number>;
  /** Arm the trigger system for recording */
  arm: () => void;
  /** Stop recording early */
  stopRecording: () => void;
  /** Reset to idle and clear all triggers */
  reset: () => void;
}

export function useTriggerRecorder({
  playbackPositionRef,
  isPlaying,
  onPlay,
  onStop,
  totalSamples,
  kitLabels,
}: UseTriggerRecorderParams): UseTriggerRecorderReturn {
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);

  const handleTrigger = useCallback((samplePosition: number, triggerId: TriggerId) => {
    setTriggerEvents((prev) => [...prev, { samplePosition, triggerId }]);
  }, []);

  const triggerInput = useTriggerInput({
    playbackPositionRef,
    isPlaying,
    onPlay,
    onStop,
    onTrigger: handleTrigger,
  });

  // Build slices and trigger→slice mapping from recorded events
  const { recordedSlices, triggerToSliceIndex } = useMemo(() => {
    if (triggerEvents.length === 0) {
      return {
        recordedSlices: [] as SliceDefinitionOutput[],
        triggerToSliceIndex: new Map<TriggerId, number>(),
      };
    }

    const labels = kitLabels.split(',').map((s) => s.trim());

    // Sort events by position, deduplicate close positions (within 100 samples)
    const sorted = [...triggerEvents].sort((a, b) => a.samplePosition - b.samplePosition);
    const deduped: TriggerEvent[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].samplePosition - deduped[deduped.length - 1].samplePosition > 100) {
        deduped.push(sorted[i]);
      }
    }

    const slices: SliceDefinitionOutput[] = [];
    const mapping = new Map<TriggerId, number>();

    for (let i = 0; i < deduped.length; i++) {
      const startSample = deduped[i].samplePosition;
      const endSample = i < deduped.length - 1 ? deduped[i + 1].samplePosition : totalSamples;
      slices.push({
        label: labels[i % labels.length] ?? `S${i + 1}`,
        startSample,
        endSample,
      });
      if (!mapping.has(deduped[i].triggerId)) {
        mapping.set(deduped[i].triggerId, i);
      }
    }

    return { recordedSlices: slices, triggerToSliceIndex: mapping };
  }, [triggerEvents, totalSamples, kitLabels]);

  const reset = useCallback(() => {
    triggerInput.reset();
    setTriggerEvents([]);
  }, [triggerInput]);

  return {
    state: triggerInput.state,
    midiAvailable: triggerInput.midiAvailable,
    triggerCount: triggerEvents.length,
    recordedSlices,
    triggerToSliceIndex,
    arm: triggerInput.arm,
    stopRecording: triggerInput.stopRecording,
    reset,
  };
}
