/**
 * useLoopEditorSync — bidirectional seam between `useLoopEditor` and the
 * device tone store.
 *
 * Two effects:
 *
 *   1. **Loop-editor → store**: when the loop editor's `loopPoint` or
 *      `endPoint` change AND differ from the tone's current values,
 *      write the updated tone back via `setTone`. Uses prev-refs so
 *      the effect only fires on real change (not on every render).
 *
 *   2. **Store → loop-editor**: when the selected tone changes, call
 *      `loopEditor.resetForNewSamples` so the editor latches onto the
 *      new tone's loop points.
 *
 * Effect-only hook: no return value.
 */

import { useEffect, useRef } from 'react';
import type { SamplerTone } from '@/core/midi/SamplerClient';
import type { useLoopEditor } from '@audiocontrol/loop-editor/ui';

type LoopEditorReturn = ReturnType<typeof useLoopEditor>;

interface UseLoopEditorSyncOptions {
  loopEditor: LoopEditorReturn;
  selectedToneIndex: number | null;
  tones: (SamplerTone | undefined)[];
  setTone: (index: number, tone: SamplerTone, total: number) => void;
  totalTones: number;
}

export function useLoopEditorSync({
  loopEditor,
  selectedToneIndex,
  tones,
  setTone,
  totalTones,
}: UseLoopEditorSyncOptions): void {
  // --- 1. Sync loop-editor changes back to the store ---
  const prevLoopPointRef = useRef(loopEditor.loopPoint);
  const prevEndPointRef = useRef(loopEditor.endPoint);

  useEffect(() => {
    if (selectedToneIndex === null) return;
    const currentTone = tones[selectedToneIndex];
    if (!currentTone) return;

    const loopChanged = loopEditor.loopPoint !== prevLoopPointRef.current;
    const endChanged = loopEditor.endPoint !== prevEndPointRef.current;
    prevLoopPointRef.current = loopEditor.loopPoint;
    prevEndPointRef.current = loopEditor.endPoint;

    if (!loopChanged && !endChanged) return;

    // Only sync if the hook's values differ from the tone's values.
    if (
      loopEditor.loopPoint !== currentTone.wave.loopPoint ||
      loopEditor.endPoint !== currentTone.wave.endPoint
    ) {
      const updatedTone: SamplerTone = {
        ...currentTone,
        wave: {
          ...currentTone.wave,
          loopPoint: loopEditor.loopPoint,
          endPoint: loopEditor.endPoint,
        },
      };
      setTone(selectedToneIndex, updatedTone, totalTones);
    }
  }, [
    loopEditor.loopPoint,
    loopEditor.endPoint,
    selectedToneIndex,
    tones,
    setTone,
    totalTones,
  ]);

  // --- 2. Reset loop editor when the selected tone changes ---
  // Intentionally watches only `selectedToneIndex`. We do NOT want to reset
  // every time the tone object changes (e.g. after a parameter edit), only
  // when the user navigates to a different tone slot.
  //
  // CLAUDE.md deviation: the `react-hooks/exhaustive-deps` rule wants `tones`
  // and `loopEditor` in the dep array. Including them defeats the
  // "reset only on slot navigation" semantic above — `tones` mutates on every
  // device parameter edit and `loopEditor` is a hook return whose identity
  // we treat as a stable seam. The disable is scoped to this specific effect;
  // do not copy this pattern. If this needs to expand, factor the reset call
  // into a stable callback exposed by the loop editor instead.
  useEffect(() => {
    if (selectedToneIndex === null) return;
    const tone = tones[selectedToneIndex];
    if (tone) {
      loopEditor.resetForNewSamples(tone.wave.loopPoint, tone.wave.endPoint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToneIndex]);
}
