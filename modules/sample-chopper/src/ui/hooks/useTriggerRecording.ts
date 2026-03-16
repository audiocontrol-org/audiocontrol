/**
 * Trigger Recording Hook
 *
 * Composes useTriggerInput with slice generation logic.
 * Maintains trigger positions and derives SliceDefinitionOutput[] from them.
 */

import { useState, useCallback, useMemo, type MutableRefObject } from 'react';
import { useTriggerInput, type TriggerState } from '@/ui/hooks/useTriggerInput.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';

export interface UseTriggerRecordingParams {
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

export interface UseTriggerRecordingReturn {
  /** Current trigger state machine state */
  state: TriggerState;
  /** Whether MIDI is available */
  midiAvailable: boolean;
  /** Number of triggers recorded so far */
  triggerCount: number;
  /** Slices derived from trigger positions (available when complete or during recording) */
  recordedSlices: SliceDefinitionOutput[];
  /** Arm the trigger system for recording */
  arm: () => void;
  /** Stop recording early */
  stopRecording: () => void;
  /** Reset to idle and clear all triggers */
  reset: () => void;
}

export function useTriggerRecording({
  playbackPositionRef,
  isPlaying,
  onPlay,
  onStop,
  totalSamples,
  kitLabels,
}: UseTriggerRecordingParams): UseTriggerRecordingReturn {
  const [triggerPositions, setTriggerPositions] = useState<number[]>([]);

  const handleTrigger = useCallback((samplePosition: number) => {
    setTriggerPositions((prev) => [...prev, samplePosition]);
  }, []);

  const triggerInput = useTriggerInput({
    playbackPositionRef,
    isPlaying,
    onPlay,
    onStop,
    onTrigger: handleTrigger,
  });

  const recordedSlices = useMemo((): SliceDefinitionOutput[] => {
    if (triggerPositions.length === 0) return [];

    const labels = kitLabels.split(',').map((s) => s.trim());
    const sorted = [...triggerPositions].sort((a, b) => a - b);

    // Deduplicate positions that are very close together (within 100 samples)
    const deduped: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - deduped[deduped.length - 1] > 100) {
        deduped.push(sorted[i]);
      }
    }

    const slices: SliceDefinitionOutput[] = [];
    for (let i = 0; i < deduped.length; i++) {
      const startSample = deduped[i];
      const endSample = i < deduped.length - 1 ? deduped[i + 1] : totalSamples;
      slices.push({
        label: labels[i % labels.length] ?? `S${i + 1}`,
        startSample,
        endSample,
      });
    }

    return slices;
  }, [triggerPositions, totalSamples, kitLabels]);

  const reset = useCallback(() => {
    triggerInput.reset();
    setTriggerPositions([]);
  }, [triggerInput]);

  return {
    state: triggerInput.state,
    midiAvailable: triggerInput.midiAvailable,
    triggerCount: triggerPositions.length,
    recordedSlices,
    arm: triggerInput.arm,
    stopRecording: triggerInput.stopRecording,
    reset,
  };
}
